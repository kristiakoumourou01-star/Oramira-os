import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { effectiveCan, isInternalRole, type Module, type Action } from '@/lib/permissions';
import { readImpersonationTarget } from '@/lib/impersonation';

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export type UserRole =
  | 'admin'
  | 'sales'
  | 'management'
  | 'finance'
  | 'construction'
  | 'viewer'
  | 'buyer'
  | 'homeowner'
  | 'investor'
  | 'contractor';

export interface CurrentProfile {
  id: string;
  role: UserRole;
  fullName: string | null;
  contactId: string | null;
  contractorId: string | null;
  moduleAccess: string[];
  /** Set only while an admin is impersonating this (effective) identity. */
  impersonator?: { id: string; fullName: string | null } | null;
}

const STAFF_ROLES: UserRole[] = ['admin', 'sales', 'management'];

/** Load a profile by id into the CurrentProfile shape. Null if it doesn't exist. */
async function loadProfile(
  supabase: ServerClient,
  userId: string,
): Promise<Omit<CurrentProfile, 'impersonator'> | null> {
  // Select core fields only — guaranteed to exist regardless of which HR
  // migrations have been applied, so sign-in never breaks on a missing column.
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, contact_id, contractor_id')
    .eq('id', userId)
    .single();

  if (!profile) return null;

  // module_access (migration 0035) is best-effort: if the column isn't there yet
  // the query fails quietly and we fall back to role-only access.
  let moduleAccess: string[] = [];
  const { data: access } = await supabase.from('profiles').select('module_access').eq('id', userId).maybeSingle();
  if (access && Array.isArray((access as any).module_access)) moduleAccess = (access as any).module_access as string[];

  return {
    id: profile.id,
    role: profile.role as UserRole,
    fullName: profile.full_name,
    contactId: profile.contact_id,
    contractorId: profile.contractor_id,
    moduleAccess,
  };
}

/**
 * Loads the signed-in user's profile + role. Returns null if not signed in.
 * This is the single source of truth route guards and page-level logic
 * should call — never infer role from anything client-supplied.
 *
 * Impersonation: if the real user is an admin and an impersonation cookie
 * points at another user, the EFFECTIVE profile returned is that target's
 * (with `impersonator` set), so the whole app renders as them. Any other role
 * ignores the cookie — only admins can view-as.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const real = await loadProfile(supabase, auth.user.id);
  if (!real) return null;

  if (real.role === 'admin') {
    const targetId = await readImpersonationTarget();
    if (targetId && targetId !== real.id) {
      const target = await loadProfile(supabase, targetId);
      if (target) {
        return { ...target, impersonator: { id: real.id, fullName: real.fullName } };
      }
    }
  }

  return { ...real, impersonator: null };
}

/** Redirects to login if not signed in; use at the top of protected Server Components. */
export async function requireProfile(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  return profile;
}

/** Redirects to login if not signed in, or to /dashboard if signed in but wrong role. */
export async function requireRole(allowed: UserRole[]): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!allowed.includes(profile.role)) {
    redirect(homeRouteForRole(profile.role));
  }
  return profile;
}

export function isStaffRole(role: UserRole): boolean {
  return STAFF_ROLES.includes(role);
}

/** Where a signed-in user should land after login, based on role. */
export function homeRouteForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'sales':
    case 'management':
    case 'finance':
    case 'construction':
    case 'viewer':
      return '/dashboard';
    case 'buyer':
      return '/buyer';
    case 'homeowner':
      return '/homeowner';
    case 'investor':
      return '/investor';
    case 'contractor':
      return '/contractor';
    default:
      return '/login';
  }
}

/**
 * Page guard for internal module access. Redirects non-internal users home and
 * internal users who lack the capability back to their dashboard. Use at the
 * top of internal pages, e.g. `await requirePermission('financials')`.
 */
export async function requirePermission(module: Module, action: Action = 'view'): Promise<CurrentProfile> {
  const profile = await requireProfile();
  if (!isInternalRole(profile.role) || !effectiveCan(profile.role, profile.moduleAccess, module, action)) {
    redirect(homeRouteForRole(profile.role));
  }
  return profile;
}
