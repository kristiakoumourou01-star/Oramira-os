'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, RotateCcw } from 'lucide-react';
import { setTicketStatusByOwner } from '@/app/actions/maintenance';

/** Lets the homeowner close a resolved ticket or reopen one that recurred. */
export function TicketOwnerActions({ ticketId, status }: { ticketId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const closed = status === 'closed';

  function set(next: 'closed' | 'reopened') {
    startTransition(async () => {
      await setTicketStatusByOwner(ticketId, next);
      router.refresh();
    });
  }

  if (closed) {
    return (
      <button onClick={() => set('reopened')} disabled={isPending} className="btn-secondary">
        <RotateCcw size={15} strokeWidth={1.75} /> Reopen ticket
      </button>
    );
  }

  return (
    <button onClick={() => set('closed')} disabled={isPending} className="btn-secondary">
      <CheckCircle2 size={15} strokeWidth={1.75} /> Close ticket
    </button>
  );
}
