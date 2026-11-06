/**
 * Oramira OS — role-based access control (RBAC).
 *
 * A single declarative matrix maps each internal role to the modules it can
 * touch and the actions it can take. Pure + importable on server and client,
 * it drives: the internal nav, server-side page guards (lib/auth
 * requirePermission), and UI gating (hiding edit controls). Adding a role or
 * module is a one-line change here — that's the "scalable architecture for
 * future expansion."
 */

export type AppRole = 'admin' | 'sales' | 'management' | 'finance' | 'construction' | 'viewer';
export type Module = 'leads' | 'marketing' | 'projects' | 'deals' | 'financials' | 'maintenance' | 'automation' | 'operations' | 'documents' | 'users' | 'hr' | 'property' | 'acquisitions';
export type Action = 'view' | 'edit' | 'delete' | 'assign';

export const INTERNAL_ROLES: AppRole[] = ['admin', 'sales', 'management', 'finance', 'construction', 'viewer'];

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: 'Admin',
  sales: 'Sales Agent',
  management: 'Manager',
  finance: 'Finance',
  construction: 'Construction',
  viewer: 'Viewer',
};

const ALL: Action[] = ['view', 'edit', 'delete', 'assign'];
const VIEW: Action[] = ['view'];
type Caps = Partial<Record<Module, Action[]>>;

/** The matrix. Anything not listed for a role is denied. */
export const ROLE_PERMISSIONS: Record<AppRole, Caps> = {
  admin: {
    leads: ALL, marketing: ALL, projects: ALL, deals: ALL, financials: ALL,
    maintenance: ALL, automation: ALL, operations: ALL, documents: ALL, users: ALL, hr: ALL, property: ALL, acquisitions: ALL,
  },
  // Sales Agent — leads + clients only
  sales: {
    leads: ['view', 'edit', 'assign'],
    marketing: VIEW,
    documents: VIEW,
  },
  // Manager — leads + projects + assignments
  management: {
    leads: ['view', 'edit', 'assign'],
    marketing: ['view', 'edit'],
    projects: ['view', 'edit'],
    deals: VIEW,
    financials: VIEW,
    operations: ['view', 'edit'],
    documents: VIEW,
    hr: ['view', 'edit'],
    property: ['view', 'edit'],
    acquisitions: ['view', 'edit', 'assign'],
  },
  // Finance — payments + contracts + invoices
  finance: {
    financials: ['view', 'edit'],
    deals: VIEW,
    documents: VIEW,
  },
  // Construction — projects + maintenance + contractor tasks
  construction: {
    projects: ['view', 'edit'],
    maintenance: ['view', 'edit'],
    property: ['view', 'edit'],
    documents: VIEW,
  },
  // Viewer — read-only across the operational modules
  viewer: {
    leads: VIEW, projects: VIEW, deals: VIEW, financials: VIEW, documents: VIEW,
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

/** Greek labels for the per-user permission matrix (Settings → Users). */
export const MODULE_LABEL: Record<Module, string> = {
  leads: 'Πωλήσεις / Leads',
  marketing: 'Marketing',
  projects: 'Έργα & μονάδες',
  deals: 'Deal Analyzer',
  financials: 'Οικονομικά',
  maintenance: 'Συντήρηση',
  automation: 'Αυτοματισμοί',
  operations: 'Operations',
  documents: 'Έγγραφα',
  users: 'Χρήστες & ρυθμίσεις',
  hr: 'HR',
  property: 'Property Management',
  acquisitions: 'Αγορές γης',
};

export const ACTION_LABEL: Record<Action, string> = {
  view: 'Βλέπει',
  edit: 'Δημιουργεί & αλλάζει',
  delete: 'Διαγράφει',
  assign: 'Αναθέτει',
};

export const ALL_ACTIONS: Action[] = ['view', 'edit', 'delete', 'assign'];

/**
 * Modules an admin can grant per user. "users" (user management, settings) is
 * deliberately excluded: it stays admin-only so access can never be widened by
 * anyone but an admin.
 */
export const CONFIGURABLE_MODULES: Module[] = [
  'leads', 'marketing', 'projects', 'deals', 'financials', 'maintenance',
  'automation', 'operations', 'documents', 'hr', 'property', 'acquisitions',
];

/** Per-user matrix stored on profiles.permissions. Null = follow the role. */
export type UserPermissions = Partial<Record<Module, Action[]>>;

/** Keep only known modules/actions; never lets "users" in. */
export function sanitizePermissions(input: unknown): UserPermissions {
  const out: UserPermissions = {};
  if (!input || typeof input !== 'object') return out;
  for (const m of CONFIGURABLE_MODULES) {
    const acts = (input as Record<string, unknown>)[m];
    if (!Array.isArray(acts)) continue;
    const clean = ALL_ACTIONS.filter((a) => acts.includes(a));
    // Any other action implies the user can at least see the module.
    if (clean.length && !clean.includes('view')) clean.unshift('view');
    if (clean.length) out[m] = clean;
  }
  return out;
}

/** The role's default matrix (plus legacy HR module grants), as a starting point for the editor. */
export function defaultPermissionsFor(role: string, moduleAccess: string[] = []): UserPermissions {
  const out: UserPermissions = {};
  for (const m of CONFIGURABLE_MODULES) {
    const acts = ALL_ACTIONS.filter((a) => effectiveCan(role, moduleAccess, m, a));
    if (acts.length) out[m] = acts;
  }
  return out;
}

/**
 * Effective access.
 * - Admin: everything, always.
 * - User with a per-user matrix (profiles.permissions): exactly that matrix.
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
  if (role === 'admin') return can(role, module, action);
  if (permissions) {
    if (module === 'users') return false;
    return permissions[module]?.includes(action) ?? false;
  }
  if (can(role, module, action)) return true;
  if ((action === 'view' || action === 'edit') && (moduleAccess ?? []).includes(module)) return true;
  return false;
}
