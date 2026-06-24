import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export type UserRole =
  | 'admin'
  | 'sales'
  | 'management'
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
}

const STAFF_ROLES: UserRole[] = ['admin', 'sales', 'management'];

/**
 * Loads the signed-in user's profile + role. Returns null if not signed in.
 * This is the single source of truth route guards and page-level logic
 * should call — never infer role from anything client-supplied.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name, contact_id, contractor_id')
    .eq('id', auth.user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    role: profile.role as UserRole,
    fullName: profile.full_name,
    contactId: profile.contact_id,
    contractorId: profile.contractor_id,
  };
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
