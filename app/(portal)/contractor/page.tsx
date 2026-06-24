import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Wrench, MapPin, User, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { TicketStatusBadge, PriorityBadge } from '@/components/homeowner/TicketStatusBadge';
import type { ContractorJob } from '@/types/database.types';

const OPEN_STATUSES = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];

export default async function ContractorJobsPage() {
  await requireRole(['contractor', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  const { data: jobs } = await supabase.rpc('contractor_jobs');

  const all: ContractorJob[] = jobs ?? [];
  const active = all.filter((j) => OPEN_STATUSES.includes(j.status));
  const done = all.filter((j) => !OPEN_STATUSES.includes(j.status));

  const Card = ({ j }: { j: (typeof all)[number] }) => (
    <Link
      href={`/contractor/jobs/${j.ticket_id}`}
      className="panel flex items-center justify-between gap-4 p-5 transition-shadow hover:shadow-overlay"
    >
      <div className="min-w-0">
        <div className="mb-1 flex items-center gap-2">
          <PriorityBadge priority={j.priority} />
          {j.category && <span className="text-xs capitalize text-charcoal-600/60">{j.category}</span>}
        </div>
        <p className="truncate text-sm font-medium text-charcoal">{j.title}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-xs text-charcoal-600/70">
          <span className="flex items-center gap-1"><User size={12} strokeWidth={1.75} /> {j.homeowner_name ?? '—'}</span>
          <span className="flex items-center gap-1"><MapPin size={12} strokeWidth={1.75} /> {j.project_name ?? ''}{j.unit_number ? ` · Unit ${j.unit_number}` : ''}{j.location ? ` · ${j.location}` : ''}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <TicketStatusBadge status={j.status} />
        <ChevronRight size={16} className="text-charcoal-600/40" strokeWidth={1.75} />
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Your work</p>
        <h1 className="font-display text-3xl">Assigned Jobs</h1>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title="No jobs assigned"
          description="When the Oramira team assigns you a maintenance job, it will appear here with the homeowner and property details."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="panel p-5"><p className="eyebrow mb-1">Active</p><p className="figure text-3xl text-forest">{active.length}</p></div>
            <div className="panel p-5"><p className="eyebrow mb-1">Awaiting parts</p><p className="figure text-3xl text-forest">{all.filter((j) => j.status === 'awaiting_parts').length}</p></div>
            <div className="panel p-5"><p className="eyebrow mb-1">Completed</p><p className="figure text-3xl text-forest">{done.length}</p></div>
          </div>

          <div>
            <h4 className="mb-3">Active jobs</h4>
            {active.length === 0 ? (
              <p className="text-sm text-charcoal-600/70">Nothing active right now.</p>
            ) : (
              <div className="space-y-3">{active.map((j) => <Card key={j.ticket_id} j={j} />)}</div>
            )}
          </div>

          {done.length > 0 && (
            <div>
              <h4 className="mb-3">Completed</h4>
              <div className="space-y-3">{done.map((j) => <Card key={j.ticket_id} j={j} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
