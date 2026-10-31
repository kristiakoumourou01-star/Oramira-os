'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setLeadPipeline } from '@/app/actions/leads';
import type { PipelineDef } from '@/lib/pipeline-shared';

/** Which pipeline this lead runs in (only shown when there is more than one). */
export function LeadPipelinePicker({ leadId, value, pipelines, defaultKey }: { leadId: string; value: string | null; pipelines: PipelineDef[]; defaultKey: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (pipelines.length < 2) return null;
  return (
    <select className="input w-auto py-1 text-xs" disabled={pending} value={value ?? defaultKey}
      onChange={(e) => start(async () => { await setLeadPipeline(leadId, e.target.value === defaultKey ? null : e.target.value); router.refresh(); })}
      title="Pipeline">
      {pipelines.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
    </select>
  );
}
