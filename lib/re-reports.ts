import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CHANNEL_NAME } from '@/lib/campaigns-shared';
import { LEAD_SOURCES, buckets, inRange, shiftYear, type Breakdown, type BuiltReport, type CellFmt, type DateRange, type Metric, type ReportFilters, type ReportRow, type Trend } from '@/lib/reports-shared';

/**
 * Αναφορές real estate για το Reports (όπως το FitnessCRM): κουτάκια KPI,
 * γράφημα τάσης με την ίδια περίοδο πέρσι, πίνακας «Σύνολα σε σύγκριση»,
 * αναλύσεις και αναλυτικός πίνακας. Server-only, αμυντικά ερωτήματα.
 */

type Db = any;
const SRC = Object.fromEntries(LEAD_SOURCES) as Record<string, string>;
const UNIT_ST: Record<string, string> = { available: 'Διαθέσιμη', reserved: 'Κρατημένη', sold: 'Πωλημένη', handed_over: 'Παραδόθηκε', not_released: 'Μη διαθέσιμη', blocked: 'Μπλοκαρισμένη' };
const RES_ST: Record<string, string> = { active: 'Ενεργή', converted: 'Έγινε συμβόλαιο', expired: 'Έληξε', cancelled: 'Ακυρώθηκε' };
const CON_ST: Record<string, string> = { draft: 'Πρόχειρο', sent: 'Στάλθηκε', signed: 'Υπογράφηκε', cancelled: 'Ακυρώθηκε' };
const TICKET_ST: Record<string, string> = { open: 'Ανοιχτό', in_progress: 'Σε εξέλιξη', waiting: 'Σε αναμονή', resolved: 'Επιλύθηκε', closed: 'Κλειστό', cancelled: 'Ακυρώθηκε' };
const CHARGE_KIND: Record<string, string> = { service: 'Υπηρεσία / επισκευή', maintenance_fee: 'Ετήσιο τέλος συντήρησης', other: 'Άλλο' };
const CHARGE_ST: Record<string, string> = { pending: 'Εκκρεμεί', paid: 'Πληρώθηκε', cancelled: 'Ακυρώθηκε' };
const CAMP_ST: Record<string, string> = { draft: 'Πρόχειρο', sending: 'Αποστολή…', sent: 'Στάλθηκε', cancelled: 'Ακυρώθηκε' };
const STAGE: Record<string, string> = { new: 'Νέο', contacted: 'Επικοινωνία', engaged: 'Ενδιαφέρον', qualified: 'Qualified', waiting: 'Αναμονή', viewing: 'Viewing', offer: 'Προσφορά', negotiating: 'Διαπραγμάτευση', reserved: 'Κράτηση', won: 'Πώληση', lost: 'Χάθηκε', nurture: 'Nurture', no_response: 'Χωρίς απάντηση', retargeting: 'Retargeting', reactivation: 'Επανενεργοποίηση' };
const SOLD = ['sold', 'handed_over'];
const CLOSED_TICKET = ['resolved', 'closed', 'cancelled'];

async function rows(p: PromiseLike<any>): Promise<any[]> { try { const r = await p; return (r?.data ?? []) as any[]; } catch { return []; } }
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : null);
const won = (l: any) => l.status === 'won' || !!l.won_at;

/** Εργαλεία για «αυτή η περίοδος» και «ίδια περίοδος πέρσι». */
function kit(f: ReportFilters) {
  const R = f.range, P = f.prev;
  const b = buckets(R);
  const idx = new Map(b.keys.map((k, i) => [k, i]));
  const metric = (label: string, fmt: CellFmt, at: (r: DateRange) => number | null, hint?: string): Metric => ({ label, fmt, cur: at(R), prev: f.compare ? at(P) : null, hint });
  const trend = <T,>(title: string, fmt: CellFmt, items: T[], date: (x: T) => string | null | undefined, val: (x: T) => number = () => 1): Trend => {
    const cur = b.keys.map(() => 0), prev = b.keys.map(() => 0);
    for (const x of items) {
      const d = date(x); if (!d) continue;
      if (inRange(d, R)) { const i = idx.get(b.keyOf(String(d))); if (i != null) cur[i] += Number(val(x)) || 0; }
      else if (f.compare && inRange(d, P)) { const i = idx.get(b.keyOf(shiftYear(String(d).slice(0, 10), 1))); if (i != null) prev[i] += Number(val(x)) || 0; }
    }
    return { title, fmt, labels: b.keys, labelFmt: b.fmt, cur, prev };
  };
  const breakdown = <T,>(title: string, fmt: CellFmt, items: T[], key: (x: T) => string | null | undefined, val: (x: T) => number = () => 1, data = false): Breakdown => {
    const m = new Map<string, number>();
    for (const x of items) { const k = key(x) || '—'; m.set(k, (m.get(k) ?? 0) + (Number(val(x)) || 0)); }
    return { title, fmt, data, rows: Array.from(m.entries()).map(([label, value]) => ({ label, value })).filter((x) => x.value).sort((a, c) => c.value - a.value).slice(0, 10) };
  };
  return { R, P, metric, trend, breakdown, inR: (d: string | null | undefined) => inRange(d, R) };
}

export async function buildReReport(key: string, f: ReportFilters): Promise<BuiltReport | null> {
  const db: Db = await createSupabaseServerClient();
  switch (key) {
    case 'sales': return sales(db, f);
    case 'leads': return leads(db, f);
    case 'agents': return agents(db, f);
    case 'inventory': return inventory(db, f);
    case 'collections': return collections(db, f);
    case 'property': return property(db, f);
    case 'campaigns': return campaigns(db, f);
    case 'tasks': return tasks(db, f);
    default: return null;
  }
}

/** Επιλογές για τα φίλτρα (έργα, πωλητές). */
export async function reportPickers(): Promise<{ projects: [string, string][]; agents: [string, string][] }> {
  const db: Db = await createSupabaseServerClient();
  const [p, a] = await Promise.all([
    rows(db.from('projects').select('id, name').order('name')),
    rows(db.from('profiles').select('id, full_name, role').in('role', ['admin', 'sales', 'management']).order('full_name')),
  ]);
  return { projects: p.map((x) => [x.id, x.name ?? '—']), agents: a.map((x) => [x.id, x.full_name ?? '—']) };
}

/** Όλη η εσωτερική ομάδα (για ανάθεση λίστας κλήσεων από το Custom report). */
export async function staffList(): Promise<{ id: string; name: string }[]> {
  const db: Db = await createSupabaseServerClient();
  const { INTERNAL_ROLES } = await import('@/lib/permissions');
  return (await rows(db.from('profiles').select('id, full_name').in('role', INTERNAL_ROLES as unknown as string[]).order('full_name'))).map((p) => ({ id: p.id, name: p.full_name ?? '—' }));
}

/* ── Πωλήσεις & έσοδα ────────────────────────────────────────────────── */
async function sales(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [projects, units, res, con, pay, ppl] = await Promise.all([
    rows(db.from('projects').select('id, name')),
    rows(db.from('units').select('id, project_id, unit_number, price')),
    rows(db.from('reservations').select('id, unit_id, reserved_at, deposit_amount, deposit_paid, status, created_by, contacts:buyer_contact_id(full_name)').limit(10000)),
    rows(db.from('contracts').select('id, unit_id, status, signed_at, created_at, total_price, contacts:buyer_contact_id(full_name)').limit(10000)),
    rows(db.from('payments').select('contract_id, amount_paid, paid_at, method').limit(30000)),
    rows(db.from('profiles').select('id, full_name')),
  ]);
  const unit = new Map(units.map((u) => [u.id, u]));
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const who = new Map(ppl.map((p) => [p.id, p.full_name as string]));
  const projOf = (unitId: string) => unit.get(unitId)?.project_id as string | undefined;
  const ok = (unitId: string) => !f.project || projOf(unitId) === f.project;
  const RES = res.filter((x) => ok(x.unit_id));
  const CON = con.filter((x) => ok(x.unit_id) && x.status === 'signed');
  const conProj = new Map(con.map((c) => [c.id, projOf(c.unit_id)]));
  const PAY = pay.filter((p) => !f.project || conProj.get(p.contract_id) === f.project);
  const cDate = (c: any) => c.signed_at ?? c.created_at;
  const resIn = (r: DateRange) => RES.filter((x) => inRange(x.reserved_at, r));
  const conIn = (r: DateRange) => CON.filter((x) => inRange(cDate(x), r));
  const payIn = (r: DateRange) => PAY.filter((x) => inRange(x.paid_at, r));
  const C = conIn(k.R), Rs = resIn(k.R), Pm = payIn(k.R);
  return {
    filters: ['project'],
    kpis: [
      k.metric('Κρατήσεις', 'int', (r) => resIn(r).length),
      k.metric('Συμβόλαια', 'int', (r) => conIn(r).length),
      k.metric('Αξία πωλήσεων', 'money', (r) => sum(conIn(r), (c) => c.total_price)),
      k.metric('Εισπράξεις', 'money', (r) => sum(payIn(r), (p) => p.amount_paid)),
    ],
    trend: k.trend('Τάση αξίας πωλήσεων', 'money', CON, cDate, (c) => Number(c.total_price ?? 0)),
    totals: [
      k.metric('Κρατήσεις', 'int', (r) => resIn(r).length),
      k.metric('Προκαταβολές κρατήσεων', 'money', (r) => sum(resIn(r), (x) => x.deposit_amount)),
      k.metric('Συμβόλαια', 'int', (r) => conIn(r).length),
      k.metric('Αξία πωλήσεων', 'money', (r) => sum(conIn(r), (c) => c.total_price)),
      k.metric('Μέση τιμή πώλησης', 'money', (r) => { const c = conIn(r); return c.length ? sum(c, (x) => x.total_price) / c.length : null; }),
      k.metric('Εισπράξεις', 'money', (r) => sum(payIn(r), (p) => p.amount_paid)),
    ],
    breakdowns: [
      k.breakdown('Πωλήσεις ανά έργο', 'money', C, (c) => pname.get(projOf(c.unit_id) ?? ''), (c) => Number(c.total_price ?? 0), true),
      k.breakdown('Εισπράξεις ανά τρόπο πληρωμής', 'money', Pm, (p) => p.method || 'Χωρίς τρόπο', (p) => Number(p.amount_paid ?? 0), true),
      k.breakdown('Κρατήσεις ανά πωλητή', 'int', Rs, (x) => who.get(x.created_by), () => 1, true),
    ],
    details: [
      { key: 'contracts', label: 'Συμβόλαια', columns: [{ key: 'date', label: 'Υπογραφή', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'list', label: 'Τιμή καταλόγου', fmt: 'money' }, { key: 'price', label: 'Τιμή πώλησης', fmt: 'money' }, { key: 'paid', label: 'Εισπράχθηκαν', fmt: 'money' }, { key: 'status', label: 'Κατάσταση' }],
        rows: C.map((x) => ({ date: cDate(x), buyer: x.contacts?.full_name ?? '—', project: pname.get(projOf(x.unit_id) ?? '') ?? '—', unit: unit.get(x.unit_id)?.unit_number ?? '—', list: unit.get(x.unit_id)?.price == null ? null : Number(unit.get(x.unit_id).price), price: x.total_price == null ? null : Number(x.total_price), paid: sum(PAY.filter((p) => p.contract_id === x.id), (p) => p.amount_paid), status: CON_ST[x.status] ?? x.status })) },
      { key: 'reservations', label: 'Κρατήσεις', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'agent', label: 'Πωλητής', data: true }, { key: 'deposit', label: 'Προκαταβολή', fmt: 'money' }, { key: 'paid', label: 'Πληρώθηκε' }, { key: 'status', label: 'Κατάσταση' }],
        rows: Rs.map((x) => ({ date: x.reserved_at, buyer: x.contacts?.full_name ?? '—', project: pname.get(projOf(x.unit_id) ?? '') ?? '—', unit: unit.get(x.unit_id)?.unit_number ?? '—', agent: who.get(x.created_by) ?? '—', deposit: x.deposit_amount == null ? null : Number(x.deposit_amount), paid: x.deposit_paid ? 'Ναι' : 'Όχι', status: RES_ST[x.status] ?? x.status })) },
      { key: 'payments', label: 'Εισπράξεις', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'project', label: 'Έργο', data: true }, { key: 'amount', label: 'Ποσό', fmt: 'money' }, { key: 'method', label: 'Τρόπος', data: true }],
        rows: Pm.map((p) => ({ date: p.paid_at, project: pname.get(conProj.get(p.contract_id) ?? '') ?? '—', amount: Number(p.amount_paid ?? 0), method: p.method ?? '' })) },
    ],
  };
}

/* ── Leads & πηγές ───────────────────────────────────────────────────── */
async function leads(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [L, costs, projects, ppl] = await Promise.all([
    rows(db.from('leads').select('id, source, status, stage, won_at, created_at, first_response_at, preferred_project_id, assigned_to, value, budget_max, contacts(full_name)').is('deleted_at', null).limit(30000)),
    rows(db.from('lead_source_costs').select('month, source, amount')),
    rows(db.from('projects').select('id, name')),
    rows(db.from('profiles').select('id, full_name')),
  ]);
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const who = new Map(ppl.map((p) => [p.id, p.full_name as string]));
  const LL = L.filter((l) => !f.project || l.preferred_project_id === f.project);
  const lIn = (r: DateRange) => LL.filter((l) => inRange(l.created_at, r));
  const wonIn = (r: DateRange) => LL.filter((l) => won(l) && inRange(l.won_at ?? l.created_at, r));
  // Κόστος: μήνες που πέφτουν στο διάστημα.
  const cost = (r: DateRange) => sum(costs.filter((c) => String(c.month).slice(0, 7) >= r.from.slice(0, 7) && String(c.month).slice(0, 7) <= r.to.slice(0, 7)), (c) => c.amount);
  const Ls = lIn(k.R);
  const bySrc = new Map<string, any[]>(); for (const l of Ls) { const s = l.source ?? 'other'; bySrc.set(s, [...(bySrc.get(s) ?? []), l]); }
  const costR = costs.filter((c) => String(c.month).slice(0, 7) >= k.R.from.slice(0, 7) && String(c.month).slice(0, 7) <= k.R.to.slice(0, 7));
  return {
    filters: ['project'],
    kpis: [
      k.metric('Leads', 'int', (r) => lIn(r).length),
      k.metric('Πωλήσεις', 'int', (r) => wonIn(r).length),
      k.metric('Μετατροπή', 'pct', (r) => ratio(wonIn(r).length, lIn(r).length)),
      k.metric('Κόστος ανά lead', 'money', (r) => { const n = lIn(r).length, c = cost(r); return n && c ? c / n : null; }),
    ],
    trend: k.trend('Τάση νέων leads', 'int', LL, (l) => l.created_at),
    totals: [
      k.metric('Νέα leads', 'int', (r) => lIn(r).length),
      k.metric('Με πρώτη απάντηση', 'int', (r) => lIn(r).filter((l) => l.first_response_at).length),
      k.metric('Πωλήσεις', 'int', (r) => wonIn(r).length),
      k.metric('Μετατροπή', 'pct', (r) => ratio(wonIn(r).length, lIn(r).length)),
      k.metric('Κόστος marketing', 'money', (r) => cost(r) || null),
      k.metric('Κόστος ανά lead', 'money', (r) => { const n = lIn(r).length, c = cost(r); return n && c ? c / n : null; }),
      k.metric('Κόστος ανά πώληση', 'money', (r) => { const n = wonIn(r).length, c = cost(r); return n && c ? c / n : null; }),
    ],
    breakdowns: [
      k.breakdown('Leads ανά πηγή', 'int', Ls, (l) => SRC[l.source ?? 'other'] ?? l.source),
      k.breakdown('Leads ανά έργο ενδιαφέροντος', 'int', Ls, (l) => pname.get(l.preferred_project_id) ?? 'Χωρίς έργο', () => 1, true),
      k.breakdown('Κόστος ανά πηγή', 'money', costR, (c) => SRC[c.source] ?? c.source, (c) => Number(c.amount ?? 0)),
    ],
    details: [
      { key: 'sources', label: 'Ανά πηγή', columns: [{ key: 'source', label: 'Πηγή' }, { key: 'leads', label: 'Leads', fmt: 'int' }, { key: 'won', label: 'Πωλήσεις', fmt: 'int' }, { key: 'conv', label: 'Μετατροπή', fmt: 'pct' }, { key: 'cost', label: 'Κόστος', fmt: 'money' }, { key: 'cpl', label: 'Κόστος / lead', fmt: 'money' }],
        rows: Array.from(new Set([...bySrc.keys(), ...costR.map((c) => c.source)])).map((s) => { const ls = bySrc.get(s) ?? []; const w = ls.filter(won).length; const c = sum(costR.filter((x) => x.source === s), (x) => x.amount); return { source: SRC[s] ?? s, leads: ls.length, won: w, conv: ratio(w, ls.length), cost: c || null, cpl: ls.length && c ? c / ls.length : null } as ReportRow; }) },
      { key: 'leads', label: 'Leads', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'name', label: 'Όνομα', data: true }, { key: 'source', label: 'Πηγή' }, { key: 'stage', label: 'Στάδιο' }, { key: 'agent', label: 'Πωλητής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'value', label: 'Αξία', fmt: 'money' }],
        rows: Ls.map((l) => ({ date: l.created_at, name: l.contacts?.full_name ?? '—', source: SRC[l.source ?? 'other'] ?? l.source, stage: STAGE[l.stage ?? l.status] ?? l.stage ?? l.status, agent: who.get(l.assigned_to) ?? '—', project: pname.get(l.preferred_project_id) ?? '—', value: l.value ?? l.budget_max ?? null })) },
    ],
    note: 'Το κόστος marketing καταχωρίζεται ανά μήνα και πηγή στη σελίδα Agents των Πωλήσεων.',
  };
}

/* ── Απόδοση πωλητών ─────────────────────────────────────────────────── */
async function agents(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [ppl, L, V, Rv, Cm] = await Promise.all([
    rows(db.from('profiles').select('id, full_name, role').in('role', ['admin', 'sales', 'management']).order('full_name')),
    rows(db.from('leads').select('assigned_to, created_at, first_response_at, status, won_at, preferred_project_id').is('deleted_at', null).limit(30000)),
    rows(db.from('viewings').select('agent_id, scheduled_at, status, project_id').limit(20000)),
    rows(db.from('reservations').select('created_by, reserved_at, units(project_id)').limit(10000)),
    rows(db.from('commissions').select('profile_id, amount, created_at').limit(10000)),
  ]);
  const proj = (p: string | null | undefined) => !f.project || p === f.project;
  const ag = (id: string | null | undefined) => !f.agent || id === f.agent;
  const who = new Map(ppl.map((p) => [p.id, p.full_name as string]));
  const LL = L.filter((l) => ag(l.assigned_to) && proj(l.preferred_project_id));
  const VV = V.filter((v) => ag(v.agent_id) && v.status !== 'cancelled' && proj(v.project_id));
  const RR = Rv.filter((x) => ag(x.created_by) && proj(x.units?.project_id));
  const CC = Cm.filter((c) => ag(c.profile_id));
  const wonIn = (r: DateRange) => LL.filter((l) => won(l) && inRange(l.won_at ?? l.created_at, r));
  const per = ppl.filter((p) => ag(p.id)).map((p) => {
    const ls = LL.filter((l) => l.assigned_to === p.id && k.inR(l.created_at));
    const mins = ls.filter((l) => l.first_response_at).map((l) => (Date.parse(l.first_response_at) - Date.parse(l.created_at)) / 60000).filter((m) => m >= 0).sort((a, b) => a - b);
    const w = wonIn(k.R).filter((l) => l.assigned_to === p.id).length;
    return { agent: p.full_name ?? '—', leads: ls.length, contacted: ls.filter((l) => l.first_response_at).length, viewings: VV.filter((v) => v.agent_id === p.id && k.inR(v.scheduled_at)).length, reservations: RR.filter((x) => x.created_by === p.id && k.inR(x.reserved_at)).length, won: w, conv: ratio(w, ls.length), response: mins.length ? Math.round(mins[Math.floor(mins.length / 2)]) : null, commission: sum(CC.filter((c) => c.profile_id === p.id && k.inR(c.created_at)), (c) => c.amount) || null } as ReportRow;
  }).filter((x) => Number(x.leads) || Number(x.viewings) || Number(x.reservations) || Number(x.won) || Number(x.commission));
  return {
    filters: ['project', 'agent'],
    kpis: [
      k.metric('Leads που ανατέθηκαν', 'int', (r) => LL.filter((l) => l.assigned_to && inRange(l.created_at, r)).length),
      k.metric('Viewings', 'int', (r) => VV.filter((v) => inRange(v.scheduled_at, r)).length),
      k.metric('Κρατήσεις', 'int', (r) => RR.filter((x) => inRange(x.reserved_at, r)).length),
      k.metric('Πωλήσεις', 'int', (r) => wonIn(r).length),
    ],
    trend: k.trend('Τάση πωλήσεων', 'int', LL.filter(won), (l) => l.won_at ?? l.created_at),
    totals: [
      k.metric('Leads που ανατέθηκαν', 'int', (r) => LL.filter((l) => l.assigned_to && inRange(l.created_at, r)).length),
      k.metric('Με πρώτη απάντηση', 'int', (r) => LL.filter((l) => l.assigned_to && l.first_response_at && inRange(l.created_at, r)).length),
      k.metric('Viewings', 'int', (r) => VV.filter((v) => inRange(v.scheduled_at, r)).length),
      k.metric('Κρατήσεις', 'int', (r) => RR.filter((x) => inRange(x.reserved_at, r)).length),
      k.metric('Πωλήσεις', 'int', (r) => wonIn(r).length),
      k.metric('Προμήθειες', 'money', (r) => sum(CC.filter((c) => inRange(c.created_at, r)), (c) => c.amount)),
    ],
    breakdowns: [
      k.breakdown('Πωλήσεις ανά πωλητή', 'int', wonIn(k.R), (l) => who.get(l.assigned_to), () => 1, true),
      k.breakdown('Viewings ανά πωλητή', 'int', VV.filter((v) => k.inR(v.scheduled_at)), (v) => who.get(v.agent_id), () => 1, true),
      k.breakdown('Προμήθειες ανά πωλητή', 'money', CC.filter((c) => k.inR(c.created_at)), (c) => who.get(c.profile_id), (c) => Number(c.amount ?? 0), true),
    ],
    details: [{ key: 'agents', label: 'Ανά πωλητή', columns: [{ key: 'agent', label: 'Πωλητής', data: true }, { key: 'leads', label: 'Leads', fmt: 'int' }, { key: 'contacted', label: 'Με απάντηση', fmt: 'int' }, { key: 'viewings', label: 'Viewings', fmt: 'int' }, { key: 'reservations', label: 'Κρατήσεις', fmt: 'int' }, { key: 'won', label: 'Πωλήσεις', fmt: 'int' }, { key: 'conv', label: 'Μετατροπή', fmt: 'pct' }, { key: 'response', label: 'Χρόνος 1ης απάντησης (λεπτά)', fmt: 'int' }, { key: 'commission', label: 'Προμήθειες', fmt: 'money' }], rows: per }],
    note: 'Χρόνος 1ης απάντησης: διάμεσος, από τη δημιουργία του lead μέχρι την πρώτη επαφή.',
  };
}

/* ── Έργα & μονάδες ──────────────────────────────────────────────────── */
async function inventory(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [projects, units, con] = await Promise.all([
    rows(db.from('projects').select('id, name').order('name')),
    rows(db.from('units').select('id, project_id, unit_number, type, bedrooms, sqm, internal_sqm, price, status').order('unit_number').limit(10000)),
    rows(db.from('contracts').select('unit_id, status, signed_at, created_at, total_price').eq('status', 'signed').limit(10000)),
  ]);
  const U = units.filter((u) => !f.project || u.project_id === f.project);
  const uById = new Map(U.map((u) => [u.id, u]));
  const area = (u: any) => Number(u?.internal_sqm ?? u?.sqm ?? 0) || 0;
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const C = con.filter((c) => uById.has(c.unit_id));
  const cDate = (c: any) => c.signed_at ?? c.created_at;
  const soldIn = (r: DateRange) => C.filter((c) => inRange(cDate(c), r));
  const ppmSold = (r: DateRange) => { const w = soldIn(r).filter((c) => area(uById.get(c.unit_id)) > 0 && Number(c.total_price) > 0); return w.length ? sum(w, (c) => c.total_price) / sum(w, (c) => area(uById.get(c.unit_id))) : null; };
  const listPpm = (() => { const w = U.filter((u) => area(u) > 0 && Number(u.price) > 0 && u.status === 'available'); return w.length ? sum(w, (u) => u.price) / sum(w, area) : null; })();
  return {
    filters: ['project'],
    kpis: [
      { label: 'Μονάδες', fmt: 'int', cur: U.length, prev: null },
      { label: 'Διαθέσιμες', fmt: 'int', cur: U.filter((u) => u.status === 'available').length, prev: null, hint: listPpm ? undefined : undefined },
      k.metric('Πωλήθηκαν στην περίοδο', 'int', (r) => soldIn(r).length),
      k.metric('Μέση τιμή / m² πωλήσεων', 'money', ppmSold),
    ],
    trend: k.trend('Τάση πωλήσεων μονάδων', 'int', C, cDate),
    totals: [
      k.metric('Μονάδες που πουλήθηκαν', 'int', (r) => soldIn(r).length),
      k.metric('Αξία πωλήσεων', 'money', (r) => sum(soldIn(r), (c) => c.total_price)),
      k.metric('Πωλημένα m²', 'm2', (r) => sum(soldIn(r), (c) => area(uById.get(c.unit_id))) || null),
      k.metric('Μέση τιμή / m² πωλήσεων', 'money', ppmSold),
    ],
    breakdowns: [
      k.breakdown('Διαθέσιμες ανά έργο', 'int', U.filter((u) => u.status === 'available'), (u) => pname.get(u.project_id), () => 1, true),
      k.breakdown('Αξία διαθέσιμων ανά έργο', 'money', U.filter((u) => u.status === 'available'), (u) => pname.get(u.project_id), (u) => Number(u.price ?? 0), true),
      k.breakdown('Μονάδες ανά κατάσταση', 'int', U, (u) => UNIT_ST[u.status] ?? u.status),
    ],
    details: [
      { key: 'projects', label: 'Ανά έργο', columns: [{ key: 'project', label: 'Έργο', data: true }, { key: 'total', label: 'Μονάδες', fmt: 'int' }, { key: 'available', label: 'Διαθέσιμες', fmt: 'int' }, { key: 'reserved', label: 'Κρατημένες', fmt: 'int' }, { key: 'sold', label: 'Πωλημένες', fmt: 'int' }, { key: 'soldPct', label: '% πωλήσεων', fmt: 'pct' }, { key: 'ppm', label: 'Τιμή / m²', fmt: 'money' }, { key: 'stock', label: 'Αξία διαθέσιμων', fmt: 'money' }],
        rows: projects.filter((p) => !f.project || p.id === f.project).map((p) => { const us = U.filter((u) => u.project_id === p.id); const s = us.filter((u) => SOLD.includes(u.status)).length; const w = us.filter((u) => area(u) > 0 && Number(u.price) > 0); return { project: p.name, total: us.length, available: us.filter((u) => u.status === 'available').length, reserved: us.filter((u) => u.status === 'reserved').length, sold: s, soldPct: ratio(s, us.length), ppm: w.length ? sum(w, (u) => u.price) / sum(w, area) : null, stock: sum(us.filter((u) => u.status === 'available'), (u) => u.price) } as ReportRow; }).filter((x) => Number(x.total) > 0) },
      { key: 'units', label: 'Μονάδες', columns: [{ key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'type', label: 'Τύπος', data: true }, { key: 'beds', label: 'Υπνοδ.', fmt: 'int' }, { key: 'area', label: 'Εμβαδόν', fmt: 'm2' }, { key: 'price', label: 'Τιμή', fmt: 'money' }, { key: 'ppm', label: 'Τιμή / m²', fmt: 'money' }, { key: 'status', label: 'Κατάσταση' }],
        rows: U.map((u) => ({ project: pname.get(u.project_id) ?? '—', unit: u.unit_number ?? '—', type: u.type ?? '', beds: u.bedrooms ?? null, area: area(u) || null, price: u.price == null ? null : Number(u.price), ppm: area(u) && Number(u.price) ? Number(u.price) / area(u) : null, status: UNIT_ST[u.status] ?? u.status ?? '' })) },
    ],
    note: 'Μονάδες και διαθέσιμες: σημερινή εικόνα. Οι πωλήσεις ακολουθούν τις ημερομηνίες.',
  };
}

/* ── Εισπράξεις & δόσεις ─────────────────────────────────────────────── */
async function collections(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [sch, pay] = await Promise.all([
    rows(db.from('payment_schedules').select('id, contract_id, installment_number, description, due_date, amount, contracts(status, units(unit_number, project_id, projects(name)), contacts:buyer_contact_id(full_name))').order('due_date').limit(30000)),
    rows(db.from('payments').select('id, payment_schedule_id, contract_id, amount_paid, paid_at, method, contracts(units(unit_number, project_id, projects(name)), contacts:buyer_contact_id(full_name))').limit(30000)),
  ]);
  const okP = (p: string | null | undefined) => !f.project || p === f.project;
  const paidBy = new Map<string, number>();
  for (const p of pay) if (p.payment_schedule_id) paidBy.set(p.payment_schedule_id, (paidBy.get(p.payment_schedule_id) ?? 0) + Number(p.amount_paid ?? 0));
  const today = new Date().toISOString().slice(0, 10);
  const S = sch.filter((s) => s.contracts?.status !== 'cancelled' && okP(s.contracts?.units?.project_id)).map((s) => { const amt = Number(s.amount ?? 0), pd = paidBy.get(s.id) ?? 0, open = Math.max(0, amt - pd); return { s, amt, pd, open, st: open <= 0.5 ? 'Εξοφλήθηκε' : s.due_date && s.due_date < today ? 'Ληξιπρόθεσμη' : pd > 0 ? 'Μερικώς' : 'Ανοιχτή' }; });
  const P = pay.filter((p) => okP(p.contracts?.units?.project_id));
  const payIn = (r: DateRange) => P.filter((p) => inRange(p.paid_at, r));
  const dueIn = (r: DateRange) => S.filter((x) => inRange(x.s.due_date, r));
  const overdue = S.filter((x) => x.st === 'Ληξιπρόθεσμη');
  return {
    filters: ['project'],
    kpis: [
      k.metric('Εισπράχθηκαν', 'money', (r) => sum(payIn(r), (p) => p.amount_paid)),
      k.metric('Δόσεις που έληξαν', 'money', (r) => sum(dueIn(r), (x) => x.amt)),
      { label: 'Ληξιπρόθεσμα σήμερα', fmt: 'money', cur: sum(overdue, (x) => x.open), prev: null, hint: `${overdue.length} δόσεις` },
      { label: 'Συνολικό υπόλοιπο', fmt: 'money', cur: sum(S, (x) => x.open), prev: null },
    ],
    trend: k.trend('Τάση εισπράξεων', 'money', P, (p) => p.paid_at, (p) => Number(p.amount_paid ?? 0)),
    totals: [
      k.metric('Εισπράχθηκαν', 'money', (r) => sum(payIn(r), (p) => p.amount_paid)),
      k.metric('Πληρωμές', 'int', (r) => payIn(r).length),
      k.metric('Δόσεις που έληξαν', 'money', (r) => sum(dueIn(r), (x) => x.amt)),
      k.metric('Από αυτές εξοφλήθηκαν', 'money', (r) => sum(dueIn(r), (x) => Math.min(x.amt, x.pd))),
      k.metric('Ποσοστό είσπραξης', 'pct', (r) => { const d = dueIn(r); return ratio(sum(d, (x) => Math.min(x.amt, x.pd)), sum(d, (x) => x.amt)); }),
    ],
    breakdowns: [
      k.breakdown('Εισπράξεις ανά έργο', 'money', payIn(k.R), (p) => p.contracts?.units?.projects?.name, (p) => Number(p.amount_paid ?? 0), true),
      k.breakdown('Εισπράξεις ανά τρόπο πληρωμής', 'money', payIn(k.R), (p) => p.method || 'Χωρίς τρόπο', (p) => Number(p.amount_paid ?? 0), true),
      k.breakdown('Ληξιπρόθεσμα ανά έργο', 'money', overdue, (x) => x.s.contracts?.units?.projects?.name, (x) => x.open, true),
    ],
    details: [
      { key: 'due', label: 'Δόσεις της περιόδου', columns: [{ key: 'due', label: 'Λήξη', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'inst', label: 'Δόση', data: true }, { key: 'amount', label: 'Ποσό', fmt: 'money' }, { key: 'paid', label: 'Πληρώθηκε', fmt: 'money' }, { key: 'open', label: 'Υπόλοιπο', fmt: 'money' }, { key: 'status', label: 'Κατάσταση' }],
        rows: dueIn(k.R).map((x) => ({ due: x.s.due_date, buyer: x.s.contracts?.contacts?.full_name ?? '—', project: x.s.contracts?.units?.projects?.name ?? '—', unit: x.s.contracts?.units?.unit_number ?? '—', inst: x.s.description || `#${x.s.installment_number}`, amount: x.amt, paid: x.pd, open: x.open, status: x.st })) },
      { key: 'overdue', label: 'Ληξιπρόθεσμες', columns: [{ key: 'due', label: 'Λήξη', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'open', label: 'Υπόλοιπο', fmt: 'money' }, { key: 'days', label: 'Ημέρες καθυστέρησης', fmt: 'int' }],
        rows: overdue.map((x) => ({ due: x.s.due_date, buyer: x.s.contracts?.contacts?.full_name ?? '—', project: x.s.contracts?.units?.projects?.name ?? '—', unit: x.s.contracts?.units?.unit_number ?? '—', open: x.open, days: Math.floor((Date.now() - Date.parse(x.s.due_date)) / 864e5) })), empty: 'Δεν υπάρχουν ληξιπρόθεσμες δόσεις.' },
      { key: 'payments', label: 'Πληρωμές', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'amount', label: 'Ποσό', fmt: 'money' }, { key: 'method', label: 'Τρόπος', data: true }],
        rows: payIn(k.R).map((p) => ({ date: p.paid_at, buyer: p.contracts?.contacts?.full_name ?? '—', project: p.contracts?.units?.projects?.name ?? '—', unit: p.contracts?.units?.unit_number ?? '—', amount: Number(p.amount_paid ?? 0), method: p.method ?? '' })) },
    ],
  };
}

/* ── Διαχείριση ακινήτων ─────────────────────────────────────────────── */
async function property(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [projects, units, T, CH] = await Promise.all([
    rows(db.from('projects').select('id, name')),
    rows(db.from('units').select('id, project_id, unit_number, annual_maintenance_fee, status').limit(10000)),
    rows(db.from('maintenance_tickets').select('project_id, title, category, priority, status, created_at, resolved_at, units(unit_number)').limit(20000)),
    rows(db.from('unit_charges').select('unit_id, kind, description, amount, status, due_date, paid_at, created_at, period_year, contacts:contact_id(full_name)').limit(20000)),
  ]);
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const unit = new Map(units.map((u) => [u.id, u]));
  const okP = (p: string | null | undefined) => !f.project || p === f.project;
  const TT = T.filter((t) => okP(t.project_id));
  const CC = CH.filter((c) => c.status !== 'cancelled' && okP(unit.get(c.unit_id)?.project_id));
  const tIn = (r: DateRange) => TT.filter((t) => inRange(t.created_at, r));
  const cDate = (c: any) => c.due_date ?? c.created_at;
  const cIn = (r: DateRange) => CC.filter((c) => inRange(cDate(c), r));
  const paidIn = (r: DateRange) => CC.filter((c) => c.status === 'paid' && inRange(c.paid_at ?? c.created_at, r));
  const avgRes = (r: DateRange) => { const d = tIn(r).filter((t) => t.resolved_at).map((t) => (Date.parse(t.resolved_at) - Date.parse(t.created_at)) / 864e5).filter((x) => x >= 0); return d.length ? sum(d, (x) => x) / d.length : null; };
  const fees = sum(units.filter((u) => okP(u.project_id)), (u) => u.annual_maintenance_fee);
  return {
    filters: ['project'],
    kpis: [
      k.metric('Αιτήματα', 'int', (r) => tIn(r).length),
      { label: 'Ανοιχτά αιτήματα', fmt: 'int', cur: TT.filter((t) => !CLOSED_TICKET.includes(t.status)).length, prev: null },
      k.metric('Χρεώσεις ιδιοκτητών', 'money', (r) => sum(cIn(r), (c) => c.amount)),
      k.metric('Εισπράχθηκαν χρεώσεις', 'money', (r) => sum(paidIn(r), (c) => c.amount)),
    ],
    trend: k.trend('Τάση αιτημάτων', 'int', TT, (t) => t.created_at),
    totals: [
      k.metric('Αιτήματα', 'int', (r) => tIn(r).length),
      k.metric('Επιλύθηκαν', 'int', (r) => tIn(r).filter((t) => t.resolved_at).length),
      k.metric('Μέσος χρόνος επίλυσης', 'days', avgRes),
      k.metric('Χρεώσεις ιδιοκτητών', 'money', (r) => sum(cIn(r), (c) => c.amount)),
      k.metric('Τέλη συντήρησης που χρεώθηκαν', 'money', (r) => sum(cIn(r).filter((c) => c.kind === 'maintenance_fee'), (c) => c.amount)),
      k.metric('Εισπράχθηκαν χρεώσεις', 'money', (r) => sum(paidIn(r), (c) => c.amount)),
      { label: 'Ετήσια τέλη συντήρησης (σύνολο μονάδων)', fmt: 'money', cur: fees || null, prev: null },
    ],
    breakdowns: [
      k.breakdown('Αιτήματα ανά κατηγορία', 'int', tIn(k.R), (t) => t.category || 'Χωρίς κατηγορία', () => 1, true),
      k.breakdown('Αιτήματα ανά έργο', 'int', tIn(k.R), (t) => pname.get(t.project_id), () => 1, true),
      k.breakdown('Χρεώσεις ανά είδος', 'money', cIn(k.R), (c) => CHARGE_KIND[c.kind] ?? c.kind, (c) => Number(c.amount ?? 0)),
    ],
    details: [
      { key: 'charges', label: 'Χρεώσεις', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'owner', label: 'Ιδιοκτήτης', data: true }, { key: 'kind', label: 'Είδος' }, { key: 'desc', label: 'Περιγραφή', data: true }, { key: 'amount', label: 'Ποσό', fmt: 'money' }, { key: 'status', label: 'Κατάσταση' }],
        rows: cIn(k.R).map((c) => ({ date: cDate(c), project: pname.get(unit.get(c.unit_id)?.project_id) ?? '—', unit: unit.get(c.unit_id)?.unit_number ?? '—', owner: c.contacts?.full_name ?? '—', kind: CHARGE_KIND[c.kind] ?? c.kind, desc: c.description ?? '', amount: Number(c.amount ?? 0), status: CHARGE_ST[c.status] ?? c.status })) },
      { key: 'tickets', label: 'Αιτήματα', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'title', label: 'Αίτημα', data: true }, { key: 'category', label: 'Κατηγορία', data: true }, { key: 'status', label: 'Κατάσταση' }, { key: 'resolved', label: 'Επιλύθηκε', fmt: 'date' }],
        rows: tIn(k.R).map((t) => ({ date: t.created_at, project: pname.get(t.project_id) ?? '—', unit: t.units?.unit_number ?? '—', title: t.title ?? '', category: t.category ?? '', status: TICKET_ST[t.status] ?? t.status ?? '', resolved: t.resolved_at })) },
    ],
  };
}

/* ── Καμπάνιες marketing ─────────────────────────────────────────────── */
async function campaigns(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const C = (await rows(db.from('marketing_campaigns').select('name, channel, status, recipients, sent, failed, skipped, opened, created_at, sent_at').neq('status', 'draft').limit(5000))).filter((c) => !f.channel || c.channel === f.channel);
  const d = (c: any) => c.sent_at ?? c.created_at;
  const cIn = (r: DateRange) => C.filter((c) => inRange(d(c), r));
  const ch = (c: any) => CHANNEL_NAME[c.channel as keyof typeof CHANNEL_NAME] ?? c.channel;
  return {
    filters: ['channel'],
    kpis: [
      k.metric('Καμπάνιες', 'int', (r) => cIn(r).length),
      k.metric('Στάλθηκαν', 'int', (r) => sum(cIn(r), (c) => c.sent)),
      k.metric('Άνοιξαν (email)', 'int', (r) => sum(cIn(r).filter((c) => c.channel === 'email'), (c) => c.opened)),
      k.metric('Απέτυχαν', 'int', (r) => sum(cIn(r), (c) => c.failed)),
    ],
    trend: k.trend('Τάση μηνυμάτων που στάλθηκαν', 'int', C, d, (c) => Number(c.sent ?? 0)),
    totals: [
      k.metric('Καμπάνιες', 'int', (r) => cIn(r).length),
      k.metric('Παραλήπτες', 'int', (r) => sum(cIn(r), (c) => c.recipients)),
      k.metric('Στάλθηκαν', 'int', (r) => sum(cIn(r), (c) => c.sent)),
      k.metric('Ποσοστό ανοίγματος (email)', 'pct', (r) => { const e = cIn(r).filter((c) => c.channel === 'email'); return ratio(sum(e, (c) => c.opened), sum(e, (c) => c.sent)); }),
      k.metric('Απέτυχαν', 'int', (r) => sum(cIn(r), (c) => c.failed)),
      k.metric('Χωρίς συγκατάθεση / διεύθυνση', 'int', (r) => sum(cIn(r), (c) => c.skipped)),
    ],
    breakdowns: [
      k.breakdown('Μηνύματα ανά κανάλι', 'int', cIn(k.R), ch, (c) => Number(c.sent ?? 0)),
      k.breakdown('Αποτυχίες ανά κανάλι', 'int', cIn(k.R), ch, (c) => Number(c.failed ?? 0)),
    ],
    details: [{ key: 'campaigns', label: 'Καμπάνιες', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'name', label: 'Καμπάνια', data: true }, { key: 'channel', label: 'Κανάλι' }, { key: 'status', label: 'Κατάσταση' }, { key: 'recipients', label: 'Παραλήπτες', fmt: 'int' }, { key: 'sent', label: 'Στάλθηκαν', fmt: 'int' }, { key: 'opened', label: 'Άνοιξαν', fmt: 'int' }, { key: 'failed', label: 'Απέτυχαν', fmt: 'int' }],
      rows: cIn(k.R).map((c) => ({ date: d(c), name: c.name, channel: ch(c), status: CAMP_ST[c.status] ?? c.status, recipients: c.recipients ?? 0, sent: c.sent ?? 0, opened: c.channel === 'email' ? c.opened ?? 0 : null, failed: c.failed ?? 0 })) }],
  };
}

/* ── Tasks & λίστες κλήσεων ──────────────────────────────────────────── */
async function tasks(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const k = kit(f);
  const [ppl, lists, items, T] = await Promise.all([
    rows(db.from('profiles').select('id, full_name')),
    rows(db.from('call_lists').select('id, title, assigned_to, due_at, status, created_at').neq('status', 'cancelled').limit(5000)),
    rows(db.from('call_list_items').select('list_id, done, outcome, done_at, done_by').limit(60000)),
    rows(db.from('tasks').select('assigned_to, is_done, due_at, created_at, completed_at').limit(30000)),
  ]);
  const who = new Map(ppl.map((p) => [p.id, p.full_name as string]));
  const ag = (id: string | null | undefined) => !f.agent || id === f.agent;
  const L = lists.filter((l) => ag(l.assigned_to));
  const owner = new Map(L.map((l) => [l.id, l.assigned_to]));
  const I = items.filter((i) => owner.has(i.list_id));
  const TT = T.filter((t) => ag(t.assigned_to));
  const callsIn = (r: DateRange) => I.filter((i) => i.done && inRange(i.done_at, r));
  const now = Date.now();
  const LR = L.filter((l) => k.inR(l.created_at));
  return {
    filters: ['agent'],
    kpis: [
      k.metric('Λίστες κλήσεων', 'int', (r) => L.filter((l) => inRange(l.created_at, r)).length),
      k.metric('Κλήσεις έγιναν', 'int', (r) => callsIn(r).length),
      k.metric('Εργασίες ολοκληρώθηκαν', 'int', (r) => TT.filter((t) => t.is_done && inRange(t.completed_at, r)).length),
      { label: 'Εργασίες σε καθυστέρηση', fmt: 'int', cur: TT.filter((t) => !t.is_done && t.due_at && Date.parse(t.due_at) < now).length, prev: null },
    ],
    trend: k.trend('Τάση κλήσεων', 'int', I.filter((i) => i.done), (i) => i.done_at),
    totals: [
      k.metric('Λίστες κλήσεων', 'int', (r) => L.filter((l) => inRange(l.created_at, r)).length),
      k.metric('Κλήσεις έγιναν', 'int', (r) => callsIn(r).length),
      k.metric('Ενδιαφέρον / viewing', 'int', (r) => callsIn(r).filter((i) => ['Ενδιαφέρεται', 'Κλείστηκε viewing'].includes(i.outcome)).length),
      k.metric('Νέες εργασίες', 'int', (r) => TT.filter((t) => inRange(t.created_at, r)).length),
      k.metric('Εργασίες ολοκληρώθηκαν', 'int', (r) => TT.filter((t) => t.is_done && inRange(t.completed_at, r)).length),
    ],
    breakdowns: [
      k.breakdown('Αποτελέσματα κλήσεων', 'int', callsIn(k.R), (i) => i.outcome || 'Χωρίς αποτέλεσμα'),
      k.breakdown('Κλήσεις ανά άτομο', 'int', callsIn(k.R), (i) => who.get(i.done_by ?? owner.get(i.list_id)), () => 1, true),
    ],
    details: [{ key: 'lists', label: 'Λίστες κλήσεων', columns: [{ key: 'date', label: 'Δημιουργήθηκε', fmt: 'date' }, { key: 'title', label: 'Λίστα', data: true }, { key: 'person', label: 'Ανατέθηκε σε', data: true }, { key: 'total', label: 'Επαφές', fmt: 'int' }, { key: 'done', label: 'Κλήθηκαν', fmt: 'int' }, { key: 'pct', label: 'Πρόοδος', fmt: 'pct' }, { key: 'due', label: 'Προθεσμία', fmt: 'date' }, { key: 'status', label: 'Κατάσταση' }],
      rows: LR.map((l) => { const its = I.filter((i) => i.list_id === l.id); const dn = its.filter((i) => i.done).length; return { date: l.created_at, title: l.title, person: who.get(l.assigned_to) ?? '—', total: its.length, done: dn, pct: ratio(dn, its.length), due: l.due_at, status: its.length && dn >= its.length ? 'Ολοκληρώθηκε' : l.due_at && Date.parse(l.due_at) < now ? 'Καθυστερεί' : dn ? 'Σε εξέλιξη' : 'Ανοιχτή' }; }) }],
  };
}
