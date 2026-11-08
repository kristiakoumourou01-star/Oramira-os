'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { DealInputs, UnitMixRow } from '@/lib/deal-analyzer';

/**
 * Deal input panel. Pure controlled inputs — every change bubbles up via
 * onChange and the parent recomputes the whole model live. Grouped Land →
 * Development → Financial to mirror how an acquisition is actually assessed.
 */
export function InputsForm({
  inputs,
  onChange,
}: {
  inputs: DealInputs;
  onChange: (patch: Partial<DealInputs>) => void;
}) {
  const num = (key: keyof DealInputs, label: string, opts: { step?: number; suffix?: string } = {}) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <div className="relative mt-1">
        <input
          type="number"
          step={opts.step ?? 'any'}
          value={Number(inputs[key] as number)}
          onChange={(e) => onChange({ [key]: Number(e.target.value) } as Partial<DealInputs>)}
          className="input figure pr-10"
        />
        {opts.suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-charcoal-600/50">{opts.suffix}</span>}
      </div>
    </label>
  );

  const text = (key: keyof DealInputs, label: string) => (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        value={String(inputs[key] as string)}
        onChange={(e) => onChange({ [key]: e.target.value } as Partial<DealInputs>)}
        className="input mt-1"
      />
    </label>
  );

  function updateMix(idx: number, patch: Partial<UnitMixRow>) {
    onChange({ unitMix: inputs.unitMix.map((u, i) => (i === idx ? { ...u, ...patch } : u)) });
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6">
        <h4 className="mb-4">Land</h4>
        <div className="grid grid-cols-2 gap-3">
          {num('plotSizeSqm', 'Plot size', { suffix: 'm²' })}
          {text('zone', 'Zoning')}
          {num('buildingDensity', 'Building density', { step: 0.1 })}
          {num('coverageRatio', 'Coverage', { step: 0.05 })}
          {num('floorsAllowed', 'Floors allowed')}
          {num('heightM', 'Height limit', { suffix: 'm' })}
          {num('greenAreaPct', 'Green area', { step: 0.05, suffix: '×' })}
          {text('roadAccess', 'Road access')}
        </div>
        <label className="mt-3 block">
          <span className="eyebrow">Planning restrictions</span>
          <textarea
            value={inputs.planningRestrictions}
            onChange={(e) => onChange({ planningRestrictions: e.target.value })}
            placeholder="Setbacks, conservation, archaeological, easements…"
            className="input mt-1 min-h-[56px]"
          />
        </label>
      </section>

      <section className="panel p-6">
        <h4 className="mb-4">Development</h4>
        <div className="grid grid-cols-2 gap-3">
          {num('efficiencyRatio', 'Sellable efficiency', { step: 0.01 })}
          {num('avgUnitSqm', 'Avg unit size', { suffix: 'm²' })}
          {num('constructionCostPerSqm', 'Construction cost', { suffix: '€/m²' })}
          {num('infrastructureCost', 'Infrastructure cost', { suffix: '€' })}
          {num('permitCost', 'Permit cost', { suffix: '€' })}
          {num('professionalFeesRate', 'Professional fees', { step: 0.01, suffix: '×constr' })}
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="eyebrow">Ideal unit mix</span>
            <button
              onClick={() => onChange({ unitMix: [...inputs.unitMix, { type: '', count: 1, avgSqm: 85, pricePerSqm: inputs.salePricePerSqm }] })}
              className="btn-ghost text-xs"
            >
              <Plus size={12} strokeWidth={1.75} /> Add type
            </button>
          </div>
          {inputs.unitMix.length === 0 ? (
            <p className="text-xs text-charcoal-600/60">No explicit mix — units & revenue derive from avg unit size and blended price below.</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-[1fr_56px_72px_84px_auto] gap-2 px-1 text-[10px] uppercase tracking-eyebrow text-charcoal-600/50">
                <span>Type</span><span>Count</span><span>m²</span><span>€/m²</span><span></span>
              </div>
              {inputs.unitMix.map((u, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_56px_72px_84px_auto] gap-2">
                  <input value={u.type} onChange={(e) => updateMix(idx, { type: e.target.value })} placeholder="2-bed" className="input" />
                  <input value={u.count} onChange={(e) => updateMix(idx, { count: Number(e.target.value) })} type="number" className="input figure" />
                  <input value={u.avgSqm} onChange={(e) => updateMix(idx, { avgSqm: Number(e.target.value) })} type="number" className="input figure" />
                  <input value={u.pricePerSqm} onChange={(e) => updateMix(idx, { pricePerSqm: Number(e.target.value) })} type="number" className="input figure" />
                  <button onClick={() => onChange({ unitMix: inputs.unitMix.filter((_, i) => i !== idx) })} className="text-charcoal-600/50 hover:text-signal-danger" aria-label="Remove">
                    <Trash2 size={15} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="panel p-6">
        <h4 className="mb-4">Financial</h4>
        <div className="grid grid-cols-2 gap-3">
          {num('landAcquisitionCost', 'Land acquisition', { suffix: '€' })}
          {num('salePricePerSqm', 'Blended sale price', { suffix: '€/m²' })}
          {num('financeCost', 'Finance cost', { suffix: '€' })}
          {num('marketingRate', 'Marketing', { step: 0.005, suffix: '×rev' })}
          {num('contingencyRate', 'Contingency', { step: 0.01, suffix: '×constr' })}
          {num('vatRate', 'VAT rate', { step: 0.01 })}
          <label className="col-span-2 flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={!!inputs.pricesExVat} onChange={(e) => onChange({ pricesExVat: e.target.checked })} />
            Οι τιμές πώλησης είναι <b>+ ΦΠΑ</b> (π.χ. «€3.500/m² + ΦΠΑ»)
          </label>
          {num('durationMonths', 'Duration', { suffix: 'mo' })}
        </div>
      </section>
    </div>
  );
}
