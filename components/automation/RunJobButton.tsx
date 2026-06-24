'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Play } from 'lucide-react';
import { runJobManual } from '@/app/actions/automation';

/** "Run now" for a single automation job, with an inline result toast. */
export function RunJobButton({ jobKey }: { jobKey: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setResult(null);
    startTransition(async () => {
      const r = await runJobManual(jobKey);
      setResult(r.summary);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={run} disabled={isPending} className="btn-ghost text-xs">
        <Play size={12} strokeWidth={1.75} /> {isPending ? 'Running…' : 'Run now'}
      </button>
      {result && <span className="text-xs text-charcoal-600/70">{result}</span>}
    </div>
  );
}
