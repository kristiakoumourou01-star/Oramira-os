/**
 * Oramira OS — role-based access control (RBAC).
 *
 * A single declarative matrix maps each internal role to the modules it can
 * touch and the actions it can take. Pure + importable on server and client,
 * it drives: the internal nav, server-side page guards (lib/auth
 * requirePermission + the per-route guard), and UI gating (hiding edit
 * controls). The permission catalogue (Staff → Ρόλοι) is built from
 * PERMISSION_GROUPS below, so a module added here shows up there too.
 */

export type AppRole = 'admin' | 'sales' | 'management' | 'finance' | 'construction' | 'viewer';
export type Module =
  | 'dashboard' | 'calendar' | 'tasks' | 'operations'
  | 'leads' | 'followups'
  | 'projects' | 'property' | 'maintenance' | 'acquisitions' | 'deals'
  | 'financials' | 'invoices' | 'reports'
  | 'marketing' | 'automation' | 'documents'
  | 'hr' | 'mobileapp'
  /** Staff, roles and every setting: always Owner (admin) only. */
  | 'users' | 'settings';
export type Action = 'view' | 'edit' | 'delete' | 'assign';

export const INTERNAL_ROLES: AppRole[] = ['admin', 'sales', 'management', 'finance', 'construction', 'viewer'];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Κάτοχος λογαριασμού',
  sales: 'Sales Agent',
  management: 'Manager',
  finance: 'Finance',
  construction: 'Construction',
  viewer: 'Viewer',
};

const ALL: Action[] = ['view', 'edit', 'delete', 'assign'];
const VIEW: Action[] = ['view'];
const VE: Action[] = ['view', 'edit'];
type Caps = Partial<Record<Module, Action[]>>;

/** Which actions make sense for each module (the catalogue only offers these). */
export const MODULE_ACTIONS: Record<Module, Action[]> = {
  dashboard: ['view'],
  calendar: ['view', 'edit'],
  tasks: ['view', 'edit', 'assign'],
  operations: ['view', 'edit'],
  leads: ['view', 'edit', 'assign', 'delete'],
  followups: ['view', 'edit', 'assign'],
  projects: ['view', 'edit', 'delete'],
  property: ['view', 'edit'],
  maintenance: ['view', 'edit'],
  acquisitions: ['view', 'edit', 'assign', 'delete'],
  deals: ['view', 'edit'],
  financials: ['view', 'edit', 'delete'],
  invoices: ['view', 'edit', 'delete'],
  reports: ['view'],
  marketing: ['view', 'edit', 'delete'],
  automation: ['view', 'edit'],
  documents: ['view', 'edit', 'delete'],
  hr: ['view', 'edit'],
  mobileapp: ['view', 'edit'],
  users: ALL,
  settings: ALL,
};

/** The matrix. Anything not listed for a role is denied. */
export const ROLE_PERMISSIONS: Record<AppRole, Caps> = {
  admin: Object.fromEntries((Object.keys(MODULE_ACTIONS) as Module[]).map((m) => [m, ALL])) as Caps,
  // Sales Agent — leads + clients only
  sales: {
    dashboard: VIEW, calendar: VE, tasks: VE,
    leads: ['view', 'edit', 'assign'],
    followups: ['view', 'edit', 'assign'],
    marketing: VIEW,
    documents: VIEW,
  },
  // Manager — leads + projects + assignments
  management: {
    dashboard: VIEW, calendar: VE, tasks: ['view', 'edit', 'assign'],
    leads: ['view', 'edit', 'assign'],
    followups: ['view', 'edit', 'assign'],
    marketing: VE,
    projects: VE,
    deals: VIEW,
    financials: VIEW,
    invoices: VIEW,
    reports: VIEW,
    operations: VE,
    documents: VIEW,
    hr: VE,
    property: VE,
    acquisitions: ['view', 'edit', 'assign'],
  },
  // Finance — payments + contracts + invoices
  finance: {
    dashboard: VIEW, calendar: VE, tasks: VE,
    financials: VE,
    invoices: VE,
    reports: VIEW,
    deals: VIEW,
    documents: VIEW,
  },
  // Construction — projects + maintenance + contractor tasks
  construction: {
    dashboard: VIEW, calendar: VE, tasks: VE,
    projects: VE,
    maintenance: VE,
    property: VE,
    documents: VIEW,
  },
  // Viewer — read-only across the operational modules
  viewer: {
    dashboard: VIEW, calendar: VIEW, tasks: VE,
    leads: VIEW, followups: VIEW, projects: VIEW, deals: VIEW, financials: VIEW, invoices: VIEW, reports: VIEW, documents: VIEW,
  },
};

export function isInternalRole(role: string): role is AppRole {
  return (INTERNAL_ROLES as string[]).includes(role);
}

/** Can this role take `action` on `module`? */
export function can(role: string, module: Module, action: Action = 'view'): boolean {
  if (!isInternalRole(role)) return false;
  return ROLE_PERMISSIONS[role][module]?.includes(action) ?? false;
}

/** Greek names of the areas (permission catalogue, per-user editor). */
export const MODULE_LABEL: Record<Module, string> = {
  dashboard: 'Πίνακας ελέγχου',
  calendar: 'Ημερολόγιο',
  tasks: 'Εργασίες',
  operations: 'Command Center',
  leads: 'Πωλήσεις / Leads',
  followups: 'Follow-ups & δραστηριότητες',
  projects: 'Έργα & μονάδες',
  property: 'Property Management',
  maintenance: 'Συντήρηση',
  acquisitions: 'Αγορές γης',
  deals: 'Deal Analyzer',
  financials: 'Οικονομικά',
  invoices: 'Τιμολόγια',
  reports: 'Αναφορές',
  marketing: 'Marketing',
  automation: 'Αυτοματισμοί',
  documents: 'Έγγραφα',
  hr: 'HR',
  mobileapp: 'Mobile app',
  users: 'Staff & ρόλοι',
  settings: 'Ρυθμίσεις',
};

export const ACTION_LABEL: Record<Action, string> = {
  view: 'Βλέπει',
  edit: 'Δημιουργεί & αλλάζει',
  delete: 'Διαγράφει',
  assign: 'Αναθέτει',
};

export const ALL_ACTIONS: Action[] = ['view', 'edit', 'delete', 'assign'];

/**
 * Modules an admin can grant per role / per user. Staff ("users") and
 * Settings are deliberately excluded: they stay Owner-only so access can never
 * be widened by anyone but the Owner.
 */
export const CONFIGURABLE_MODULES: Module[] = [
  'dashboard', 'calendar', 'tasks', 'operations',
  'leads', 'followups',
  'projects', 'property', 'maintenance', 'acquisitions', 'deals',
  'financials', 'invoices', 'reports',
  'marketing', 'automation', 'documents',
  'hr', 'mobileapp',
];

/**
 * A module that lives inside another one's pages: granting it also grants
 * "view" of the parent (e.g. Invoices are under /financials).
 */
export const MODULE_REQUIRES: Partial<Record<Module, Module>> = {
  invoices: 'financials',
  followups: 'leads',
  reports: 'financials',
};

/** Permission key as shown in the catalogue, e.g. "leads.edit". */
export const permKey = (m: Module, a: Action) => `${m}.${a}`;

/** One row of the catalogue: a module × action with a plain explanation. */
export interface PermissionDef { key: string; module: Module; action: Action; moduleLabel: string; actionLabel: string; hint: string }
export interface PermissionGroup { id: string; label: string; modules: Module[]; locked?: boolean; lockedNote?: string }

/** Areas of the catalogue, in the order shown (Staff → Ρόλοι → Επεξεργασία). */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  { id: 'general', label: 'Γενικά', modules: ['dashboard', 'calendar', 'tasks', 'operations'] },
  { id: 'sales', label: 'Πωλήσεις & πελάτες', modules: ['leads', 'followups'] },
  { id: 'projects', label: 'Έργα & ακίνητα', modules: ['projects', 'property', 'maintenance', 'acquisitions', 'deals'] },
  { id: 'finance', label: 'Οικονομικά', modules: ['financials', 'invoices', 'reports'] },
  { id: 'marketing', label: 'Marketing & έγγραφα', modules: ['marketing', 'automation', 'documents'] },
  { id: 'team', label: 'Ομάδα & εφαρμογή', modules: ['hr', 'mobileapp'] },
  { id: 'admin', label: 'Διαχείριση', modules: ['users', 'settings'], locked: true, lockedNote: 'Μόνο ο κάτοχος του λογαριασμού.' },
];

/** What each permission means, in the owner's words. Missing = generic text. */
const HINTS: Partial<Record<string, string>> = {
  'dashboard.view': 'Ανοίγει την αρχική σελίδα με τα νούμερα της ημέρας.',
  'calendar.view': 'Βλέπει το ημερολόγιο με ραντεβού και προβολές.',
  'calendar.edit': 'Κλείνει και αλλάζει ραντεβού.',
  'tasks.view': 'Βλέπει τις εργασίες του.',
  'tasks.edit': 'Δημιουργεί και ολοκληρώνει εργασίες.',
  'tasks.assign': 'Αναθέτει εργασίες σε άλλους.',
  'operations.view': 'Βλέπει το Command Center με την εικόνα όλης της εταιρείας.',
  'operations.edit': 'Ενεργεί από το Command Center.',
  'leads.view': 'Βλέπει leads, deals και πελάτες.',
  'leads.edit': 'Προσθέτει και αλλάζει leads, deals και πελάτες.',
  'leads.assign': 'Αλλάζει τον υπεύθυνο ενός lead.',
  'leads.delete': 'Διαγράφει leads και πελάτες.',
  'followups.view': 'Βλέπει follow-ups, κλήσεις και δραστηριότητες.',
  'followups.edit': 'Καταγράφει και ολοκληρώνει follow-ups.',
  'followups.assign': 'Αναθέτει follow-ups σε άλλους.',
  'projects.view': 'Βλέπει έργα, μονάδες, τιμές και χάρτη.',
  'projects.edit': 'Αλλάζει έργα, μονάδες και τιμοκατάλογους.',
  'projects.delete': 'Διαγράφει έργα και μονάδες.',
  'property.view': 'Βλέπει τα ακίνητα υπό διαχείριση.',
  'property.edit': 'Αλλάζει ακίνητα, ενοικιαστές και αιτήματα.',
  'maintenance.view': 'Βλέπει τα αιτήματα συντήρησης.',
  'maintenance.edit': 'Χειρίζεται και κλείνει αιτήματα συντήρησης.',
  'acquisitions.view': 'Βλέπει οικόπεδα και αγορές γης.',
  'acquisitions.edit': 'Προσθέτει και αλλάζει οικόπεδα.',
  'acquisitions.assign': 'Αναθέτει οικόπεδα σε συνεργάτες.',
  'acquisitions.delete': 'Διαγράφει οικόπεδα.',
  'deals.view': 'Βλέπει τις αναλύσεις επενδύσεων.',
  'deals.edit': 'Φτιάχνει και αλλάζει αναλύσεις.',
  'financials.view': 'Βλέπει έσοδα, έξοδα και ταμειακές ροές.',
  'financials.edit': 'Καταχωρεί πληρωμές και έξοδα.',
  'financials.delete': 'Διαγράφει οικονομικές εγγραφές.',
  'invoices.view': 'Βλέπει τιμολόγια και αποδείξεις.',
  'invoices.edit': 'Εκδίδει τιμολόγια.',
  'invoices.delete': 'Ακυρώνει τιμολόγια.',
  'reports.view': 'Ανοίγει τις αναφορές.',
  'marketing.view': 'Βλέπει καμπάνιες και αποτελέσματα.',
  'marketing.edit': 'Φτιάχνει και στέλνει καμπάνιες.',
  'marketing.delete': 'Διαγράφει καμπάνιες.',
  'automation.view': 'Βλέπει τους αυτοματισμούς.',
  'automation.edit': 'Αλλάζει τους αυτοματισμούς.',
  'documents.view': 'Βλέπει έγγραφα.',
  'documents.edit': 'Ανεβάζει έγγραφα.',
  'documents.delete': 'Διαγράφει έγγραφα.',
  'hr.view': 'Βλέπει υπαλλήλους, άδειες και συμβάσεις.',
  'hr.edit': 'Εγκρίνει άδειες, αλλάζει συμβάσεις και μισθοδοσία.',
  'mobileapp.view': 'Βλέπει τις ρυθμίσεις της εφαρμογής κινητού.',
  'mobileapp.edit': 'Αλλάζει την αρχική οθόνη και τις ρυθμίσεις της εφαρμογής.',
  'users.view': 'Βλέπει την ομάδα και τους ρόλους.',
  'users.edit': 'Προσθέτει υπαλλήλους και αλλάζει ρόλους.',
  'settings.view': 'Ανοίγει τις Ρυθμίσεις.',
  'settings.edit': 'Αλλάζει τις Ρυθμίσεις της εταιρείας.',
};

/** Every permission row of a group (module × its meaningful actions). */
export function groupPermissions(g: PermissionGroup): PermissionDef[] {
  const out: PermissionDef[] = [];
  for (const m of g.modules) {
    const acts = g.locked ? (['view', 'edit'] as Action[]) : MODULE_ACTIONS[m];
    for (const a of acts) {
      out.push({ key: permKey(m, a), module: m, action: a, moduleLabel: MODULE_LABEL[m], actionLabel: ACTION_LABEL[a], hint: HINTS[permKey(m, a)] ?? '' });
    }
  }
  return out;
}

/** Per-user matrix stored on profiles.permissions. Null = follow the role. */
export type UserPermissions = Partial<Record<Module, Action[]>>;

/** Modules that did not exist before the v2 catalogue (November 2026). */
const V2_MODULES: Module[] = ['dashboard', 'calendar', 'tasks', 'followups', 'invoices', 'reports', 'mobileapp'];
/** Stored matrices carry this marker; without it they predate V2_MODULES. */
export const PERMISSIONS_VERSION = 2;

/**
 * Keep only known modules/actions; never lets Staff/Settings in.
 * `legacy` (a matrix saved before the v2 catalogue): the new modules are
 * filled in the way the app behaved before, so nobody loses access they had
 * (dashboard/calendar/tasks were open to all, invoices/reports followed
 * Finance, follow-ups followed Leads). Default: auto-detect from the marker.
 */
export function sanitizePermissions(input: unknown, legacy?: boolean): UserPermissions {
  const out: UserPermissions = {};
  if (!input || typeof input !== 'object') return out;
  const raw = input as Record<string, unknown>;
  const isLegacy = legacy ?? raw._v !== PERMISSIONS_VERSION;
  for (const m of CONFIGURABLE_MODULES) {
    const acts = raw[m];
    if (!Array.isArray(acts)) continue;
    const clean = MODULE_ACTIONS[m].filter((a) => acts.includes(a));
    // Any other action implies the user can at least see the module.
    if (clean.length && !clean.includes('view')) clean.unshift('view');
    if (clean.length) out[m] = clean;
  }
  if (isLegacy) {
    const pick = (src: Module, allowed: Action[]) => (out[src] ?? []).filter((a) => allowed.includes(a));
    const derived: Partial<Record<Module, Action[]>> = {
      dashboard: ['view'],
      calendar: ['view', 'edit'],
      tasks: ['view', 'edit', 'assign'],
      followups: pick('leads', MODULE_ACTIONS.followups),
      invoices: pick('financials', MODULE_ACTIONS.invoices),
      reports: out.financials?.length ? ['view'] : [],
      mobileapp: [],
    };
    for (const m of V2_MODULES) {
      if (out[m]) continue;
      const d = derived[m] ?? [];
      if (d.length) out[m] = d;
    }
  }
  return enforceRequires(out);
}

/** Granting a sub-area (Invoices) also grants "view" of its parent (Finance). */
export function enforceRequires(p: UserPermissions): UserPermissions {
  const out: UserPermissions = { ...p };
  for (const [child, parent] of Object.entries(MODULE_REQUIRES) as [Module, Module][]) {
    if (out[child]?.length && !out[parent]?.includes('view')) out[parent] = ['view', ...(out[parent] ?? [])];
  }
  return out;
}

/** The value to store in the database (carries the version marker). */
export function storedPermissions(p: UserPermissions): Record<string, unknown> {
  return { ...p, _v: PERMISSIONS_VERSION };
}

/** The role's default matrix (plus legacy HR module grants), as a starting point for the editor. */
export function defaultPermissionsFor(role: string, moduleAccess: string[] = []): UserPermissions {
  const out: UserPermissions = {};
  for (const m of CONFIGURABLE_MODULES) {
    const acts = MODULE_ACTIONS[m].filter((a) => effectiveCan(role, moduleAccess, m, a));
    if (acts.length) out[m] = acts;
  }
  return out;
}

/**
 * Effective access.
 * - Owner (admin): everything, always.
 * - User with a matrix (their own, or their role's): exactly that matrix.
 * - Otherwise: role capability OR a manual module grant from HR verification
 *   (manual grants confer view + edit; assign/delete stay role-driven).
 */
export function effectiveCan(
  role: string,
  moduleAccess: string[] | null | undefined,
  module: Module,
  action: Action = 'view',
  permissions?: UserPermissions | null,
): boolean {
  if (!isInternalRole(role)) return false;
  if (role === 'admin') return true;
  if (module === 'users' || module === 'settings') return false;
  if (permissions) return permissions[module]?.includes(action) ?? false;
  if (can(role, module, action)) return true;
  if ((action === 'view' || action === 'edit') && (moduleAccess ?? []).includes(module)) return true;
  return false;
}

/**
 * Pages guarded by a module that their own code doesn't check (they were open
 * to everyone, or checked the parent area). lib/auth applies this on every
 * internal page; longest prefix wins.
 */
export const ROUTE_MODULES: [string, Module][] = [
  ['/dashboard', 'dashboard'],
  ['/calendar', 'calendar'],
  ['/tasks', 'tasks'],
  ['/sales/activities', 'followups'],
  ['/financials/invoices', 'invoices'],
  ['/reports', 'reports'],
  ['/settings/mobile-app', 'mobileapp'],
];

export function moduleForPath(path: string | null | undefined): Module | null {
  if (!path) return null;
  let best: [string, Module] | null = null;
  for (const r of ROUTE_MODULES) {
    if ((path === r[0] || path.startsWith(r[0] + '/')) && (!best || r[0].length > best[0].length)) best = r;
  }
  return best ? best[1] : null;
}

/** Where to send someone who may not open a page: the first area they can. */
const LANDINGS: [string, Module | null][] = [
  ['/dashboard', 'dashboard'], ['/sales/leads', 'leads'], ['/projects', 'projects'], ['/property', 'property'],
  ['/acquisitions', 'acquisitions'], ['/financials', 'financials'], ['/marketing', 'marketing'], ['/hr', 'hr'],
  ['/tasks', 'tasks'], ['/calendar', 'calendar'], ['/account', null],
];
export function landingFor(role: string, moduleAccess: string[] | null | undefined, permissions?: UserPermissions | null): string {
  for (const [href, m] of LANDINGS) if (!m || effectiveCan(role, moduleAccess, m, 'view', permissions)) return href;
  return '/account';
}
