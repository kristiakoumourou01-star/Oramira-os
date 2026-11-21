/**
 * Custom report πελατών (όπως το «Custom member report» του FitnessCRM, με
 * κριτήρια ακινήτων): συνθήκες που στοιβάζονται, ΟΛΕΣ ή ΟΠΟΙΑΔΗΠΟΤΕ, πρότυπα.
 * Client-safe — η αξιολόγηση γίνεται στον browser πάνω στις γραμμές.
 */
export interface CustomRow {
  id: string; name: string; email: string | null; phone: string | null;
  roles: string[]; status: string; groups: string[]; tags: string[]; source: string | null;
  language: string | null; nationality: string | null; buyerType: string | null; optIn: boolean; ownerId: string | null; ownerName: string | null;
  createdAt: string; lastContactAt: string | null;
  leadStages: string[]; budget: number; projects: string[]; areas: string[]; bedrooms: number | null;
  reservations: number; contracts: number; value: number; paid: number; balance: number; ownedProjects: string[]; units: string[];
  viewings: number;
}

export type FieldType = 'enum' | 'multi' | 'number' | 'money' | 'date' | 'bool' | 'text' | 'days';
export interface FieldDef { key: string; label: string; group: string; type: FieldType; options?: [string, string][] }
export interface Condition { field: string; op: string; value: string }
export interface ReportDef { match: 'all' | 'any'; conditions: Condition[]; columns: string[] }

export const OPS: Record<FieldType, [string, string][]> = {
  enum: [['is', 'είναι'], ['not', 'δεν είναι'], ['empty', 'είναι κενό']],
  multi: [['has', 'περιέχει'], ['not', 'δεν περιέχει'], ['empty', 'είναι κενό']],
  number: [['gte', '≥'], ['lte', '≤'], ['eq', '=']],
  money: [['gte', '≥'], ['lte', '≤']],
  date: [['after', 'μετά από'], ['before', 'πριν από']],
  days: [['gte', 'πάνω από (μέρες)'], ['lte', 'έως (μέρες)']],
  bool: [['yes', 'ναι'], ['no', 'όχι']],
  text: [['contains', 'περιέχει'], ['not', 'δεν περιέχει']],
};

export function evaluate(rows: CustomRow[], def: ReportDef, fields: FieldDef[], now = Date.now()): CustomRow[] {
  const conds = def.conditions.filter((c) => c.field && c.op);
  if (!conds.length) return rows;
  const test = (r: CustomRow, c: Condition): boolean => {
    const f = fields.find((x) => x.key === c.field); if (!f) return true;
    const v = (r as any)[c.field];
    const val = c.value ?? '';
    switch (f.type) {
      case 'enum': return c.op === 'empty' ? !v : c.op === 'is' ? String(v ?? '') === val : String(v ?? '') !== val;
      case 'multi': { const arr = (v ?? []) as string[]; return c.op === 'empty' ? arr.length === 0 : c.op === 'has' ? arr.includes(val) : !arr.includes(val); }
      case 'number': case 'money': { const n = Number(v ?? 0), t = Number(val); if (!Number.isFinite(t) || val === '') return true; return c.op === 'gte' ? n >= t : c.op === 'lte' ? n <= t : n === t; }
      case 'date': { if (!val) return true; const day = v ? String(v).slice(0, 10) : ''; if (!day) return false; return c.op === 'after' ? day >= val : day <= val; }
      case 'days': { const t = Number(val); if (!Number.isFinite(t) || val === '') return true; const days = v ? Math.floor((now - Date.parse(v)) / 86_400_000) : 99999; return c.op === 'gte' ? days >= t : days <= t; }
      case 'bool': { const b = typeof v === 'number' ? v > 0 : !!v; return c.op === 'yes' ? b : !b; }
      case 'text': { const s = String(v ?? '').toLowerCase(); return c.op === 'contains' ? s.includes(val.toLowerCase()) : !s.includes(val.toLowerCase()); }
    }
  };
  return rows.filter((r) => (def.match === 'all' ? conds.every((c) => test(r, c)) : conds.some((c) => test(r, c))));
}

export const COLUMNS: [string, string][] = [
  ['name', 'Ονοματεπώνυμο'], ['email', 'Email'], ['phone', 'Τηλέφωνο'], ['roles', 'Ιδιότητες'], ['status', 'Κατάσταση'], ['groups', 'Ομάδες'],
  ['tags', 'Tags'], ['source', 'Πηγή'], ['language', 'Γλώσσα'], ['nationality', 'Εθνικότητα'], ['buyerType', 'Τύπος αγοραστή'], ['optIn', 'Marketing'],
  ['ownerName', 'Υπεύθυνος'], ['leadStages', 'Στάδιο lead'], ['budget', 'Budget'], ['projects', 'Ενδιαφέρον για έργο'], ['areas', 'Περιοχές'],
  ['bedrooms', 'Υπνοδωμάτια'], ['viewings', 'Viewings'], ['reservations', 'Κρατήσεις'], ['contracts', 'Συμβόλαια'], ['value', 'Αξία συμβολαίων'],
  ['paid', 'Εισπραγμένα'], ['balance', 'Υπόλοιπο'], ['units', 'Μονάδες'], ['ownedProjects', 'Ιδιοκτήτης σε έργο'], ['createdAt', 'Καταχώριση'], ['lastContactAt', 'Τελευταία επαφή'],
];
export const DEFAULT_COLUMNS = ['name', 'email', 'phone', 'roles', 'leadStages', 'budget', 'projects', 'nationality', 'ownerName'];
