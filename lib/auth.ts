import { getAuthUser, createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { effectiveCan, isInternalRole, sanitizePermissions, type Module, type Action, type UserPermissions } from '@/lib/permissions';
import { readImpersonationTarget } from '@/lib/impersonation';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { resolveRole, type RightKey } from '@/lib/roles-shared';
import { cookies, headers } from 'next/headers';
import { LAST_SEEN_COOKIE, PASSWORD_MAX_AGE_DAYS, ipAllowed } from '@/lib/security-shared';
import { getMfaStatus, isTrustedDevice } from '@/lib/mfa';
import '@/lib/locale-server';

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
  /**
   * Effective access matrix: the user's own (Users → Δικαιώματα), else their
   * role's (custom role or admin-adjusted built-in role); null = built-in defaults.
   */
  permissions: UserPermissions | null;
  /** Role as shown to people: a custom role's name or the built-in label. */
  roleName: string;
  /** Admin-defined role id (profiles.custom_role), if any. */
  customRoleId: string | null;
  /** Special rights (export, approve discounts, …) from the role. */
  rights: RightKey[];
  /** True while the account still has the temporary password an admin set. */
  mustChangePassword: boolean;
  /** False once an admin deactivates the account. */
  isActive: boolean;
  /** Settings → Ασφάλεια "change every 90 days" and this password is older. */
  passwordExpired: boolean;
  /** Set only while an admin is impersonating this (effective) identity. */
  impersonator?: { id: string; fullName: string | null } | null;
}

const STAFF_ROLES: UserRole[] = ['admin', 'sales', 'management'];

/** Load a profile by id into the CurrentProfile shape. Null if it doesn't exist. */
async function loadProfile(
  supabase: ServerClient,
  userId: string,
): Promise<Omit<CurrentProfile, 'impersonator'> | null> {
  // One read for everything (all columns exist since migrations 0035/0053/0054).
  // If an older database lacks one, fall back to the core columns so sign-in
  // never breaks on a missing column.
  const [{ data: full, error }, { roles: rolesEarly }] = await Promise.all([
    supabase.from('profiles').select('id, role, full_name, contact_id, contractor_id, module_access, permissions, must_change_password, is_active, custom_role').eq('id', userId).maybeSingle(),
    getOrgSettingsRaw(),
  ]);
  let profile: any = full;
  if (error) {
    const { data: core } = await supabase.from('profiles').select('id, role, full_name, contact_id, contractor_id').eq('id', userId).maybeSingle();
    profile = core;
  }
  if (!profile) return null;

  const moduleAccess: string[] = Array.isArray(profile.module_access) ? profile.module_access : [];
  const permissions: UserPermissions | null = profile.permissions && typeof profile.permissions === 'object' ? sanitizePermissions(profile.permissions) : null;
  const mustChangePassword = profile.must_change_password === true;
  const isActive = profile.is_active !== false;
  const customRoleId: string | null = typeof profile.custom_role === 'string' ? profile.custom_role : null;
  const roles = rolesEarly;
  const resolved = resolveRole(profile.role, customRoleId, roles);

  return {
    id: profile.id,
    role: profile.role as UserRole,
    fullName: profile.full_name,
    contactId: profile.contact_id,
    contractorId: profile.contractor_id,
    moduleAccess,
    permissions: permissions ?? resolved.permissions,
    roleName: resolved.name,
    customRoleId: resolved.customRoleId,
    rights: resolved.rights,
    mustChangePassword,
    isActive,
    passwordExpired: false,
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
export const getCurrentProfile = cache(async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const t0 = Date.now();
  try { return await readCurrentProfile(); } finally {
    const ms = Date.now() - t0;
    if (ms > 250) console.log(`[perf] profile ${ms}ms`);
  }
});

async function readCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const user = await getAuthUser();
  if (!user) return null;
  const auth = { user };

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

  // Password age (Settings → Ασφάλεια) — for the real signed-in user only.
  let passwordExpired = false;
  const { security } = await getOrgSettingsRaw();
  if (security.pwExpire90) {
    const changed = Date.parse((auth.user.user_metadata as any)?.pw_changed_at ?? auth.user.created_at ?? '');
    if (Number.isFinite(changed)) passwordExpired = Date.now() - changed > PASSWORD_MAX_AGE_DAYS * 86_400_000;
  }
  return { ...real, passwordExpired, impersonator: null };
}


/**
 * Redirects to login if not signed in; use at the top of protected Server Components.
 * Also enforces two admin decisions for the REAL signed-in user (never while an
 * admin is viewing as someone): a deactivated account is sent back to login,
 * and an account still on its temporary password must change it first.
 */
export async function requireProfile(opts: { allowPasswordChange?: boolean; allowMfaSetup?: boolean } = {}): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  // 2FA is checked for the session itself, so it also applies while viewing as someone.
  await enforceMfa(profile, !!opts.allowMfaSetup);
  if (!profile.impersonator) {
    if (!profile.isActive) redirect('/login?disabled=1');
    await enforceSessionRules();
    if ((profile.mustChangePassword || profile.passwordExpired) && !opts.allowPasswordChange) redirect('/account/password');
  }
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
  if (!isInternalRole(profile.role) || !effectiveCan(profile.role, profile.moduleAccess, module, action, profile.permissions)) {
    redirect(homeRouteForRole(profile.role));
  }
  return profile;
}

/** Does this user hold a special right (Settings → Ρόλοι)? Admins hold them all. */
export function hasRight(profile: Pick<CurrentProfile, 'role' | 'rights'>, right: RightKey): boolean {
  return profile.role === 'admin' || profile.rights.includes(right);
}

/**
 * Settings → Ασφάλεια → κωδικός μίας χρήσης (2FA):
 *  - someone with an authenticator must pass the code in this session (aal2),
 *    unless this browser is one of their trusted devices (when allowed);
 *  - when the company makes 2FA mandatory, staff without an authenticator are
 *    sent to set one up first (portal users are never forced).
 */
async function enforceMfa(profile: CurrentProfile, allowSetup: boolean): Promise<void> {
  const st = await getMfaStatus();
  if (!st.userId) return;
  const { security } = await getOrgSettingsRaw();
  if (st.hasFactor) {
    if (st.current === 'aal2') return;
    if (security.trustedDevices && (await isTrustedDevice(st.userId))) return;
    redirect('/login/2fa');
  }
  const staff = !!profile.impersonator || isInternalRole(profile.role);
  if (security.otp && staff && !allowSetup) redirect('/account/security?setup=1');
}

/**
 * Settings → Ασφάλεια, checked on every protected page for the real user:
 *  - sign out after N hours without activity (last request time is kept in a
 *    cookie by the middleware; 0 = never)
 *  - IP allow-list (empty = any address)
 */
async function enforceSessionRules(): Promise<void> {
  const { security } = await getOrgSettingsRaw();
  try {
    if (security.sessionTimeoutHours > 0) {
      const seen = Number((await cookies()).get(LAST_SEEN_COOKIE)?.value ?? '');
      if (Number.isFinite(seen) && seen > 0 && Date.now() - seen > security.sessionTimeoutHours * 3_600_000) {
        redirect('/auth/signout?reason=timeout');
      }
    }
    if (security.ipAllowList.trim()) {
      const h = await headers();
      const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
      if (!ipAllowed(ip, security.ipAllowList)) redirect('/auth/signout?reason=ip');
    }
  } catch (e) {
    // redirect() works by throwing — let it through; anything else is ignored.
    if (e && typeof e === 'object' && 'digest' in e && String((e as any).digest).startsWith('NEXT_REDIRECT')) throw e;
  }
}
