import { createSupabaseServerClient } from '@/lib/supabase/server';
import { SOURCE_EL } from '@/lib/contacts-hub-shared';

/**
 * Δεδομένα για το Dashboard (ίδια διάταξη με το FitnessCRM, με δεδομένα
 * developer): ενημέρωση, «χρειάζονται προσοχή», μετρήσεις, εισπράξεις ανά
 * μήνα, ζωντανή δραστηριότητα, ραντεβού σήμερα, πηγές leads, αγοραστές ανά
 * χώρα, πρόγραμμα πληρωμών, διαθεσιμότητα μονάδων, deals σε κίνδυνο,
 * funnel και κορυφαίοι πωλητές.
 */
const DAY = 86_400_000;
const OPEN = ['new', 'contacted', 'engaged', 'qualified', 'waiting', 'viewing', 'offer', 'negotiating', 'reserved', 'nurture', 'no_response'];

export type { Attention, ActivityItem, HomeData } from '@/lib/dashboard-home-shared';
import type { Attention, ActivityItem, HomeData } from '@/lib/dashboard-home-shared';

const STAGE_EL: Record<string, string> = {
  new: 'Νέο', contacted: 'Επικοινωνία', engaged: 'Ενδιαφέρον', qualified: 'Qualified', waiting: 'Αναμονή', viewing: 'Viewing', offer: 'Προσφορά',
  negotiating: 'Διαπραγμάτευση', reserved: 'Κράτηση', won: 'Κέρδος', lost: 'Χάθηκε', nurture: 'Nurture', no_response: 'Χωρίς απάντηση',
};
const MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιουν', 'Ιουλ', 'Αυγ', 'Σεπ', 'Οκτ', 'Νοε', 'Δεκ'];
const eur = (n: number) => `€${Math.round(n).toLocaleString('el-GR')}`;

export async function loadHome(): Promise<HomeData> {
  const db = (await createSupabaseServerClient()) as any;
  const now = Date.now();
  const y = new Date().getFullYear();
  const lastYearStart = `${y - 1}-01-01`;
  const in30 = new Date(now + 30 * DAY).toISOString().slice(0, 10);
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + DAY);
  const q = async (p: Promise<any>) => { try { const r = await p; return (r?.data ?? []) as any[]; } catch { return []; } };

  const [payments, leads, units, reservations, schedules, contracts, viewings, tickets, leaveReq, projects, staff, calEv] = await Promise.all([
    q(db.from('payments').select('id, amount_paid, paid_at, payment_schedule_id, contract_id, contracts(buyer_contact_id, contacts:buyer_contact_id(full_name))').gte('paid_at', lastYearStart).order('paid_at', { ascending: false }).limit(5000)),
    q(db.from('leads').select('id, status, source, value, budget_max, budget_min, created_at, last_contacted_at, stage_entered_at, won_at, assigned_to, contact_id, contacts(full_name, nationality)').is('deleted_at', null).limit(5000)),
    q(db.from('units').select('id, status, project_id, price, unit_number')),
    q(db.from('reservations').select('id, status, reserved_at, expires_at, deposit_amount, deposit_paid, unit_id, units(unit_number), contacts:buyer_contact_id(full_name)').order('reserved_at', { ascending: false }).limit(500)),
    q(db.from('payment_schedules').select('id, due_date, amount, description, contract_id, contracts(unit_id, units(unit_number), contacts:buyer_contact_id(full_name)), payments(amount_paid)').lte('due_date', in30).order('due_date').limit(500)),
    q(db.from('contracts').select('id, status, signed_at, created_at, total_price, contacts:buyer_contact_id(full_name)').limit(1000)),
    q(db.from('viewings').select('id, scheduled_at, status, lead_id, meeting_link, contacts(full_name), projects(name)').gte('scheduled_at', new Date(now - 30 * DAY).toISOString()).limit(500)),
    q(db.from('maintenance_tickets').select('id, status').in('status', ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'])),
    q(db.from('leave_requests').select('id').eq('status', 'pending')),
    q(db.from('projects').select('id, name').order('name')),
    q(db.from('profiles').select('id, full_name')),
    q(db.from('calendar_events').select('id, title, start_at, meeting_link, status').gte('start_at', dayStart.toISOString()).lt('start_at', dayEnd.toISOString()).neq('status', 'cancelled')),
  ]);

  // ── Εισπράξεις ──
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const today = ymd(new Date());
  // Εισπράξεις = πληρωμές συμβολαίων + πληρωμένες προκαταβολές κρατήσεων που δεν έγιναν ακόμη συμβόλαιο
  // (όταν γίνουν συμβόλαιο, η προκαταβολή περνά ως πληρωμή — δεν μετρά δύο φορές).
  const inflows: { paid_at: string; amount_paid: number }[] = [
    ...payments.map((p: any) => ({ paid_at: p.paid_at, amount_paid: Number(p.amount_paid ?? 0) })),
    ...reservations.filter((r: any) => r.status === 'active' && r.deposit_paid && r.reserved_at).map((r: any) => ({ paid_at: r.reserved_at, amount_paid: Number(r.deposit_amount ?? 0) })),
  ];
  const todayIn = inflows.filter((p) => String(p.paid_at ?? '').slice(0, 10) === today).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
  const last30 = inflows.filter((p) => Date.parse(p.paid_at) >= now - 30 * DAY).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0);
  const monthly = MONTHS.map((label, m) => ({
    label,
    thisYear: inflows.filter((p) => { const d = new Date(p.paid_at); return d.getFullYear() === y && d.getMonth() === m; }).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0),
    lastYear: inflows.filter((p) => { const d = new Date(p.paid_at); return d.getFullYear() === y - 1 && d.getMonth() === m; }).reduce((s, p) => s + Number(p.amount_paid ?? 0), 0),
  }));
  const curM = new Date().getMonth();
  const ytd = monthly.slice(0, curM + 1).reduce((s, m) => s + m.thisYear, 0);
  const lytd = monthly.slice(0, curM + 1).reduce((s, m) => s + m.lastYear, 0);
  const yoy = lytd > 0 ? Math.round(((ytd - lytd) / lytd) * 1000) / 10 : null;

  // ── Leads ──
  const open = leads.filter((l) => OPEN.includes(l.status));
  const newWeek = leads.filter((l) => Date.parse(l.created_at) >= now - 7 * DAY).length;
  const new30 = leads.filter((l) => Date.parse(l.created_at) >= now - 30 * DAY);
  const val = (l: any) => Number(l.value ?? l.budget_max ?? l.budget_min ?? 0);
  const pipelineValue = open.reduce((s, l) => s + val(l), 0);
  const monthStart = new Date(y, curM, 1).getTime();
  const wonThisMonth = leads.filter((l) => l.status === 'won' && Date.parse(l.won_at ?? l.stage_entered_at ?? l.created_at) >= monthStart).length;
  const conv = (from: number, to: number) => {
    const set = leads.filter((l) => { const t = Date.parse(l.created_at); return t >= from && t < to; });
    return set.length ? Math.round((set.filter((l) => l.status === 'won').length / set.length) * 100) : 0;
  };
  const conversion = conv(now - 90 * DAY, now + DAY);
  const conversionPrev = conv(now - 180 * DAY, now - 90 * DAY);

  // ── Μονάδες ──
  const st = (s: string) => units.filter((u) => u.status === s).length;
  const projRows = projects.map((p) => {
    const us = units.filter((u) => u.project_id === p.id);
    return { name: p.name, available: us.filter((u) => u.status === 'available').length, reserved: us.filter((u) => u.status === 'reserved').length, sold: us.filter((u) => ['sold', 'handed_over'].includes(u.status)).length, total: us.length };
  }).filter((p) => p.total > 0);

  // ── Πρόγραμμα πληρωμών ──
  const schedule = schedules.map((s) => {
    const paid = (s.payments ?? []).reduce((n: number, p: any) => n + Number(p.amount_paid ?? 0), 0);
    const status: 'upcoming' | 'overdue' | 'paid' = paid >= Number(s.amount ?? 0) ? 'paid' : s.due_date < today ? 'overdue' : 'upcoming';
    return { id: s.id, buyer: s.contracts?.contacts?.full_name ?? '—', unit: s.contracts?.units?.unit_number ?? '—', due: s.due_date, amount: Number(s.amount ?? 0) - (status === 'paid' ? 0 : paid), status };
  });
  const overdue = schedule.filter((s) => s.status === 'overdue');

  // ── Χρειάζονται προσοχή ──
  const expiring = reservations.filter((r) => r.status === 'active' && r.expires_at && Date.parse(r.expires_at) - now < 7 * DAY && Date.parse(r.expires_at) > now);
  const uncontacted = open.filter((l) => !l.last_contacted_at && now - Date.parse(l.created_at) > 2 * DAY);
  const quiet = open.filter((l) => l.last_contacted_at && now - Date.parse(l.last_contacted_at) > 14 * DAY);
  const unsigned = contracts.filter((c) => c.status === 'sent');
  const attention: Attention[] = [];
  const push = (n: number, text: string, href: string, tone: 'warn' | 'info' = 'warn') => { if (n > 0) attention.push({ text, href, tone }); };
  push(overdue.length, `${overdue.length} δόσεις καθυστερούν (${eur(overdue.reduce((s, x) => s + x.amount, 0))})`, '/financials');
  push(expiring.length, `${expiring.length} κρατήσεις λήγουν μέσα σε 7 μέρες`, '/sales/deals');
  push(uncontacted.length, `${uncontacted.length} leads χωρίς πρώτη επικοινωνία πάνω από 48 ώρες`, '/sales/follow-ups');
  push(quiet.length, `${quiet.length} leads χωρίς επαφή πάνω από 14 μέρες`, '/sales/deals?view=list');
  push(unsigned.length, `${unsigned.length} συμβόλαια περιμένουν υπογραφή`, '/sales/deals');
  push(tickets.length, `${tickets.length} ανοιχτά αιτήματα ιδιοκτητών`, '/property', 'info');
  push(leaveReq.length, `${leaveReq.length} αιτήματα άδειας για έγκριση`, '/hr?tab=leave', 'info');
  push(st('available'), `${st('available')} διαθέσιμες μονάδες προς πώληση`, '/projects', 'info');
  push(new30.length, `${new30.length} νέα leads τις τελευταίες 30 μέρες`, '/sales/new', 'info');

  // ── Ζωντανή δραστηριότητα ──
  const activity: ActivityItem[] = [
    ...payments.slice(0, 30).map((p) => ({ kind: 'payment' as const, at: p.paid_at, text: `Πληρωμή από ${p.contracts?.contacts?.full_name ?? 'αγοραστή'}: ${eur(Number(p.amount_paid ?? 0))}`, parts: [{ t: 'Πληρωμή από' }, { t: p.contracts?.contacts?.full_name ?? '—', data: true }, { t: eur(Number(p.amount_paid ?? 0)), data: true }], href: '/financials' })),
    ...leads.slice().sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 30).map((l) => ({ kind: 'lead' as const, at: l.created_at, text: `Νέο lead: ${l.contacts?.full_name ?? '—'} (${SOURCE_EL[l.source] ?? l.source ?? 'Άλλο'})`, parts: [{ t: 'Νέο lead' }, { t: l.contacts?.full_name ?? '—', data: true }, { t: SOURCE_EL[l.source] ?? l.source ?? 'Άλλο' }], href: `/crm/leads/${l.id}` })),
    ...reservations.slice(0, 30).map((r) => ({ kind: 'reservation' as const, at: r.reserved_at, text: `Κράτηση μονάδας ${r.units?.unit_number ?? ''} από ${r.contacts?.full_name ?? '—'}${r.deposit_amount ? ` · προκαταβολή ${eur(Number(r.deposit_amount))}` : ''}`,
      parts: [{ t: 'Κράτηση μονάδας' }, { t: r.units?.unit_number ?? '', data: true }, { t: r.contacts?.full_name ?? '—', data: true }, ...(r.deposit_amount ? [{ t: 'Προκαταβολή' }, { t: eur(Number(r.deposit_amount)), data: true }] : [])] })),
    ...contracts.filter((c) => c.signed_at).map((c) => ({ kind: 'contract' as const, at: c.signed_at, text: `Υπογράφηκε συμβόλαιο: ${c.contacts?.full_name ?? '—'}${c.total_price ? ` · ${eur(Number(c.total_price))}` : ''}`,
      parts: [{ t: 'Υπογράφηκε συμβόλαιο' }, { t: c.contacts?.full_name ?? '—', data: true }, ...(c.total_price ? [{ t: eur(Number(c.total_price)), data: true }] : [])] })),
    ...viewings.filter((v) => Date.parse(v.scheduled_at) <= now).map((v) => ({ kind: 'viewing' as const, at: v.scheduled_at, text: `Viewing με ${v.contacts?.full_name ?? '—'}${v.projects?.name ? ` · ${v.projects.name}` : ''}`, parts: [{ t: 'Ξενάγηση' }, { t: v.contacts?.full_name ?? '—', data: true }, ...(v.projects?.name ? [{ t: v.projects.name, data: true }] : [])], href: v.lead_id ? `/crm/leads/${v.lead_id}` : undefined })),
  ].filter((a) => a.at).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);

  // ── Σήμερα ──
  const todayList = [
    ...viewings.filter((v) => { const t = Date.parse(v.scheduled_at); return t >= dayStart.getTime() && t < dayEnd.getTime() && v.status !== 'cancelled'; })
      .map((v) => ({ id: `v${v.id}`, title: `Viewing · ${v.contacts?.full_name ?? 'πελάτης'}${v.projects?.name ? ` · ${v.projects.name}` : ''}`, at: v.scheduled_at, href: v.lead_id ? `/crm/leads/${v.lead_id}` : undefined, link: v.meeting_link })),
    ...calEv.map((c) => ({ id: `c${c.id}`, title: c.title, at: c.start_at, href: '/calendar', link: c.meeting_link })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  // ── Πηγές & χώρες ──
  const srcMap = new Map<string, { n: number; won: number }>();
  for (const l of new30) { const k = l.source ?? 'other'; const c = srcMap.get(k) ?? { n: 0, won: 0 }; c.n++; if (l.status === 'won') c.won++; srcMap.set(k, c); }
  const sources = [...srcMap.entries()].map(([key, v]) => ({ key, label: SOURCE_EL[key] ?? key, ...v })).sort((a, b) => b.n - a.n);
  const ctry = new Map<string, number>();
  for (const l of leads) { const k = (l.contacts?.nationality ?? '').trim() || 'Δεν καταγράφηκε'; ctry.set(k, (ctry.get(k) ?? 0) + 1); }
  const countries = [...ctry.entries()].map(([name, n]) => ({ name, n, share: leads.length ? Math.round((n / leads.length) * 100) : 0 })).sort((a, b) => b.n - a.n).slice(0, 8);

  // ── Σε κίνδυνο ──
  const atRisk = open.map((l) => {
    const last = Date.parse(l.last_contacted_at ?? l.created_at);
    const days = Math.floor((now - last) / DAY);
    const late = ['viewing', 'offer', 'negotiating', 'reserved'].includes(l.status);
    const risk = Math.min(100, Math.round(days * (late ? 4 : 2.5) + (l.last_contacted_at ? 0 : 20)));
    return { id: l.id, name: l.contacts?.full_name ?? 'Lead', stage: STAGE_EL[l.status] ?? l.status, days, value: val(l), risk, reason: l.last_contacted_at ? `Χωρίς επαφή ${days} μέρες` : 'Δεν έχει γίνει ποτέ επικοινωνία' };
  }).filter((x) => x.risk >= 30).sort((a, b) => b.risk - a.risk).slice(0, 50);

  // ── Funnel 60 μέρες ──
  const f60 = leads.filter((l) => Date.parse(l.created_at) >= now - 60 * DAY);
  const reached = (stages: string[]) => f60.filter((l) => stages.includes(l.status)).length;
  const funnel = [
    { label: 'Leads', n: f60.length },
    { label: 'Επικοινωνία', n: f60.filter((l) => l.status !== 'new').length },
    { label: 'Viewing', n: reached(['viewing', 'offer', 'negotiating', 'reserved', 'won']) },
    { label: 'Προσφορά', n: reached(['offer', 'negotiating', 'reserved', 'won']) },
    { label: 'Κράτηση', n: reached(['reserved', 'won']) },
    { label: 'Πώληση', n: reached(['won']) },
  ];

  // ── Πωλητές ──
  const names = new Map(staff.map((s) => [s.id, s.full_name ?? '—']));
  const ag = new Map<string, { won: number; open: number }>();
  for (const l of leads) {
    if (!l.assigned_to) continue;
    const c = ag.get(l.assigned_to) ?? { won: 0, open: 0 };
    if (l.status === 'won' && Date.parse(l.won_at ?? l.stage_entered_at ?? l.created_at) >= now - 30 * DAY) c.won++;
    if (OPEN.includes(l.status)) c.open++;
    ag.set(l.assigned_to, c);
  }
  const agents = [...ag.entries()].map(([id, v]) => ({ name: names.get(id) ?? '—', ...v })).sort((a, b) => b.won - a.won || b.open - a.open).slice(0, 6);

  return {
    todayIn, avgDailyIn: last30 / 30,
    activeLeads: open.length, newLeadsWeek: newWeek,
    pipelineValue, wonThisMonth, conversion, conversionPrev,
    available: st('available'), reservedUnits: st('reserved'), soldUnits: st('sold') + st('handed_over'), totalUnits: units.length,
    attention, monthly, yoy, activity, today: todayList, sources, countries, schedule, projects: projRows, atRisk, funnel, agents,
  };
}
