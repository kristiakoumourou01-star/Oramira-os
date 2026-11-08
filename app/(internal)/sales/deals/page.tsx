import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnrichedLeads } from '@/lib/leads';
import { getOrgSettings, getOrgSettingsRaw } from '@/lib/org-settings';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { NewLeadForm } from '@/components/crm/NewLeadForm';
import { DealsBoard } from '@/components/sales/DealsBoard';
import type { Agent } from '@/components/crm/LeadBoard';

export const dynamic = 'force-dynamic';

/** Sales → Deals: ο πίνακας του pipeline (όπως Pipedrive). */
export default async function DealsPage({ searchParams }: { searchParams: { view?: string } }) {
  const profile = await requirePermission('leads');
  const supabase = await createSupabaseServerClient();
  const [leads, { data: projects }, { data: agents }, settings, raw] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('projects').select('id, name'),
    supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).eq('is_active', true),
    getOrgSettings(),
    profile.role === 'admin' ? getOrgSettingsRaw() : Promise.resolve(null),
  ]);
  const cfg = settings.pipelines;
  const view = (['board', 'list', 'forecast', 'archive'] as const).find((v) => v === searchParams.view) ?? 'board';
  const pipes = [cfg.pipelines.find((p) => p.key === cfg.defaultKey) ?? cfg.pipelines[0], ...cfg.pipelines.filter((p) => p.key !== cfg.defaultKey)].map((p) => ({ key: p.key, name: p.name }));
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Deals" action={<NewLeadForm projects={projects ?? []} agents={(agents ?? []) as Agent[]} required={settings.fields.staff} pipelines={pipes} />} />
      <DealsBoard leads={leads} cfg={cfg} rawCfg={raw?.pipelines} canEditStages={profile.role === 'admin'} agents={(agents ?? []) as Agent[]} currentUserId={profile.id} initialView={view} />
    </div>
  );
}
