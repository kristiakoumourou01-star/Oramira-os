'use client';

import { useState, useTransition } from 'react';
import { Undo2 } from 'lucide-react';
import { undoOrgSlice } from '@/app/actions/org-settings';

/** Shown next to «Αποθηκεύτηκε.»: puts the section back as it was before that save. */
export function UndoButton({ slice }: { slice: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const undo = () => start(async () => {
    const r = await undoOrgSlice(slice);
    if (r.ok) window.location.reload(); else setErr(r.error);
  });
  return (
    <>
      <button type="button" onClick={undo} disabled={pending} className="inline-flex items-center gap-1 text-sm text-forest underline-offset-2 hover:underline disabled:opacity-50">
        <Undo2 size={13} /> {pending ? 'Αναίρεση…' : 'Αναίρεση'}
      </button>
      {err && <span className="text-sm text-signal-danger">{err}</span>}
    </>
  );
}
