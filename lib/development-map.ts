/**
 * Development-map domain model — turns the flat unit inventory into the
 * Block → Floor → Unit tree the interactive map renders, plus the canonical
 * unit-status display mapping (label + colour). Pure and client-safe so the
 * staff map and the owner portal share one source of truth.
 */

export type UnitDbStatus = 'available' | 'reserved' | 'sold' | 'handed_over' | 'blocked';
export type DisplayStatus = 'available' | 'reserved' | 'sold' | 'owned' | 'not_released';

export interface StatusStyle {
  key: DisplayStatus;
  label: string;
  /** Tailwind classes for a filled cell and a legend dot. */
  fill: string;
  ring: string;
  dot: string;
}

export const STATUS_STYLES: Record<DisplayStatus, StatusStyle> = {
  available:    { key: 'available',    label: 'Available',    fill: 'bg-emerald-500/85 text-white',  ring: 'ring-emerald-500',  dot: 'bg-emerald-500' },
  reserved:     { key: 'reserved',     label: 'Reserved',     fill: 'bg-amber-400/90 text-charcoal', ring: 'ring-amber-400',    dot: 'bg-amber-400' },
  sold:         { key: 'sold',         label: 'Sold',         fill: 'bg-purple-500/85 text-white',   ring: 'ring-purple-500',   dot: 'bg-purple-500' },
  owned:        { key: 'owned',        label: 'Owned',        fill: 'bg-sky-500/85 text-white',      ring: 'ring-sky-500',      dot: 'bg-sky-500' },
  not_released: { key: 'not_released', label: 'Not released', fill: 'bg-stone-300 text-charcoal-600',ring: 'ring-stone-400',    dot: 'bg-stone-400' },
};

export function toDisplayStatus(s: string): DisplayStatus {
  switch (s) {
    case 'available': return 'available';
    case 'reserved': return 'reserved';
    case 'sold': return 'sold';
    case 'handed_over': return 'owned';
    case 'blocked': return 'not_released';
    default: return 'not_released';
  }
}

export interface MapUnit {
  id: string;
  unit_number: string;
  floor: number | null;
  status: DisplayStatus;
  type: string | null;
  bedrooms: number | null;
  sqm: number | null;
  price: number | null;
  has_issue: boolean;       // open maintenance ticket → red indicator
  map_x: number | null;     // site-plan position (% of image)
  map_y: number | null;
}
export interface MapFloor {
  floor: number;
  label: string;
  units: MapUnit[];
}
export interface MapBlock {
  id: string;          // building id, or '_unassigned'
  name: string;
  floors: MapFloor[];
  unitCount: number;
  statusCounts: Record<DisplayStatus, number>;
}

interface RawUnit {
  id: string;
  unit_number: string;
  floor: number | null;
  status: string;
  type: string | null;
  bedrooms: number | null;
  sqm: number | null;
  price: number | null;
  building_id: string | null;
  buildings?: { name: string | null } | null;
  has_issue?: boolean;
  map_x?: number | null;
  map_y?: number | null;
}

function toMapUnit(u: RawUnit): MapUnit {
  return {
    id: u.id, unit_number: u.unit_number, floor: u.floor, status: toDisplayStatus(u.status),
    type: u.type, bedrooms: u.bedrooms, sqm: u.sqm, price: u.price,
    has_issue: !!u.has_issue, map_x: u.map_x ?? null, map_y: u.map_y ?? null,
  };
}

/** Flat list of houses for a villa-style development (no blocks/floors). */
export function buildHouseList(units: RawUnit[]): MapUnit[] {
  return units.map(toMapUnit).sort((a, z) => a.unit_number.localeCompare(z.unit_number, undefined, { numeric: true }));
}

function emptyCounts(): Record<DisplayStatus, number> {
  return { available: 0, reserved: 0, sold: 0, owned: 0, not_released: 0 };
}

/** Build the Block → Floor → Unit tree, sorted naturally. */
export function buildDevelopmentTree(units: RawUnit[]): MapBlock[] {
  const blocks = new Map<string, MapBlock>();

  for (const u of units) {
    const blockId = u.building_id ?? '_unassigned';
    const blockName = u.buildings?.name ?? (u.building_id ? 'Block' : 'Unassigned');
    if (!blocks.has(blockId)) {
      blocks.set(blockId, { id: blockId, name: blockName, floors: [], unitCount: 0, statusCounts: emptyCounts() });
    }
    const block = blocks.get(blockId)!;
    const status = toDisplayStatus(u.status);
    block.unitCount += 1;
    block.statusCounts[status] += 1;

    const floorNum = u.floor ?? 0;
    let floor = block.floors.find((f) => f.floor === floorNum);
    if (!floor) {
      floor = { floor: floorNum, label: floorLabel(floorNum), units: [] };
      block.floors.push(floor);
    }
    floor.units.push(toMapUnit(u));
  }

  const result = [...blocks.values()];
  for (const b of result) {
    b.floors.sort((a, z) => z.floor - a.floor); // top floor first
    for (const f of b.floors) f.units.sort((a, z) => a.unit_number.localeCompare(z.unit_number, undefined, { numeric: true }));
  }
  result.sort((a, z) => a.name.localeCompare(z.name, undefined, { numeric: true }));
  return result;
}

export function floorLabel(n: number): string {
  if (n === 0) return 'Ground floor';
  if (n < 0) return `Basement ${Math.abs(n)}`;
  const suffix = n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th';
  return `${n}${suffix} floor`;
}

/** Full per-unit detail for the map's selected-unit panel and unit details page. */
export interface UnitDetail {
  id: string;
  unit_number: string;
  floor_label: string;
  status: DisplayStatus;
  type: string | null;
  bedrooms: number | null;
  internal_sqm: number | null;
  covered_veranda_sqm: number | null;
  uncovered_veranda_sqm: number | null;
  storage_sqm: number | null;
  parking_spaces: number | null;
  plot_size_sqm: number | null;
  garden_sqm: number | null;
  has_pool: boolean;
  has_issue: boolean;
  handover_date: string | null;
  owner_name: string | null;
}

export function totalStatusCounts(blocks: MapBlock[]): Record<DisplayStatus, number> {
  const total = emptyCounts();
  for (const b of blocks) for (const k of Object.keys(total) as DisplayStatus[]) total[k] += b.statusCounts[k];
  return total;
}
