import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { mergeMobileApp } from '@/lib/mobile-app-shared';
import { MobileAppBuilder, type MobileProjectInfo } from '@/components/admin/MobileAppBuilder';

export const dynamic = 'force-dynamic';

/** Admin → Mobile app: Home builder με ζωντανή προεπισκόπηση, Content (έργα), Settings (όπως στο FitnessCRM). */
export default async function MobileAppPage() {
  await requirePermission('users');
  const supabase = await createSupabaseServerClient();
  const svc = createSupabaseServiceRoleClient() as any;
  const [{ data: row }, { data: projects }, { data: units }, { data: brand }] = await Promise.all([
    svc.from('org_settings').select('data').eq('id', 'org').maybeSingle(),
    supabase.from('projects').select('id, name, location').order('name'),
    supabase.from('units').select('project_id, status, price'),
    svc.from('org_branding').select('company_name').eq('id', 'org').maybeSingle(),
  ]);
  const cfg = mergeMobileApp(row?.data?.mobileApp);
  const info: MobileProjectInfo[] = ((projects ?? []) as any[]).map((p) => {
    const us = ((units ?? []) as any[]).filter((u) => u.project_id === p.id);
    const avail = us.filter((u) => u.status === 'available');
    const prices = avail.map((u) => Number(u.price ?? 0)).filter((n) => n > 0);
    return { id: p.id, name: p.name, location: p.location ?? null, available: avail.length, total: us.length, fromPrice: prices.length ? Math.min(...prices) : null };
  });
  const url = (process.env.NEXT_PUBLIC_APP_URL || 'https://oramira-os-3mbm.vercel.app').replace(/\/$/, '');
  return <MobileAppBuilder initial={cfg} projects={info} installUrl={url} company={brand?.company_name || 'Oramira'} />;
}
