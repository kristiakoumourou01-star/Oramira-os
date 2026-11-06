'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, Truck, CheckCircle2, X } from 'lucide-react';
import { scheduleVisit, updateVisit } from '@/app/actions/contractor';
import { formatDateTime } from '@/lib/format';

export interface VisitItem {
  id: string;
  scheduled_for: string | null;
  completed_at: string | null;
  status: string;
  notes: string | null;
}

const STATUS_CLASS: Record<string, string> = {
  scheduled: 'badge-champagne',
  en_route: 'badge-champagne',
  completed: 'badge-forest',
  cancelled: 'badge-neutral',
  rescheduled: 'badge-neutral',
};

/**
 * Schedule a visit and manage the visit lifecycle for a job. Setting a date
 * notifies the homeowner; "On my way" pings them again; "Completed" closes the
 * visit out. The visit history doubles as the homeowner's arrival record.
 */
export function ScheduleVisitForm({
  ticketId,
  unitId,
  visits,
}: {
  ticketId: string;
  unitId: string;
  visits: VisitItem[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><CalendarClock size={15} className="text-olive" strokeWidth={1.75} /> Visits</h4>
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-xs">
          {open ? <X size={13} strokeWidth={1.75} /> : <CalendarClock size={13} strokeWidth={1.75} />} {open ? 'Cancel' : 'Schedule'}
        </button>
      </div>

      {open && (
        <form
          action={(formData) => {
            const when = String(formData.get('scheduledFor'));
            if (!when) return;
            run(() => scheduleVisit({ ticketId, unitId, scheduledFor: new Date(when).toISOString(), notes: String(formData.get('notes') || '') || undefined }));
          }}
          className="mb-4 space-y-2 border-b border-stone-line pb-4"
        >
          <input name="scheduledFor" type="datetime-local" required className="input" />
          <input name="notes" placeholder="Note for the homeowner (optional)" className="input" />
          <button type="submit" disabled={isPending} className="btn-primary w-full">Schedule visit</button>
        </form>
      )}

      {visits.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No visits scheduled yet.</p>
      ) : (
        <ul className="divide-y divide-stone-line">
          {visits.map((v) => {
            const active = v.status !== 'completed' && v.status !== 'cancelled';
            return (
              <li key={v.id} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="figure text-sm text-charcoal">
                    {v.scheduled_for ? formatDateTime(v.scheduled_for) : 'Time TBC'}
                  </p>
                  <span className={STATUS_CLASS[v.status] ?? 'badge-neutral'}>{v.status.replace(/_/g, ' ')}</span>
                </div>
                {v.notes && <p className="mt-1 text-xs text-charcoal-600/70">{v.notes}</p>}
                {active && (
                  <div className="mt-2 flex gap-2">
                    {v.status !== 'en_route' && (
                      <button onClick={() => run(() => updateVisit(v.id, ticketId, { status: 'en_route' }))} disabled={isPending} className="btn-ghost text-xs">
                        <Truck size={12} strokeWidth={1.75} /> On my way
                      </button>
                    )}
                    <button onClick={() => run(() => updateVisit(v.id, ticketId, { status: 'completed' }))} disabled={isPending} className="btn-ghost text-xs">
                      <CheckCircle2 size={12} strokeWidth={1.75} /> Completed
                    </button>
                    <button onClick={() => run(() => updateVisit(v.id, ticketId, { status: 'cancelled' }))} disabled={isPending} className="btn-ghost text-xs text-signal-danger">
                      Cancel
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
