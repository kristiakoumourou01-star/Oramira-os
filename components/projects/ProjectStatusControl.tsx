'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProjectStatus } from '@/app/actions/projects';
import { PROJECT_STATUSES } from './NewProjectForm';

/** Inline project status selector — quiet, not a colorful dropdown of badges. */
export function ProjectStatusControl({ projectId, status }: { projectId: string; status: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <select
      value={status}
      disabled={isPending}
      onChange={(e) => {
        const next = e.target.value;
        startTransition(async () => {
          await updateProjectStatus(projectId, next);
          router.refresh();
        });
      }}
      className="input max-w-[200px] capitalize"
    >
      {PROJECT_STATUSES.map((s) => (
        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
      ))}
    </select>
  );
}
