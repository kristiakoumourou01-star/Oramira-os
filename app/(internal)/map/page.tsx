import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadMapData } from '@/lib/map-data';
import { MapWorkspace } from '@/components/map/MapWorkspace';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

export const dynamic = 'force-dynamic';

/**
 * Χάρτης: όλα τα έργα με τις διαθέσιμες μονάδες, ταίριασμα ενός αγοραστή με
 * βαθμολογία και «τι λείπει», αποστολή επιλογής στον πελάτη, και πλάνο ημέρας
 * για τις προβολές ενός πωλητή.
 */
export default async function MapPage({ searchParams }: { searchParams: { lead?: string } }) {
  const profile = await requirePermission('projects');
  const canLeads = effectiveCan(profile.role, profile.moduleAccess, 'leads', 'view', profile.permissions);
  const data = await loadMapData({ withLeads: canLeads });
  const supabase = await createSupabaseServerClient();
  const { data: staff } = await supabase.from('profiles').select('id, full_name').in('role', ['admin', 'sales', 'management']).order('full_name');
  const agents = ((staff ?? []) as any[]).map((s) => ({ id: s.id as string, name: (s.full_name ?? '—') as string }));
  if (!agents.some((a) => a.id === profile.id)) agents.unshift({ id: profile.id, name: profile.fullName ?? 'Εγώ' });

  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Έργα & μονάδες" title="Χάρτης" description="Διαλέξτε αγοραστή για να δείτε ποιες μονάδες του ταιριάζουν και τι λείπει, στείλτε του επιλογή, ή δείτε το πλάνο προβολών της ημέρας." />
      <MapWorkspace
        projects={data.projects}
        unplaced={data.unplaced}
        units={data.units}
        leads={data.leads}
        fields={data.fields}
        agents={agents}
        me={profile.id}
        canLeads={canLeads}
        presetLead={searchParams.lead ?? null}
      />
    </div>
  );
}
