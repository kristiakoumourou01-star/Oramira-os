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
  const [{ rows: base, staff, groups }, leads, viewings, reservations, contracts, units, projects, templates] = await Promise.all([
    loadContactList(),
    q(db.from('leads').select('contact_id, status, budget_min, budget_max, value, preferred_project_id, preferred_areas, unit_requirements').is('deleted_at', null).limit(10000)),
    q(db.from('viewings').select('contact_id').limit(10000)),
    q(db.from('reservations').select('buyer_contact_id, status').limit(10000)),
    q(db.from('contracts').select('buyer_contact_id, status').neq('status', 'cancelled').limit(10000)),
    q(db.from('units').select('buyer_contact_id, unit_number, project_id').not('buyer_contact_id', 'is', null)),
    q(db.from('projects').select('id, name').order('name')),
    q(db.from('report_templates').select('id, name, definition').eq('kind', 'customers').order('name')),
  ]);
  const pname = new Map(projects.map((p) => [p.id, p.name as string]));
  const by = <T,>(arr: any[], key: string) => { const m = new Map<string, any[]>(); for (const x of arr) { const k = x[key]; if (!k) continue; const a = m.get(k) ?? []; a.push(x); m.set(k, a); } return m; };
  const L = by(leads, 'contact_id'), V = by(viewings, 'contact_id'), R = by(reservations, 'buyer_contact_id'), C = by(contracts, 'buyer_contact_id'), U = by(units, 'buyer_contact_id');
  const rows: CustomRow[] = base.map((c) => {
    const ls = L.get(c.id) ?? [];
    const us = U.get(c.id) ?? [];
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
    };
  });
  const uniq = (a: (string | null)[]) => Array.from(new Set(a.filter(Boolean) as string[])).sort((x, y) => x.localeCompare(y, 'el')).map((x) => [x, x] as [string, string]);
  const projOpts = projects.map((p) => [p.name, p.name] as [string, string]);
  const fields: FieldDef[] = [
    { key: 'roles', label: 'Ιδιότητα', group: 'Πελάτης', type: 'multi', options: ALL_ROLES.map((r) => [r, ROLE_EL[r]]) },
    { key: 'status', label: 'Κατάσταση', group: 'Πελάτης', type: 'enum', options: CONTACT_STATUSES.map((s) => [s, STATUS_EL[s]]) },
    { key: 'groups', label: 'Ομάδα', group: 'Πελάτης', type: 'multi', options: uniq([...groups.map((g) => g.name), ...rows.flatMap((r) => r.groups)]) },
    { key: 'tags', label: 'Tag', group: 'Πελάτης', type: 'multi', options: uniq(rows.flatMap((r) => r.tags)) },
    { key: 'source', label: 'Πηγή', group: 'Πελάτης', type: 'enum', options: Object.entries(SOURCE_EL) },
    { key: 'language', label: 'Γλώσσα', group: 'Πελάτης', type: 'enum', options: LANGUAGES.map((l) => [l.v, l.l]) },
    { key: 'nationality', label: 'Εθνικότητα', group: 'Πελάτης', type: 'enum', options: uniq(rows.map((r) => r.nationality)) },
    { key: 'buyerType', label: 'Τύπος αγοραστή', group: 'Πελάτης', type: 'enum', options: [['investor', 'Επενδυτής'], ['end_user', 'Ιδιοκατοίκηση'], ['holiday', 'Εξοχικό'], ['relocation', 'Μετεγκατάσταση'], ['other', 'Άλλο']] },
    { key: 'optIn', label: 'Συγκατάθεση marketing', group: 'Πελάτης', type: 'bool' },
    { key: 'ownerId', label: 'Υπεύθυνος', group: 'Πελάτης', type: 'enum', options: staff.map((s) => [s.id, s.name]) },
    { key: 'createdAt', label: 'Ημερομηνία καταχώρισης', group: 'Πελάτης', type: 'date' },
    { key: 'lastContactAt', label: 'Μέρες από την τελευταία επαφή', group: 'Πελάτης', type: 'days' },
    { key: 'name', label: 'Όνομα', group: 'Πελάτης', type: 'text' },
    { key: 'leadStages', label: 'Στάδιο lead', group: 'Ενδιαφέρον', type: 'multi', options: STAGES },
    { key: 'budget', label: 'Budget (€)', group: 'Ενδιαφέρον', type: 'money' },
    { key: 'projects', label: 'Ενδιαφέρον για έργο', group: 'Ενδιαφέρον', type: 'multi', options: projOpts },
    { key: 'areas', label: 'Περιοχή ενδιαφέροντος', group: 'Ενδιαφέρον', type: 'multi', options: uniq(rows.flatMap((r) => r.areas)) },
    { key: 'bedrooms', label: 'Υπνοδωμάτια', group: 'Ενδιαφέρον', type: 'number' },
    { key: 'viewings', label: 'Έχει κάνει viewing', group: 'Ενδιαφέρον', type: 'bool' },
    { key: 'reservations', label: 'Έχει κράτηση', group: 'Αγορά', type: 'bool' },
    { key: 'contracts', label: 'Έχει συμβόλαιο', group: 'Αγορά', type: 'bool' },
    { key: 'value', label: 'Αξία συμβολαίων (€)', group: 'Αγορά', type: 'money' },
    { key: 'paid', label: 'Εισπραγμένα (€)', group: 'Αγορά', type: 'money' },
    { key: 'balance', label: 'Υπόλοιπο προς είσπραξη (€)', group: 'Αγορά', type: 'money' },
    { key: 'ownedProjects', label: 'Ιδιοκτήτης μονάδας σε έργο', group: 'Αγορά', type: 'multi', options: projOpts },
  ];
  return { rows, fields, templates };
}
