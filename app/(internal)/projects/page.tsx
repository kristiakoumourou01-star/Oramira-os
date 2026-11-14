import { requirePermission } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { ProjectsBoard } from '@/components/projects/ProjectsBoard';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Building2 } from 'lucide-react';
import { NewProjectForm } from '@/components/projects/NewProjectForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { statusOf, type BoardStatus } from '@/lib/unit-board-shared';

/**
 * Projects index — the operational inventory layer's front door. Each card
 * summarises a project's structure and how much of its inventory is still
 * available vs. committed.
 */
export default async function ProjectsPage() {
  const profile = await requirePermission('projects');
  const canEdit = effectiveCan(profile.role, profile.moduleAccess, 'projects', 'edit', profile.permissions);
  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, location, status, created_at, description, delivery_date, latitude, longitude')
    .order('created_at', { ascending: false });

  const { data: units } = await supabase.from('units').select('id, project_id, status');

  const statsByProject = (units ?? []).reduce<Record<string, { total: number; available: number; by: Partial<Record<BoardStatus, number>> }>>((acc, u) => {
    const bucket = (acc[u.project_id] ??= { total: 0, available: 0, by: {} });
    bucket.total += 1;
    if (u.status === 'available') bucket.available += 1;
    const st = statusOf(u.status);
    bucket.by[st] = (bucket.by[st] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Operations" title="Projects" description="Developments, phases, and unit inventory." action={<NewProjectForm />} />

      {!projects || projects.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No projects yet"
          description="Create your first development to start laying out buildings, phases, and units."
          action={<NewProjectForm />}
        />
      ) : (
        <ProjectsBoard canEdit={canEdit} projects={projects.map((p: any) => { const st = statsByProject[p.id] ?? { total: 0, available: 0, by: {} }; return { id: p.id, name: p.name, location: p.location ?? null, status: p.status ?? null, description: p.description ?? null, delivery_date: p.delivery_date ?? null, lat: p.latitude != null ? Number(p.latitude) : null, lng: p.longitude != null ? Number(p.longitude) : null, ...st }; })} />
      )}
    </div>
  );
}
