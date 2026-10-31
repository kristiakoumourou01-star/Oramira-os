/**
 * Dashboard builder (Settings → Dashboard). Client-safe.
 *
 * The dashboard is a grid of boxes. For each audience — everyone (default),
 * a built-in role, or one of the company's own roles — the admin chooses which
 * boxes show, their order and their width. A user sees their own role's layout
 * if one exists, otherwise the default. New boxes added to the catalog later
 * appear automatically (at the end, with their default visibility).
 */

export type BlockSize = 'third' | 'half' | 'twoThirds' | 'full';

export interface BlockDef {
  key: string;
  label: string;
  hint: string;
  size: BlockSize;
  visible: boolean;
  /** Sizes that make sense for this box. */
  sizes: BlockSize[];
}

const ALL: BlockSize[] = ['third', 'half', 'twoThirds', 'full'];
const WIDE: BlockSize[] = ['half', 'twoThirds', 'full'];

export const DASHBOARD_CATALOG: BlockDef[] = [
  { key: 'briefing', label: 'Ημερήσιο briefing', hint: 'Καλημέρα, τι σας περιμένει σήμερα, σύνδεση ημερολογίου.', size: 'full', visible: true, sizes: ['full'] },
  { key: 'kpis', label: 'Βασικοί αριθμοί', hint: 'Συναντήσεις σήμερα, καθυστερημένα follow-ups, hot leads, αξία pipeline, ενεργά deals.', size: 'full', visible: true, sizes: ['full'] },
  { key: 'command', label: 'Command Center (διοίκηση)', hint: 'Εικόνα όλης της εταιρείας. Φαίνεται μόνο σε Admin και Manager.', size: 'full', visible: true, sizes: ['full'] },
  { key: 'planner', label: 'Ημερολόγιο & γρήγορες ενέργειες', hint: 'Ημερολόγιο εβδομάδας, νέα συνάντηση/εργασία, πλάνο διαδρομής.', size: 'full', visible: true, sizes: WIDE },
  { key: 'pipeline', label: 'Pipeline σήμερα', hint: 'Επόμενες συναντήσεις, καθυστερημένα follow-ups, hot leads.', size: 'twoThirds', visible: true, sizes: WIDE },
  { key: 'tasks', label: 'Εργασίες σήμερα', hint: 'Όλες οι εργασίες και τα follow-ups σας σε μία λίστα.', size: 'third', visible: true, sizes: ALL },
  { key: 'notifications', label: 'Ειδοποιήσεις', hint: 'Οι τελευταίες ειδοποιήσεις σας, ανά κατηγορία.', size: 'third', visible: true, sizes: ALL },
  { key: 'approvals', label: 'Εγκρίσεις αδειών', hint: 'Αιτήματα αδειών που περιμένουν έγκριση. Για όσους έχουν πρόσβαση στο HR.', size: 'third', visible: true, sizes: ALL },
  { key: 'commissions', label: 'Οι προμήθειές μου', hint: 'Σύνολο, πληρωμένες και τελευταίες προμήθειες.', size: 'third', visible: false, sizes: ALL },
  { key: 'leave', label: 'Οι άδειές μου', hint: 'Υπόλοιπο αδειών ανά τύπο.', size: 'third', visible: false, sizes: ALL },
  { key: 'payslips', label: 'Τα payslips μου', hint: 'Οι τελευταίες μισθοδοσίες σας, για λήψη.', size: 'third', visible: false, sizes: ALL },
];

export const SIZE_LABEL: Record<BlockSize, string> = { third: '⅓', half: '½', twoThirds: '⅔', full: 'Πλήρες' };
/** Grid classes (6-column grid on large screens, full width on phones). */
export const SIZE_CLASS: Record<BlockSize, string> = {
  third: 'col-span-6 lg:col-span-2',
  half: 'col-span-6 lg:col-span-3',
  twoThirds: 'col-span-6 lg:col-span-4',
  full: 'col-span-6',
};

export interface DashBlock { key: string; visible: boolean; size: BlockSize }
export interface DashboardSettings {
  /** Audience key → layout. 'default' = everyone without their own layout. */
  layouts: Record<string, DashBlock[]>;
}

export const defaultLayout = (): DashBlock[] => DASHBOARD_CATALOG.map((b) => ({ key: b.key, visible: b.visible, size: b.size }));
export const DEFAULT_DASHBOARD: DashboardSettings = { layouts: { default: defaultLayout() } };

/** Keep known boxes in the saved order, add new ones at the end, fix sizes. */
export function normalizeLayout(stored: any): DashBlock[] {
  const out: DashBlock[] = [];
  const seen = new Set<string>();
  for (const s of Array.isArray(stored) ? stored : []) {
    const def = DASHBOARD_CATALOG.find((d) => d.key === s?.key);
    if (!def || seen.has(def.key)) continue;
    seen.add(def.key);
    out.push({ key: def.key, visible: s.visible !== false, size: def.sizes.includes(s.size) ? s.size : def.size });
  }
  for (const def of DASHBOARD_CATALOG) if (!seen.has(def.key)) out.push({ key: def.key, visible: def.visible, size: def.size });
  return out;
}

const AUDIENCE = /^(default|admin|sales|management|finance|construction|viewer|custom:[a-z0-9-]{2,40})$/;

/** Read the stored slice; the old single list ({ blocks }) becomes the default layout. */
export function mergeDashboard(d: any): DashboardSettings {
  const layouts: Record<string, DashBlock[]> = {};
  if (d && typeof d === 'object' && d.layouts && typeof d.layouts === 'object') {
    for (const [k, v] of Object.entries(d.layouts)) if (AUDIENCE.test(k)) layouts[k] = normalizeLayout(v);
  } else if (d && Array.isArray(d.blocks)) {
    // Legacy: old builder stored visibility only for 4 boxes; keep it, add the rest.
    const old = normalizeLayout(d.blocks.map((b: any) => ({ key: b.key, visible: b.visible })));
    layouts.default = old;
  }
  if (!layouts.default) layouts.default = defaultLayout();
  return { layouts };
}

/** The layout a user sees: their custom role's, else their built-in role's, else the default. */
export function layoutFor(settings: DashboardSettings, role: string, customRoleId: string | null): DashBlock[] {
  return (customRoleId && settings.layouts[`custom:${customRoleId}`]) || settings.layouts[role] || settings.layouts.default || defaultLayout();
}
