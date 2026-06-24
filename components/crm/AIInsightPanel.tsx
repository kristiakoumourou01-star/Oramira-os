'use client';

import { useState, useTransition } from 'react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { runAIAnalysis } from '@/app/actions/leads';

/**
 * Surfaces the AI score, reasoning, summary, and recommended next steps for
 * a lead. Two distinct panels — summary answers "what's the situation",
 * next steps answers "what do I do about it" — deliberately not merged
 * into one paragraph, since a sales rep scans them differently.
 */
export function AIInsightPanel({
  leadId,
  score,
  reasoning,
  summary,
  nextSteps,
  generatedAt,
}: {
  leadId: string;
  score: number | null;
  reasoning: string | null;
  summary: string | null;
  nextSteps: string | null;
  generatedAt: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState({ score, reasoning, summary, nextSteps });

  function refresh() {
    startTransition(async () => {
      const result = await runAIAnalysis(leadId);
      if (result) {
        setState({
          score: result.score,
          reasoning: result.reasoning,
          summary: result.summary,
          nextSteps: result.next_steps,
        });
      }
    });
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-champagne-600" strokeWidth={1.75} />
          <h4>AI insight</h4>
        </div>
        <button onClick={refresh} disabled={isPending} className="btn-ghost text-xs">
          <RefreshCw size={13} className={isPending ? 'animate-spin' : ''} strokeWidth={1.75} />
          {isPending ? 'Analyzing…' : 'Refresh'}
        </button>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className="figure text-3xl text-forest">{state.score ?? '—'}</span>
        <div>
          <p className="eyebrow">Conversion score</p>
          <p className="text-xs text-charcoal-600/80">{state.reasoning ?? 'No analysis yet.'}</p>
        </div>
      </div>

      <div className="space-y-3 border-t border-stone-line pt-4">
        <div>
          <p className="eyebrow mb-1">Summary</p>
          <p className="text-sm text-charcoal">{state.summary ?? 'Run AI analysis to generate a summary.'}</p>
        </div>
        <div>
          <p className="eyebrow mb-1">Recommended next steps</p>
          <p className="text-sm text-charcoal">{state.nextSteps ?? '—'}</p>
        </div>
      </div>

      {generatedAt && (
        <p className="mt-4 text-xs text-charcoal-600/50">
          Last generated {new Date(generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
}
