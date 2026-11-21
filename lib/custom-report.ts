import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadContactList } from '@/lib/contacts-hub';
import { ALL_ROLES, ROLE_EL, SOURCE_EL, STATUS_EL, CONTACT_STATUSES } from '@/lib/contacts-hub-shared';
import { LANGUAGES } from '@/lib/kyc-shared';
import type { CustomRow, FieldDef } from '@/lib/custom-report-shared';

const STAGES: [string, string][] = [['new', 'Νέο'], ['contacted', 'Επικοινωνία'], ['engaged', 'Ενδιαφέρον'], ['qualified', 'Qualified'], ['waiting', 'Αναμονή'], ['viewing', 'Viewing'], ['offer', 'Προσφορά'], ['negotiating', 'Διαπραγμάτευση'], ['reserved', 'Κράτηση'], ['won', 'Πώληση'], ['lost', 'Χάθηκε'], ['nurture', 'Nurture'], ['no_response', 'Χωρίς απάντηση']];

/** Γραμμές και πεδία για το Custom report πελατών. */
export async function loadCustomReport(): Promise<{ rows: CustomRow[]; fields: FieldDef[]; templates: { id: string; name: string; definition: any }[] }> {
  const db = (await createSupabaseServerClient()) as any;
  const q = async (p: Promise<any>) => { try { const r = await p; return (r?.data ?? []) as any[]; } catch { return []; } };
  const [{ rows: base, staff, groups }, leads, viewings, reservations, contracts, units, projects, templates, cx, kyc, owners, tenancies, history, schedules, payments, charges, followUps] = await Promise.all([
    loadContactList(),
    q(db.from('leads').select('id, contact_id, status, source, budget_min, budget_max, value, preferred_project_id, preferred_areas, unit_requirements, timeline_to_buy').is('deleted_at', null).limit(20000)),
    q(db.from('viewings').select('contact_id').limit(20000)),
    q(db.from('reservations').select('buyer_contact_id, status, deposit_paid').limit(10000)),
    q(db.from('contracts').select('id, buyer_contact_id, status').neq('status', 'cancelled').limit(10000)),
    q(db.from('units').select('buyer_contact_id, unit_number, project_id, status').not('buyer_contact_id', 'is', null)),
    q(db.from('projects').select('id, name').order('name')),
    q(db.from('report_templates').select('id, name, definition').eq('kind', 'customers').order('name')),
    // Στήλες που μπορεί να προστεθούν στην καρτέλα πελάτη (πόλη, χώρα, γέννηση, προτιμήσεις καναλιών) — select('*') για να μη σπάει αν λείπουν.
    q(db.from('contacts').select('*').is('anonymized_at', null).limit(5000)),
    q(db.from('contact_kyc').select('contact_id, status, date_of_birth, residence_country, address, cash_payment').limit(10000)),
    q(db.from('homeowners').select('contact_id').limit(10000)),
    q(db.from('unit_tenancies').select('tenant_contact_id, status').limit(10000)),
    q(db.from('unit_ownership_history').select('previous_contact_id').limit(10000)),
    q(db.from('payment_schedules').select('id, contract_id, due_date, amount').limit(30000)),
    q(db.from('payments').select('payment_schedule_id, amount_paid').limit(30000)),
    q(db.from('unit_charges').select('contact_id, kind, status').limit(20000)),
    q(db.from('follow_up_tasks').select('contact_id, lead_id, is_done').eq('is_done', false).limit(20000)),
  ]);
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const by = <T,>(arr: any[], key: string) => { const m = new Map<string, any[]>(); for (const x of arr) { const k = x[key]; if (!k) continue; const a = m.get(k) ?? []; a.push(x); m.set(k, a); } return m; };
  const L = by(leads, 'contact_id'), V = by(viewings, 'contact_id'), R = by(reservations, 'buyer_contact_id'), C = by(contracts, 'buyer_contact_id'), U = by(units, 'buyer_contact_id');
  const CX = new Map(cx.map((c) => [c.id, c])), K = new Map(kyc.map((k) => [k.contact_id, k]));
  const ownerSet = new Set(owners.map((o) => o.contact_id)), renting = new Set(tenancies.filter((t) => t.status !== 'ended').map((t) => t.tenant_contact_id)), former = new Set(history.map((h) => h.previous_contact_id));
  const feeDue = new Set(charges.filter((c) => c.kind === 'maintenance_fee' && c.status === 'pending').map((c) => c.contact_id));
  const leadContact = new Map(leads.map((l) => [l.id, l.contact_id]));
  const openFU = new Set(followUps.map((x) => x.contact_id ?? leadContact.get(x.lead_id)).filter(Boolean));
  const paidBy = new Map<string, number>(); for (const p of payments) if (p.payment_schedule_id) paidBy.set(p.payment_schedule_id, (paidBy.get(p.payment_schedule_id) ?? 0) + Number(p.amount_paid ?? 0));
  const today = new Date().toISOString().slice(0, 10);
  const buyerOf = new Map(contracts.map((c) => [c.id, c.buyer_contact_id]));
  const overdue = new Set(schedules.filter((s) => s.due_date && s.due_date < today && Number(s.amount ?? 0) - (paidBy.get(s.id) ?? 0) > 0.5).map((s) => buyerOf.get(s.contract_id)).filter(Boolean));
  const pick = (o: any, ks: string[]) => { for (const k of ks) if (o?.[k] != null && o[k] !== '') return o[k]; return null; };
  const flag = (o: any, k: string, dflt: boolean) => (o && typeof o[k] === 'boolean' ? o[k] : dflt);
  const rows: CustomRow[] = base.map((c) => {
    const ls = L.get(c.id) ?? [];
    const us = U.get(c.id) ?? [];
    const x = CX.get(c.id) ?? {}, k = K.get(c.id);
    const dob = pick(x, ['date_of_birth', 'birth_date', 'dob']) ?? k?.date_of_birth ?? null;
    const age = dob ? Math.floor((Date.now() - Date.parse(dob)) / (365.25 * 864e5)) : null;
    const req = ls.map((l) => l.unit_requirements ?? {});
    const bed = ls.map((l) => Number(l.unit_requirements?.bedrooms ?? l.unit_requirements?.beds ?? NaN)).find((n) => Number.isFinite(n));
    return {
      id: c.id, name: c.name, email: c.email, phone: c.phone, roles: c.roles, status: c.status, groups: c.groups, tags: c.tags, source: c.source ?? 'manual',
      language: c.language, nationality: c.nationality, buyerType: c.buyerType, optIn: c.optIn, ownerId: c.ownerId, ownerName: c.ownerName,
      createdAt: c.createdAt, lastContactAt: c.lastContactAt,
      leadStages: Array.from(new Set(ls.map((l) => l.status))),
      budget: Math.max(0, ...ls.map((l) => Number(l.value ?? l.budget_max ?? l.budget_min ?? 0))),
      projects: Array.from(new Set(ls.map((l) => pname.get(l.preferred_project_id)).filter(Boolean) as string[])),
      areas: Array.from(new Set(ls.flatMap((l) => (l.preferred_areas ?? []) as string[]))),
      bedrooms: bed ?? null,
      viewings: (V.get(c.id) ?? []).length,
      reservations: (R.get(c.id) ?? []).filter((r) => r.status === 'active' || r.status === 'converted').length,
      contracts: (C.get(c.id) ?? []).length,
      value: c.value, paid: c.paid, balance: Math.max(0, c.value - c.paid),
      ownedProjects: Array.from(new Set(us.map((u) => pname.get(u.project_id)).filter(Boolean) as string[])),
      units: us.map((u) => u.unit_number).filter(Boolean),
      city: pick(x, ['city', 'area']), country: pick(x, ['country', 'residence_country']) ?? k?.residence_country ?? null,
      age: age != null && age >= 0 && age < 120 ? age : null, birthMonth: dob ? String(Number(String(dob).slice(5, 7))) : null,
      hasEmail: !!c.email, hasMobile: !!c.phone,
      receivesSms: flag(x, 'receive_sms', c.optIn), receivesEmail: flag(x, 'receive_email', c.optIn), receivesPush: flag(x, 'receive_push', c.optIn),
      fromLead: ls.length > 0 || c.roles.includes('lead'),
      leadSources: Array.from(new Set(ls.map((l) => l.source).filter(Boolean))),
      propertyTypes: Array.from(new Set(req.map((r: any) => r.type ?? r.property_type ?? r.unit_type).filter(Boolean).map(String))),
      timeline: ls.map((l) => l.timeline_to_buy).find(Boolean) ?? null,
      cashBuyer: !!k?.cash_payment,
      ownsUnit: us.length > 0 || ownerSet.has(c.id),
      handover: ownerSet.has(c.id) || us.some((u) => u.status === 'handed_over'),
      unitStatuses: Array.from(new Set(us.map((u) => u.status).filter(Boolean))),
      rents: renting.has(c.id), formerOwner: former.has(c.id),
      overdue: overdue.has(c.id), depositPaid: (R.get(c.id) ?? []).some((r) => r.deposit_paid), feeUnpaid: feeDue.has(c.id),
      openFollowUp: openFU.has(c.id), kycStatus: (c as any).kycStatus ?? k?.status ?? null,
    };
  });
  const uniq = (a: (string | null)[]) => Array.from(new Set(a.filter(Boolean) as string[])).sort((x, y) => x.localeCompare(y, 'el')).map((x) => [x, x] as [string, string]);
  const projOpts = projects.map((p) => [p.name, p.name] as [string, string]);
  const MONTHS: [string, string][] = ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'].map((m, i) => [String(i + 1), m]);
  const P = 'Προφίλ', I = 'Ενδιαφέρον', A = 'Ακίνητο', F = 'Οικονομικά', D = 'Δραστηριότητα';
  const fields: FieldDef[] = [
    { key: 'roles', label: 'Ιδιότητα (αγοραστής, επενδυτής, ιδιοκτήτης…)', group: P, type: 'multi', options: ALL_ROLES.map((r) => [r, ROLE_EL[r]]) },
    { key: 'status', label: 'Κατάσταση', group: P, type: 'enum', options: CONTACT_STATUSES.map((s) => [s, STATUS_EL[s]]) },
    { key: 'name', label: 'Όνομα', group: P, type: 'text' },
    { key: 'nationality', label: 'Εθνικότητα', group: P, type: 'enum', options: uniq(rows.map((r) => r.nationality)) },
    { key: 'language', label: 'Γλώσσα', group: P, type: 'enum', options: LANGUAGES.map((l) => [l.v, l.l]) },
    { key: 'city', label: 'Πόλη / περιοχή', group: P, type: 'text' },
    { key: 'country', label: 'Χώρα διαμονής', group: P, type: 'enum', options: uniq(rows.map((r) => r.country)) },
    { key: 'age', label: 'Ηλικία', group: P, type: 'number' },
    { key: 'birthMonth', label: 'Μήνας γενεθλίων', group: P, type: 'enum', options: MONTHS },
    { key: 'groups', label: 'Ομάδες', group: P, type: 'multi', options: uniq([...groups.map((g) => g.name), ...rows.flatMap((r) => r.groups)]) },
    { key: 'tags', label: 'Tags', group: P, type: 'multi', options: uniq(rows.flatMap((r) => r.tags)) },
    { key: 'hasEmail', label: 'Έχει email', group: P, type: 'bool' },
    { key: 'hasMobile', label: 'Έχει κινητό', group: P, type: 'bool' },
    { key: 'receivesSms', label: 'Δέχεται SMS', group: P, type: 'bool' },
    { key: 'receivesEmail', label: 'Δέχεται email', group: P, type: 'bool' },
    { key: 'receivesPush', label: 'Δέχεται push', group: P, type: 'bool' },
    { key: 'optIn', label: 'Συγκατάθεση marketing', group: P, type: 'bool' },
    { key: 'fromLead', label: 'Ήρθε από lead', group: P, type: 'bool' },
    { key: 'source', label: 'Πρώτη πηγή', group: P, type: 'enum', options: Object.entries(SOURCE_EL) },
    { key: 'leadSources', label: 'Πηγή lead', group: P, type: 'multi', options: Object.entries(SOURCE_EL) },
    { key: 'budget', label: 'Budget (€)', group: I, type: 'money' },
    { key: 'areas', label: 'Περιοχή που προτιμά', group: I, type: 'multi', options: uniq(rows.flatMap((r) => r.areas)) },
    { key: 'projects', label: 'Έργο που προτιμά', group: I, type: 'multi', options: projOpts },
    { key: 'bedrooms', label: 'Υπνοδωμάτια', group: I, type: 'number' },
    { key: 'propertyTypes', label: 'Τύπος ακινήτου', group: I, type: 'multi', options: uniq(rows.flatMap((r) => r.propertyTypes)) },
    { key: 'timeline', label: 'Πότε θέλει να αγοράσει', group: I, type: 'enum', options: uniq(rows.map((r) => r.timeline)) },
    { key: 'buyerType', label: 'Τύπος αγοραστή', group: I, type: 'enum', options: [['investor', 'Επενδυτής'], ['end_user', 'Ιδιοκατοίκηση'], ['holiday', 'Εξοχικό'], ['relocation', 'Μετεγκατάσταση'], ['other', 'Άλλο']] },
    { key: 'cashBuyer', label: 'Πληρώνει με μετρητά (χωρίς δάνειο)', group: I, type: 'bool' },
    { key: 'ownsUnit', label: 'Έχει μονάδα', group: A, type: 'bool' },
    { key: 'ownedProjects', label: 'Έχει μονάδα στο έργο', group: A, type: 'multi', options: projOpts },
    { key: 'reservations', label: 'Έχει κρατήσει μονάδα', group: A, type: 'bool' },
    { key: 'contracts', label: 'Έχει υπογράψει συμβόλαιο', group: A, type: 'bool' },
    { key: 'handover', label: 'Έχει παραλάβει', group: A, type: 'bool' },
    { key: 'unitStatuses', label: 'Κατάσταση μονάδας', group: A, type: 'multi', options: [['reserved', 'Κρατημένη'], ['sold', 'Πωλημένη'], ['handed_over', 'Παραδόθηκε']] },
    { key: 'rents', label: 'Νοικιάζει μονάδα', group: A, type: 'bool' },
    { key: 'formerOwner', label: 'Πρώην ιδιοκτήτης', group: A, type: 'bool' },
    { key: 'overdue', label: 'Έχει ληξιπρόθεσμη δόση', group: F, type: 'bool' },
    { key: 'balance', label: 'Υπόλοιπο προς είσπραξη (€)', group: F, type: 'money' },
    { key: 'value', label: 'Αξία συμβολαίων (€)', group: F, type: 'money' },
    { key: 'paid', label: 'Έχει πληρώσει (€)', group: F, type: 'money' },
    { key: 'depositPaid', label: 'Πλήρωσε προκαταβολή', group: F, type: 'bool' },
    { key: 'feeUnpaid', label: 'Απλήρωτο τέλος συντήρησης', group: F, type: 'bool' },
    { key: 'createdAt', label: 'Καταχωρίστηκε', group: D, type: 'date' },
    { key: 'lastContactAt', label: 'Μέρες από την τελευταία επαφή', group: D, type: 'days' },
    { key: 'viewings', label: 'Έχει κάνει viewing', group: D, type: 'bool' },
    { key: 'ownerId', label: 'Υπεύθυνος πωλητής', group: D, type: 'enum', options: staff.map((s) => [s.id, s.name]) },
    { key: 'leadStages', label: 'Στάδιο pipeline', group: D, type: 'multi', options: STAGES },
    { key: 'openFollowUp', label: 'Έχει ανοιχτό follow-up', group: D, type: 'bool' },
    { key: 'kycStatus', label: 'Κατάσταση KYC', group: D, type: 'enum', options: [['not_started', 'Δεν ξεκίνησε'], ['in_progress', 'Σε εξέλιξη'], ['verified', 'Επαληθεύτηκε'], ['rejected', 'Απορρίφθηκε']] },
  ];
  return { rows, fields, templates };
}
