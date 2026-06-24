'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Play, PackageOpen, Handshake } from 'lucide-react';
import { acceptJob, setJobStatus } from '@/app/actions/contractor';

/**
 * Contextual job status controls. Shows only the actions that make sense for
 * the current state — accept → start → (awaiting parts) → complete — so the
 * contractor always sees the one obvious next step, never a wall of buttons.
 */
export function JobStatusControl({ ticketId, status }: { ticketId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const terminal = status === 'resolved' || status === 'closed';
  if (terminal) {
    return (
      <p className="flex items-center gap-2 text-sm text-signal-success">
        <CheckCircle2 size={16} strokeWidth={1.75} /> Job completed
      </p>
    );
  }

  const canAccept = status === 'open' || status === 'reopened';
  const canStart = status === 'acknowledged' || status === 'awaiting_parts';
  const canComplete = status === 'in_progress' || status === 'awaiting_parts';

  return (
    <div className="flex flex-wrap gap-2">
      {canAccept && (
        <button onClick={() => run(() => acceptJob(ticketId))} disabled={isPending} className="btn-primary">
          <Handshake size={15} strokeWidth={1.75} /> Accept job
        </button>
      )}
      {canStart && (
        <button onClick={() => run(() => setJobStatus(ticketId, 'in_progress'))} disabled={isPending} className="btn-primary">
          <Play size={15} strokeWidth={1.75} /> Start work
        </button>
      )}
      {status === 'in_progress' && (
        <button onClick={() => run(() => setJobStatus(ticketId, 'awaiting_parts'))} disabled={isPending} className="btn-secondary">
          <PackageOpen size={15} strokeWidth={1.75} /> Awaiting parts
        </button>
      )}
      {canComplete && (
        <button onClick={() => run(() => setJobStatus(ticketId, 'resolved'))} disabled={isPending} className="btn-secondary">
          <CheckCircle2 size={15} strokeWidth={1.75} /> Mark completed
        </button>
      )}
    </div>
  );
}
