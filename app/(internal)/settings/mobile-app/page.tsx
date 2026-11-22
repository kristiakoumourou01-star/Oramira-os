import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { effectiveCan } from '@/lib/permissions';
import { getMobileApp } from '@/lib/mobile-app';
import { mergeExtra } from '@/lib/settings-extra-shared';
import { MobileAppBuilder, type MobileProjectInfo, type AdminPreviewStats } from '@/components/admin/MobileAppBuilder';

export const dynamic = 'force-dynamic';

/** Admin → Mobile app: Home | Content | Settings, Home builder με ζωντανή προεπισκόπηση Customer app / Admin app. */
export default async function MobileAppPage() {
  const me = await requirePermission('mobileapp');
  const canEdit = effectiveCan(me.role, me.moduleAccess, 'mobileapp', 'edit', me.permissions);
  const supabase = (await createSupabaseServerClient()) as any;
  const svc = createSupabaseServiceRoleClient() as any;
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(); dayEnd.setHours(23, 59, 59, 999);
  const [cfg, { data: projects }, { data: units }, { data: brand }, leadsToday, dueToday, pendingLeave, openTasks, { data: orgRow }] = await Promise.all([
    getMobileApp(),
    supabase.from('projects').select('id, name, location').order('name'),
    supabase.from('units').select('project_id, status, price'),
    svc.from('org_branding').select('company_name').eq('id', 'org').maybeSingle(),
    supabase.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', dayStart.toISOString()),
    supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lte('due_at', dayEnd.toISOString()),
    supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_done', false),
    svc.from('org_settings').select('data').eq('id', 'org').maybeSingle(),
  ]);
  const signInCode = mergeExtra(orgRow?.data?.extra).signInCode;
  const info: MobileProjectInfo[] = ((projects ?? []) as any[]).map((p) => {
    const us = ((units ?? []) as any[]).filter((u) => u.project_id === p.id);
    const avail = us.filter((u) => u.status === 'available');
    const prices = avail.map((u) => Number(u.price ?? 0)).filter((n) => n > 0);
    return { id: p.id, name: p.name, location: p.location ?? null, available: avail.length, total: us.length, fromPrice: prices.length ? Math.min(...prices) : null };
  });
  const stats: AdminPreviewStats = {
    leadsToday: leadsToday.count ?? 0,
    followupsDue: dueToday.count ?? 0,
    pendingLeave: pendingLeave.count ?? 0,
    openTasks: openTasks.error ? 0 : openTasks.count ?? 0,
    unitsAvailable: info.reduce((n, p) => n + p.available, 0),
    me: me.fullName ?? '',
  };
  const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://oramira-os-3mbm.vercel.app').replace(/\/$/, '');
  return <MobileAppBuilder initial={cfg} projects={info} installUrl={url} company={brand?.company_name || 'Oramira'} stats={stats} canEdit={canEdit} signInCode={signInCode} />;
}
