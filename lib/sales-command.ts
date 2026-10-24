import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getEnrichedLeads, type LeadListItem } from '@/lib/leads';
import { selectResilient } from '@/lib/db-resilient';

/**
 * Sales Command Center — one execution-first, revenue-first read of the sales
 * floor. Pulls the live CRM tables into six operational boards: lead urgency,
 * follow-up deadlines, today's viewing prep, active negotiations, reservation
 * expiry, and per-agent performance. Pure aggregation (RLS-safe via the
 * caller's client); every item carries a concrete next action.
 */

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_PIPE = ['viewing', 'offer', 'negotiating', 'reserved'];
const SPEED_WINDOW_MIN = 15; // first-response SLA
const STALL_DAYS = 7;

export interface UrgencyLead {
  id: string; name: string; urgency: number; reasons: string[];
  budget: number | null; owner: string | null; waitedMinutes: number | null; stalledDays: number | null; phone: string | null;
}
export interface FollowUpItem { id: string; note: string; dueAt: string; leadId: string | null; name: string | null; priority: 'high' | 'medium' | 'low' }
export interface ViewingPrep {
  id: string; time: string; leadId: string | null; contact: string; project: string | null; unit: string | null;
  meetingLink: string | null; reminderSent: boolean; notes: string | null; documents: string[]; nextAction: string;
}
export interface NegotiationItem {
  id: string; leadId: string; name: string; unit: string | null; offered: number | null; counter: number | null; agreed: number | null;
  paymentTerms: string | null; objections: string | null; latestComm: string | null; latestCommAt: string | null; nextActionDeadline: string | null; nextAction: string;
}
export interface ReservationItem {
  id: string; buyer: string; unit: string | null; deposit: number | null; depositPaid: boolean; expiresAt: string | null;
  daysLeft: number | null; contractPending: boolean; status: string; urgentLegal: string | null;
}
export interface AgentScore {
  agentId: string; name: string; responseSpeedMin: number | null; conversionPct: number; pipelineValue: number;
  viewingsBooked: number; reservationsClosed: number; commissionPending: number; leads: number; won: number;
}
export interface SalesCommand {
  urgency: { firstResponseOverdue: UrgencyLead[]; hot: UrgencyLead[]; stalled: UrgencyLead[] };
  followUps: { overdue: FollowUpItem[]; today: FollowUpItem[]; upcoming: FollowUpItem[] };
  viewingPrep: ViewingPrep[];
  negotiations: NegotiationItem[];
  reservations: ReservationItem[];
  agents: AgentScore[];
  counts: { urgent: number; followUpsOverdue: number; viewingsToday: number; negotiations: number; reservationsExpiring: number };
}

const money = (n: number | null | undefined) => (n == null ? null : Number(n));

export async function buildSalesCommand(supabase: Client): Promise<SalesCommand> {
  const now = Date.now();
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [leads, followRes, viewRes, negRes, resvRes, commRes, profRes, rawLeadsData] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('follow_up_tasks').select('id, note, due_at, lead_id, contacts(full_name)').eq('is_done', false).order('due_at', { ascending: true }).limit(200),
    supabase.from('viewings').select('id, scheduled_at, status, lead_id, notes, meeting_link, reminder_sent_at, contacts(full_name), projects(name), units(unit_number)').gte('scheduled_at', todayStart.toISOString()).lte('scheduled_at', todayEnd.toISOString()).order('scheduled_at', { ascending: true }),
    supabase.from('negotiations').select('id, lead_id, offered_price, counter_offer, agreed_price, payment_terms, notes, created_at, units(unit_number, projects(name)), leads(status, contact_id, contacts(full_name))').is('agreed_price', null).order('created_at', { ascending: false }).limit(60),
    supabase.from('reservations').select('id, status, deposit_amount, deposit_paid, expires_at, converted_contract_id, contacts:buyer_contact_id(full_name), units(unit_number, projects(name))').in('status', ['active', 'pending']).order('expires_at', { ascending: true }).limit(60),
    supabase.from('commissions').select('profile_id, amount, status'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']),
    // Resilient: first_response_at (0027) may be absent — else the first-response
    // board would falsely read "all clear". Fall back to the base columns.
    selectResilient(
      supabase.from('leads').select('id, status, assigned_to, created_at, first_response_at, budget_min, budget_max'),
      () => supabase.from('leads').select('id, status, assigned_to, created_at, budget_min, budget_max'),
      'buildSalesCommand',
    ),
  ]);

  // ── 1. Lead Urgency Board ──
  const toUrgency = (l: LeadListItem, extra: Partial<UrgencyLead> = {}): UrgencyLead => ({
    id: l.id, name: l.full_name ?? 'Lead', urgency: l.priority, reasons: l.priority_reasons,
    budget: l.budget_max ?? l.budget_min, owner: l.owner_name, phone: l.phone, waitedMinutes: null, stalledDays: null, ...extra,
  });
  const rawLeads = (rawLeadsData ?? []) as any[];
  const respondedById = new Map(rawLeads.map((r) => [r.id, r]));
  const firstResponseOverdue = leads
    .filter((l) => l.status === 'new' && !respondedById.get(l.id)?.first_response_at && (now - new Date(l.created_at).getTime()) / 60000 > SPEED_WINDOW_MIN)
    .map((l) => toUrgency(l, { waitedMinutes: Math.floor((now - new Date(l.created_at).getTime()) / 60000) }))
    .sort((a, b) => (b.waitedMinutes ?? 0) - (a.waitedMinutes ?? 0));
  const overdueIds = new Set(firstResponseOverdue.map((l) => l.id));
  const hot = leads.filter((l) => l.needs_action && l.priority >= 40 && !overdueIds.has(l.id)).slice(0, 12).map((l) => toUrgency(l));
  const stalled = leads
    .filter((l) => ACTIVE_PIPE.includes(l.status) && !overdueIds.has(l.id) && (now - new Date(l.last_contacted_at ?? l.created_at).getTime()) > STALL_DAYS * DAY)
    .map((l) => toUrgency(l, { stalledDays: Math.floor((now - new Date(l.last_contacted_at ?? l.created_at).getTime()) / DAY) }))
    .sort((a, b) => (b.stalledDays ?? 0) - (a.stalledDays ?? 0)).slice(0, 12);

  // ── 2. Follow-up Deadlines (auto-priority by how overdue) ──
  const followItems: FollowUpItem[] = (followRes.data ?? []).map((t: any) => {
    const due = new Date(t.due_at).getTime();
    const priority: FollowUpItem['priority'] = due < now - DAY ? 'high' : due <= todayEnd.getTime() ? 'medium' : 'low';
    return { id: t.id, note: t.note ?? 'Follow-up', dueAt: t.due_at, leadId: t.lead_id, name: t.contacts?.full_name ?? null, priority };
  });
  const followUps = {
    overdue: followItems.filter((f) => new Date(f.dueAt).getTime() < todayStart.getTime()),
    today: followItems.filter((f) => { const d = new Date(f.dueAt).getTime(); return d >= todayStart.getTime() && d <= todayEnd.getTime(); }),
    upcoming: followItems.filter((f) => new Date(f.dueAt).getTime() > todayEnd.getTime()).slice(0, 30),
  };

  // ── 3. Viewing Prep Board (today) ──
  const STANDARD_DOCS = ['Passport / ID', 'Proof of funds', 'Floor plan & price list', 'Reservation form'];
  const viewingPrep: ViewingPrep[] = (viewRes.data ?? []).filter((v: any) => v.status !== 'cancelled').map((v: any) => ({
    id: v.id, time: v.scheduled_at, leadId: v.lead_id, contact: v.contacts?.full_name ?? 'Lead',
    project: v.projects?.name ?? null, unit: v.units?.unit_number ?? null, meetingLink: v.meeting_link,
    reminderSent: !!v.reminder_sent_at, notes: v.notes, documents: STANDARD_DOCS,
    nextAction: v.status === 'attended' ? 'Log outcome & send follow-up' : v.reminder_sent_at ? 'Confirm attendance & prep pack' : 'Send reminder & confirm time',
  }));

  // ── 4. Negotiation Tracker (active) ──
  const commByLead = new Map<string, { summary: string | null; at: string }>();
  const negLeadIds = (negRes.data ?? []).map((n: any) => n.lead_id).filter(Boolean);
  if (negLeadIds.length) {
    const { data: comms } = await supabase.from('contact_communications').select('lead_id, summary, occurred_at').in('lead_id', negLeadIds).order('occurred_at', { ascending: false }).limit(200);
    for (const c of comms ?? []) { if (c.lead_id && !commByLead.has(c.lead_id)) commByLead.set(c.lead_id, { summary: c.summary, at: c.occurred_at }); }
  }
  const nextByLead = new Map<string, string>();
  for (const f of followItems) { if (f.leadId && !nextByLead.has(f.leadId)) nextByLead.set(f.leadId, f.dueAt); }
  const negotiations: NegotiationItem[] = (negRes.data ?? []).map((n: any) => {
    const deadline = n.lead_id ? nextByLead.get(n.lead_id) ?? null : null;
    return {
      id: n.id, leadId: n.lead_id, name: n.leads?.contacts?.full_name ?? 'Lead',
      unit: n.units?.unit_number ? `${n.units.projects?.name ?? ''} · ${n.units.unit_number}`.trim() : null,
      offered: money(n.offered_price), counter: money(n.counter_offer), agreed: money(n.agreed_price),
      paymentTerms: n.payment_terms, objections: n.notes, latestComm: commByLead.get(n.lead_id)?.summary ?? null, latestCommAt: commByLead.get(n.lead_id)?.at ?? null,
      nextActionDeadline: deadline, nextAction: n.counter_offer ? 'Respond to counter-offer' : n.offered_price ? 'Send counter / close' : 'Present offer',
    };
  });

  // ── 5. Reservation Expiry Tracker ──
  const reservations: ReservationItem[] = (resvRes.data ?? []).map((r: any) => {
    const daysLeft = r.expires_at ? Math.floor((new Date(r.expires_at).getTime() - now) / DAY) : null;
    const contractPending = !r.converted_contract_id;
    let urgentLegal: string | null = null;
    if (daysLeft != null && daysLeft <= 3 && !r.deposit_paid) urgentLegal = 'Deposit unpaid — reservation lapses soon';
    else if (daysLeft != null && daysLeft <= 2 && contractPending) urgentLegal = 'Draft & send contract before expiry';
    else if (daysLeft != null && daysLeft < 0) urgentLegal = 'Expired — release unit or extend';
    return {
      id: r.id, buyer: r.contacts?.full_name ?? 'Buyer',
      unit: r.units?.unit_number ? `${r.units.projects?.name ?? ''} · ${r.units.unit_number}`.trim() : null,
      deposit: money(r.deposit_amount), depositPaid: !!r.deposit_paid, expiresAt: r.expires_at, daysLeft, contractPending, status: r.status, urgentLegal,
    };
  });

  // ── 6. Agent Performance Board ──
  const nameById = new Map((profRes.data ?? []).map((p) => [p.id, p.full_name ?? 'Agent']));
  const viewingsByAgent = new Map<string, number>();
  const { data: allViewings } = await supabase.from('viewings').select('agent_id');
  for (const v of allViewings ?? []) { if (v.agent_id) viewingsByAgent.set(v.agent_id, (viewingsByAgent.get(v.agent_id) ?? 0) + 1); }
  const resvByAgent = new Map<string, number>();
  const { data: allResv } = await supabase.from('reservations').select('created_by, status');
  for (const r of allResv ?? []) { if (r.created_by && r.status !== 'cancelled') resvByAgent.set(r.created_by, (resvByAgent.get(r.created_by) ?? 0) + 1); }
  const commByAgent = new Map<string, number>();
  for (const c of commRes.data ?? []) { if (c.profile_id && c.status !== 'paid') commByAgent.set(c.profile_id, (commByAgent.get(c.profile_id) ?? 0) + Number(c.amount ?? 0)); }

  const agentAgg = new Map<string, { leads: number; won: number; respSum: number; respN: number; pipeline: number }>();
  const ensure = (id: string) => { if (!agentAgg.has(id)) agentAgg.set(id, { leads: 0, won: 0, respSum: 0, respN: 0, pipeline: 0 }); return agentAgg.get(id)!; };
  for (const l of rawLeads) {
    if (!l.assigned_to) continue;
    const a = ensure(l.assigned_to);
    a.leads += 1;
    if (l.status === 'won') a.won += 1;
    if (l.first_response_at) { const m = (new Date(l.first_response_at).getTime() - new Date(l.created_at).getTime()) / 60000; if (m >= 0) { a.respSum += m; a.respN += 1; } }
    if (ACTIVE_PIPE.includes(l.status)) a.pipeline += Number(l.budget_max ?? l.budget_min ?? 0);
  }
  const agentIds = new Set<string>([...agentAgg.keys(), ...viewingsByAgent.keys(), ...resvByAgent.keys(), ...commByAgent.keys()]);
  const agents: AgentScore[] = [...agentIds].map((id) => {
    const a = agentAgg.get(id) ?? { leads: 0, won: 0, respSum: 0, respN: 0, pipeline: 0 };
    return {
      agentId: id, name: nameById.get(id) ?? 'Agent', responseSpeedMin: a.respN ? Math.round(a.respSum / a.respN) : null,
      conversionPct: a.leads ? Math.round((a.won / a.leads) * 100) : 0, pipelineValue: a.pipeline,
      viewingsBooked: viewingsByAgent.get(id) ?? 0, reservationsClosed: resvByAgent.get(id) ?? 0,
      commissionPending: commByAgent.get(id) ?? 0, leads: a.leads, won: a.won,
    };
  }).sort((x, y) => y.pipelineValue - x.pipelineValue || y.won - x.won);

  return {
    urgency: { firstResponseOverdue, hot, stalled },
    followUps, viewingPrep, negotiations, reservations, agents,
    counts: {
      urgent: firstResponseOverdue.length + hot.length,
      followUpsOverdue: followUps.overdue.length,
      viewingsToday: viewingPrep.length,
      negotiations: negotiations.length,
      reservationsExpiring: reservations.filter((r) => r.daysLeft != null && r.daysLeft <= 3).length,
    },
  };
}
