/**
 * Πίνακας διαθεσιμότητας (βήμα 11α) — client-safe.
 * Ομαδοποίηση μονάδων ανά κτίριο → όροφο, σύνολα ανά κατάσταση.
 */

export const BOARD_STATUSES = ['available', 'reserved', 'sold', 'handed_over', 'blocked'] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

/** Colours are fixed (not brand) so the board reads the same on screen, in print and for clients. */
export const STATUS_STYLE: Record<BoardStatus, { label: string; bg: string; fg: string; border: string }> = {
  available: { label: 'Διαθέσιμη', bg: '#E3F1E6', fg: '#1E5B33', border: '#7DBB8E' },
  reserved: { label: 'Κρατημένη', bg: '#FCEFD3', fg: '#7A5410', border: '#E2B65A' },
  sold: { label: 'Πωλημένη', bg: '#F6DEDB', fg: '#8A2A20', border: '#D98A80' },
  handed_over: { label: 'Παραδόθηκε', bg: '#DDE6F2', fg: '#24426B', border: '#8EA7CB' },
  blocked: { label: 'Εκτός πώλησης', bg: '#ECEAE6', fg: '#5E5A53', border: '#BDB8AE' },
};

export interface BoardUnit {
  id: string;
  unit_number: string;
  floor: number | null;
  type: string | null;
  sqm: number | null;
  bedrooms: number | null;
  price: number | null;
  status: string;
  building_id: string | null;
  building_name: string | null;
  /** Active reservation's expiry, if any. */
  reserved_until?: string | null;
}

export const statusOf = (s: string): BoardStatus => ((BOARD_STATUSES as readonly string[]).includes(s) ? (s as BoardStatus) : 'blocked');

export function floorLabel(f: number | null): string {
  if (f === null || f === undefined) return 'Χωρίς όροφο';
  if (f === 0) return 'Ισόγειο';
  if (f < 0) return `Υπόγειο ${f}`;
  return `${f}ος`;
}

const natural = (a: string, b: string) => a.localeCompare(b, 'el', { numeric: true, sensitivity: 'base' });

export interface BoardGroup { key: string; name: string; floors: { floor: number | null; units: BoardUnit[] }[]; count: number }

/** Buildings (named first, A→Z; "no building" last) → floors (top floor first; "no floor" last) → units (A2 before A10). */
export function groupBoard(units: BoardUnit[]): BoardGroup[] {
  const groups = new Map<string, BoardGroup>();
  for (const u of units) {
    const key = u.building_id ?? '_none';
    if (!groups.has(key)) groups.set(key, { key, name: u.building_id ? u.building_name ?? 'Κτίριο' : 'Χωρίς κτίριο', floors: [], count: 0 });
    const g = groups.get(key)!;
    let fl = g.floors.find((x) => x.floor === (u.floor ?? null));
    if (!fl) { fl = { floor: u.floor ?? null, units: [] }; g.floors.push(fl); }
    fl.units.push(u); g.count++;
  }
  const out = Array.from(groups.values());
  for (const g of out) {
    g.floors.sort((a, b) => (a.floor === null ? 1 : b.floor === null ? -1 : b.floor - a.floor));
    for (const f of g.floors) f.units.sort((a, b) => natural(a.unit_number, b.unit_number));
  }
  return out.sort((a, b) => (a.key === '_none' ? 1 : b.key === '_none' ? -1 : natural(a.name, b.name)));
}

export interface BoardTotals { total: number; byStatus: Record<BoardStatus, number>; soldPct: number; availableValue: number; soldValue: number }

export function boardTotals(units: BoardUnit[]): BoardTotals {
  const byStatus = Object.fromEntries(BOARD_STATUSES.map((s) => [s, 0])) as Record<BoardStatus, number>;
  let availableValue = 0; let soldValue = 0;
  for (const u of units) {
    const s = statusOf(u.status);
    byStatus[s]++;
    if (s === 'available') availableValue += Number(u.price) || 0;
    if (s === 'sold' || s === 'handed_over') soldValue += Number(u.price) || 0;
  }
  const forSale = units.length - byStatus.blocked;
  const soldPct = forSale ? Math.round(((byStatus.sold + byStatus.handed_over) / forSale) * 100) : 0;
  return { total: units.length, byStatus, soldPct, availableValue, soldValue };
}

/** Days until a reservation lapses (negative = already expired); null when unknown. */
export function daysLeft(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.ceil((t - now) / 86400000) : null;
}
