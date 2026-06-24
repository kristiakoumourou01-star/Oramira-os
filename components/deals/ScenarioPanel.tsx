'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Layers } from 'lucide-react';
import type { DealInputs, DealOutputs } from '@/lib/deal-analyzer';
import { eur, pct } from '@/lib/deal-analyzer';
import { saveScenario, deleteScenario } from '@/app/actions/deals';

export interface SavedScenario {
  id: string;
  name: string;
  computed_outputs: DealOutputs;
}

/**
 * Scenario builder. Snapshot the current assumptions as a named scenario, then
 * compare unit-mix / pricing / cost strategies side by side on the figures that
 * decide the deal. The live "Current" column is always the leftmost reference.
 */
export function ScenarioPanel({
  dealId,
  currentInputs,
  currentOutputs,
  scenarios,
}: {
  dealId: string;
  currentInputs: DealInputs;
  currentOutputs: DealOutputs;
  scenarios: SavedScenario[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    const name = window.prompt('Name this scenario (e.g. "Premium pricing", "More 1-beds")');
    if (!name) return;
    startTransition(async () => {
      await saveScenario(dealId, name, currentInputs);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      await deleteScenario(id, dealId);
      router.refresh();
    });
  }

  const columns = [
    { id: 'current', name: 'Current', o: currentOutputs, live: true },
    ...scenarios.map((s) => ({ id: s.id, name: s.name, o: s.computed_outputs, live: false })),
  ];

  const metrics: { label: string; fmt: (o: DealOutputs) => string }[] = [
    { label: 'Net profit', fmt: (o) => eur(o.netProfit, { compact: true }) },
    { label: 'ROI', fmt: (o) => pct(o.roi) },
    { label: 'Margin', fmt: (o) => pct(o.profitMargin) },
    { label: 'Units', fmt: (o) => String(o.estimatedUnits) },
    { label: 'GDV', fmt: (o) => eur(o.grossRevenueInclVat, { compact: true }) },
    { label: 'Risk', fmt: (o) => `${Math.round(o.risk.overall)}` },
  ];

  return (
    <section className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Layers size={15} className="text-olive" strokeWidth={1.75} /> Scenarios</h4>
        <button onClick={save} disabled={isPending} className="btn-ghost text-xs">
          <Plus size={13} strokeWidth={1.75} /> Save current
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="eyebrow border-b border-stone-line py-2 text-left"></th>
              {columns.map((c) => (
                <th key={c.id} className="border-b border-stone-line px-3 py-2 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-semibold ${c.live ? 'text-champagne-600' : 'text-charcoal'}`}>{c.name}</span>
                    {!c.live && (
                      <button onClick={() => remove(c.id)} disabled={isPending} className="text-charcoal-600/40 hover:text-signal-danger" aria-label="Delete scenario">
                        <Trash2 size={12} strokeWidth={1.75} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.label}>
                <td className="border-b border-stone-line py-2.5 text-xs text-charcoal-600/70">{m.label}</td>
                {columns.map((c) => (
                  <td key={c.id} className={`figure border-b border-stone-line px-3 py-2.5 ${c.live ? 'text-champagne-600' : 'text-charcoal'}`}>
                    {m.fmt(c.o)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {scenarios.length === 0 && (
        <p className="mt-3 text-xs text-charcoal-600/60">Save the current assumptions as a scenario, then change the inputs and save another to compare strategies side by side.</p>
      )}
    </section>
  );
}
