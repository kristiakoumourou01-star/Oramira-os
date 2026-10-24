import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INTERNAL_ROLES } from '@/lib/permissions';
import { UsersAdmin, type AdminUser, type AdminInvite } from '@/components/admin/UsersAdmin';

const PORTAL_ROLES = ['buyer', 'homeowner', 'investor', 'contractor'];

export default async function UsersSettingsPage() {
  const profile = await requirePermission('users');
  const supabase = await createSupabaseServerClient();

  const [{ data: users }, { data: invites }, { data: portalUsers }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, is_active').in('role', INTERNAL_ROLES).order('full_name'),
    supabase.from('invites').select('id, email, role, created_at').eq('status', 'pending').in('role', INTERNAL_ROLES).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role, is_active').in('role', PORTAL_ROLES).order('full_name'),
  ]);

  return (
    <UsersAdmin
      users={(users ?? []) as AdminUser[]}
      invites={(invites ?? []) as AdminInvite[]}
      portalUsers={(portalUsers ?? []) as AdminUser[]}
      currentUserId={profile.id}
      canImpersonate={profile.role === 'admin'}
    />
  );
}
