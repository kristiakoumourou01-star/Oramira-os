import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Company Knowledge Graph — connects the entities that the modules keep in
 * separate tables (leads, clients, owners, projects, units, contractors,
 * employees, negotiations, tasks, payments) into relationship intelligence:
 * cross-role contacts (an owner who is also a live lead = upsell), repeat
 * buyers, and a per-contact 360° connection map.
 */

type Client = SupabaseClient<Database>;

export interface GraphNodeCount { type: string; count: number }
export interface GraphHighlight { title: string; detail: string; href: string | null; severity: 'opportunity' | 'info' }
export interface KnowledgeOverview { nodes: GraphNodeCount[]; edges: number; highlights: GraphHighlight[] }

export interface ContactConnection { relation: string; label: string; href: string | null }
export interface ContactGraph { contactId: string; name: string; roles: string[]; connections: ContactConnection[] }

export async function getKnowledgeOverview(supabase: Client): Promise<KnowledgeOverview> {
  const [leads, contacts, homeowners, investors, buyers, projects, units, contractors, employees, negotiations, tasks, payments, reservations, contracts] = await Promise.all([
    supabase.from('leads').select('id, contact_id, status'),
    supabase.from('contacts').select('id, full_name'),
    supabase.from('homeowners').select('contact_id, unit_id'),
    supabase.from('investors').select('contact_id'),
    supabase.from('buyers').select('contact_id'),
    supabase.from('projects').select('id'),
    supabase.from('units').select('id'),
    supabase.from('contractors').select('id'),
    supabase.from('profiles').select('id').in('role', ['admin', 'sales', 'management', 'finance', 'construction', 'property', 'hr']),
    supabase.from('negotiations').select('id'),
    supabase.from('tasks').select('id'),
    supabase.from('payments').select('id'),
    supabase.from('reservations').select('id, buyer_contact_id'),
    supabase.from('contracts').select('id, buyer_contact_id'),
  ]);

  const nameById = new Map((contacts.data ?? []).map((c) => [c.id, c.full_name ?? 'Contact']));
  const homeownerContacts = new Set((homeowners.data ?? []).map((h) => h.contact_id));
  const investorContacts = new Set((investors.data ?? []).map((i) => i.contact_id));
  const activeLeadByContact = new Map<string, string>();
  for (const l of leads.data ?? []) if (!['won', 'lost'].includes(l.status)) activeLeadByContact.set(l.contact_id, l.id);

  const nodes: GraphNodeCount[] = [
    { type: 'Leads', count: (leads.data ?? []).length },
    { type: 'Contacts', count: (contacts.data ?? []).length },
    { type: 'Owners', count: (homeowners.data ?? []).length },
    { type: 'Investors', count: (investors.data ?? []).length },
    { type: 'Projects', count: (projects.data ?? []).length },
    { type: 'Units', count: (units.data ?? []).length },
    { type: 'Contractors', count: (contractors.data ?? []).length },
    { type: 'Employees', count: (employees.data ?? []).length },
    { type: 'Negotiations', count: (negotiations.data ?? []).length },
    { type: 'Tasks', count: (tasks.data ?? []).length },
    { type: 'Payments', count: (payments.data ?? []).length },
  ];
  const edges = (leads.data ?? []).length + (homeowners.data ?? []).length + (investors.data ?? []).length + (buyers.data ?? []).length + (reservations.data ?? []).length + (contracts.data ?? []).length + (negotiations.data ?? []).length;

  const highlights: GraphHighlight[] = [];

  // Cross-sell: existing owners who are also active leads (a second purchase).
  for (const contactId of homeownerContacts) {
    const leadId = activeLeadByContact.get(contactId);
    if (leadId) highlights.push({ title: `${nameById.get(contactId) ?? 'Owner'} — owner & active lead`, detail: 'Existing owner with a live enquiry — strong second-purchase / referral opportunity.', href: `/crm/leads/${leadId}`, severity: 'opportunity' });
  }
  // Investors who are also active leads.
  for (const contactId of investorContacts) {
    const leadId = activeLeadByContact.get(contactId);
    if (leadId && !homeownerContacts.has(contactId)) highlights.push({ title: `${nameById.get(contactId) ?? 'Investor'} — investor & active lead`, detail: 'Known investor is back in the funnel — prioritise and tailor to portfolio goals.', href: `/crm/leads/${leadId}`, severity: 'opportunity' });
  }
  // Repeat buyers — contacts on 2+ reservations/contracts.
  const buyerCount = new Map<string, number>();
  for (const r of reservations.data ?? []) buyerCount.set(r.buyer_contact_id, (buyerCount.get(r.buyer_contact_id) ?? 0) + 1);
  for (const c of contracts.data ?? []) buyerCount.set(c.buyer_contact_id, (buyerCount.get(c.buyer_contact_id) ?? 0) + 1);
  for (const [contactId, n] of buyerCount) if (n >= 2) highlights.push({ title: `${nameById.get(contactId) ?? 'Buyer'} — repeat buyer (${n})`, detail: 'Multiple reservations/contracts — a portfolio relationship worth nurturing directly.', href: null, severity: 'info' });

  return { nodes, edges, highlights: highlights.slice(0, 12) };
}

/** 360° connection map for one contact across every module. */
export async function getContactGraph(supabase: Client, contactId: string): Promise<ContactGraph | null> {
  const { data: contact } = await supabase.from('contacts').select('id, full_name').eq('id', contactId).maybeSingle();
  if (!contact) return null;

  const [leadsRes, homeownerRes, investorRes, reservationsRes, viewingsRes, commsRes] = await Promise.all([
    supabase.from('leads').select('id, status').eq('contact_id', contactId),
    supabase.from('homeowners').select('id, unit_id, units(unit_number, projects(name))').eq('contact_id', contactId),
    supabase.from('investors').select('id, investor_type').eq('contact_id', contactId),
    supabase.from('reservations').select('id, status, units(unit_number)').eq('buyer_contact_id', contactId),
    supabase.from('viewings').select('id, scheduled_at, projects(name)').eq('contact_id', contactId),
    supabase.from('contact_communications').select('id', { count: 'exact', head: true }).eq('contact_id', contactId),
  ]);

  const roles: string[] = [];
  if ((leadsRes.data ?? []).length) roles.push('Lead');
  if ((homeownerRes.data ?? []).length) roles.push('Owner');
  if ((investorRes.data ?? []).length) roles.push('Investor');
  if ((reservationsRes.data ?? []).length) roles.push('Buyer');

  const connections: ContactConnection[] = [];
  for (const l of leadsRes.data ?? []) connections.push({ relation: 'Lead', label: `Enquiry · ${l.status}`, href: `/crm/leads/${l.id}` });
  for (const h of homeownerRes.data ?? []) connections.push({ relation: 'Owns', label: `${(h as any).units?.projects?.name ?? 'Unit'} · ${(h as any).units?.unit_number ?? ''}`.trim(), href: '/property' });
  for (const r of reservationsRes.data ?? []) connections.push({ relation: 'Reserved', label: `Unit ${(r as any).units?.unit_number ?? '—'} · ${r.status}`, href: null });
  for (const v of viewingsRes.data ?? []) connections.push({ relation: 'Viewed', label: `${(v as any).projects?.name ?? 'Property'}`, href: null });
  const commsCount = (commsRes as any).count ?? 0;
  if (commsCount) connections.push({ relation: 'Communications', label: `${commsCount} logged`, href: null });

  return { contactId, name: contact.full_name ?? 'Contact', roles, connections };
}
