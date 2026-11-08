/**
 * Φόρμες μονάδων (βήμα 9) — client-safe.
 *
 * Settings → «Φόρμες μονάδων»: τύποι μονάδων και τα δικά σας πεδία, με ετικέτα
 * σε ελληνικά και αγγλικά. Κάθε πεδίο λέει:
 *  - σε ποιους τύπους εμφανίζεται (κενό = σε όλους),
 *  - αν το βλέπει ο πελάτης (portal) ή μόνο το προσωπικό,
 *  - αν μετρά στο matching αγοραστών (ο αγοραστής δηλώνει τι θέλει).
 * Οι τιμές ανά μονάδα αποθηκεύονται στο units.custom_fields (migration 0061),
 * οι απαιτήσεις του αγοραστή στο leads.unit_requirements.
 * Το `key` ενός πεδίου δεν αλλάζει ποτέ, άρα μετονομασία δεν χάνει τιμές.
 */
import type { Lang } from '@/lib/locale-shared';

export type UnitFieldType = 'text' | 'number' | 'choice' | 'multi' | 'yesno' | 'date';
export const UNIT_FIELD_TYPES: { value: UnitFieldType; label: string }[] = [
  { value: 'text', label: 'Κείμενο' },
  { value: 'number', label: 'Αριθμός' },
  { value: 'choice', label: 'Μία επιλογή' },
  { value: 'multi', label: 'Πολλές επιλογές' },
  { value: 'yesno', label: 'Ναι / Όχι' },
  { value: 'date', label: 'Ημερομηνία' },
];
export const UNIT_SECTIONS = [
  { key: 'location', el: 'Τοποθεσία', en: 'Location' },
  { key: 'property', el: 'Ακίνητο', en: 'Property' },
  { key: 'construction', el: 'Κατασκευή', en: 'Construction' },
  { key: 'specs', el: 'Προδιαγραφές κατασκευής', en: 'Build specifications' },
  { key: 'features', el: 'Χαρακτηριστικά', en: 'Features' },
  { key: 'legal', el: 'Νομικά', en: 'Legal' },
  { key: 'price', el: 'Τιμή', en: 'Price' },
] as const;
export type UnitSection = (typeof UNIT_SECTIONS)[number]['key'];

export interface UnitType { key: string; el: string; en: string }
export interface UnitField {
  key: string;
  el: string;
  en: string;
  type: UnitFieldType;
  options: string[];
  /** e.g. "m", "m²", "€" — shown after numbers. */
  suffix: string;
  section: UnitSection;
  /** Unit type keys; empty = every type. */
  types: string[];
  visibleToClient: boolean;
  useInMatching: boolean;
  required: boolean;
}
export interface UnitFormsSettings { types: UnitType[]; fields: UnitField[] }

const T = (key: string, el: string, en: string): UnitType => ({ key, el, en });
const F = (p: Partial<UnitField> & Pick<UnitField, 'key' | 'el' | 'en' | 'type'>): UnitField => ({
  options: [], suffix: '', section: 'features', types: [], visibleToClient: true, useInMatching: false, required: false, ...p,
});

export const DEFAULT_UNIT_FORMS: UnitFormsSettings = {
  types: [
    T('apartment', 'Διαμέρισμα', 'Apartment'),
    T('penthouse', 'Ρετιρέ', 'Penthouse'),
    T('maisonette', 'Μεζονέτα', 'Maisonette'),
    T('house', 'Μονοκατοικία / Βίλα', 'House / Villa'),
    T('studio', 'Studio', 'Studio'),
    T('commercial', 'Επαγγελματικός χώρος', 'Commercial'),
    T('plot', 'Οικόπεδο', 'Plot'),
  ],
  // Πεδία για νέες κατοικίες που χτίζει η εταιρεία (όχι μεταπώληση).
  fields: [
    // Κατασκευή
    F({ key: 'construction_stage', el: 'Στάδιο κατασκευής', en: 'Construction stage', type: 'choice', options: ['Σχέδια / άδειες', 'Εκσκαφές & θεμελίωση', 'Σκελετός', 'Τοιχοποιίες', 'Η/Μ εγκαταστάσεις', 'Τελειώματα', 'Ολοκληρωμένο'], section: 'construction', useInMatching: true, types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'expected_completion', el: 'Αναμενόμενη παράδοση', en: 'Expected completion', type: 'date', section: 'construction' }),
    F({ key: 'covered_area', el: 'Καλυμμένοι χώροι', en: 'Covered area', type: 'number', suffix: 'm²', section: 'construction', useInMatching: true, types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'covered_verandas', el: 'Καλυμμένες βεράντες', en: 'Covered verandas', type: 'number', suffix: 'm²', section: 'construction', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'uncovered_verandas', el: 'Ακάλυπτες βεράντες', en: 'Uncovered verandas', type: 'number', suffix: 'm²', section: 'construction', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'roof_garden', el: 'Roof garden', en: 'Roof garden', type: 'number', suffix: 'm²', section: 'construction', types: ['penthouse', 'maisonette', 'house'] }),
    F({ key: 'plot_area', el: 'Εμβαδόν οικοπέδου', en: 'Plot area', type: 'number', suffix: 'm²', section: 'construction', useInMatching: true, types: ['maisonette', 'house', 'plot'] }),
    F({ key: 'basement', el: 'Υπόγειο', en: 'Basement', type: 'number', suffix: 'm²', section: 'construction', types: ['maisonette', 'house'] }),
    F({ key: 'parking', el: 'Στάθμευση', en: 'Parking', type: 'choice', options: ['Καμία', '1 στεγασμένη', '2 στεγασμένες', '1 ανοιχτή', '2 ανοιχτές', 'Υπόγειο γκαράζ'], section: 'construction', useInMatching: true, types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'storage_room', el: 'Αποθήκη', en: 'Storage room', type: 'yesno', section: 'construction', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    // Προδιαγραφές κατασκευής
    F({ key: 'structure', el: 'Φέρων οργανισμός', en: 'Structure', type: 'choice', options: ['Οπλισμένο σκυρόδεμα (αντισεισμικό)', 'Μεταλλικός σκελετός', 'Μικτός'], section: 'specs' }),
    F({ key: 'insulation', el: 'Μονώσεις', en: 'Insulation', type: 'multi', options: ['Θερμομόνωση εξωτ. τοίχων (ETICS)', 'Θερμομόνωση δώματος', 'Υγρομόνωση', 'Ηχομόνωση δαπέδων'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'windows', el: 'Κουφώματα', en: 'Windows', type: 'choice', options: ['Αλουμίνιο με θερμοδιακοπή & διπλά τζάμια', 'Αλουμίνιο με διπλά τζάμια', 'PVC με διπλά τζάμια'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'heating', el: 'Θέρμανση', en: 'Heating', type: 'choice', options: ['Ενδοδαπέδια με αντλία θερμότητας', 'Ενδοδαπέδια με πετρέλαιο', 'Καλοριφέρ', 'Πρόνοια θέρμανσης', 'Καμία'], section: 'specs', useInMatching: true, types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'cooling', el: 'Κλιματισμός', en: 'Cooling', type: 'choice', options: ['VRV σε όλους τους χώρους', 'Split σε όλους τους χώρους', 'Πρόνοια για split'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'hot_water', el: 'Ζεστό νερό', en: 'Hot water', type: 'choice', options: ['Ηλιακός', 'Αντλία θερμότητας', 'Ηλιακός + αντλία θερμότητας'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'pv_kw', el: 'Φωτοβολταϊκά', en: 'Photovoltaics', type: 'number', suffix: 'kWp', section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'ev_charger', el: 'Φορτιστής ηλεκτρικού αυτοκινήτου', en: 'EV charger', type: 'choice', options: ['Εγκατεστημένος', 'Πρόνοια', 'Όχι'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'smart_home', el: 'Smart home', en: 'Smart home', type: 'choice', options: ['Πλήρες σύστημα', 'Βασικό (φώτα, ρολά)', 'Πρόνοια', 'Όχι'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'finishes', el: 'Επίπεδο τελειωμάτων', en: 'Finishes level', type: 'choice', options: ['Standard', 'Premium', 'Luxury'], section: 'specs', useInMatching: true, types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'flooring', el: 'Δάπεδα', en: 'Flooring', type: 'multi', options: ['Πορσελανάτο πλακάκι', 'Ξύλινο', 'Μάρμαρο', 'Μικροτσιμέντο'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'kitchen', el: 'Κουζίνα', en: 'Kitchen', type: 'choice', options: ['Με ηλεκτρικές συσκευές', 'Χωρίς συσκευές', 'Επιλογή αγοραστή'], section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'wardrobes', el: 'Εντοιχισμένες ντουλάπες', en: 'Built-in wardrobes', type: 'yesno', section: 'specs', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'private_pool', el: 'Ιδιωτική πισίνα', en: 'Private pool', type: 'yesno', section: 'specs', useInMatching: true, types: ['penthouse', 'maisonette', 'house'] }),
    F({ key: 'lift', el: 'Ανελκυστήρας', en: 'Lift', type: 'yesno', section: 'specs', types: ['apartment', 'penthouse', 'studio', 'commercial'] }),
    // Ακίνητο / τοποθεσία
    F({ key: 'orientation', el: 'Προσανατολισμός', en: 'Orientation', type: 'choice', options: ['Νότιος', 'Νοτιοανατολικός', 'Νοτιοδυτικός', 'Ανατολικός', 'Δυτικός', 'Βόρειος'], section: 'property', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio'] }),
    F({ key: 'energy_class', el: 'Ενεργειακή κλάση', en: 'Energy class', type: 'choice', options: ['A+', 'A', 'B+', 'B'], section: 'property', types: ['apartment', 'penthouse', 'maisonette', 'house', 'studio', 'commercial'] }),
    F({ key: 'sea_view', el: 'Θέα θάλασσα', en: 'Sea view', type: 'yesno', section: 'location', useInMatching: true }),
    F({ key: 'distance_sea', el: 'Απόσταση από θάλασσα', en: 'Distance to sea', type: 'number', suffix: 'm', section: 'location', useInMatching: true }),
    // Νομικά
    F({ key: 'planning_permit', el: 'Πολεοδομική άδεια (αρ.)', en: 'Planning permit no.', type: 'text', section: 'legal', visibleToClient: false }),
    F({ key: 'building_permit', el: 'Άδεια οικοδομής (αρ.)', en: 'Building permit no.', type: 'text', section: 'legal', visibleToClient: false }),
    F({ key: 'title_deeds', el: 'Τίτλος ιδιοκτησίας', en: 'Title deeds', type: 'choice', options: ['Ξεχωριστός τίτλος αναμένεται', 'Σε εξέλιξη', 'Διαθέσιμος'], section: 'legal' }),
    F({ key: 'structural_warranty', el: 'Εγγύηση φέροντος οργανισμού', en: 'Structural warranty', type: 'number', suffix: 'έτη', section: 'legal' }),
    // Τιμή (μόνο προσωπικό)
    F({ key: 'build_cost_sqm', el: 'Κόστος κατασκευής ανά m²', en: 'Build cost per m²', type: 'number', suffix: '€', section: 'price', visibleToClient: false }),
    F({ key: 'building_density', el: 'Συντελεστής δόμησης', en: 'Building density', type: 'number', suffix: '%', section: 'legal', types: ['plot'] }),
  ],
};

const KEY_RE = /^[a-z0-9_]{1,40}$/;

/** "Θέα θάλασσα" → "thea_thalassa", unique among `taken`. */
export function keyFrom(name: string, taken: string[]): string {
  const gr: Record<string, string> = { α:'a',β:'v',γ:'g',δ:'d',ε:'e',ζ:'z',η:'i',θ:'th',ι:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o' };
  const base = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split('').map((c) => gr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36) || 'field';
  let k = base; let n = 2;
  while (taken.includes(k)) k = `${base}_${n++}`;
  return k;
}

/** Validate the slice (used on read AND before save). */
export function mergeUnitForms(x: any): UnitFormsSettings {
  const v = x && typeof x === 'object' ? x : {};
  const s = (t: any, max = 80) => (typeof t === 'string' ? t.trim().slice(0, max) : '');
  const types: UnitType[] = [];
  for (const t of Array.isArray(v.types) ? v.types : DEFAULT_UNIT_FORMS.types) {
    const el = s(t?.el); if (!el) continue;
    const key = typeof t?.key === 'string' && KEY_RE.test(t.key) && !types.some((y) => y.key === t.key) ? t.key : keyFrom(s(t?.en) || el, types.map((y) => y.key));
    types.push({ key, el, en: s(t?.en) || el });
  }
  const typeKeys = types.map((t) => t.key);
  const fields: UnitField[] = [];
  for (const f of Array.isArray(v.fields) ? v.fields : DEFAULT_UNIT_FORMS.fields) {
    const el = s(f?.el); if (!el) continue;
    const key = typeof f?.key === 'string' && KEY_RE.test(f.key) && !fields.some((y) => y.key === f.key) ? f.key : keyFrom(s(f?.en) || el, fields.map((y) => y.key));
    const type: UnitFieldType = UNIT_FIELD_TYPES.some((t) => t.value === f?.type) ? f.type : 'text';
    fields.push({
      key, el, en: s(f?.en) || el, type,
      options: type === 'choice' || type === 'multi' ? Array.from(new Set((Array.isArray(f?.options) ? f.options : []).map((o: any) => s(o, 60)).filter(Boolean))).slice(0, 40) as string[] : [],
      suffix: s(f?.suffix, 8),
      section: UNIT_SECTIONS.some((x) => x.key === f?.section) ? f.section : 'features',
      types: Array.isArray(f?.types) ? f.types.filter((t: any) => typeKeys.includes(t)) : [],
      visibleToClient: f?.visibleToClient !== false,
      useInMatching: !!f?.useInMatching && type !== 'text' && type !== 'date',
      required: !!f?.required,
    });
  }
  return { types: types.length ? types : DEFAULT_UNIT_FORMS.types, fields: fields.slice(0, 80) };
}

export const label = (x: { el: string; en: string }, lang: Lang) => (lang === 'el' ? x.el : x.en);

/** Which unit type key a unit's free-text `type` corresponds to ("Apartment", "διαμέρισμα", "apartment"). */
export function typeKeyOf(unitType: string | null | undefined, types: UnitType[]): string | null {
  const n = String(unitType ?? '').trim().toLowerCase();
  if (!n) return null;
  return types.find((t) => t.key === n || t.el.toLowerCase() === n || t.en.toLowerCase() === n)?.key ?? null;
}

/** Fields for a unit of this type (all types when the type is unknown). */
export function fieldsFor(cfg: UnitFormsSettings, typeKey: string | null): UnitField[] {
  return cfg.fields.filter((f) => !f.types.length || !typeKey || f.types.includes(typeKey));
}

export type FieldValue = string | number | boolean | string[] | null;

/** Keep only known fields with values of the right shape. */
export function cleanValues(raw: unknown, fields: UnitField[]): Record<string, FieldValue> {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Record<string, FieldValue> = {};
  for (const f of fields) {
    const x = v[f.key];
    if (x === undefined || x === null || x === '') continue;
    if (f.type === 'number') { const n = Number(x); if (Number.isFinite(n)) out[f.key] = n; }
    else if (f.type === 'yesno') out[f.key] = x === true || x === 'true' || x === 'yes';
    else if (f.type === 'multi') { const a = (Array.isArray(x) ? x : [x]).map(String).filter((o) => f.options.includes(o)); if (a.length) out[f.key] = a; }
    else if (f.type === 'choice') { if (f.options.includes(String(x))) out[f.key] = String(x); }
    else if (f.type === 'date') { if (/^\d{4}-\d{2}-\d{2}$/.test(String(x))) out[f.key] = String(x); }
    else out[f.key] = String(x).slice(0, 500);
  }
  return out;
}

/** Human-readable value ("Ναι", "350 m", "Ανελκυστήρας, Ηλιακός"). */
export function showValue(f: UnitField, v: FieldValue, lang: Lang = 'el', fmtNumber: (n: number) => string = String): string {
  if (v === null || v === undefined || v === '') return '—';
  if (f.type === 'yesno') return v ? (lang === 'el' ? 'Ναι' : lang === 'ru' ? 'Да' : 'Yes') : (lang === 'el' ? 'Όχι' : lang === 'ru' ? 'Нет' : 'No');
  if (f.type === 'number') return `${fmtNumber(Number(v))}${f.suffix ? ` ${f.suffix}` : ''}`;
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

/* ------------------------------------------------------------ matching -- */

/**
 * What the buyer wants for a matching field. yesno: true = must have;
 * number: { max } (e.g. distance to sea ≤ 300) or { min }; choice/multi:
 * any of the listed options.
 */
export type Requirement = boolean | { min?: number; max?: number } | string[];
export type Requirements = Record<string, Requirement>;

export function cleanRequirements(raw: unknown, fields: UnitField[]): Requirements {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out: Requirements = {};
  for (const f of fields.filter((x) => x.useInMatching)) {
    const r = v[f.key];
    if (r === undefined || r === null) continue;
    if (f.type === 'yesno' && r === true) out[f.key] = true;
    else if (f.type === 'number' && typeof r === 'object' && !Array.isArray(r)) {
      const min = Number((r as any).min); const max = Number((r as any).max);
      const o: { min?: number; max?: number } = {};
      if (Number.isFinite(min) && (r as any).min !== '' && (r as any).min != null) o.min = min;
      if (Number.isFinite(max) && (r as any).max !== '' && (r as any).max != null) o.max = max;
      if (o.min != null || o.max != null) out[f.key] = o;
    } else if ((f.type === 'choice' || f.type === 'multi') && Array.isArray(r)) {
      const a = r.map(String).filter((o) => f.options.includes(o));
      if (a.length) out[f.key] = a;
    }
  }
  return out;
}

/** How many of the buyer's wishes this unit meets: met / missed (unknown values don't count against). */
export function checkRequirements(req: Requirements, values: Record<string, FieldValue>, fields: UnitField[], lang: Lang = 'el'): { met: string[]; missed: string[] } {
  const met: string[] = []; const missed: string[] = [];
  for (const [k, r] of Object.entries(req)) {
    const f = fields.find((x) => x.key === k);
    if (!f) continue;
    const v = values[k];
    if (v === undefined || v === null) continue;
    let ok = false;
    if (r === true) ok = v === true;
    else if (Array.isArray(r)) ok = Array.isArray(v) ? v.some((x) => r.includes(x)) : r.includes(String(v));
    else if (typeof r === 'object') { const n = Number(v); ok = (r.min == null || n >= r.min) && (r.max == null || n <= r.max); }
    (ok ? met : missed).push(label(f, lang));
  }
  return { met, missed };
}
