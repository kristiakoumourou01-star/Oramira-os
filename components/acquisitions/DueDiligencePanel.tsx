'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShieldCheck } from 'lucide-react';
import { DD_CHECKS } from '@/lib/due-diligence';
import type { DDSummary } from '@/lib/due-diligence';
import { setDueDiligence } from '@/app/actions/acquisitions';

/** Due-diligence checklist with completion + mandatory gate for Acquired. */
export function DueDiligencePanel({ parcelId, dd }: { parcelId: string; dd: DDSummary }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [local, setLocal] = useState<Record<string, boolean>>(Object.fromEntries(dd.items.map((i) => [i.key, i.done])));

  const done = DD_CHECKS.filter((c) => local[c.key]).length;
  const pct = Math.round((done / DD_CHECKS.length) * 100);
  const mandatoryComplete = DD_CHECKS.filter((c) => c.mandatory).every((c) => local[c.key]);

  const toggle = (key: string) => { const next = !local[key]; setLocal((l) => ({ ...l, [key]: next })); start(async () => { await setDueDiligence(parcelId, key, next); router.refresh(); }); };

  return (
    <div className="panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-charcoal"><ShieldCheck size={16} className="text-forest" strokeWidth={1.85} /> Due diligence</h4>
        <span className={`figure text-sm font-semibold ${pct === 100 ? 'text-forest' : 'text-charcoal-600/70'}`}>{pct}%</span>
      </div>
      <div className="mb-4 h-1.5 w-full rounded-full bg-sand-100"><div className={`h-1.5 rounded-full transition-all ${mandatoryComplete ? 'bg-forest' : 'bg-champagne-500'}`} style={{ width: `${Math.max(3, pct)}%` }} /></div>

      <ul className="grid gap-1.5 sm:grid-cols-2">
        {DD_CHECKS.map((c) => {
          const on = !!local[c.key];
          return (
            <li key={c.key}>
              <button onClick={() => toggle(c.key)} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1.5 text-left text-sm transition-colors hover:bg-sand-100/60">
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-[#D8CDBA] text-transparent'}`}><Check size={11} strokeWidth={3} /></span>
                <span className={on ? 'text-charcoal' : 'text-charcoal-600/75'}>{c.label}</span>
                {c.mandatory && <span className="ml-auto text-[9px] uppercase tracking-wide text-champagne-600/70">req</span>}
              </button>
            </li>
          );
        })}
      </ul>

      {!mandatoryComplete && (
        <p className="mt-3 rounded-lg bg-champagne-50/60 px-3 py-2 text-[11px] text-charcoal-600/70">Mandatory checks (Ownership, Title, Planning, Valuation) must be complete before this parcel can move to <span className="font-medium text-forest">Acquired</span>.</p>
      )}
    </div>
  );
}
