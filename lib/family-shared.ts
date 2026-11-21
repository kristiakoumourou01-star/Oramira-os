/**
 * Καρτέλα πελάτη → Επαφές & οικογενειακό δέντρο (client-safe).
 * Η σχέση διαβάζεται από τον πελάτη της καρτέλας: «Πατέρας» = ο πατέρας του.
 */

export type Gender = 'male' | 'female' | null;

/** Επιλογές του «Νέα επαφή» (όπως στο FitnessCRM· αντί για Παιδίατρο: Δικηγόρος / Λογιστής). */
export const FAMILY_RELATIONS = [
  { v: 'father', l: 'Πατέρας' }, { v: 'mother', l: 'Μητέρα' }, { v: 'son', l: 'Γιος' }, { v: 'daughter', l: 'Κόρη' },
  { v: 'brother', l: 'Αδελφός' }, { v: 'sister', l: 'Αδελφή' }, { v: 'grandfather', l: 'Παππούς' }, { v: 'grandmother', l: 'Γιαγιά' },
  { v: 'grandson', l: 'Εγγονός' }, { v: 'granddaughter', l: 'Εγγονή' }, { v: 'uncle', l: 'Θείος' }, { v: 'aunt', l: 'Θεία' },
  { v: 'cousin', l: 'Ξάδερφος/η' }, { v: 'nephew', l: 'Ανιψιός' }, { v: 'niece', l: 'Ανιψιά' }, { v: 'spouse', l: 'Σύζυγος' },
  { v: 'partner', l: 'Σύντροφος' }, { v: 'lawyer', l: 'Δικηγόρος' }, { v: 'accountant', l: 'Λογιστής' }, { v: 'other', l: 'Άλλο' },
] as const;

/** Γενικές ετικέτες (για την αντίστροφη σχέση όταν δεν ξέρουμε το φύλο) και παλιές τιμές. */
const EXTRA: Record<string, string> = {
  child: 'Παιδί', parent: 'Γονέας', sibling: 'Αδέλφι', grandchild: 'Εγγόνι', grandparent: 'Παππούς / γιαγιά',
  nibling: 'Ανιψιός / ανιψιά', uncle_aunt: 'Θείος / θεία', client: 'Πελάτης', relative: 'Συγγενής',
  agent: 'Μεσίτης / συνεργάτης', business_partner: 'Συνέταιρος',
};
export const RELATION_KEYS: string[] = [...FAMILY_RELATIONS.map((r) => r.v), ...Object.keys(EXTRA)];
export function familyLabel(v: string): string {
  return FAMILY_RELATIONS.find((r) => r.v === v)?.l ?? EXTRA[v] ?? v;
}

/**
 * Η σχέση από την άλλη πλευρά. Ο Α δηλώνει τον Β ως «Πατέρα» → στην καρτέλα
 * του Β ο Α είναι «Γιος» / «Κόρη» (από το φύλο του Α) ή γενικά «Παιδί».
 */
export function inverseRelation(rel: string, genderOfA: Gender): string {
  const g = (m: string, f: string, any: string) => (genderOfA === 'male' ? m : genderOfA === 'female' ? f : any);
  switch (rel) {
    case 'father': case 'mother': case 'parent': return g('son', 'daughter', 'child');
    case 'son': case 'daughter': case 'child': return g('father', 'mother', 'parent');
    case 'brother': case 'sister': case 'sibling': return g('brother', 'sister', 'sibling');
    case 'grandfather': case 'grandmother': case 'grandparent': return g('grandson', 'granddaughter', 'grandchild');
    case 'grandson': case 'granddaughter': case 'grandchild': return g('grandfather', 'grandmother', 'grandparent');
    case 'uncle': case 'aunt': case 'uncle_aunt': return g('nephew', 'niece', 'nibling');
    case 'nephew': case 'niece': case 'nibling': return g('uncle', 'aunt', 'uncle_aunt');
    case 'cousin': return 'cousin';
    case 'spouse': return 'spouse';
    case 'partner': return 'partner';
    case 'lawyer': case 'accountant': case 'agent': return 'client';
    case 'client': return 'other';
    case 'business_partner': return 'business_partner';
    case 'relative': return 'relative';
    default: return 'other';
  }
}

/** Γενιά σε σχέση με τον πελάτη (−2 παππούδες … +2 εγγόνια)· null = όχι οικογένεια. */
export function generationOf(rel: string): number | null {
  if (['grandfather', 'grandmother', 'grandparent'].includes(rel)) return -2;
  if (['father', 'mother', 'parent', 'uncle', 'aunt', 'uncle_aunt'].includes(rel)) return -1;
  if (['spouse', 'partner', 'brother', 'sister', 'sibling', 'cousin'].includes(rel)) return 0;
  if (['son', 'daughter', 'child', 'nephew', 'niece', 'nibling'].includes(rel)) return 1;
  if (['grandson', 'granddaughter', 'grandchild'].includes(rel)) return 2;
  if (rel === 'relative') return 0;
  return null;
}

export const normGender = (g: unknown): Gender => (g === 'male' || g === 'female' ? g : null);

/** Μία επαφή στη λίστα «Επαφές» της καρτέλας. */
export interface FamilyRow {
  id: string;
  relation: string;
  contactId: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  note: string | null;
  decisionMaker: boolean;
  /** Γραμμή που έγραψε ο άλλος πελάτης (χωρίς αντίστροφη εγγραφή, παλιά δεδομένα). */
  incoming: boolean;
}
