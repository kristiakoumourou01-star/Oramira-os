'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { addInternalNote } from '@/app/actions/contractor';
import { formatDateTime } from '@/lib/format';

export interface JobNote {
  id: string;
  body: string;
  created_at: string;
}

/**
 * Internal job notes — private to the trade and Oramira staff (no homeowner
 * RLS policy exists on contractor_job_notes, by design). A quiet scratchpad
 * for the contractor's own working notes.
 */
export function InternalNotes({ ticketId, notes }: { ticketId: string; notes: JobNote[] }) {
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function add() {
    const body = draft.trim();
    if (!body) return;
    setDraft('');
    startTransition(async () => {
      await addInternalNote(ticketId, body);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <h4 className="mb-1 flex items-center gap-2"><Lock size={14} className="text-olive" strokeWidth={1.75} /> Internal notes</h4>
      <p className="mb-4 text-xs text-charcoal-600/60">Only visible to you and the Oramira team.</p>

      <div className="mb-4 flex gap-2">
        <input
          className="input"
          placeholder="Add a private note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button onClick={add} disabled={isPending} className="btn-secondary">Add</button>
      </div>

      {notes.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No internal notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded border border-stone-line bg-sand-100/40 p-3">
              <p className="text-sm text-charcoal">{n.body}</p>
              <p className="mt-1 text-xs text-charcoal-600/50">{formatDateTime(n.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
