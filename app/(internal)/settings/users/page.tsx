import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { INTERNAL_ROLES, sanitizePermissions } from '@/lib/permissions';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { UsersAdmin, type AdminUser, type AdminInvite } from '@/components/admin/UsersAdmin';
import { StaffTabs } from '@/components/admin/StaffTabs';
import { LeaveManager } from '@/components/hr/LeaveManager';
import { effectiveCan } from '@/lib/permissions';
import { loadEmployeeHr } from '@/lib/staff';
import { EMPTY_HR } from '@/lib/staff-shared';

const PORTAL_ROLES = ['buyer', 'homeowner', 'investor', 'contractor'];

export default async function UsersSettingsPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const tab = searchParams?.tab === 'external' ? 'external' : searchParams?.tab === 'leave' ? 'leave' : 'employees';
  const profile = await requirePermission('users');
  const supabase = await createSupabaseServerClient();

  const [{ data: users }, { data: invites }, { data: portalUsers }] = await Promise.all([
    supabase.from('profiles').select('id, full_name, role, is_active').in('role', INTERNAL_ROLES).order('full_name'),
    supabase.from('invites').select('id, email, role, created_at').eq('status', 'pending').in('role', INTERNAL_ROLES).order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name, role, is_active').in('role', PORTAL_ROLES).order('full_name'),
  ]);

  // Best-effort extras: per-user permissions / temporary-password flag
  // (migration 0053), HR module grants (0035) and login emails (auth admin API).
  // Any of these missing just means the page shows less, never that it breaks.
  const extras = new Map<string, { permissions: any; must_change_password: boolean; module_access: string[] }>();
  const ids = (users ?? []).map((u) => u.id);
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id, permissions, must_change_password, module_access').in('id', ids);
    for (const row of (data ?? []) as any[]) extras.set(row.id, row);
  }
  const customRoles = new Map<string, string>();
  if (ids.length) {
    const { data } = await supabase.from('profiles').select('id, custom_role').in('id', ids);
    for (const row of (data ?? []) as any[]) if (row.custom_role) customRoles.set(row.id, row.custom_role);
  }
  const [{ roles }, hrMap] = await Promise.all([getOrgSettingsRaw(), tab === 'employees' ? loadEmployeeHr(ids) : Promise.resolve(new Map())]);
  const emails = new Map<string, string>();
  try {
    const service = createSupabaseServiceRoleClient();
    const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) if (u.email) emails.set(u.id, u.email);
  } catch {
    // service key not configured — emails simply aren't shown
  }

  const enrich = (u: any): AdminUser => {
    const e = extras.get(u.id);
    return {
      ...u,
      email: emails.get(u.id) ?? null,
      permissions: e?.permissions ? sanitizePermissions(e.permissions) : null,
      mustChangePassword: e?.must_change_password === true,
      moduleAccess: Array.isArray(e?.module_access) ? e!.module_access : [],
      customRole: customRoles.get(u.id) ?? null,
      hr: hrMap.get(u.id) ?? EMPTY_HR,
    };
  };

  const counts = { employees: (users ?? []).length, external: (portalUsers ?? []).length };
  if (tab === 'leave') {
    const canEditHr = effectiveCan(profile.role, profile.moduleAccess, 'hr', 'edit', profile.permissions);
    const [{ data: allLeave }, { data: balances }] = await Promise.all([
      supabase.from('leave_requests').select('id, profile_id, leave_type, start_date, end_date, days, reason, status, created_at, profiles!leave_requests_profile_id_fkey(full_name)').order('start_date', { ascending: false }).limit(1000),
      supabase.from('leave_balances').select('profile_id, leave_type, year, total_days, used_days'),
    ]);
    return (
      <div className="space-y-5">
        <StaffTabs active="leave" counts={counts} />
        <LeaveManager me={profile.id} canEdit={canEditHr} employees={((users ?? []) as any[]).map((u) => ({ id: u.id, full_name: u.full_name })) as any}
          balances={((balances ?? []) as any[]).map((b) => ({ ...b, total_days: Number(b.total_days ?? 0), used_days: Number(b.used_days ?? 0) }))}
          requests={((allLeave ?? []) as any[]).map((r) => ({ ...r, employee: r.profiles?.full_name ?? null }))} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <StaffTabs active={tab} counts={counts} />
      <UsersAdmin
        mode={tab}
        users={(users ?? []).map(enrich)}
        invites={(invites ?? []) as AdminInvite[]}
        portalUsers={(portalUsers ?? []).map((u) => ({ ...u, email: emails.get(u.id) ?? null, permissions: null, mustChangePassword: false, moduleAccess: [] }))}
        currentUserId={profile.id}
        canImpersonate={profile.role === 'admin'}
        roles={roles}
        canEditDocs={effectiveCan(profile.role, profile.moduleAccess, 'hr', 'edit', profile.permissions)}
      />
    </div>
  );
}
