'use client';

import { useState, useTransition } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, Flag, Target, Tag } from 'lucide-react';
import { runDealAI } from '@/app/actions/deals';
import type { DealAdvisory } from '@/lib/ai';

/**
 * AI advisory layer — the acquisitions analyst's read on the deal. Generated on
 * demand from the saved model; until run, it invites the analyst to generate
 * one. Save the deal before generating so the advisory reflects current inputs.
 */
export function AIAdvisoryPanel({
  dealId,
  initial,
  generatedAt,
}: {
  dealId: string;
  initial: DealAdvisory | null;
  generatedAt: string | null;
}) {
  const [advisory, setAdvisory] = useState<DealAdvisory | null>(initial);
  const [stamp, setStamp] = useState<string | null>(generatedAt);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const result = await runDealAI(dealId);
      setAdvisory(result);
      setStamp(new Date().toISOString());
    });
  }

  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Sparkles size={15} className="text-champagne-600" strokeWidth={1.75} /> AI advisory</h4>
        <button onClick={generate} disabled={isPending} className="btn-secondary text-xs">
          {isPending ? 'Analysing…' : advisory ? 'Refresh' : 'Generate advisory'}
        </button>
      </div>

      {!advisory ? (
        <p className="text-sm text-charcoal-600/70">
          Generate a strategic read on this deal — verdict, strengths, weaknesses, red flags, and a recommended approach.
          Save your inputs first so the advisory reflects them.
        </p>
      ) : (
        <div className="space-y-5">
          <p className="text-sm leading-relaxed text-charcoal">{advisory.summary}</p>

          <div className="grid grid-cols-2 gap-5">
            <List icon={CheckCircle2} tone="text-signal-success" title="Strengths" items={advisory.strengths} />
            <List icon={AlertTriangle} tone="text-signal-warning" title="Weaknesses" items={advisory.weaknesses} />
          </div>

          {advisory.red_flags.length > 0 && (
            <div className="rounded border border-signal-danger/20 bg-champagne-50/50 p-4">
              <List icon={Flag} tone="text-signal-danger" title="Red flags" items={advisory.red_flags} />
            </div>
          )}

          <div className="grid grid-cols-2 gap-5 border-t border-stone-line pt-4">
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5"><Target size={12} strokeWidth={1.75} /> Recommended strategy</p>
              <p className="text-sm text-charcoal-600/85">{advisory.recommended_strategy}</p>
            </div>
            <div>
              <p className="eyebrow mb-1 flex items-center gap-1.5"><Tag size={12} strokeWidth={1.75} /> Suggested pricing</p>
              <p className="text-sm text-charcoal-600/85">{advisory.suggested_pricing}</p>
            </div>
          </div>

          {stamp && <p className="text-[11px] text-charcoal-600/45">Generated {new Date(stamp).toLocaleString()}</p>}
        </div>
      )}
    </section>
  );
}

function List({ icon: Icon, tone, title, items }: { icon: typeof CheckCircle2; tone: string; title: string; items: string[] }) {
  return (
    <div>
      <p className="eyebrow mb-2 flex items-center gap-1.5"><Icon size={12} className={tone} strokeWidth={1.75} /> {title}</p>
      {items.length === 0 ? (
        <p className="text-xs text-charcoal-600/55">None noted.</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-sm text-charcoal-600/85">
              <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${tone.replace('text-', 'bg-')}`} />
              {it}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
