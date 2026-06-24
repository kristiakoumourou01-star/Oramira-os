'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightLeft, ExternalLink } from 'lucide-react';
import { convertDealToProject } from '@/app/actions/deals';

/**
 * Acquisitions → delivery handoff. Once a deal is approved/acquired, spin up a
 * real project from it; if already linked, jump straight to that project.
 */
export function ConvertToProjectButton({ dealId, projectId }: { dealId: string; projectId: string | null }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (projectId) {
    return (
      <button onClick={() => router.push(`/projects/${projectId}`)} className="btn-secondary">
        <ExternalLink size={15} strokeWidth={1.75} /> Open project
      </button>
    );
  }

  return (
    <button
      onClick={() => startTransition(async () => { const id = await convertDealToProject(dealId); router.push(`/projects/${id}`); })}
      disabled={isPending}
      className="btn-secondary"
    >
      <ArrowRightLeft size={15} strokeWidth={1.75} /> {isPending ? 'Creating project…' : 'Convert to project'}
    </button>
  );
}
