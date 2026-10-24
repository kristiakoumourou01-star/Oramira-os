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

/**
 * Effective access = role capability OR a manual module grant from HR
 * verification. Manual grants confer operational access (view + edit); elevated
 * actions (assign/delete) remain role-driven. This is the "Role + manual access"
 * model the Employee Verification flow configures per employee.
 */
export function effectiveCan(role: string, moduleAccess: string[] | null | undefined, module: Module, action: Action = 'view'): boolean {
  if (can(role, module, action)) return true;
  if ((action === 'view' || action === 'edit') && (moduleAccess ?? []).includes(module)) return true;
  return false;
}
