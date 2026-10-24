import { Check } from 'lucide-react';
import { formatDate } from '@/lib/format';

const STAGE_ORDER = ['permits', 'excavation', 'structure', 'mep', 'finishes', 'delivery'] as const;
const STAGE_LABEL: Record<string, string> = {
  permits: 'Permits & approvals',
  excavation: 'Excavation & foundations',
  structure: 'Structure',
  mep: 'Mechanical, electrical & plumbing',
  finishes: 'Interior finishes',
  delivery: 'Delivery & handover',
};

export interface BuyerMilestone {
  id: string;
  milestone_type: string;
  status: string;
  planned_end: string | null;
  actual_end: string | null;
}

/**
 * Read-only construction timeline for the buyer — a quiet vertical ledger of
 * the build stages, with a percentage-complete summary. No controls: the
 * buyer watches their home take shape, staff drive the actual statuses.
 */
export function BuyerMilestoneTimeline({ milestones }: { milestones: BuyerMilestone[] }) {
  const ordered = [...milestones].sort(
    (a, b) => STAGE_ORDER.indexOf(a.milestone_type as any) - STAGE_ORDER.indexOf(b.milestone_type as any)
  );
  const completed = ordered.filter((m) => m.status === 'complete').length;
  const pct = ordered.length > 0 ? Math.round((completed / ordered.length) * 100) : 0;

  if (ordered.length === 0) {
    return <p className="text-sm text-charcoal-600/70">Construction milestones will appear here as the project progresses.</p>;
  }

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-baseline justify-between">
          <span className="figure text-2xl text-forest">{pct}%</span>
          <span className="text-sm text-charcoal-600/70">{completed} of {ordered.length} stages complete</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sand-100">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ol className="relative space-y-5 border-l border-stone-line pl-6">
        {ordered.map((m) => {
          const done = m.status === 'complete';
          const active = m.status === 'in_progress';
          const delayed = m.status === 'delayed';
          return (
            <li key={m.id} className="relative">
              <span
                className={`absolute -left-[31px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-white ${
                  done ? 'bg-forest text-stone-100' : active ? 'bg-champagne text-forest' : delayed ? 'bg-signal-warning text-stone-100' : 'bg-stone-line'
                }`}
              >
                {done && <Check size={11} strokeWidth={2.5} />}
              </span>
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm font-medium ${done ? 'text-charcoal' : active ? 'text-forest' : 'text-charcoal-600'}`}>
                  {STAGE_LABEL[m.milestone_type] ?? m.milestone_type}
                </p>
                <span className="text-xs capitalize text-charcoal-600/60">{m.status.replace(/_/g, ' ')}</span>
              </div>
              {(m.actual_end || m.planned_end) && (
                <p className="mt-0.5 text-xs text-charcoal-600/60">
                  {done && m.actual_end
                    ? `Completed ${formatDate(m.actual_end)}`
                    : m.planned_end
                    ? `Expected ${formatDate(m.planned_end)}`
                    : ''}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
