import { CalendarClock, CheckCircle2, Truck } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface VisitRow {
  id: string;
  scheduled_for: string | null;
  completed_at: string | null;
  status: string;
  notes: string | null;
  contractor_name: string | null;
  ticket_title: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  scheduled: 'badge-champagne',
  en_route: 'badge-champagne',
  completed: 'badge-forest',
  cancelled: 'badge-neutral',
  rescheduled: 'badge-neutral',
};

/**
 * Contractor visit schedule + history for the homeowner — upcoming visits
 * surfaced first, past visits as a calm record. Read-only: staff and the
 * contractor manage the schedule.
 */
export function ContractorVisitList({ visits }: { visits: VisitRow[] }) {
  if (visits.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No contractor visits scheduled. We'll let you know when one is arranged.</p>;
  }

  const upcoming = visits.filter((v) => v.status !== 'completed' && v.status !== 'cancelled');
  const past = visits.filter((v) => v.status === 'completed' || v.status === 'cancelled');

  const Row = ({ v }: { v: VisitRow }) => (
    <li className="flex items-start gap-3 py-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sand-100 text-forest">
        {v.status === 'completed' ? <CheckCircle2 size={15} strokeWidth={1.75} /> : v.status === 'en_route' ? <Truck size={15} strokeWidth={1.75} /> : <CalendarClock size={15} strokeWidth={1.75} />}
      </div>
      <div className="flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-charcoal">{v.contractor_name ?? 'Contractor'}</p>
          <span className={STATUS_CLASS[v.status] ?? 'badge-neutral'}>{v.status.replace(/_/g, ' ')}</span>
        </div>
        {v.ticket_title && <p className="text-xs text-charcoal-600/70">{v.ticket_title}</p>}
        <p className="mt-0.5 text-xs text-charcoal-600/60">
          {v.completed_at
            ? `Visited ${formatDateTime(v.completed_at)}`
            : v.scheduled_for
            ? `Scheduled ${formatDateTime(v.scheduled_for)}`
            : 'Time to be confirmed'}
        </p>
        {v.notes && <p className="mt-1 text-xs text-charcoal-600/80">{v.notes}</p>}
      </div>
    </li>
  );

  return (
    <div className="space-y-5">
      {upcoming.length > 0 && (
        <div>
          <p className="eyebrow mb-1">Upcoming</p>
          <ul className="divide-y divide-stone-line">{upcoming.map((v) => <Row key={v.id} v={v} />)}</ul>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <p className="eyebrow mb-1">Visit history</p>
          <ul className="divide-y divide-stone-line">{past.map((v) => <Row key={v.id} v={v} />)}</ul>
        </div>
      )}
    </div>
  );
}
