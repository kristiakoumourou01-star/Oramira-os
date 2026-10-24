import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { CalendarClock, CheckCircle2, Truck, ChevronRight } from 'lucide-react';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDateTime } from '@/lib/format';

const STATUS_CLASS: Record<string, string> = {
  scheduled: 'badge-champagne',
  en_route: 'badge-champagne',
  completed: 'badge-forest',
  cancelled: 'badge-neutral',
  rescheduled: 'badge-neutral',
};

export default async function ContractorSchedulePage() {
  const profile = await requireRole(['contractor', 'admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  // Only contractor accounts have a contractor_id; staff previewing this route
  // have none, so short-circuit rather than query with an empty uuid.
  const { data: visits } = profile.contractorId
    ? await supabase
        .from('contractor_visits')
        .select('id, ticket_id, scheduled_for, completed_at, status, notes, maintenance_tickets(title)')
        .eq('contractor_id', profile.contractorId)
        .order('scheduled_for', { ascending: true })
    : { data: [] as any[] };

  const all = visits ?? [];
  const upcoming = all.filter((v) => v.status !== 'completed' && v.status !== 'cancelled');
  const past = all.filter((v) => v.status === 'completed' || v.status === 'cancelled').reverse();

  const Row = ({ v }: { v: (typeof all)[number] }) => (
    <Link
      href={v.ticket_id ? `/contractor/jobs/${v.ticket_id}` : '#'}
      className="flex items-center justify-between gap-3 px-6 py-4 transition-colors hover:bg-stone/60"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sand-100 text-forest">
          {v.status === 'completed' ? <CheckCircle2 size={15} strokeWidth={1.75} /> : v.status === 'en_route' ? <Truck size={15} strokeWidth={1.75} /> : <CalendarClock size={15} strokeWidth={1.75} />}
        </div>
        <div>
          <p className="text-sm font-medium text-charcoal">{(v as any).maintenance_tickets?.title ?? 'Visit'}</p>
          <p className="figure text-xs text-charcoal-600/60">
            {v.completed_at ? formatDateTime(v.completed_at) : v.scheduled_for ? formatDateTime(v.scheduled_for) : 'Time TBC'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={STATUS_CLASS[v.status] ?? 'badge-neutral'}>{v.status.replace(/_/g, ' ')}</span>
        <ChevronRight size={16} className="text-charcoal-600/40" strokeWidth={1.75} />
      </div>
    </Link>
  );

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow mb-1">Your week</p>
        <h1 className="font-display text-3xl">Schedule</h1>
      </div>

      {all.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No visits scheduled"
          description="Schedule a visit from any assigned job and it will show up here, with your full visit history."
        />
      ) : (
        <>
          <div>
            <h4 className="mb-3">Upcoming</h4>
            {upcoming.length === 0 ? (
              <p className="text-sm text-charcoal-600/70">No upcoming visits.</p>
            ) : (
              <div className="panel divide-y divide-stone-line">{upcoming.map((v) => <Row key={v.id} v={v} />)}</div>
            )}
          </div>
          {past.length > 0 && (
            <div>
              <h4 className="mb-3">Visit history</h4>
              <div className="panel divide-y divide-stone-line">{past.map((v) => <Row key={v.id} v={v} />)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
