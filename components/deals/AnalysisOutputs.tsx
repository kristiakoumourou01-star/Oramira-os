import type { DealOutputs } from '@/lib/deal-analyzer';
import { eur, pct } from '@/lib/deal-analyzer';
import { formatNumber } from '@/lib/format';

function Metric({ label, value, accent, hint }: { label: string; value: string; accent?: boolean; hint?: string }) {
  return (
    <div className="rounded border border-stone-line p-4">
      <p className="eyebrow">{label}</p>
      <p className={`figure mt-1 text-xl ${accent ? 'text-champagne-600' : 'text-charcoal'}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[11px] text-charcoal-600/55">{hint}</p>}
    </div>
  );
}

/**
 * The computed read-out: development envelope, the full cost stack, the
 * headline returns, and a quarter-by-quarter cashflow. Minimal and
 * decision-focused — the three numbers that decide a deal (net profit, ROI,
 * margin) lead.
 */
export function AnalysisOutputs({ outputs }: { outputs: DealOutputs }) {
  const vatHint = outputs.exVat ? '+ VAT' : 'incl. VAT';
  const o = outputs;
  const maxAbs = Math.max(1, ...o.cashflow.map((p) => Math.abs(p.cumulative)));

  const costStack: { label: string; value: number }[] = [
    { label: 'Land', value: o.landAcquisitionCost },
    { label: 'Construction', value: o.constructionCost },
    { label: 'Contingency', value: o.contingency },
    { label: 'Professional fees', value: o.professionalFees },
    { label: 'Infrastructure', value: o.infrastructureCost },
    { label: 'Permits', value: o.permitCost },
    { label: 'Finance', value: o.financeCost },
    { label: 'Marketing', value: o.marketingCost },
  ];

  return (
    <div className="space-y-6">
      {/* Headline verdict */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-forest p-5 text-stone-100">
          <p className="text-[11px] uppercase tracking-eyebrow text-champagne">Net profit</p>
          <p className="figure mt-1 text-3xl">{eur(o.netProfit, { compact: true })}</p>
        </div>
        <div className="rounded-md bg-forest p-5 text-stone-100">
          <p className="text-[11px] uppercase tracking-eyebrow text-champagne">ROI</p>
          <p className="figure mt-1 text-3xl">{pct(o.roi)}</p>
        </div>
        <div className="rounded-md bg-forest p-5 text-stone-100">
          <p className="text-[11px] uppercase tracking-eyebrow text-champagne">Net margin</p>
          <p className="figure mt-1 text-3xl">{pct(o.profitMargin)}</p>
        </div>
      </div>

      <section className="panel p-6">
        <h4 className="mb-4">Development envelope</h4>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Buildable" value={`${formatNumber(Math.round(o.buildableSqm))} m²`} />
          <Metric label="Sellable" value={`${formatNumber(Math.round(o.sellableSqm))} m²`} />
          <Metric label="Constructed" value={`${formatNumber(Math.round(o.constructedSqm))} m²`} hint="cost basis" />
          <Metric label="Sold (unit mix)" value={`${formatNumber(Math.round(o.soldSqm))} m²`} />
          <Metric label="Estimated units" value={String(o.estimatedUnits)} />
          <Metric label="Effective price" value={`${eur(o.effectivePricePerSqm)}/m²`} hint={vatHint} />
          <Metric label="Break-even price" value={`${eur(o.breakEvenPricePerSqm)}/m²`} accent hint={vatHint} />
          <Metric label="Green area" value={`${formatNumber(Math.round(o.greenAreaSqm))} m²`} />
        </div>
      </section>

      <section className="panel p-6">
        <h4 className="mb-4">Financials</h4>
        <div className="grid grid-cols-3 gap-3">
          <Metric label="Gross revenue (GDV)" value={eur(o.grossRevenueInclVat, { compact: true })} hint={vatHint} />
          <Metric label="Net revenue" value={eur(o.netRevenue, { compact: true })} />
          <Metric label="Total dev cost" value={eur(o.totalDevelopmentCost, { compact: true })} />
          <Metric label="Gross profit" value={eur(o.grossProfit, { compact: true })} />
          <Metric label="Revenue / unit" value={eur(o.revenuePerUnit, { compact: true })} />
          <Metric label="Cost / built m²" value={`${eur(o.costPerBuildableSqm)}`} />
        </div>

        <div className="mt-5">
          <p className="eyebrow mb-2">Cost stack</p>
          <div className="space-y-1.5">
            {costStack.map((c) => {
              const w = Math.round((c.value / o.totalDevelopmentCost) * 100);
              return (
                <div key={c.label} className="flex items-center gap-3">
                  <span className="w-32 shrink-0 text-xs text-charcoal-600/70">{c.label}</span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand-100">
                    <div className="h-full rounded-full bg-forest/80" style={{ width: `${w}%` }} />
                  </div>
                  <span className="figure w-24 shrink-0 text-right text-xs text-charcoal">{eur(c.value, { compact: true })}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="panel p-6">
        <h4 className="mb-4">Cashflow projection</h4>
        <div className="overflow-x-auto">
          <table className="table-base w-full">
            <thead>
              <tr><th>Period</th><th>Outflow</th><th>Inflow</th><th>Net</th><th>Cumulative</th></tr>
            </thead>
            <tbody>
              {o.cashflow.map((p) => (
                <tr key={p.label}>
                  <td className="figure">{p.label}</td>
                  <td className="figure text-charcoal-600">{eur(p.outflow, { compact: true })}</td>
                  <td className="figure text-charcoal-600">{eur(p.inflow, { compact: true })}</td>
                  <td className={`figure ${p.net < 0 ? 'text-signal-danger' : 'text-signal-success'}`}>{eur(p.net, { compact: true })}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`figure w-20 ${p.cumulative < 0 ? 'text-signal-danger' : 'text-charcoal'}`}>{eur(p.cumulative, { compact: true })}</span>
                      <div className="relative h-1.5 flex-1 rounded-full bg-sand-100">
                        <div
                          className={`absolute top-0 h-full rounded-full ${p.cumulative < 0 ? 'bg-signal-danger/60' : 'bg-forest'}`}
                          style={{ width: `${(Math.abs(p.cumulative) / maxAbs) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
