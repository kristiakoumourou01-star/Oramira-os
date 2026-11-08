/** Τύποι activities (όπως Pipedrive) — και η «Προβολή» ακινήτου. */
export const ACTIVITY_TYPES = [
  { key: 'call', label: 'Κλήση', icon: 'Phone' },
  { key: 'meeting', label: 'Συνάντηση', icon: 'Users' },
  { key: 'task', label: 'Εργασία', icon: 'CheckSquare' },
  { key: 'deadline', label: 'Προθεσμία', icon: 'Flag' },
  { key: 'email', label: 'Email', icon: 'Mail' },
  { key: 'lunch', label: 'Γεύμα', icon: 'Utensils' },
  { key: 'viewing', label: 'Προβολή', icon: 'Home' },
] as const;
export type ActivityKey = (typeof ACTIVITY_TYPES)[number]['key'];
export const ACTIVITY_KEYS: string[] = ACTIVITY_TYPES.map((a) => a.key);
export const activityLabel = (k: string | null | undefined) => ACTIVITY_TYPES.find((a) => a.key === k)?.label ?? 'Εργασία';

/** Κατάσταση της επόμενης activity ενός deal (το εικονίδιο στην κάρτα του Pipedrive). */
export type ActivityState = 'none' | 'overdue' | 'today' | 'planned';
export function activityState(next: string | null | undefined, now = new Date()): ActivityState {
  if (!next) return 'none';
  const t = new Date(next.length === 10 ? `${next}T23:59:59` : next);
  if (!Number.isFinite(t.getTime())) return 'none';
  const sameDay = t.getFullYear() === now.getFullYear() && t.getMonth() === now.getMonth() && t.getDate() === now.getDate();
  if (sameDay) return t.getTime() < now.getTime() && next.length > 10 ? 'overdue' : 'today';
  return t.getTime() < now.getTime() ? 'overdue' : 'planned';
}
