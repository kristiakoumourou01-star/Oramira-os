'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateProjectStatus } from '@/app/actions/projects';
import { PROJECT_STATUSES } from './NewProjectForm';

/** Inline project status selector — quiet, not a colorful dropdown of badges. */
export function ProjectStatusControl({ projectId, status, stages }: { projectId: string; status: string; stages?: { key: string; label: string }[] }) {
  const opts = stages?.length ? stages : PROJECT_STATUSES.map((k) => ({ key: k, label: k.replace(/_/g, ' ') }));
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
      {!opts.some((o) => o.key === status) && <option value={status}>{status.replace(/_/g, ' ')}</option>}
      {opts.map((o) => (
        <option key={o.key} value={o.key}>{o.label}</option>
      ))}
    </select>
  );
}
