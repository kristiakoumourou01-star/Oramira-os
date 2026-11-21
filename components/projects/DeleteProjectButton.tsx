'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { deleteProject } from '@/app/actions/project-flow';

/** Διαγραφή έργου (με επιβεβαίωση) — επιστρέφει στη λίστα έργων. */
export function DeleteProjectButton({ projectId, name }: { projectId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="btn-ghost text-sm text-signal-danger"
      onClick={() => {
        if (!confirm(`Να διαγραφεί οριστικά το έργο «${name}» με όλες τις μονάδες του;`)) return;
        start(async () => { const r = await deleteProject(projectId); if (!r.ok) { alert(r.error); return; } router.push('/projects'); router.refresh(); });
      }}>
      <Trash2 size={14} /> {pending ? 'Διαγραφή…' : 'Διαγραφή'}
    </button>
  );
}
