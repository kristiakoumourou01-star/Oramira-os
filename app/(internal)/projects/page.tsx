import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Building2, MapPin } from 'lucide-react';
import { NewProjectForm } from '@/components/projects/NewProjectForm';
import { EmptyState } from '@/components/ui/EmptyState';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { BOARD_STATUSES, STATUS_STYLE, statusOf, type BoardStatus } from '@/lib/unit-board-shared';

/**
 * Projects index — the operational inventory layer's front door. Each card
 * summarises a project's structure and how much of its inventory is still
 * available vs. committed.
 */
export default async function ProjectsPage() {
  await requirePermission('projects');
  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, location, status, created_at')
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
        <div className="grid grid-cols-3 gap-6">
          {projects.map((p) => {
            const stats = statsByProject[p.id] ?? { total: 0, available: 0, by: {} };
            return (
              <Link key={p.id} href={`/projects/${p.id}`} className="panel p-6 transition-shadow hover:shadow-overlay">
                <div className="mb-3 flex items-start justify-between">
                  <Building2 size={20} className="text-olive" strokeWidth={1.5} />
                  <span className="badge-neutral capitalize">{p.status?.replace(/_/g, ' ')}</span>
                </div>
                <h3 className="text-xl">{p.name}</h3>
                {p.location && (
                  <p className="mt-1 flex items-center gap-1 text-sm text-charcoal-600/70">
                    <MapPin size={13} strokeWidth={1.75} /> {p.location}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between border-t border-stone-line pt-3 text-sm">
                  <span className="text-charcoal-600/70">Units</span>
                  <span className="figure text-charcoal">
                    {stats.available}<span className="text-charcoal-600/50"> / {stats.total} available</span>
                  </span>
                </div>
                {stats.total > 0 && (
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-stone" title={BOARD_STATUSES.filter((st) => stats.by[st]).map((st) => `${STATUS_STYLE[st].label}: ${stats.by[st]}`).join(' · ')}>
                    {BOARD_STATUSES.filter((st) => stats.by[st]).map((st) => (
                      <span key={st} style={{ width: `${((stats.by[st] ?? 0) / stats.total) * 100}%`, background: STATUS_STYLE[st].border }} />
                    ))}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
