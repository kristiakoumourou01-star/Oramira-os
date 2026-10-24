'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, Check, Loader2 } from 'lucide-react';
import { computeOffer, DEFAULT_OFFER_INPUTS, type OfferInputs } from '@/lib/offer-calculator';
import { saveOfferInputs } from '@/app/actions/acquisitions';
import { formatCurrency } from '@/lib/format';

const VERDICT = {
  excellent: { label: 'Excellent', cls: 'bg-signal-success/12 text-signal-success', bar: 'bg-signal-success' },
  acceptable: { label: 'Acceptable', cls: 'bg-signal-warning/12 text-signal-warning', bar: 'bg-signal-warning' },
  too_expensive: { label: 'Too expensive', cls: 'bg-signal-danger/12 text-signal-danger', bar: 'bg-signal-danger' },
} as const;

const FIELDS: { k: keyof OfferInputs; label: string; suffix?: string }[] = [
  { k: 'currentLandValue', label: 'Current land value', suffix: '€' },
  { k: 'gdv', label: 'Expected GDV', suffix: '€' },
  { k: 'constructionCost', label: 'Construction cost', suffix: '€' },
  { k: 'financeCost', label: 'Finance cost', suffix: '€' },
  { k: 'professionalFees', label: 'Professional fees', suffix: '€' },
  { k: 'marketingCost', label: 'Marketing cost', suffix: '€' },
  { k: 'contingency', label: 'Contingency', suffix: '€' },
  { k: 'developerProfitPct', label: 'Developer profit', suffix: '%' },
];

/** Residual land valuation — the maximum offer that still clears the target
 *  developer profit, with a green/amber/red verdict. */
export function OfferCalculator({ parcelId, initial }: { parcelId: string; initial: Partial<OfferInputs> | null }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [inp, setInp] = useState<OfferInputs>({ ...DEFAULT_OFFER_INPUTS, ...(initial ?? {}) });
  const r = useMemo(() => computeOffer(inp), [inp]);
  const v = VERDICT[r.verdict];

  const set = (k: keyof OfferInputs) => (e: any) => setInp({ ...inp, [k]: Number(e.target.value) || 0 });
  const save = () => start(async () => { await saveOfferInputs(parcelId, inp as any); setSaved(true); setTimeout(() => setSaved(false), 2500); router.refresh(); });

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-charcoal"><Calculator size={16} className="text-forest" strokeWidth={1.85} /> Offer calculator</h4>
        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${v.cls}`}>{v.label}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.k} className="block">
            <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-charcoal-600/55">{f.label}{f.suffix ? ` (${f.suffix})` : ''}</span>
            <input type="number" value={inp[f.k]} onChange={set(f.k)} className="w-full rounded-lg border border-stone-line bg-white px-2.5 py-1.5 text-sm focus-visible:border-forest focus-visible:outline-none" />
          </label>
        ))}
      </div>

      {/* Results */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[['Max offer', formatCurrency(r.maxOffer), 'text-forest'], ['Residual land', formatCurrency(r.residualLandValue), 'text-charcoal'], ['Profit', formatCurrency(r.profit), r.profit >= 0 ? 'text-signal-success' : 'text-signal-danger'], ['ROI', `${Math.round(r.roi)}%`, r.roi >= 15 ? 'text-signal-success' : 'text-charcoal']].map(([label, val, cls]) => (
          <div key={label} className="rounded-xl bg-sand-100/50 p-3 text-center">
            <p className={`figure text-lg leading-none ${cls}`}>{val}</p>
            <p className="mt-1 text-[10px] uppercase tracking-wide text-charcoal-600/50">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3">
        <div className="mb-1 flex justify-between text-[11px] text-charcoal-600/60"><span>Offer headroom vs. current value</span><span className="figure">{formatCurrency(r.offerMargin)}</span></div>
        <div className="h-1.5 w-full rounded-full bg-sand-100"><div className={`h-1.5 rounded-full ${v.bar}`} style={{ width: `${Math.max(3, Math.min(100, r.residualLandValue > 0 ? (inp.currentLandValue / r.residualLandValue) * 100 : 100))}%` }} /></div>
      </div>

      <button onClick={save} className="mt-4 flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white">{saved ? <><Check size={15} /> Saved</> : 'Save inputs'}</button>
    </div>
  );
}
