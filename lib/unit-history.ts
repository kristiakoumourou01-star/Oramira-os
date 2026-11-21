import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Charge, HistoryEvent, OwnerPeriod, Tenancy, UnitHistory } from '@/lib/unit-history-shared';

/**
 * Πλήρες ιστορικό μιας μονάδας από όλες τις πηγές: δημιουργία, κρατήσεις,
 * συμβόλαια, πληρωμές, ιδιοκτήτες στον χρόνο, ενοικιάσεις, παράδοση, αιτήματα
 * συντήρησης, χρεώσεις και έγγραφα — ταξινομημένο από το πιο πρόσφατο.
 * Ανθεκτικό: όποιος πίνακας λείπει απλώς παραλείπεται.
 */
export async function loadUnitHistory(unitId: string): Promise<UnitHistory> {
  const s = (await createSupabaseServerClient()) as any;
  const safe = async (q: PromiseLike<{ data: any; error: any }>) => { try { const r = await q; return r.error ? null : r.data; } catch { return null; } };

  const unit = await safe(s.from('units').select('id, created_at, status, handover_status, handover_date, buyer_contact_id, occupancy_status, owner:buyer_contact_id(full_name)').eq('id', unitId).maybeSingle());
  const fee = await safe(s.from('units').select('annual_maintenance_fee').eq('id', unitId).maybeSingle());

  const [reservations, contracts, ownership, ownershipRich, tenancies, tickets, charges, documents, statusLog] = await Promise.all([
    safe(s.from('reservations').select('id, reserved_at, status, deposit_amount, expired_at, buyer_contact_id, contacts(full_name)').eq('unit_id', unitId).order('reserved_at', { ascending: false })),
    safe(s.from('contracts').select('id, created_at, signed_at, status, total_price, buyer_contact_id, contacts(full_name)').eq('unit_id', unitId)),
    safe(s.from('unit_ownership_history').select('id, transfer_date, created_at, note, previous_contact_id, new_contact_id, next:new_contact_id(full_name)').eq('unit_id', unitId).order('transfer_date', { ascending: true }).order('created_at', { ascending: true })),
    safe(s.from('unit_ownership_history').select('id, kind, price').eq('unit_id', unitId)),
    safe(s.from('unit_tenancies').select('id, tenant_contact_id, tenant_name, start_date, end_date, monthly_rent, deposit, status, notes, created_at, tenant:tenant_contact_id(full_name)').eq('unit_id', unitId).order('start_date', { ascending: false })),
    safe(s.from('maintenance_tickets').select('id, title, category, status, created_at, resolved_at').eq('unit_id', unitId)),
    safe(s.from('unit_charges').select('id, kind, description, amount, status, due_date, period_year, created_at, paid_at, ticket_id, contact:contact_id(full_name)').eq('unit_id', unitId).order('created_at', { ascending: false })),
    safe(s.from('documents').select('id, title, created_at').eq('entity_type', 'unit').eq('entity_id', unitId)),
    safe(s.from('activity_log').select('id, action, metadata, created_at').eq('entity_type', 'unit').eq('entity_id', unitId).eq('action', 'status_changed').order('created_at', { ascending: false }).limit(30)),
  ]);
  const contractIds = ((contracts ?? []) as any[]).map((c) => c.id);
  const payments = contractIds.length ? await safe(s.from('payments').select('id, amount_paid, paid_at, method').in('contract_id', contractIds)) : [];

  const ev: HistoryEvent[] = [];
  if (unit?.created_at) ev.push({ id: 'created', at: unit.created_at, kind: 'created', title: 'Η μονάδα δημιουργήθηκε' });
  for (const r of (reservations ?? []) as any[]) {
    ev.push({ id: `r_${r.id}`, at: r.reserved_at, kind: 'reservation', title: 'Κράτηση', person: r.contacts?.full_name ?? null, personId: r.buyer_contact_id, amount: r.deposit_amount != null ? Number(r.deposit_amount) : null });
    if (['cancelled', 'expired'].includes(r.status) && r.expired_at) ev.push({ id: `re_${r.id}`, at: r.expired_at, kind: 'reservation_end', title: r.status === 'expired' ? 'Η κράτηση έληξε' : 'Η κράτηση ακυρώθηκε', person: r.contacts?.full_name ?? null, personId: r.buyer_contact_id });
  }
  for (const c of (contracts ?? []) as any[]) {
    ev.push({ id: `c_${c.id}`, at: c.created_at, kind: 'contract', title: 'Συμβόλαιο πώλησης', person: c.contacts?.full_name ?? null, personId: c.buyer_contact_id, amount: c.total_price != null ? Number(c.total_price) : null });
    if (c.signed_at) ev.push({ id: `cs_${c.id}`, at: c.signed_at, kind: 'contract_signed', title: 'Υπογραφή συμβολαίου', person: c.contacts?.full_name ?? null, personId: c.buyer_contact_id });
  }
  for (const p of (payments ?? []) as any[]) ev.push({ id: `p_${p.id}`, at: p.paid_at, kind: 'payment', title: 'Πληρωμή', amount: Number(p.amount_paid), detail: p.method ?? null });

  const rich = new Map(((ownershipRich ?? []) as any[]).map((o) => [o.id, o]));
  const owners: OwnerPeriod[] = [];
  for (const o of (ownership ?? []) as any[]) {
    const x = rich.get(o.id) ?? {};
    const at = o.transfer_date ?? o.created_at;
    if (o.new_contact_id) ev.push({ id: `o_${o.id}`, at, kind: 'owner', title: x.kind === 'resale' ? 'Μεταπώληση — νέος ιδιοκτήτης' : x.kind === 'sale' ? 'Πώληση — ιδιοκτήτης' : x.kind === 'inheritance' ? 'Κληρονομιά — νέος ιδιοκτήτης' : 'Νέος ιδιοκτήτης', person: o.next?.full_name ?? null, personId: o.new_contact_id, amount: x.price != null ? Number(x.price) : null, detail: o.note });
    else ev.push({ id: `o_${o.id}`, at, kind: 'owner_removed', title: 'Αφαίρεση ιδιοκτήτη', detail: o.note });
    if (owners.length) owners[owners.length - 1].to = at;
    if (o.new_contact_id) owners.push({ id: o.id, contactId: o.new_contact_id, name: o.next?.full_name ?? null, from: at, to: null, kind: x.kind ?? null, price: x.price != null ? Number(x.price) : null, note: o.note ?? null });
  }
  // Ιδιοκτήτης χωρίς εγγραφή ιστορικού (π.χ. πώληση πριν υπάρξει το ιστορικό).
  if (unit?.buyer_contact_id && !owners.some((o) => o.contactId === unit.buyer_contact_id && !o.to)) {
    owners.push({ id: 'current', contactId: unit.buyer_contact_id, name: unit.owner?.full_name ?? null, from: null, to: null, kind: null, price: null, note: null });
  }

  const tens: Tenancy[] = ((tenancies ?? []) as any[]).map((t) => {
    const name = t.tenant?.full_name ?? t.tenant_name ?? null;
    if (t.start_date) ev.push({ id: `ts_${t.id}`, at: t.start_date, kind: 'tenancy_start', title: 'Ενοικίαση — αρχή', person: name, personId: t.tenant_contact_id, amount: t.monthly_rent != null ? Number(t.monthly_rent) : null });
    if (t.end_date && (t.status === 'ended' || t.end_date <= new Date().toISOString().slice(0, 10))) ev.push({ id: `te_${t.id}`, at: t.end_date, kind: 'tenancy_end', title: 'Ενοικίαση — λήξη', person: name, personId: t.tenant_contact_id });
    return { id: t.id, tenantContactId: t.tenant_contact_id, tenantName: name, startDate: t.start_date, endDate: t.end_date, monthlyRent: t.monthly_rent != null ? Number(t.monthly_rent) : null, deposit: t.deposit != null ? Number(t.deposit) : null, status: t.status, notes: t.notes };
  });

  if (unit?.handover_status === 'completed' || unit?.handover_date) {
    if (unit.handover_date) ev.push({ id: 'handover', at: unit.handover_date, kind: 'handover', title: unit.handover_status === 'completed' ? 'Παράδοση κλειδιών' : 'Προγραμματισμένη παράδοση' });
  }
  for (const t of (tickets ?? []) as any[]) {
    ev.push({ id: `t_${t.id}`, at: t.created_at, kind: 'ticket', title: 'Αίτημα συντήρησης', detail: t.title });
    if (t.resolved_at) ev.push({ id: `tr_${t.id}`, at: t.resolved_at, kind: 'ticket_resolved', title: 'Το αίτημα ολοκληρώθηκε', detail: t.title });
  }
  const chs: Charge[] = ((charges ?? []) as any[]).map((c) => {
    ev.push({ id: `ch_${c.id}`, at: c.created_at, kind: 'charge', title: c.kind === 'maintenance_fee' ? 'Χρέωση ετήσιας συντήρησης' : 'Χρέωση στον ιδιοκτήτη', detail: c.description, amount: Number(c.amount), person: c.contact?.full_name ?? null });
    if (c.paid_at) ev.push({ id: `chp_${c.id}`, at: c.paid_at, kind: 'charge_paid', title: 'Η χρέωση πληρώθηκε', detail: c.description, amount: Number(c.amount) });
    return { id: c.id, kind: c.kind, description: c.description, amount: Number(c.amount), status: c.status, dueDate: c.due_date, periodYear: c.period_year, createdAt: c.created_at, paidAt: c.paid_at, ticketId: c.ticket_id, contactName: c.contact?.full_name ?? null };
  });
  for (const d of (documents ?? []) as any[]) ev.push({ id: `d_${d.id}`, at: d.created_at, kind: 'document', title: 'Έγγραφο', detail: d.title });
  const ST: Record<string, string> = { available: 'Διαθέσιμη', reserved: 'Κρατημένη', sold: 'Πωλημένη', handed_over: 'Παραδόθηκε', blocked: 'Μη διαθέσιμη' };
  for (const a of (statusLog ?? []) as any[]) if (a.metadata?.to && ST[a.metadata.to]) ev.push({ id: `s_${a.id}`, at: a.created_at, kind: 'status', title: 'Αλλαγή κατάστασης', sub: ST[a.metadata.to] });

  ev.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  const current = owners.find((o) => !o.to && o.contactId) ?? null;
  return {
    events: ev.filter((e) => e.at),
    owners: owners.reverse(),
    currentOwner: current?.contactId ? { id: current.contactId, name: current.name } : null,
    tenancies: tens,
    charges: chs,
    annualFee: fee?.annual_maintenance_fee != null ? Number(fee.annual_maintenance_fee) : null,
    occupancy: unit?.occupancy_status ?? null,
    ready: tenancies !== null && fee !== null,
  };
}

/** Ακίνητα ενός πελάτη: ως αγοραστής/ιδιοκτήτης (τώρα ή παλιότερα) και ως ενοικιαστής. */
export interface ContactProperty { unitId: string; projectId: string; label: string; role: 'owner' | 'former_owner' | 'buyer' | 'tenant'; since: string | null; until: string | null }
export async function loadContactProperties(contactId: string): Promise<ContactProperty[]> {
  const s = (await createSupabaseServerClient()) as any;
  const safe = async (q: PromiseLike<{ data: any; error: any }>) => { try { const r = await q; return r.error ? [] : r.data ?? []; } catch { return []; } };
  const [owned, history, tenancies, contracts] = await Promise.all([
    safe(s.from('units').select('id, project_id, unit_number, projects(name)').eq('buyer_contact_id', contactId)),
    safe(s.from('unit_ownership_history').select('unit_id, transfer_date, created_at, previous_contact_id, new_contact_id, units(id, project_id, unit_number, projects(name))').or(`new_contact_id.eq.${contactId},previous_contact_id.eq.${contactId}`)),
    safe(s.from('unit_tenancies').select('unit_id, start_date, end_date, status, units(id, project_id, unit_number, projects(name))').eq('tenant_contact_id', contactId)),
    safe(s.from('contracts').select('unit_id, created_at, units(id, project_id, unit_number, projects(name))').eq('buyer_contact_id', contactId)),
  ]);
  const label = (u: any) => [u?.projects?.name, u?.unit_number].filter(Boolean).join(' — ');
  const out = new Map<string, ContactProperty>();
  for (const u of owned as any[]) out.set(`o_${u.id}`, { unitId: u.id, projectId: u.project_id, label: label(u), role: 'owner', since: null, until: null });
  for (const h of history as any[]) {
    const u = h.units; if (!u) continue;
    const at = h.transfer_date ?? h.created_at;
    if (h.new_contact_id === contactId && out.has(`o_${u.id}`)) out.get(`o_${u.id}`)!.since = at;
    if (h.previous_contact_id === contactId && !out.has(`o_${u.id}`)) out.set(`f_${u.id}`, { unitId: u.id, projectId: u.project_id, label: label(u), role: 'former_owner', since: null, until: at });
  }
  for (const c of contracts as any[]) { const u = c.units; if (u && !out.has(`o_${u.id}`) && !out.has(`f_${u.id}`)) out.set(`b_${u.id}`, { unitId: u.id, projectId: u.project_id, label: label(u), role: 'buyer', since: c.created_at, until: null }); }
  for (const t of tenancies as any[]) { const u = t.units; if (u) out.set(`t_${u.id}_${t.start_date}`, { unitId: u.id, projectId: u.project_id, label: label(u), role: 'tenant', since: t.start_date, until: t.end_date }); }
  return Array.from(out.values());
}
