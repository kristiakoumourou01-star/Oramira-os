/**
 * Αναφορές real estate (όπως οι αναφορές του FitnessCRM): τύποι, λίστα
 * αναφορών, χρονικά διαστήματα και σύγκριση με την ίδια περίοδο πέρσι.
 * Client-safe. Οι αριθμοί ταξιδεύουν «ωμοί» και μορφοποιούνται στην οθόνη.
 */

export type CellFmt = 'money' | 'int' | 'pct' | 'date' | 'month' | 'days' | 'm2' | 'text';
export interface ReportColumn { key: string; label: string; align?: 'right' | 'left'; fmt?: CellFmt; /** Δεδομένα χρηστών (ονόματα, διευθύνσεις) — δεν μεταφράζονται. */ data?: boolean; money?: boolean }
export type ReportRow = Record<string, string | number | null>;

/** Πίνακας αναφοράς (χρησιμοποιείται και από το Custom report). */
export interface DataReport { columns: ReportColumn[]; rows: ReportRow[]; summary: { label: string; value: string }[]; note?: string }

export interface ReportView { key: string; label: string; columns: ReportColumn[]; rows: ReportRow[]; empty?: string }
export interface ReportSummary { label: string; value: number | string | null; fmt?: CellFmt; hint?: string }

/** Ένα νούμερο της αναφοράς: αυτή η περίοδος και η ίδια περίοδος πέρσι. */
export interface Metric { label: string; fmt: CellFmt; cur: number | null; prev: number | null; hint?: string }
export interface Trend { title: string; fmt: CellFmt; labels: string[]; labelFmt: 'day' | 'month'; cur: number[]; prev: number[] }
export interface Breakdown { title: string; fmt: CellFmt; rows: { label: string; value: number }[]; data?: boolean }
export type ReportFilterKey = 'project' | 'agent' | 'channel';

export interface BuiltReport { kpis: Metric[]; trend: Trend | null; totals: Metric[]; breakdowns: Breakdown[]; details: ReportView[]; filters: ReportFilterKey[]; note?: string }

export interface DateRange { from: string; to: string }
export interface ReportFilters { range: DateRange; prev: DateRange; preset: string; compare: boolean; project: string; agent: string; channel: string }

export interface ReportTileDef { key: string; title: string; desc: string; icon: string }

export const REPORT_TILES: ReportTileDef[] = [
  { key: 'sales', title: 'Πωλήσεις & έσοδα', desc: 'Κρατήσεις, συμβόλαια, έσοδα και εισπράξεις ανά έργο', icon: 'TrendingUp' },
  { key: 'leads', title: 'Leads & πηγές', desc: 'Όγκος, μετατροπή και κόστος ανά lead', icon: 'Users' },
  { key: 'agents', title: 'Απόδοση πωλητών', desc: 'Leads, viewings, κρατήσεις και πωλήσεις ανά πωλητή', icon: 'Award' },
  { key: 'inventory', title: 'Έργα & μονάδες', desc: 'Απόθεμα, πωλημένες / διαθέσιμες, τιμή ανά m²', icon: 'Building2' },
  { key: 'collections', title: 'Εισπράξεις & δόσεις', desc: 'Πρόγραμμα πληρωμών, ληξιπρόθεσμα και εισπράξεις', icon: 'Wallet' },
  { key: 'property', title: 'Διαχείριση ακινήτων', desc: 'Αιτήματα, χρεώσεις και τέλη συντήρησης', icon: 'Wrench' },
  { key: 'campaigns', title: 'Καμπάνιες marketing', desc: 'Αποστολές, ανοίγματα και αποτυχίες ανά κανάλι', icon: 'Megaphone' },
  { key: 'tasks', title: 'Tasks', desc: 'Λίστες κλήσεων, αποτελέσματα και εργασίες ανά άτομο', icon: 'PhoneCall' },
  { key: 'custom', title: 'Custom report', desc: 'Στοιβάξτε συνθήκες και πάρτε την ακριβή λίστα πελατών', icon: 'SlidersHorizontal' },
  { key: 'board', title: 'Board pack', desc: 'Σύνοψη για τη διοίκηση — PDF εβδομάδας / μήνα', icon: 'Briefcase' },
  { key: 'investor', title: 'Investor report', desc: 'Αναφορά για επενδυτές σε PDF', icon: 'LineChart' },
];

/** Παλιοί σύνδεσμοι → νέες αναφορές. */
export const REPORT_ALIAS: Record<string, string> = { pipeline: 'sales', reservations: 'sales', leads_source: 'leads', commissions: 'agents', activities: 'tasks', maintenance: 'property', invoices: 'collections' };

export const PRESETS: [string, string][] = [['today', 'Σήμερα'], ['yesterday', 'Χθες'], ['week', 'Αυτή η εβδομάδα'], ['month', 'Αυτός ο μήνας'], ['year', 'Φέτος'], ['lastyear', 'Πέρσι'], ['custom', 'Προσαρμογή ημερομηνιών']];

export const LEAD_SOURCES: [string, string][] = [['website', 'Ιστοσελίδα'], ['meta', 'Facebook / Instagram'], ['google', 'Google'], ['organic', 'Οργανικά'], ['referral', 'Σύσταση'], ['walk_in', 'Επίσκεψη στο γραφείο'], ['whatsapp', 'WhatsApp'], ['other', 'Άλλο']];

const iso = (d: Date) => d.toISOString().slice(0, 10);
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const addDays = (s: string, n: number) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const shiftYear = (s: string, n: number) => { const d = D(s); const m = d.getUTCMonth(); d.setUTCFullYear(d.getUTCFullYear() + n); if (d.getUTCMonth() !== m) d.setUTCDate(0); return iso(d); };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Διάστημα από preset ή από / έως. `today` = σημερινή ημερομηνία (YYYY-MM-DD, ώρα Κύπρου). */
export function resolveRange(preset: string | undefined, from: string | undefined, to: string | undefined, today: string): { preset: string; range: DateRange } {
  if (from && to && DATE_RE.test(from) && DATE_RE.test(to)) return { preset: preset && preset !== 'custom' && PRESETS.some((p) => p[0] === preset) ? preset : 'custom', range: from <= to ? { from, to } : { from: to, to: from } };
  const y = today.slice(0, 4);
  switch (preset) {
    case 'today': return { preset, range: { from: today, to: today } };
    case 'yesterday': { const d = addDays(today, -1); return { preset, range: { from: d, to: d } }; }
    case 'week': { const wd = (D(today).getUTCDay() + 6) % 7; return { preset, range: { from: addDays(today, -wd), to: today } }; }
    case 'month': return { preset, range: { from: `${today.slice(0, 7)}-01`, to: today } };
    case 'lastyear': return { preset, range: { from: `${Number(y) - 1}-01-01`, to: `${Number(y) - 1}-12-31` } };
    default: return { preset: 'year', range: { from: `${y}-01-01`, to: today } };
  }
}
export const prevRange = (r: DateRange): DateRange => ({ from: shiftYear(r.from, -1), to: shiftYear(r.to, -1) });
export const dayCount = (r: DateRange) => Math.round((D(r.to).getTime() - D(r.from).getTime()) / 864e5) + 1;

/** Τιμή (ISO ημερομηνία ή timestamp) μέσα στο διάστημα; */
export const inRange = (v: string | null | undefined, r: DateRange) => { if (!v) return false; const d = String(v).slice(0, 10); return d >= r.from && d <= r.to; };

/** Κουβάδες γραφήματος: ημέρες (έως ~2 μήνες) ή μήνες. */
export function buckets(r: DateRange): { keys: string[]; fmt: 'day' | 'month'; keyOf: (d: string) => string } {
  if (dayCount(r) <= 62) {
    const keys: string[] = []; for (let d = r.from; d <= r.to; d = addDays(d, 1)) keys.push(d);
    return { keys, fmt: 'day', keyOf: (d) => d.slice(0, 10) };
  }
  const keys: string[] = []; for (let m = r.from.slice(0, 7); m <= r.to.slice(0, 7); m = shiftMonth(m)) keys.push(`${m}-01`);
  return { keys, fmt: 'month', keyOf: (d) => `${d.slice(0, 7)}-01` };
}
const shiftMonth = (m: string) => { const [y, mo] = m.split('-').map(Number); return mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, '0')}`; };

/** Διαφορά % (null όταν δεν συγκρίνεται). */
export const deltaPct = (cur: number | null, prev: number | null) => (cur == null || prev == null || prev === 0 ? null : ((cur - prev) / Math.abs(prev)) * 100);
