'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { addMilestone, updateMilestoneStatus } from '@/app/actions/projects';
import { formatDate } from '@/lib/format';

const STAGES = ['permits', 'excavation', 'structure', 'mep', 'finishes', 'delivery'] as const;
const STAGE_LABEL: Record<string, string> = {
  permits: 'Permits', excavation: 'Excavation', structure: 'Structure',
  mep: 'MEP', finishes: 'Finishes', delivery: 'Delivery',
};
const MS_STATUS = ['not_started', 'in_progress', 'delayed', 'complete'] as const;
type MsStatus = (typeof MS_STATUS)[number];

const STATUS_CLASS: Record<MsStatus, string> = {
  not_started: 'badge-neutral',
  in_progress: 'badge-champagne',
  delayed: 'border-signal-warning/30 bg-champagne-50 text-signal-warning badge',
  complete: 'badge-forest',
};

export interface MilestoneNode {
  id: string;
  milestone_type: string;
  status: MsStatus;
  planned_start: string | null;
  planned_end: string | null;
  notes: string | null;
}

/**
 * Construction timeline / permits / stages — rendered as a calm vertical
 * ledger of milestones, each with an inline status control. Mirrors the
 * phase_type stages so "permits → delivery" reads as one continuous build.
 */
export function ProjectTimeline({ projectId, milestones }: { projectId: string; milestones: MilestoneNode[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);

  function submit(formData: FormData) {
    startTransition(async () => {
      await addMilestone({
        projectId,
        milestoneType: String(formData.get('type')) as MilestoneNode['milestone_type'] as any,
        plannedStart: String(formData.get('plannedStart') || '') || undefined,
        plannedEnd: String(formData.get('plannedEnd') || '') || undefined,
        notes: String(formData.get('notes') || '') || undefined,
      });
      setShowAdd(false);
      router.refresh();
    });
  }

  function setStatus(id: string, status: MsStatus) {
    startTransition(async () => {
      await updateMilestoneStatus(id, projectId, status);
      router.refresh();
    });
  }

  const ordered = [...milestones].sort(
    (a, b) => STAGES.indexOf(a.milestone_type as any) - STAGES.indexOf(b.milestone_type as any)
  );

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4>Construction timeline</h4>
        <button onClick={() => setShowAdd((v) => !v)} className="btn-ghost text-xs">
          <Plus size={13} strokeWidth={1.75} /> Stage
        </button>
      </div>

      {showAdd && (
        <form action={submit} className="mb-4 grid grid-cols-2 gap-2">
          <select name="type" className="input col-span-2">
            {STAGES.map((s) => (
              <option key={s} value={s}>{STAGE_LABEL[s]}</option>
            ))}
          </select>
          <label className="text-xs text-charcoal-600/70">Planned start
            <input name="plannedStart" type="date" className="input mt-1" />
          </label>
          <label className="text-xs text-charcoal-600/70">Planned end
            <input name="plannedEnd" type="date" className="input mt-1" />
          </label>
          <input name="notes" placeholder="Notes" className="input col-span-2" />
          <button type="submit" disabled={isPending} className="btn-primary col-span-2">Add stage</button>
        </form>
      )}

      {ordered.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No milestones planned yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-stone-line pl-5">
          {ordered.map((m) => (
            <li key={m.id} className="relative">
              <span
                className={`absolute -left-[26px] top-1 h-2.5 w-2.5 rounded-full border-2 border-white ${
                  m.status === 'complete' ? 'bg-forest' : m.status === 'delayed' ? 'bg-signal-warning' : m.status === 'in_progress' ? 'bg-champagne' : 'bg-stone-line'
                }`}
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-charcoal">{STAGE_LABEL[m.milestone_type] ?? m.milestone_type}</p>
                <select
                  value={m.status}
                  disabled={isPending}
                  onChange={(e) => setStatus(m.id, e.target.value as MsStatus)}
                  className={`${STATUS_CLASS[m.status]} cursor-pointer border-none bg-transparent text-xs`}
                >
                  {MS_STATUS.map((s) => (
                    <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <p className="mt-0.5 text-xs text-charcoal-600/60">
                {m.planned_start ? formatDate(m.planned_start) : '—'}
                {' → '}
                {m.planned_end ? formatDate(m.planned_end) : '—'}
              </p>
              {m.notes && <p className="mt-1 text-xs text-charcoal-600/80">{m.notes}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
