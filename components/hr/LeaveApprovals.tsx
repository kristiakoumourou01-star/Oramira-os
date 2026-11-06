'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { decideLeave } from '@/app/actions/hr';
import { formatDate } from '@/lib/format';

export interface PendingLeave {
  id: string;
  employee: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  days: number | null;
  reason: string | null;
}

/** HR approves/rejects pending leave requests. */
export function LeaveApprovals({ requests }: { requests: PendingLeave[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function decide(id: string, decision: 'approved' | 'rejected') {
    startTransition(async () => { await decideLeave(id, decision); router.refresh(); });
  }

  if (requests.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No leave requests awaiting approval.</p>;
  }

  return (
    <ul className="divide-y divide-stone-line">
      {requests.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-3 py-3">
          <div>
            <p className="text-sm font-medium text-charcoal">{r.employee ?? 'Employee'} · <span className="capitalize text-charcoal-600">{r.leave_type}</span></p>
            <p className="text-xs text-charcoal-600/70">
              {formatDate(r.start_date)} → {formatDate(r.end_date)} · <span className="figure">{r.days ?? '—'}</span> day(s)
            </p>
            {r.reason && <p className="mt-0.5 text-xs text-charcoal-600/60">{r.reason}</p>}
          </div>
          <div className="flex gap-2">
            <button onClick={() => decide(r.id, 'approved')} disabled={isPending} className="btn-ghost text-xs text-signal-success"><Check size={13} strokeWidth={1.75} /> Approve</button>
            <button onClick={() => decide(r.id, 'rejected')} disabled={isPending} className="btn-ghost text-xs text-signal-danger"><X size={13} strokeWidth={1.75} /> Reject</button>
          </div>
        </li>
      ))}
    </ul>
  );
}
