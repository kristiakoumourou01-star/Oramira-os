import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Building2, MapPin } from 'lucide-react';
import { NewProjectForm } from '@/components/projects/NewProjectForm';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * Projects index — the operational inventory layer's front door. Each card
 * summarises a project's structure and how much of its inventory is still
 * available vs. committed.
 */
export default async function ProjectsPage() {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: projects } = await supabase
    .from('projects')
    .select('id, name, location, status, created_at')
    .order('created_at', { ascending: false });

  const { data: units } = await supabase.from('units').select('id, project_id, status');

  const statsByProject = (units ?? []).reduce<Record<string, { total: number; available: number }>>((acc, u) => {
    const bucket = (acc[u.project_id] ??= { total: 0, available: 0 });
    bucket.total += 1;
    if (u.status === 'available') bucket.available += 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Operations</p>
          <h1 className="text-3xl">Projects</h1>
        </div>
        <NewProjectForm />
      </div>

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
            const stats = statsByProject[p.id] ?? { total: 0, available: 0 };
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
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
