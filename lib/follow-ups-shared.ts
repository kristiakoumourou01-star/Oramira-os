/** Follow-ups: ομαδοποίηση κατά προθεσμία και γρήγορες αναβολές. Client-safe. */

export interface FollowUpRow {
  id: string; leadId: string | null; contactId: string | null; dueAt: string; note: string;
  name: string; phone: string | null; email: string | null; ownerId: string | null; ownerName: string | null;
  leadStatus: string | null; budget: string | null;
}

export const BUCKETS = [
  { key: 'overdue', label: 'Καθυστερημένα', danger: true },
  { key: 'today', label: 'Σήμερα' },
  { key: 'tomorrow', label: 'Αύριο' },
  { key: 'week', label: 'Αυτή την εβδομάδα' },
  { key: 'later', label: 'Αργότερα' },
] as const;
export type BucketKey = (typeof BUCKETS)[number]['key'];

const dayStart = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };

export function bucketOf(dueAt: string, now = new Date()): BucketKey {
  const t = Date.parse(dueAt);
  const today = dayStart(now);
  if (t < now.getTime()) return 'overdue';
  if (t < today + 86_400_000) return 'today';
  if (t < today + 2 * 86_400_000) return 'tomorrow';
  if (t < today + 7 * 86_400_000) return 'week';
  return 'later';
}

/** Γρήγορες αναβολές: νέα ώρα (ISO). `in1h` κρατά τη μέρα· οι άλλες πάνε 09:30. */
export function snoozeTo(kind: 'in1h' | 'tomorrow' | 'in3d' | 'nextweek', now = new Date()): string {
  const d = new Date(now);
  if (kind === 'in1h') { d.setMinutes(d.getMinutes() + 60, 0, 0); return d.toISOString(); }
  const add = kind === 'tomorrow' ? 1 : kind === 'in3d' ? 3 : ((8 - d.getDay()) % 7 || 7); // επόμενη Δευτέρα
  d.setDate(d.getDate() + add); d.setHours(9, 30, 0, 0);
  return d.toISOString();
}

/** Τύπος κίνησης από το κείμενο (για εικονίδιο). */
export function kindOf(note: string): 'call' | 'whatsapp' | 'email' | 'meeting' | 'viewing' | 'other' {
  const n = note.toLowerCase();
  if (/whats|μήνυμα|μηνυμα/.test(n)) return 'whatsapp';
  if (/email|mail/.test(n)) return 'email';
  if (/ξενάγ|ξεναγ|προβολ|viewing/.test(n)) return 'viewing';
  if (/συνάντ|συναντ|meeting/.test(n)) return 'meeting';
  if (/κλήσ|κλησ|τηλ|call|phone/.test(n)) return 'call';
  return 'other';
}

export const NEXT_PRESETS = ['Κλήση', 'WhatsApp', 'Email με πρόταση', 'Ξενάγηση', 'Συνάντηση'];

/** Για <input type="datetime-local">: τοπική ώρα χωρίς ζώνη. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
