/**
 * Έλεγχος ταυτότητας & AML (βήμα 12) — client-safe.
 *
 * Ο βαθμός κινδύνου είναι άθροισμα από απλούς, εξηγήσιμους παράγοντες (PEP,
 * χώρα υψηλού κινδύνου, μετρητά, πηγή χρημάτων χωρίς απόδειξη κ.λπ.). Κάθε
 * παράγοντας φαίνεται στην καρτέλα, ώστε ο υπεύθυνος συμμόρφωσης να ξέρει
 * γιατί βγήκε ο βαθμός. Οι λίστες χωρών είναι ρύθμιση της εταιρείας
 * (Ρυθμίσεις → GDPR & δεδομένα → AML) και πρέπει να ενημερώνονται μετά από
 * κάθε ολομέλεια της FATF (Φεβρουάριος, Ιούνιος, Οκτώβριος).
 *
 * Βοήθημα για το προσωπικό — δεν αντικαθιστά τον υπεύθυνο συμμόρφωσης
 * ούτε τη νομική υποχρέωση ελέγχου λιστών κυρώσεων στην πηγή τους.
 */
import type { Lang } from '@/lib/locale-shared';

export const COUNTRY_CODES = ('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS XK YE YT ZA ZM ZW').split(' ');

const TAG: Record<Lang, string> = { el: 'el', en: 'en', ru: 'ru' };
export function countryName(code: string | null | undefined, lang: Lang = 'el'): string {
  if (!code) return '';
  try { return new Intl.DisplayNames([TAG[lang]], { type: 'region' }).of(code) ?? code; } catch { return code; }
}
export function countryOptions(lang: Lang = 'el'): { code: string; name: string }[] {
  return COUNTRY_CODES.map((code) => ({ code, name: countryName(code, lang) })).sort((a, b) => a.name.localeCompare(b.name, TAG[lang]));
}

/* ------------------------------------------------------------ settings -- */

export interface AmlSettings {
  /** FATF «call for action» (μαύρη λίστα) — ενισχυμένη δέουσα επιμέλεια, αντίμετρα. */
  highRisk: string[];
  /** FATF «increased monitoring» (γκρίζα λίστα). */
  monitored: string[];
  /** Πότε ξαναελέγχεται ένας φάκελος (μήνες) ανά επίπεδο κινδύνου. */
  reviewMonths: { low: number; medium: number; high: number };
  /** Ημερομηνία της λίστας, για να φαίνεται πόσο παλιά είναι. */
  listsAsOf: string;
}
/** FATF, ολομέλεια Ιουνίου 2026 (19/06/2026). */
export const DEFAULT_AML: AmlSettings = {
  highRisk: ['IR', 'KP', 'MM'],
  monitored: ['AO', 'BO', 'BA', 'BG', 'CM', 'CI', 'CD', 'HT', 'IQ', 'KE', 'KW', 'LA', 'LB', 'MC', 'NP', 'PG', 'SS', 'SY', 'VE', 'VN', 'VG', 'YE'],
  reviewMonths: { low: 36, medium: 24, high: 12 },
  listsAsOf: '2026-06-19',
};
export function mergeAml(x: any): AmlSettings {
  const v = x && typeof x === 'object' ? x : {};
  const codes = (a: any, fb: string[]) => (Array.isArray(a) ? Array.from(new Set(a.map((c: any) => String(c).toUpperCase()).filter((c: string) => COUNTRY_CODES.includes(c)))) as string[] : fb);
  const m = (n: any, fb: number) => (Number.isFinite(Number(n)) && Number(n) >= 1 && Number(n) <= 120 ? Math.round(Number(n)) : fb);
  const r = v.reviewMonths ?? {};
  return {
    highRisk: codes(v.highRisk, DEFAULT_AML.highRisk),
    monitored: codes(v.monitored, DEFAULT_AML.monitored),
    reviewMonths: { low: m(r.low, 36), medium: m(r.medium, 24), high: m(r.high, 12) },
    listsAsOf: typeof v.listsAsOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.listsAsOf) ? v.listsAsOf : DEFAULT_AML.listsAsOf,
  };
}

/* ------------------------------------------------------------- options -- */

export const KYC_STATUS: Record<string, { label: string; tone: string }> = {
  not_started: { label: 'Δεν ξεκίνησε', tone: 'text-charcoal-600/70' },
  in_progress: { label: 'Σε εξέλιξη', tone: 'text-champagne-600' },
  verified: { label: 'Επαληθεύτηκε', tone: 'text-signal-success' },
  rejected: { label: 'Απορρίφθηκε', tone: 'text-signal-danger' },
};
export const PERSON_TYPES = [{ v: 'individual', l: 'Φυσικό πρόσωπο' }, { v: 'company', l: 'Εταιρεία' }, { v: 'trust', l: 'Trust / ίδρυμα' }];
export const ID_TYPES = [{ v: 'passport', l: 'Διαβατήριο' }, { v: 'id_card', l: 'Ταυτότητα' }, { v: 'residence_permit', l: 'Άδεια διαμονής' }, { v: 'company_registration', l: 'Πιστοποιητικό εταιρείας' }];
export const PEP_OPTIONS = [{ v: 'no', l: 'Όχι' }, { v: 'self', l: 'Ναι — το ίδιο το πρόσωπο' }, { v: 'family', l: 'Μέλος οικογένειας PEP' }, { v: 'associate', l: 'Στενός συνεργάτης PEP' }];
export const FUNDS = [
  { v: 'salary', l: 'Μισθός / σύνταξη' }, { v: 'business', l: 'Επιχείρηση / μερίσματα' }, { v: 'property_sale', l: 'Πώληση ακινήτου' },
  { v: 'inheritance', l: 'Κληρονομιά / δωρεά' }, { v: 'investments', l: 'Επενδύσεις' }, { v: 'loan', l: 'Δάνειο / στεγαστικό' },
  { v: 'savings', l: 'Αποταμιεύσεις' }, { v: 'other', l: 'Άλλο' },
];
export const RELATIONS = [
  { v: 'spouse', l: 'Σύζυγος' }, { v: 'partner', l: 'Σύντροφος' }, { v: 'child', l: 'Παιδί' }, { v: 'parent', l: 'Γονέας' },
  { v: 'sibling', l: 'Αδελφός/ή' }, { v: 'relative', l: 'Συγγενής' }, { v: 'lawyer', l: 'Δικηγόρος' }, { v: 'accountant', l: 'Λογιστής' },
  { v: 'agent', l: 'Μεσίτης / συνεργάτης' }, { v: 'business_partner', l: 'Συνέταιρος' }, { v: 'other', l: 'Άλλο' },
];
export const relationLabel = (v: string) => RELATIONS.find((r) => r.v === v)?.l ?? v;
/** How the relation reads from the other person's card (A is B's «Παιδί» → B is A's «Γονέας»). */
export function inverseRelationLabel(v: string): string {
  const inv: Record<string, string> = { child: 'parent', parent: 'child' };
  const prof: Record<string, string> = { lawyer: 'Πελάτης (ως δικηγόρος του)', accountant: 'Πελάτης (ως λογιστής του)', agent: 'Πελάτης (ως μεσίτης/συνεργάτης του)' };
  return prof[v] ?? relationLabel(inv[v] ?? v);
}
export const BEST_TIME = [
  { v: 'any', l: 'Οποτεδήποτε' }, { v: 'morning', l: 'Πρωί (9–12)' }, { v: 'midday', l: 'Μεσημέρι (12–15)' },
  { v: 'afternoon', l: 'Απόγευμα (15–18)' }, { v: 'evening', l: 'Βράδυ (18–21)' },
];
export const CHANNELS = [{ v: 'whatsapp', l: 'WhatsApp' }, { v: 'call', l: 'Τηλέφωνο' }, { v: 'email', l: 'Email' }, { v: 'viber', l: 'Viber' }, { v: 'telegram', l: 'Telegram' }, { v: 'sms', l: 'SMS' }];
export const LANGUAGES = [{ v: 'el', l: 'Ελληνικά' }, { v: 'en', l: 'Αγγλικά' }, { v: 'ru', l: 'Ρωσικά' }, { v: 'uk', l: 'Ουκρανικά' }, { v: 'he', l: 'Εβραϊκά' }, { v: 'ar', l: 'Αραβικά' }, { v: 'zh', l: 'Κινεζικά' }, { v: 'de', l: 'Γερμανικά' }, { v: 'fr', l: 'Γαλλικά' }, { v: 'other', l: 'Άλλη' }];

/* --------------------------------------------------------------- data -- */

export interface KycData {
  status: string; person_type: string;
  id_type: string | null; id_number: string | null; id_country: string | null; id_expiry: string | null;
  date_of_birth: string | null; nationality: string | null; residence_country: string | null;
  address: string | null; address_verified: boolean; occupation: string | null;
  pep: string; sanctions_checked_at: string | null; sanctions_hit: boolean;
  funds_source: string | null; funds_country: string | null; funds_verified: boolean; funds_note: string | null;
  cash_payment: boolean; third_party_payer: boolean; remote_onboarding: boolean;
  notes: string | null;
}
export const EMPTY_KYC: KycData = {
  status: 'not_started', person_type: 'individual', id_type: null, id_number: null, id_country: null, id_expiry: null,
  date_of_birth: null, nationality: null, residence_country: null, address: null, address_verified: false, occupation: null,
  pep: 'no', sanctions_checked_at: null, sanctions_hit: false, funds_source: null, funds_country: null, funds_verified: false,
  funds_note: null, cash_payment: false, third_party_payer: false, remote_onboarding: false, notes: null,
};

const date = (x: any) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.slice(0, 10)) ? x.slice(0, 10) : null);
const code = (x: any) => (typeof x === 'string' && COUNTRY_CODES.includes(x.toUpperCase()) ? x.toUpperCase() : null);
const txt = (x: any, n: number) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, n) : null);
const pick = (x: any, list: { v: string }[], fb: string | null) => (list.some((o) => o.v === x) ? x : fb);

/** Validate a KYC form (server side, before save). */
export function cleanKyc(x: any): KycData {
  const v = x && typeof x === 'object' ? x : {};
  return {
    status: Object.keys(KYC_STATUS).includes(v.status) ? v.status : 'in_progress',
    person_type: pick(v.person_type, PERSON_TYPES.map((p) => ({ v: p.v })), 'individual')!,
    id_type: pick(v.id_type, ID_TYPES.map((p) => ({ v: p.v })), null), id_number: txt(v.id_number, 60), id_country: code(v.id_country), id_expiry: date(v.id_expiry),
    date_of_birth: date(v.date_of_birth), nationality: code(v.nationality), residence_country: code(v.residence_country),
    address: txt(v.address, 300), address_verified: !!v.address_verified, occupation: txt(v.occupation, 120),
    pep: pick(v.pep, PEP_OPTIONS.map((p) => ({ v: p.v })), 'no')!,
    sanctions_checked_at: typeof v.sanctions_checked_at === 'string' && !Number.isNaN(Date.parse(v.sanctions_checked_at)) ? new Date(v.sanctions_checked_at).toISOString() : null,
    sanctions_hit: !!v.sanctions_hit,
    funds_source: pick(v.funds_source, FUNDS.map((p) => ({ v: p.v })), null), funds_country: code(v.funds_country), funds_verified: !!v.funds_verified, funds_note: txt(v.funds_note, 1000),
    cash_payment: !!v.cash_payment, third_party_payer: !!v.third_party_payer, remote_onboarding: !!v.remote_onboarding,
    notes: txt(v.notes, 2000),
  };
}

/* --------------------------------------------------------------- risk -- */

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export interface RiskFactor { key: string; label: string; points: number }
export interface Risk { score: number; level: RiskLevel; factors: RiskFactor[]; edd: boolean }

export const RISK_LABEL: Record<RiskLevel, { label: string; bg: string; fg: string }> = {
  low: { label: 'Χαμηλός', bg: '#E3F1E6', fg: '#1E5B33' },
  medium: { label: 'Μεσαίος', bg: '#FCEFD3', fg: '#7A5410' },
  high: { label: 'Υψηλός', bg: '#F6DEDB', fg: '#8A2A20' },
  blocked: { label: 'Αποκλεισμός', bg: '#2B2A27', fg: '#FFFFFF' },
};

/**
 * Score 0–100 from explainable factors. ≥50 or any EDD trigger (PEP, black-list
 * country) = high; a sanctions match = blocked, whatever else.
 */
export function computeRisk(k: KycData, aml: AmlSettings, today = new Date()): Risk {
  const f: RiskFactor[] = [];
  const add = (key: string, label: string, points: number) => f.push({ key, label, points });
  let edd = false;
  const countries = [
    ['nationality', k.nationality, 'Υπηκοότητα'], ['residence', k.residence_country, 'Χώρα διαμονής'], ['funds', k.funds_country, 'Χώρα προέλευσης χρημάτων'],
  ] as const;
  const seenHigh = new Set<string>(); const seenMon = new Set<string>();
  for (const [key, c, what] of countries) {
    if (!c) continue;
    if (aml.highRisk.includes(c) && !seenHigh.has(c)) { seenHigh.add(c); edd = true; add(`hr_${key}`, `${what}: ${countryName(c)} — χώρα υψηλού κινδύνου (FATF)`, 40); }
    else if (aml.monitored.includes(c) && !seenMon.has(c) && !seenHigh.has(c)) { seenMon.add(c); add(`mon_${key}`, `${what}: ${countryName(c)} — υπό αυξημένη παρακολούθηση (FATF)`, 20); }
  }
  if (k.pep !== 'no') { edd = true; add('pep', k.pep === 'self' ? 'Πολιτικά εκτεθειμένο πρόσωπο (PEP)' : k.pep === 'family' ? 'Μέλος οικογένειας PEP' : 'Στενός συνεργάτης PEP', k.pep === 'self' ? 35 : 25); }
  if (k.cash_payment) add('cash', 'Πληρωμή με μετρητά', 20);
  if (k.third_party_payer) add('third_party', 'Πληρώνει τρίτο πρόσωπο', 15);
  if (!k.funds_source) add('funds_unknown', 'Δεν δηλώθηκε πηγή χρημάτων', 15);
  else if (!k.funds_verified) add('funds_unverified', 'Η πηγή χρημάτων δεν αποδείχθηκε με έγγραφα', 10);
  if (k.person_type !== 'individual') add('structure', k.person_type === 'trust' ? 'Trust / ίδρυμα (πραγματικός δικαιούχος)' : 'Εταιρεία (πραγματικός δικαιούχος)', 10);
  if (k.remote_onboarding) add('remote', 'Χωρίς φυσική παρουσία', 10);
  if (!k.id_number || !k.id_type) add('no_id', 'Λείπει έγγραφο ταυτότητας', 10);
  else if (k.id_expiry && k.id_expiry < today.toISOString().slice(0, 10)) add('id_expired', 'Η ταυτότητα/διαβατήριο έχει λήξει', 10);
  if (!k.address_verified) add('address', 'Η διεύθυνση δεν επαληθεύτηκε', 5);
  if (!k.sanctions_checked_at) add('no_sanctions_check', 'Δεν έγινε έλεγχος σε λίστες κυρώσεων', 10);

  if (k.sanctions_hit) return { score: 100, level: 'blocked', edd: true, factors: [{ key: 'sanctions', label: 'Ταίριασμα σε λίστα κυρώσεων — καμία συναλλαγή, ενημερώστε τον υπεύθυνο συμμόρφωσης', points: 100 }, ...f] };
  const score = Math.min(100, f.reduce((s, x) => s + x.points, 0));
  const level: RiskLevel = edd || score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low';
  return { score, level, factors: f.sort((a, b) => b.points - a.points), edd };
}

/** What still blocks «Επαληθεύτηκε». */
export function verifyMissing(k: KycData): string[] {
  const m: string[] = [];
  if (!k.id_type || !k.id_number) m.push('έγγραφο ταυτότητας (είδος και αριθμός)');
  if (!k.id_expiry) m.push('ημερομηνία λήξης εγγράφου');
  if (k.person_type === 'individual' && !k.date_of_birth) m.push('ημερομηνία γέννησης');
  if (!k.nationality) m.push('υπηκοότητα');
  if (!k.residence_country) m.push('χώρα διαμονής');
  if (!k.address) m.push('διεύθυνση');
  if (!k.funds_source) m.push('πηγή χρημάτων');
  if (!k.sanctions_checked_at) m.push('έλεγχος σε λίστες κυρώσεων');
  if (k.sanctions_hit) m.push('δεν επιτρέπεται με ταίριασμα σε λίστα κυρώσεων');
  return m;
}

export function reviewDue(level: RiskLevel, from: string | null, aml: AmlSettings): string | null {
  if (!from || level === 'blocked') return null;
  const d = new Date(from);
  d.setMonth(d.getMonth() + aml.reviewMonths[level]);
  return d.toISOString().slice(0, 10);
}
