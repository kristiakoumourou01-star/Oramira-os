import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentProfile } from '@/lib/auth';
import { selectResilient } from '@/lib/db-resilient';
import { CLOSED_STATUSES, type AgentStat, type FollowUpItem, type NewLead, type SourceCost, type AssignedLeadRow } from '@/lib/sales-hub-shared';

/**
 * Διαχείριση leads — φόρτωση δεδομένων για «Νέα leads», «Follow-ups» και
 * «Agents». Τα components παίρνουν έτοιμα αντικείμενα (lib/sales-hub-shared).
 */

/** Οι ενεργοί συνεργάτες πωλήσεων (για ανάθεση και φίλτρα). */
export async function getSalesAgents(): Promise<{ id: string; full_name: string | null }[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).eq('is_active', true).order('full_name');
  return (data ?? []) as { id: string; full_name: string | null }[];
}

/** Νέα leads: όλα τα εισερχόμενα χωρίς υπεύθυνο που δεν έχουν κλείσει. Νεότερα πρώτα. */
export async function getNewLeads(): Promise<NewLead[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const base = () => supabase.from('leads').select('id, created_at, status, source, budget_min, budget_max, timeline_to_buy, message, last_contacted_at, contact_id, contacts(full_name, email, phone), projects:preferred_project_id(name)')
    .is('assigned_to', null).order('created_at', { ascending: false }).limit(500);
  const rows = (await selectResilient(
    supabase.from('leads').select('id, created_at, status, source, budget_min, budget_max, timeline_to_buy, message, last_contacted_at, first_response_at, is_returning, archived_at, contact_id, contacts(full_name, email, phone), projects:preferred_project_id(name)')
      .is('assigned_to', null).is('archived_at', null).order('created_at', { ascending: false }).limit(500),
    base, 'getNewLeads',
  )) ?? [];
  const open = (rows as any[]).filter((l) => !CLOSED_STATUSES.includes(l.status));
  const ids = open.map((l) => l.id);
  const units = new Map<string, string>();
  const touched = new Set<string>();
  if (ids.length) {
    const [vw, fu, cc] = await Promise.all([
      supabase.from('viewings').select('lead_id, units(unit_number), projects(name)').in('lead_id', ids).limit(1000),
      supabase.from('follow_up_tasks').select('lead_id').in('lead_id', ids).eq('is_done', true).limit(1000),
      supabase.from('contact_communications').select('lead_id').in('lead_id', ids).eq('direction', 'outbound').limit(1000),
    ]);
    for (const v of (vw.error ? [] : vw.data ?? []) as any[]) {
      const u = [v.projects?.name, v.units?.unit_number].filter(Boolean).join(' ');
      if (v.lead_id && u && !units.has(v.lead_id)) units.set(v.lead_id, v.units?.unit_number ?? u);
    }
    for (const r of [...(fu.error ? [] : fu.data ?? []), ...(cc.error ? [] : cc.data ?? [])] as any[]) if (r.lead_id) touched.add(r.lead_id);
  }
  return open.map((l) => ({
    id: l.id,
    createdAt: l.created_at,
    name: l.contacts?.full_name ?? null,
    email: l.contacts?.email ?? null,
    phone: l.contacts?.phone ?? null,
    source: l.source,
    project: l.projects?.name ?? null,
    unit: units.get(l.id) ?? null,
    budgetMin: l.budget_min != null ? Number(l.budget_min) : null,
    budgetMax: l.budget_max != null ? Number(l.budget_max) : null,
    timeline: l.timeline_to_buy ?? null,
    message: l.message ?? null,
    status: l.status,
    notContacted: !l.last_contacted_at && !l.first_response_at && !touched.has(l.id),
    isReturning: !!l.is_returning,
  }));
}

/** Ανοιχτά follow-ups (με τα στοιχεία του πελάτη) για τη σελίδα Follow-ups. */
export async function getOpenFollowUps(): Promise<FollowUpItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const SEL = 'id, due_at, note, lead_id, assigned_to, contacts(full_name, phone, email), leads(status, title), owner:assigned_to(full_name)';
  const rows = (await selectResilient(
    supabase.from('follow_up_tasks').select(`${SEL}, type`).eq('is_done', false).order('due_at').limit(2000),
    () => supabase.from('follow_up_tasks').select(SEL).eq('is_done', false).order('due_at').limit(2000),
    'getOpenFollowUps',
  )) ?? [];
  return (rows as any[])
    .filter((r) => !r.leads || !CLOSED_STATUSES.includes(r.leads.status))
    .map((r) => ({
      id: r.id, dueAt: r.due_at, note: r.note ?? null, type: r.type ?? 'task', leadId: r.lead_id ?? null,
      name: r.leads?.title || r.contacts?.full_name || '—', phone: r.contacts?.phone ?? null, email: r.contacts?.email ?? null,
      ownerId: r.assigned_to ?? null, ownerName: r.owner?.full_name ?? null, leadStatus: r.leads?.status ?? null,
    }));
}

/** Καταχωρημένο κόστος ανά πηγή και μήνα (migration 0091· κενό αν λείπει ο πίνακας). */
export async function getSourceCosts(): Promise<SourceCost[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase.from('lead_source_costs').select('id, source, month, amount').order('month', { ascending: false }).limit(500);
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, source: r.source, month: String(r.month).slice(0, 7), amount: Number(r.amount) || 0 }));
}

const ym = (iso: string) => iso.slice(0, 7);
const median = (xs: number[]) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.floor(s.length / 2)]); };

/**
 * Στατιστικά ανά agent για τα leads που ανατέθηκαν μέσα στο διάστημα: ανατέθηκαν,
 * επικοινωνία, προβολή, πώληση, χρόνος πρώτης επαφής (από leads, σημειώσεις και
 * κινήσεις) και κόστος ανά lead / πώληση όταν υπάρχουν κόστη πηγών.
 */
export async function getAgentStats(days: number): Promise<{ rows: AgentStat[]; unassigned: number; hasCosts: boolean }> {
  const supabase = (await createSupabaseServerClient()) as any;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const viewer = await getCurrentProfile();
  const leads = ((await selectResilient(
    supabase.from('leads').select('id, assigned_to, assigned_at, created_at, status, source, first_response_at, last_contacted_at, won_at').gte('created_at', since).limit(5000),
    () => supabase.from('leads').select('id, assigned_to, created_at, status, source, last_contacted_at').gte('created_at', since).limit(5000),
    'getAgentStats',
  )) ?? []) as any[];
  const ids = leads.map((l) => l.id);
  const chunk = <T,>(xs: T[], n = 300) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));
  const notes: any[] = []; const fus: any[] = []; const views: any[] = [];
  for (const part of chunk(ids)) {
    const [n, f, v] = await Promise.all([
      supabase.from('notes').select('entity_id, author_id, created_at').eq('entity_type', 'lead').in('entity_id', part).limit(10000),
      selectResilient(
        supabase.from('follow_up_tasks').select('lead_id, assigned_to, is_done, done_at, due_at').in('lead_id', part).limit(10000),
        () => supabase.from('follow_up_tasks').select('lead_id, assigned_to, is_done, due_at').in('lead_id', part).limit(10000),
      ),
      supabase.from('viewings').select('lead_id, status').in('lead_id', part).limit(10000),
    ]);
    notes.push(...(n.error ? [] : n.data ?? [])); fus.push(...(f ?? [])); views.push(...(v.error ? [] : v.data ?? []));
  }
  const [{ data: profiles }, costs] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, is_active').in('role', ['admin', 'sales', 'management']),
    getSourceCosts(),
  ]);

  // Κόστος ενός lead = κόστος πηγής του μήνα / leads της πηγής εκείνο τον μήνα.
  const costKey = (src: string, m: string) => `${src.toLowerCase()}|${m}`;
  const costBy = new Map(costs.map((c) => [costKey(c.source, c.month), c.amount]));
  const allLeadsBySrcMonth = new Map<string, number>();
  for (const l of leads) { const k = costKey(String(l.source ?? ''), ym(l.created_at)); allLeadsBySrcMonth.set(k, (allLeadsBySrcMonth.get(k) ?? 0) + 1); }
  const leadCost = (l: any) => { const k = costKey(String(l.source ?? ''), ym(l.created_at)); const c = costBy.get(k); return c === undefined ? null : c / Math.max(1, allLeadsBySrcMonth.get(k) ?? 1); };

  const firstTouch = new Map<string, number>();
  const touch = (id: string, iso: string | null | undefined) => { if (!iso) return; const t = Date.parse(iso); if (!Number.isFinite(t)) return; const cur = firstTouch.get(id); if (cur === undefined || t < cur) firstTouch.set(id, t); };
  for (const l of leads) touch(l.id, l.first_response_at);
  for (const n of notes) touch(n.entity_id, n.created_at);
  for (const f of fus) if (f.is_done) touch(f.lead_id, f.done_at ?? f.due_at);
  const viewed = new Set(views.filter((v) => !['cancelled'].includes(v.status)).map((v) => v.lead_id));

  const by = new Map<string, AgentStat & { _resp: number[] }>();
  const nameOf = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p.full_name ?? '—']));
  for (const p of (profiles ?? []) as any[]) if (p.is_active !== false) by.set(p.id, { agentId: p.id, name: p.full_name ?? '—', assigned: 0, contacted: 0, viewings: 0, won: 0, notes: 0, activitiesDone: 0, overdue: 0, responseMin: null, cost: null, _resp: [] });
  let unassigned = 0;
  const now = Date.now();
  for (const l of leads) {
    if (!l.assigned_to) { unassigned++; continue; }
    let a = by.get(l.assigned_to);
    if (!a) { a = { agentId: l.assigned_to, name: nameOf.get(l.assigned_to) ?? '—', assigned: 0, contacted: 0, viewings: 0, won: 0, notes: 0, activitiesDone: 0, overdue: 0, responseMin: null, cost: null, _resp: [] }; by.set(l.assigned_to, a); }
    a.assigned++;
    const ft = firstTouch.get(l.id) ?? (l.last_contacted_at ? Date.parse(l.last_contacted_at) : undefined);
    if (ft !== undefined) {
      a.contacted++;
      const from = Date.parse(l.assigned_at ?? l.created_at);
      if (Number.isFinite(from) && ft >= from) a._resp.push((ft - from) / 60000);
    }
    if (viewed.has(l.id) || ['viewing', 'offer', 'negotiating', 'reserved', 'won'].includes(l.status)) a.viewings++;
    if (l.status === 'won') a.won++;
    const c = leadCost(l);
    if (c !== null) a.cost = (a.cost ?? 0) + c;
  }
  for (const n of notes) { const a = n.author_id ? by.get(n.author_id) : undefined; if (a) a.notes++; }
  for (const f of fus) {
    const a = f.assigned_to ? by.get(f.assigned_to) : undefined; if (!a) continue;
    if (f.is_done) a.activitiesDone++; else if (Date.parse(f.due_at) < now) a.overdue++;
  }
  // Ο Sales Agent βλέπει μόνο τη δική του γραμμή· Admin/Manager όλη την ομάδα.
  const onlyMe = viewer && viewer.role === 'sales' ? viewer.id : null;
  const rows = [...by.values()]
    .filter((a) => (onlyMe ? a.agentId === onlyMe : a.assigned > 0 || a.activitiesDone > 0 || a.notes > 0))
    .map(({ _resp, ...a }) => ({ ...a, responseMin: median(_resp) }))
    .sort((x, y) => y.assigned - x.assigned || x.name.localeCompare(y.name, 'el'));
  return { rows, unassigned, hasCosts: costs.length > 0 };
}


/**
 * Ανατεθειμένα leads (για Owner / Manager): ποιος πήρε ποιο lead, μόνος του ή με
 * ανάθεση από άλλον, και πότε. Τελευταίες `days` μέρες.
 */
export async function getAssignedLeads(days = 60): Promise<AssignedLeadRow[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data, error } = await supabase.from('leads')
    .select('id, created_at, status, source, assigned_to, assigned_by, assigned_at, last_contacted_at, first_response_at, contacts(full_name)')
    .not('assigned_to', 'is', null)
    .or(`assigned_at.gte.${since},and(assigned_at.is.null,created_at.gte.${since})`)
    .order('assigned_at', { ascending: false, nullsFirst: false }).limit(1000);
  if (error) return [];
  const ids = Array.from(new Set((data ?? []).flatMap((l: any) => [l.assigned_to, l.assigned_by]).filter(Boolean)));
  const names = new Map<string, string | null>();
  if (ids.length) {
    const { data: ps } = await supabase.from('profiles').select('id, full_name').in('id', ids);
    for (const p of (ps ?? []) as any[]) names.set(p.id, p.full_name);
  }
  return ((data ?? []) as any[]).map((l) => ({
    id: l.id, name: l.contacts?.full_name ?? null, source: l.source ?? null, status: l.status,
    assignedTo: l.assigned_to, assignedToName: names.get(l.assigned_to) ?? null,
    assignedBy: l.assigned_by ?? null, assignedByName: l.assigned_by ? names.get(l.assigned_by) ?? null : null,
    assignedAt: l.assigned_at ?? null, createdAt: l.created_at,
    contacted: !!(l.last_contacted_at || l.first_response_at),
    responseMin: (() => {
      const start = Date.parse(l.assigned_at ?? l.created_at); const first = l.first_response_at ? Date.parse(l.first_response_at) : NaN;
      return Number.isFinite(start) && Number.isFinite(first) && first >= start ? Math.round((first - start) / 60000) : null;
    })(),
  }));
}
