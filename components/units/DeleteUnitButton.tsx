'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteUnit } from '@/app/actions/project-flow';

/** Διαγραφή μονάδας (με επιβεβαίωση). Αν έχει ιστορικό πώλησης, εξηγεί γιατί δεν γίνεται. */
export function DeleteUnitButton({ unitId, projectId, onDone, compact = false }: { unitId: string; projectId: string; onDone?: () => void; compact?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const click = () => {
    if (!confirm('Να διαγραφεί οριστικά αυτή η μονάδα;')) return;
    start(async () => {
      const r = await deleteUnit(projectId, unitId);
      if (!r.ok) { alert(r.error); return; }
      if (onDone) { onDone(); router.refresh(); } else router.push(`/projects/${projectId}`);
    });
  };
  if (compact) return <button type="button" onClick={click} disabled={pending} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-rose-50 hover:text-signal-danger disabled:opacity-40"><Trash2 size={15} /></button>;
  return <button type="button" onClick={click} disabled={pending} className="btn-ghost text-sm text-signal-danger"><Trash2 size={14} /> Διαγραφή</button>;
}
