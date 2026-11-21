import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CHANNEL_NAME } from '@/lib/campaigns-shared';
import { LEAD_SOURCES, periodRange, type BuiltReport, type ReportFilters, type ReportRow } from '@/lib/reports-shared';

/**
 * Αναφορές real estate για το Reports. Server-only. Κάθε αναφορά: σύνοψη,
 * γράφημα, ένας ή περισσότεροι πίνακες («προβολές») και ποια φίλτρα δέχεται.
 * Οι ερωτήματα είναι αμυντικά: αν λείπει πίνακας/στήλη, η αναφορά βγαίνει κενή.
 */

type Db = any;
const SRC = Object.fromEntries(LEAD_SOURCES) as Record<string, string>;
const UNIT_ST: Record<string, string> = { available: 'Διαθέσιμη', reserved: 'Κρατημένη', sold: 'Πωλημένη', handed_over: 'Παραδόθηκε', not_released: 'Μη διαθέσιμη', blocked: 'Μπλοκαρισμένη' };
const RES_ST: Record<string, string> = { active: 'Ενεργή', converted: 'Έγινε συμβόλαιο', expired: 'Έληξε', cancelled: 'Ακυρώθηκε' };
const CON_ST: Record<string, string> = { draft: 'Πρόχειρο', sent: 'Στάλθηκε', signed: 'Υπογράφηκε', cancelled: 'Ακυρώθηκε' };
const TICKET_ST: Record<string, string> = { open: 'Ανοιχτό', in_progress: 'Σε εξέλιξη', waiting: 'Σε αναμονή', resolved: 'Επιλύθηκε', closed: 'Κλειστό', cancelled: 'Ακυρώθηκε' };
const PRI: Record<string, string> = { low: 'Χαμηλή', medium: 'Μεσαία', normal: 'Κανονική', high: 'Υψηλή', urgent: 'Επείγον' };
const CAMP_ST: Record<string, string> = { draft: 'Πρόχειρο', sending: 'Αποστολή…', sent: 'Στάλθηκε', cancelled: 'Ακυρώθηκε' };
const SOLD = ['sold', 'handed_over'];
const CLOSED_TICKET = ['resolved', 'closed', 'cancelled'];
const CLOSED_LEAD = ['won', 'lost', 'nurture', 'no_response', 'retargeting', 'reactivation'];

async function rows(p: PromiseLike<any>): Promise<any[]> { try { const r = await p; return (r?.data ?? []) as any[]; } catch { return []; } }
const inRange = (iso: string | null | undefined, r: { from: string | null; to: string | null }) => !!iso && (!r.from || iso >= r.from) && (!r.to || iso <= r.to);
const sum = <T,>(a: T[], f: (x: T) => number) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0);
const ratio = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const month = (iso: string) => iso.slice(0, 7);
const by = <T,>(a: T[], k: (x: T) => string | null | undefined) => { const m = new Map<string, T[]>(); for (const x of a) { const key = k(x); if (!key) continue; const l = m.get(key) ?? []; l.push(x); m.set(key, l); } return m; };

export async function buildReReport(key: string, f: ReportFilters): Promise<BuiltReport | null> {
  const db: Db = await createSupabaseServerClient();
  const r = periodRange(f);
  switch (key) {
    case 'sales': return sales(db, f, r);
    case 'leads': return leads(db, f, r);
    case 'agents': return agents(db, f, r);
    case 'inventory': return inventory(db, f);
    case 'collections': return collections(db, f, r);
    case 'property': return property(db, f, r);
    case 'campaigns': return campaigns(db, f, r);
    case 'tasks': return tasks(db, f, r);
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

type Range = { from: string | null; to: string | null };

async function sales(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const [projects, units, res, con, pay] = await Promise.all([
    rows(db.from('projects').select('id, name')),
    rows(db.from('units').select('id, project_id, unit_number, price')),
    rows(db.from('reservations').select('id, unit_id, reserved_at, deposit_amount, deposit_paid, status, contacts:buyer_contact_id(full_name)').order('reserved_at', { ascending: false }).limit(5000)),
    rows(db.from('contracts').select('id, unit_id, status, signed_at, created_at, total_price, contacts:buyer_contact_id(full_name)').order('created_at', { ascending: false }).limit(5000)),
    rows(db.from('payments').select('contract_id, amount_paid, paid_at').limit(20000)),
  ]);
  const unit = new Map(units.map((u) => [u.id, u]));
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const projOf = (unitId: string) => unit.get(unitId)?.project_id as string | undefined;
  const okProj = (unitId: string) => !f.project || projOf(unitId) === f.project;
  const R = res.filter((x) => okProj(x.unit_id) && inRange(x.reserved_at, r));
  const C = con.filter((x) => okProj(x.unit_id) && x.status === 'signed' && inRange(x.signed_at ?? x.created_at, r));
  const conProj = new Map(con.map((c) => [c.id, projOf(c.unit_id)]));
  const P = pay.filter((p) => (!f.project || conProj.get(p.contract_id) === f.project) && inRange(p.paid_at, r));
  const perProj = projects.filter((p) => !f.project || p.id === f.project).map((p) => {
    const rs = R.filter((x) => projOf(x.unit_id) === p.id);
    const cs = C.filter((x) => projOf(x.unit_id) === p.id);
    const value = sum(cs, (c) => c.total_price);
    return { project: p.name, reservations: rs.length, contracts: cs.length, value, collected: sum(P.filter((x) => conProj.get(x.contract_id) === p.id), (x) => x.amount_paid), avg: cs.length ? value / cs.length : null } as ReportRow;
  }).filter((x) => Number(x.reservations) || Number(x.contracts) || Number(x.collected));
  const value = sum(C, (c) => c.total_price);
  return {
    filters: ['period', 'project'],
    summary: [
      { label: 'Κρατήσεις', value: R.length, fmt: 'int' },
      { label: 'Συμβόλαια', value: C.length, fmt: 'int' },
      { label: 'Αξία πωλήσεων', value, fmt: 'money' },
      { label: 'Εισπράξεις', value: sum(P, (p) => p.amount_paid), fmt: 'money' },
    ],
    chart: { title: 'Αξία πωλήσεων ανά έργο', dataLabels: true, labels: perProj.map((x) => String(x.project)), series: [{ name: 'Αξία συμβολαίων', values: perProj.map((x) => Number(x.value)) }], fmt: 'money' },
    views: [
      { key: 'projects', label: 'Ανά έργο', columns: [{ key: 'project', label: 'Έργο', data: true }, { key: 'reservations', label: 'Κρατήσεις', fmt: 'int' }, { key: 'contracts', label: 'Συμβόλαια', fmt: 'int' }, { key: 'value', label: 'Αξία συμβολαίων', fmt: 'money' }, { key: 'collected', label: 'Εισπράχθηκαν', fmt: 'money' }, { key: 'avg', label: 'Μέση τιμή', fmt: 'money' }], rows: perProj },
      { key: 'reservations', label: 'Κρατήσεις', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'deposit', label: 'Προκαταβολή', fmt: 'money' }, { key: 'paid', label: 'Πληρώθηκε' }, { key: 'status', label: 'Κατάσταση' }],
        rows: R.map((x) => ({ date: x.reserved_at, buyer: x.contacts?.full_name ?? '—', project: pname.get(projOf(x.unit_id) ?? '') ?? '—', unit: unit.get(x.unit_id)?.unit_number ?? '—', deposit: x.deposit_amount == null ? null : Number(x.deposit_amount), paid: x.deposit_paid ? 'Ναι' : 'Όχι', status: RES_ST[x.status] ?? x.status })) },
      { key: 'contracts', label: 'Συμβόλαια', columns: [{ key: 'date', label: 'Υπογραφή', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'price', label: 'Τιμή', fmt: 'money' }, { key: 'status', label: 'Κατάσταση' }],
        rows: C.map((x) => ({ date: x.signed_at ?? x.created_at, buyer: x.contacts?.full_name ?? '—', project: pname.get(projOf(x.unit_id) ?? '') ?? '—', unit: unit.get(x.unit_id)?.unit_number ?? '—', price: x.total_price == null ? null : Number(x.total_price), status: CON_ST[x.status] ?? x.status })) },
    ],
  };
}

async function leads(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const [L, spendRows] = await Promise.all([
    rows(db.from('leads').select('id, source, status, won_at, created_at, preferred_project_id').is('deleted_at', null).limit(20000)),
    rows(db.from('marketing_spend').select('id, month, source, amount, note').order('month', { ascending: false })),
  ]);
  const leadsIn = L.filter((l) => inRange(l.created_at, r) && (!f.project || l.preferred_project_id === f.project));
  const spend = spendRows.filter((s) => (!r.from || s.month >= r.from.slice(0, 7)) && (!r.to || s.month <= r.to));
  const won = (l: any) => l.status === 'won' || !!l.won_at;
  const keys = Array.from(new Set([...leadsIn.map((l) => l.source ?? 'other'), ...spend.map((s) => s.source)]));
  const bySrc = keys.map((k) => {
    const ls = leadsIn.filter((l) => (l.source ?? 'other') === k);
    const w = ls.filter(won).length;
    const cost = sum(spend.filter((s) => s.source === k), (s) => s.amount);
    return { source: SRC[k] ?? k, leads: ls.length, won: w, conv: ratio(w, ls.length), cost, cpl: ls.length && cost ? cost / ls.length : null, cps: w && cost ? cost / w : null } as ReportRow;
  }).sort((a, b) => Number(b.leads) - Number(a.leads));
  const months = Array.from(new Set(leadsIn.map((l) => month(l.created_at)))).sort();
  const byMonth = months.map((m) => { const ls = leadsIn.filter((l) => month(l.created_at) === m); const w = ls.filter(won).length; return { month: `${m}-01`, leads: ls.length, won: w, conv: ratio(w, ls.length), cost: sum(spend.filter((s) => String(s.month).slice(0, 7) === m), (s) => s.amount) } as ReportRow; }).reverse();
  const totalCost = sum(spend, (s) => s.amount);
  const totalWon = leadsIn.filter(won).length;
  return {
    filters: ['period', 'project'],
    summary: [
      { label: 'Leads', value: leadsIn.length, fmt: 'int' },
      { label: 'Μετατροπή σε πώληση', value: ratio(totalWon, leadsIn.length), fmt: 'pct' },
      { label: 'Κόστος marketing', value: totalCost, fmt: 'money' },
      { label: 'Κόστος ανά lead', value: leadsIn.length && totalCost ? totalCost / leadsIn.length : null, fmt: 'money' },
    ],
    chart: { title: 'Leads ανά πηγή', labels: bySrc.map((x) => String(x.source)), series: [{ name: 'Leads', values: bySrc.map((x) => Number(x.leads)) }, { name: 'Πωλήσεις', values: bySrc.map((x) => Number(x.won)) }], fmt: 'int' },
    views: [
      { key: 'sources', label: 'Ανά πηγή', columns: [{ key: 'source', label: 'Πηγή' }, { key: 'leads', label: 'Leads', fmt: 'int' }, { key: 'won', label: 'Πωλήσεις', fmt: 'int' }, { key: 'conv', label: 'Μετατροπή', fmt: 'pct' }, { key: 'cost', label: 'Κόστος', fmt: 'money' }, { key: 'cpl', label: 'Κόστος / lead', fmt: 'money' }, { key: 'cps', label: 'Κόστος / πώληση', fmt: 'money' }], rows: bySrc },
      { key: 'months', label: 'Ανά μήνα', columns: [{ key: 'month', label: 'Μήνας', fmt: 'month' }, { key: 'leads', label: 'Leads', fmt: 'int' }, { key: 'won', label: 'Πωλήσεις', fmt: 'int' }, { key: 'conv', label: 'Μετατροπή', fmt: 'pct' }, { key: 'cost', label: 'Κόστος', fmt: 'money' }], rows: byMonth },
      { key: 'spend', label: 'Κόστος marketing', columns: [{ key: 'month', label: 'Μήνας', fmt: 'month' }, { key: 'source', label: 'Πηγή' }, { key: 'amount', label: 'Ποσό', fmt: 'money' }, { key: 'note', label: 'Σημείωση', data: true }, { key: '_id', label: '' }],
        rows: spend.map((s) => ({ month: s.month, source: SRC[s.source] ?? s.source, amount: Number(s.amount ?? 0), note: s.note ?? '', _id: s.id })), empty: 'Καταχωρίστε το κόστος διαφήμισης ανά μήνα και πηγή για να βγει το κόστος ανά lead.' },
    ],
    note: 'Το κόστος ανά lead προκύπτει από το κόστος marketing που καταχωρίζετε ανά μήνα και πηγή.',
  };
}

async function agents(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const [ppl, L, V, R, C] = await Promise.all([
    rows(db.from('profiles').select('id, full_name, role').in('role', ['admin', 'sales', 'management']).order('full_name')),
    rows(db.from('leads').select('assigned_to, created_at, first_response_at, status, won_at, preferred_project_id').is('deleted_at', null).limit(20000)),
    rows(db.from('viewings').select('agent_id, scheduled_at, status, project_id').limit(20000)),
    rows(db.from('reservations').select('created_by, reserved_at, units(project_id)').limit(10000)),
    rows(db.from('commissions').select('profile_id, amount, status, created_at').limit(10000)),
  ]);
  const proj = (p: string | null | undefined) => !f.project || p === f.project;
  const list = ppl.filter((p) => !f.agent || p.id === f.agent).map((p) => {
    const ls = L.filter((l) => l.assigned_to === p.id && inRange(l.created_at, r) && proj(l.preferred_project_id));
    const responded = ls.filter((l) => l.first_response_at);
    const mins = responded.map((l) => (Date.parse(l.first_response_at) - Date.parse(l.created_at)) / 60000).filter((m) => m >= 0);
    const won = L.filter((l) => l.assigned_to === p.id && (l.status === 'won' || l.won_at) && inRange(l.won_at ?? l.created_at, r) && proj(l.preferred_project_id)).length;
    return {
      agent: p.full_name ?? '—', leads: ls.length, contacted: responded.length,
      viewings: V.filter((v) => v.agent_id === p.id && v.status !== 'cancelled' && inRange(v.scheduled_at, r) && proj(v.project_id)).length,
      reservations: R.filter((x) => x.created_by === p.id && inRange(x.reserved_at, r) && proj(x.units?.project_id)).length,
      won, conv: ratio(won, ls.length),
      response: mins.length ? Math.round(mins.sort((a, b) => a - b)[Math.floor(mins.length / 2)]) : null,
      commission: sum(C.filter((c) => c.profile_id === p.id && inRange(c.created_at, r)), (c) => c.amount),
    } as ReportRow;
  }).filter((x) => Number(x.leads) || Number(x.viewings) || Number(x.reservations) || Number(x.won) || Number(x.commission)).sort((a, b) => Number(b.won) - Number(a.won) || Number(b.leads) - Number(a.leads));
  return {
    filters: ['period', 'project', 'agent'],
    summary: [
      { label: 'Leads που ανατέθηκαν', value: sum(list, (x) => Number(x.leads)), fmt: 'int' },
      { label: 'Viewings', value: sum(list, (x) => Number(x.viewings)), fmt: 'int' },
      { label: 'Πωλήσεις', value: sum(list, (x) => Number(x.won)), fmt: 'int' },
      { label: 'Προμήθειες', value: sum(list, (x) => Number(x.commission)), fmt: 'money' },
    ],
    chart: { title: 'Πωλήσεις και viewings ανά πωλητή', dataLabels: true, labels: list.map((x) => String(x.agent)), series: [{ name: 'Πωλήσεις', values: list.map((x) => Number(x.won)) }, { name: 'Viewings', values: list.map((x) => Number(x.viewings)) }], fmt: 'int' },
    views: [{ key: 'agents', label: 'Ανά πωλητή', columns: [{ key: 'agent', label: 'Πωλητής', data: true }, { key: 'leads', label: 'Leads', fmt: 'int' }, { key: 'contacted', label: 'Με απάντηση', fmt: 'int' }, { key: 'viewings', label: 'Viewings', fmt: 'int' }, { key: 'reservations', label: 'Κρατήσεις', fmt: 'int' }, { key: 'won', label: 'Πωλήσεις', fmt: 'int' }, { key: 'conv', label: 'Μετατροπή', fmt: 'pct' }, { key: 'response', label: 'Χρόνος 1ης απάντησης (λεπτά)', fmt: 'int' }, { key: 'commission', label: 'Προμήθειες', fmt: 'money' }], rows: list }],
    note: 'Χρόνος 1ης απάντησης: διάμεσος, από τη δημιουργία του lead μέχρι την πρώτη επαφή.',
  };
}

async function inventory(db: Db, f: ReportFilters): Promise<BuiltReport> {
  const [projects, units] = await Promise.all([
    rows(db.from('projects').select('id, name').order('name')),
    rows(db.from('units').select('id, project_id, unit_number, type, bedrooms, sqm, internal_sqm, covered_veranda_sqm, price, status').order('unit_number').limit(10000)),
  ]);
  const U = units.filter((u) => !f.project || u.project_id === f.project);
  const area = (u: any) => Number(u.internal_sqm ?? u.sqm ?? 0) || 0;
  const ppm = (us: any[]) => { const w = us.filter((u) => area(u) > 0 && Number(u.price) > 0); return w.length ? sum(w, (u) => u.price) / sum(w, area) : null; };
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const per = projects.filter((p) => !f.project || p.id === f.project).map((p) => {
    const us = U.filter((u) => u.project_id === p.id);
    const sold = us.filter((u) => SOLD.includes(u.status)).length;
    return { project: p.name, total: us.length, available: us.filter((u) => u.status === 'available').length, reserved: us.filter((u) => u.status === 'reserved').length, sold, soldPct: ratio(sold, us.length), ppm: ppm(us), stock: sum(us.filter((u) => u.status === 'available'), (u) => u.price) } as ReportRow;
  }).filter((x) => Number(x.total) > 0);
  return {
    filters: ['project'],
    summary: [
      { label: 'Μονάδες', value: U.length, fmt: 'int' },
      { label: 'Διαθέσιμες', value: U.filter((u) => u.status === 'available').length, fmt: 'int' },
      { label: 'Πωλημένες', value: U.filter((u) => SOLD.includes(u.status)).length, fmt: 'int' },
      { label: 'Μέση τιμή / m²', value: ppm(U), fmt: 'money' },
    ],
    chart: { title: 'Πωλημένες και διαθέσιμες ανά έργο', dataLabels: true, labels: per.map((x) => String(x.project)), series: [{ name: 'Πωλημένες', values: per.map((x) => Number(x.sold)) }, { name: 'Διαθέσιμες', values: per.map((x) => Number(x.available)) }], fmt: 'int' },
    views: [
      { key: 'projects', label: 'Ανά έργο', columns: [{ key: 'project', label: 'Έργο', data: true }, { key: 'total', label: 'Μονάδες', fmt: 'int' }, { key: 'available', label: 'Διαθέσιμες', fmt: 'int' }, { key: 'reserved', label: 'Κρατημένες', fmt: 'int' }, { key: 'sold', label: 'Πωλημένες', fmt: 'int' }, { key: 'soldPct', label: '% πωλήσεων', fmt: 'pct' }, { key: 'ppm', label: 'Τιμή / m²', fmt: 'money' }, { key: 'stock', label: 'Αξία διαθέσιμων', fmt: 'money' }], rows: per },
      { key: 'units', label: 'Μονάδες', columns: [{ key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'type', label: 'Τύπος', data: true }, { key: 'beds', label: 'Υπνοδ.', fmt: 'int' }, { key: 'area', label: 'Εμβαδόν', fmt: 'm2' }, { key: 'price', label: 'Τιμή', fmt: 'money' }, { key: 'ppm', label: 'Τιμή / m²', fmt: 'money' }, { key: 'status', label: 'Κατάσταση' }],
        rows: U.map((u) => ({ project: pname.get(u.project_id) ?? '—', unit: u.unit_number ?? '—', type: u.type ?? '', beds: u.bedrooms ?? null, area: area(u) || null, price: u.price == null ? null : Number(u.price), ppm: area(u) && Number(u.price) ? Number(u.price) / area(u) : null, status: UNIT_ST[u.status] ?? u.status ?? '' })) },
    ],
  };
}

async function collections(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const [sch, pay] = await Promise.all([
    rows(db.from('payment_schedules').select('id, contract_id, installment_number, description, due_date, amount, contracts(status, units(unit_number, project_id, projects(name)), contacts:buyer_contact_id(full_name))').order('due_date').limit(20000)),
    rows(db.from('payments').select('id, payment_schedule_id, contract_id, amount_paid, paid_at, method, contracts(units(unit_number, project_id, projects(name)), contacts:buyer_contact_id(full_name))').order('paid_at', { ascending: false }).limit(20000)),
  ]);
  const paid = new Map<string, number>();
  for (const p of pay) if (p.payment_schedule_id) paid.set(p.payment_schedule_id, (paid.get(p.payment_schedule_id) ?? 0) + Number(p.amount_paid ?? 0));
  const today = new Date().toISOString().slice(0, 10);
  const in90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
  const S = sch.filter((s) => s.contracts?.status !== 'cancelled' && (!f.project || s.contracts?.units?.project_id === f.project)).map((s) => {
    const amt = Number(s.amount ?? 0), pd = paid.get(s.id) ?? 0, open = Math.max(0, amt - pd);
    return { s, amt, pd, open, st: open <= 0.5 ? 'Εξοφλήθηκε' : s.due_date && s.due_date < today ? 'Ληξιπρόθεσμη' : pd > 0 ? 'Μερικώς' : 'Ανοιχτή' };
  });
  const row = (x: (typeof S)[number]): ReportRow => ({ due: x.s.due_date, buyer: x.s.contracts?.contacts?.full_name ?? '—', project: x.s.contracts?.units?.projects?.name ?? '—', unit: x.s.contracts?.units?.unit_number ?? '—', inst: x.s.description || `#${x.s.installment_number}`, amount: x.amt, paid: x.pd, open: x.open, status: x.st, days: x.open > 0.5 && x.s.due_date && x.s.due_date < today ? Math.floor((Date.now() - Date.parse(x.s.due_date)) / 864e5) : null });
  const cols = [{ key: 'due', label: 'Λήξη', fmt: 'date' as const }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'inst', label: 'Δόση', data: true }, { key: 'amount', label: 'Ποσό', fmt: 'money' as const }, { key: 'paid', label: 'Πληρώθηκε', fmt: 'money' as const }, { key: 'open', label: 'Υπόλοιπο', fmt: 'money' as const }, { key: 'status', label: 'Κατάσταση' }];
  const overdue = S.filter((x) => x.st === 'Ληξιπρόθεσμη');
  const upcoming = S.filter((x) => x.open > 0.5 && x.s.due_date && x.s.due_date >= today && x.s.due_date <= in90);
  const P = pay.filter((p) => inRange(p.paid_at, r) && (!f.project || p.contracts?.units?.project_id === f.project));
  // Γράφημα: τι λήγει (ανεξόφλητο) τους επόμενους 12 μήνες.
  const ms: string[] = []; { const d = new Date(); d.setUTCDate(1); for (let i = 0; i < 12; i++) { ms.push(d.toISOString().slice(0, 7)); d.setUTCMonth(d.getUTCMonth() + 1); } }
  return {
    filters: ['period', 'project'],
    summary: [
      { label: 'Ληξιπρόθεσμα', value: sum(overdue, (x) => x.open), fmt: 'money', hint: `${overdue.length} δόσεις` },
      { label: 'Λήγουν σε 90 ημέρες', value: sum(upcoming, (x) => x.open), fmt: 'money' },
      { label: 'Εισπράχθηκαν', value: sum(P, (p) => p.amount_paid), fmt: 'money' },
      { label: 'Συνολικό υπόλοιπο', value: sum(S, (x) => x.open), fmt: 'money' },
    ],
    chart: { title: 'Δόσεις που λήγουν ανά μήνα (επόμενοι 12 μήνες)', labels: ms.map((m) => `${m}-01`), series: [{ name: 'Ανεξόφλητο', values: ms.map((m) => sum(S.filter((x) => x.open > 0.5 && String(x.s.due_date ?? '').startsWith(m)), (x) => x.open)) }], fmt: 'money', labelFmt: 'month' },
    views: [
      { key: 'overdue', label: 'Ληξιπρόθεσμες', columns: [...cols.slice(0, 5), { key: 'open', label: 'Υπόλοιπο', fmt: 'money' }, { key: 'days', label: 'Ημέρες καθυστέρησης', fmt: 'int' }], rows: overdue.sort((a, b) => String(a.s.due_date).localeCompare(String(b.s.due_date))).map(row), empty: 'Δεν υπάρχουν ληξιπρόθεσμες δόσεις.' },
      { key: 'upcoming', label: 'Επόμενες 90 ημέρες', columns: cols, rows: upcoming.map(row) },
      { key: 'all', label: 'Όλες οι δόσεις', columns: cols, rows: S.filter((x) => inRange(x.s.due_date, r) || (!r.from && !r.to)).map(row) },
      { key: 'payments', label: 'Πληρωμές', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'buyer', label: 'Αγοραστής', data: true }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'amount', label: 'Ποσό', fmt: 'money' }, { key: 'method', label: 'Τρόπος', data: true }],
        rows: P.map((p) => ({ date: p.paid_at, buyer: p.contracts?.contacts?.full_name ?? '—', project: p.contracts?.units?.projects?.name ?? '—', unit: p.contracts?.units?.unit_number ?? '—', amount: Number(p.amount_paid ?? 0), method: p.method ?? '' })) },
    ],
  };
}

/** Ετήσιο τέλος συντήρησης ανά μονάδα — η στήλη προστίθεται από τη Διαχείριση ακινήτων· δοκιμάζουμε τα πιθανά ονόματα. */
const FEE_COLS = ['annual_maintenance_fee', 'maintenance_fee', 'annual_fee', 'service_charge'];
const feeOf = (u: any) => { for (const k of FEE_COLS) if (u?.[k] != null && Number(u[k]) > 0) return Number(u[k]); return 0; };

async function property(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const [projects, units, owners, T] = await Promise.all([
    rows(db.from('projects').select('id, name').order('name')),
    rows(db.from('units').select('*').limit(10000)),
    rows(db.from('homeowners').select('unit_id').limit(10000)),
    rows(db.from('maintenance_tickets').select('project_id, title, category, priority, status, created_at, resolved_at, units(unit_number)').order('created_at', { ascending: false }).limit(10000)),
  ]);
  const owned = new Set(owners.map((o) => o.unit_id));
  const tk = T.filter((t) => inRange(t.created_at, r) && (!f.project || t.project_id === f.project));
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const per = projects.filter((p) => !f.project || p.id === f.project).map((p) => {
    const us = units.filter((u) => u.project_id === p.id);
    const ts = tk.filter((t) => t.project_id === p.id);
    const done = ts.filter((t) => t.resolved_at);
    const days = done.map((t) => (Date.parse(t.resolved_at) - Date.parse(t.created_at)) / 864e5).filter((d) => d >= 0);
    return { project: p.name, owners: us.filter((u) => owned.has(u.id)).length, tickets: ts.length, open: ts.filter((t) => !CLOSED_TICKET.includes(t.status)).length, resolve: days.length ? Math.round((sum(days, (d) => d) / days.length) * 10) / 10 : null, fees: sum(us.filter((u) => owned.has(u.id) || SOLD.includes(u.status)), feeOf) } as ReportRow;
  }).filter((x) => Number(x.owners) || Number(x.tickets) || Number(x.fees));
  const fees = sum(per, (x) => Number(x.fees));
  return {
    filters: ['period', 'project'],
    summary: [
      { label: 'Ιδιοκτήτες', value: sum(per, (x) => Number(x.owners)), fmt: 'int' },
      { label: 'Αιτήματα', value: tk.length, fmt: 'int' },
      { label: 'Ανοιχτά αιτήματα', value: tk.filter((t) => !CLOSED_TICKET.includes(t.status)).length, fmt: 'int' },
      { label: 'Ετήσια τέλη συντήρησης', value: fees || null, fmt: 'money' },
    ],
    chart: { title: 'Αιτήματα ανά έργο', dataLabels: true, labels: per.map((x) => String(x.project)), series: [{ name: 'Ανοιχτά', values: per.map((x) => Number(x.open)) }, { name: 'Σύνολο', values: per.map((x) => Number(x.tickets)) }], fmt: 'int' },
    views: [
      { key: 'projects', label: 'Ανά έργο', columns: [{ key: 'project', label: 'Έργο', data: true }, { key: 'owners', label: 'Ιδιοκτήτες', fmt: 'int' }, { key: 'tickets', label: 'Αιτήματα', fmt: 'int' }, { key: 'open', label: 'Ανοιχτά', fmt: 'int' }, { key: 'resolve', label: 'Μέσος χρόνος επίλυσης', fmt: 'days' }, { key: 'fees', label: 'Ετήσια τέλη συντήρησης', fmt: 'money' }], rows: per },
      { key: 'tickets', label: 'Αιτήματα', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'project', label: 'Έργο', data: true }, { key: 'unit', label: 'Μονάδα', data: true }, { key: 'title', label: 'Αίτημα', data: true }, { key: 'category', label: 'Κατηγορία', data: true }, { key: 'priority', label: 'Προτεραιότητα' }, { key: 'status', label: 'Κατάσταση' }, { key: 'resolved', label: 'Επιλύθηκε', fmt: 'date' }],
        rows: tk.map((t) => ({ date: t.created_at, project: pname.get(t.project_id) ?? '—', unit: t.units?.unit_number ?? '—', title: t.title ?? '', category: t.category ?? '', priority: PRI[t.priority] ?? t.priority ?? '', status: TICKET_ST[t.status] ?? t.status ?? '', resolved: t.resolved_at })) },
    ],
    note: fees ? undefined : 'Τα ετήσια τέλη συντήρησης εμφανίζονται μόλις οριστεί το ετήσιο τέλος σε κάθε μονάδα.',
  };
}

async function campaigns(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const C = (await rows(db.from('marketing_campaigns').select('name, channel, status, recipients, sent, failed, skipped, opened, created_at, sent_at').order('created_at', { ascending: false }).limit(5000)))
    .filter((c) => inRange(c.sent_at ?? c.created_at, r) && (!f.channel || c.channel === f.channel));
  const chans = (['email', 'sms', 'whatsapp', 'push'] as const).filter((ch) => !f.channel || ch === f.channel);
  const per = chans.map((ch) => { const cs = C.filter((c) => c.channel === ch && c.status !== 'draft'); const sent = sum(cs, (c) => c.sent); return { channel: CHANNEL_NAME[ch], campaigns: cs.length, sent, opened: ch === 'email' ? sum(cs, (c) => c.opened) : null, openRate: ch === 'email' ? ratio(sum(cs, (c) => c.opened), sent) : null, failed: sum(cs, (c) => c.failed), skipped: sum(cs, (c) => c.skipped) } as ReportRow; });
  const sent = C.filter((c) => c.status !== 'draft');
  return {
    filters: ['period', 'channel'],
    summary: [
      { label: 'Καμπάνιες', value: sent.length, fmt: 'int' },
      { label: 'Στάλθηκαν', value: sum(sent, (c) => c.sent), fmt: 'int' },
      { label: 'Άνοιξαν (email)', value: sum(sent.filter((c) => c.channel === 'email'), (c) => c.opened), fmt: 'int' },
      { label: 'Απέτυχαν', value: sum(sent, (c) => c.failed), fmt: 'int' },
    ],
    chart: { title: 'Μηνύματα ανά κανάλι', labels: per.map((x) => String(x.channel)), series: [{ name: 'Στάλθηκαν', values: per.map((x) => Number(x.sent)) }, { name: 'Απέτυχαν', values: per.map((x) => Number(x.failed)) }], fmt: 'int' },
    views: [
      { key: 'campaigns', label: 'Καμπάνιες', columns: [{ key: 'date', label: 'Ημερομηνία', fmt: 'date' }, { key: 'name', label: 'Καμπάνια', data: true }, { key: 'channel', label: 'Κανάλι' }, { key: 'status', label: 'Κατάσταση' }, { key: 'recipients', label: 'Παραλήπτες', fmt: 'int' }, { key: 'sent', label: 'Στάλθηκαν', fmt: 'int' }, { key: 'opened', label: 'Άνοιξαν', fmt: 'int' }, { key: 'failed', label: 'Απέτυχαν', fmt: 'int' }],
        rows: C.map((c) => ({ date: c.sent_at ?? c.created_at, name: c.name, channel: CHANNEL_NAME[c.channel as keyof typeof CHANNEL_NAME] ?? c.channel, status: CAMP_ST[c.status] ?? c.status, recipients: c.recipients ?? 0, sent: c.sent ?? 0, opened: c.channel === 'email' ? c.opened ?? 0 : null, failed: c.failed ?? 0 })) },
      { key: 'channels', label: 'Ανά κανάλι', columns: [{ key: 'channel', label: 'Κανάλι' }, { key: 'campaigns', label: 'Καμπάνιες', fmt: 'int' }, { key: 'sent', label: 'Στάλθηκαν', fmt: 'int' }, { key: 'opened', label: 'Άνοιξαν', fmt: 'int' }, { key: 'openRate', label: 'Ποσοστό ανοίγματος', fmt: 'pct' }, { key: 'failed', label: 'Απέτυχαν', fmt: 'int' }, { key: 'skipped', label: 'Χωρίς συγκατάθεση / διεύθυνση', fmt: 'int' }], rows: per },
    ],
  };
}

async function tasks(db: Db, f: ReportFilters, r: Range): Promise<BuiltReport> {
  const [ppl, lists, items, T] = await Promise.all([
    rows(db.from('profiles').select('id, full_name').order('full_name')),
    rows(db.from('call_lists').select('id, title, assigned_to, due_at, status, created_at').neq('status', 'cancelled').limit(5000)),
    rows(db.from('call_list_items').select('list_id, done, outcome, done_by').limit(50000)),
    rows(db.from('tasks').select('assigned_to, is_done, due_at, created_at').limit(20000)),
  ]);
  const name = new Map(ppl.map((p) => [p.id, p.full_name ?? '—']));
  const L = lists.filter((l) => inRange(l.created_at, r) && (!f.agent || l.assigned_to === f.agent));
  const ids = new Set(L.map((l) => l.id));
  const I = items.filter((i) => ids.has(i.list_id));
  const itemsBy = by(I, (i) => i.list_id);
  const now = Date.now();
  const TT = T.filter((t) => inRange(t.created_at, r) && (!f.agent || t.assigned_to === f.agent));
  const people = Array.from(new Set([...L.map((l) => l.assigned_to), ...TT.map((t) => t.assigned_to)].filter(Boolean)));
  const perPerson = people.map((pid) => {
    const ts = TT.filter((t) => t.assigned_to === pid);
    const its = I.filter((i) => L.find((l) => l.id === i.list_id)?.assigned_to === pid);
    return { person: name.get(pid) ?? '—', open: ts.filter((t) => !t.is_done).length, late: ts.filter((t) => !t.is_done && t.due_at && Date.parse(t.due_at) < now).length, done: ts.filter((t) => t.is_done).length, calls: its.filter((i) => i.done).length, pending: its.filter((i) => !i.done).length } as ReportRow;
  }).sort((a, b) => Number(b.calls) + Number(b.done) - Number(a.calls) - Number(a.done));
  const outcomes = Array.from(by(I.filter((i) => i.done), (i) => i.outcome || 'Χωρίς αποτέλεσμα').entries()).map(([k, v]) => ({ outcome: k, calls: v.length, share: ratio(v.length, I.filter((i) => i.done).length) } as ReportRow)).sort((a, b) => Number(b.calls) - Number(a.calls));
  const calls = I.filter((i) => i.done).length;
  return {
    filters: ['period', 'agent'],
    summary: [
      { label: 'Λίστες κλήσεων', value: L.length, fmt: 'int' },
      { label: 'Κλήσεις έγιναν', value: calls, fmt: 'int' },
      { label: 'Πρόοδος κλήσεων', value: ratio(calls, I.length), fmt: 'pct' },
      { label: 'Εργασίες σε καθυστέρηση', value: sum(perPerson, (x) => Number(x.late)), fmt: 'int' },
    ],
    chart: { title: 'Αποτελέσματα κλήσεων', labels: outcomes.map((x) => String(x.outcome)), series: [{ name: 'Κλήσεις', values: outcomes.map((x) => Number(x.calls)) }], fmt: 'int' },
    views: [
      { key: 'lists', label: 'Λίστες κλήσεων', columns: [{ key: 'title', label: 'Λίστα', data: true }, { key: 'person', label: 'Ανατέθηκε σε', data: true }, { key: 'total', label: 'Επαφές', fmt: 'int' }, { key: 'done', label: 'Κλήθηκαν', fmt: 'int' }, { key: 'pct', label: 'Πρόοδος', fmt: 'pct' }, { key: 'due', label: 'Προθεσμία', fmt: 'date' }, { key: 'status', label: 'Κατάσταση' }],
        rows: L.map((l) => { const its = itemsBy.get(l.id) ?? []; const d = its.filter((i) => i.done).length; return { title: l.title, person: name.get(l.assigned_to) ?? '—', total: its.length, done: d, pct: ratio(d, its.length), due: l.due_at, status: its.length && d >= its.length ? 'Ολοκληρώθηκε' : l.due_at && Date.parse(l.due_at) < now ? 'Καθυστερεί' : d ? 'Σε εξέλιξη' : 'Ανοιχτή' }; }) },
      { key: 'people', label: 'Ανά άτομο', columns: [{ key: 'person', label: 'Άτομο', data: true }, { key: 'open', label: 'Ανοιχτές εργασίες', fmt: 'int' }, { key: 'late', label: 'Καθυστερούν', fmt: 'int' }, { key: 'done', label: 'Ολοκληρώθηκαν', fmt: 'int' }, { key: 'calls', label: 'Κλήσεις έγιναν', fmt: 'int' }, { key: 'pending', label: 'Κλήσεις εκκρεμούν', fmt: 'int' }], rows: perPerson },
      { key: 'outcomes', label: 'Αποτελέσματα', columns: [{ key: 'outcome', label: 'Αποτέλεσμα' }, { key: 'calls', label: 'Κλήσεις', fmt: 'int' }, { key: 'share', label: 'Ποσοστό', fmt: 'pct' }], rows: outcomes },
    ],
  };
}

/** Όλη η εσωτερική ομάδα (για ανάθεση λίστας κλήσεων από το Custom report). */
export async function staffList(): Promise<{ id: string; name: string }[]> {
  const db: Db = await createSupabaseServerClient();
  const { INTERNAL_ROLES } = await import('@/lib/permissions');
  return (await rows(db.from('profiles').select('id, full_name').in('role', INTERNAL_ROLES as unknown as string[]).order('full_name'))).map((p) => ({ id: p.id, name: p.full_name ?? '—' }));
}
