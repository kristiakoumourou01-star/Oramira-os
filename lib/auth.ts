import { getAuthUser, createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { effectiveCan, isInternalRole, sanitizePermissions, type Module, type Action, type UserPermissions } from '@/lib/permissions';
import { readImpersonationTarget } from '@/lib/impersonation';
import { getOrgSettings } from '@/lib/org-settings';
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

  // permissions / must_change_password (migration 0053) and is_active are also
  // best-effort, for the same reason: a missing column must never block sign-in.
  let permissions: UserPermissions | null = null;
  let mustChangePassword = false;
  let isActive = true;
  const { data: extra } = await supabase
    .from('profiles')
    .select('permissions, must_change_password, is_active')
    .eq('id', userId)
    .maybeSingle();
  if (extra) {
    const e = extra as any;
    if (e.permissions && typeof e.permissions === 'object') permissions = sanitizePermissions(e.permissions);
    mustChangePassword = e.must_change_password === true;
    isActive = e.is_active !== false;
  }

  // Admin-defined role (migration 0054) — separate best-effort read, then the
  // role definitions from org settings. Own matrix beats the role's.
  let customRoleId: string | null = null;
  const { data: cr } = await supabase.from('profiles').select('custom_role').eq('id', userId).maybeSingle();
  if (cr && typeof (cr as any).custom_role === 'string') customRoleId = (cr as any).custom_role;
  const { roles } = await getOrgSettings();
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
  const { security } = await getOrgSettings();
  if (security.pwExpire90) {
    const changed = Date.parse((auth.user.user_metadata as any)?.pw_changed_at ?? auth.user.created_at ?? '');
    if (Number.isFinite(changed)) passwordExpired = Date.now() - changed > PASSWORD_MAX_AGE_DAYS * 86_400_000;
  }
  return { ...real, passwordExpired, impersonator: null };
});

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
  const { security } = await getOrgSettings();
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
  const { security } = await getOrgSettings();
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
