/**
 * Αναφορές real estate (όπως το πλέγμα αναφορών του FitnessCRM): τύποι και
 * λίστα αναφορών. Client-safe. Οι αριθμοί ταξιδεύουν «ωμοί» και μορφοποιούνται
 * στον πίνακα — έτσι η ταξινόμηση και το export μένουν σωστά σε κάθε γλώσσα.
 */

export type CellFmt = 'money' | 'int' | 'pct' | 'date' | 'month' | 'days' | 'm2' | 'text';
export interface ReportColumn { key: string; label: string; align?: 'right' | 'left'; fmt?: CellFmt; /** Δεδομένα χρηστών (ονόματα, διευθύνσεις) — δεν μεταφράζονται. */ data?: boolean; money?: boolean }
export type ReportRow = Record<string, string | number | null>;

/** Πίνακας αναφοράς (χρησιμοποιείται και από το Custom report). */
export interface DataReport { columns: ReportColumn[]; rows: ReportRow[]; summary: { label: string; value: string }[]; note?: string }

export interface ReportView { key: string; label: string; columns: ReportColumn[]; rows: ReportRow[]; empty?: string }
export interface ReportChart { title: string; labels: string[]; series: { name: string; values: number[] }[]; fmt?: CellFmt; labelFmt?: 'month'; /** Τα labels είναι δεδομένα χρηστών (ονόματα έργων, πωλητών). */ dataLabels?: boolean }
export interface ReportSummary { label: string; value: number | string | null; fmt?: CellFmt; hint?: string }
export type ReportFilterKey = 'period' | 'project' | 'agent' | 'channel';

export interface BuiltReport { summary: ReportSummary[]; chart?: ReportChart; views: ReportView[]; filters: ReportFilterKey[]; note?: string }

export interface ReportFilters { period: string; from: string | null; to: string | null; project: string; agent: string; channel: string }

export interface ReportTileDef { key: string; title: string; desc: string; icon: string }

export const REPORT_TILES: ReportTileDef[] = [
  { key: 'sales', title: 'Πωλήσεις', desc: 'Κρατήσεις, συμβόλαια και έσοδα ανά έργο', icon: 'TrendingUp' },
  { key: 'leads', title: 'Leads & πηγές', desc: 'Όγκος, μετατροπή και κόστος ανά lead', icon: 'Users' },
  { key: 'agents', title: 'Απόδοση πωλητών', desc: 'Leads, viewings, κρατήσεις και πωλήσεις ανά πωλητή', icon: 'Award' },
  { key: 'inventory', title: 'Έργα & μονάδες', desc: 'Απόθεμα, πωλημένες / διαθέσιμες, τιμή ανά m²', icon: 'Building2' },
  { key: 'collections', title: 'Εισπράξεις & δόσεις', desc: 'Πρόγραμμα πληρωμών, ληξιπρόθεσμα και εισπράξεις', icon: 'Wallet' },
  { key: 'property', title: 'Διαχείριση ακινήτων', desc: 'Αιτήματα, χρεώσεις και τέλη συντήρησης', icon: 'Wrench' },
  { key: 'campaigns', title: 'Καμπάνιες marketing', desc: 'Αποστολές, ανοίγματα και αποτυχίες ανά κανάλι', icon: 'Megaphone' },
  { key: 'tasks', title: 'Tasks', desc: 'Λίστες κλήσεων, αποτελέσματα και εργασίες ανά άτομο', icon: 'PhoneCall' },
  { key: 'custom', title: 'Custom report', desc: 'Φτιάξτε το δικό σας φίλτρο πελατών', icon: 'SlidersHorizontal' },
  { key: 'board', title: 'Board pack', desc: 'Σύνοψη για τη διοίκηση — PDF εβδομάδας / μήνα', icon: 'Briefcase' },
  { key: 'investor', title: 'Investor report', desc: 'Αναφορά για επενδυτές σε PDF', icon: 'LineChart' },
];

/** Παλιοί σύνδεσμοι ?tab= → νέες αναφορές. */
export const REPORT_ALIAS: Record<string, string> = { pipeline: 'sales', reservations: 'sales', leads_source: 'leads', commissions: 'agents', activities: 'tasks', maintenance: 'property', invoices: 'collections' };

export const PERIODS: [string, string][] = [['30', '30 ημέρες'], ['90', '90 ημέρες'], ['365', '12 μήνες'], ['ytd', 'Φέτος'], ['all', 'Όλα'], ['custom', 'Από – έως']];

export const LEAD_SOURCES: [string, string][] = [['website', 'Ιστοσελίδα'], ['meta', 'Facebook / Instagram'], ['google', 'Google'], ['organic', 'Οργανικά'], ['referral', 'Σύσταση'], ['walk_in', 'Επίσκεψη στο γραφείο'], ['whatsapp', 'WhatsApp'], ['other', 'Άλλο']];

/** Χρονικό διάστημα από τα φίλτρα (ISO, ή null = χωρίς όριο). */
export function periodRange(f: Pick<ReportFilters, 'period' | 'from' | 'to'>, now = new Date()): { from: string | null; to: string | null } {
  if (f.period === 'custom') return { from: f.from || null, to: f.to ? `${f.to}T23:59:59.999Z` : null };
  if (f.period === 'all') return { from: null, to: null };
  if (f.period === 'ytd') return { from: `${now.getUTCFullYear()}-01-01`, to: null };
  const days = Number(f.period) || 365;
  return { from: new Date(now.getTime() - days * 864e5).toISOString(), to: null };
}
