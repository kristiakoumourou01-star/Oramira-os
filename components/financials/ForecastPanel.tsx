import { eur } from '@/lib/deal-analyzer';
import { TrendingUp, ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import type { FinancialForecast } from '@/lib/financial-forecast';
import { formatNumber } from '@/lib/format';

const c = (n: number) => eur(n, { compact: true });

/** Πρόβλεψη ταμειακών ροών 30/60/90 ημερών: κάρτες καθαρής θέσης + αναλυτικός πίνακας με χρώμα (έσοδα πράσινα, έξοδα κόκκινα). */
export function ForecastPanel({ forecast }: { forecast: FinancialForecast }) {
  const rows: { label: string; get: (h: FinancialForecast['horizons'][number]) => string; kind: 'in' | 'out' }[] = [
    { label: 'Projected closings', get: (h) => `${h.projectedClosingsCount} · ${c(h.projectedClosingsValue)}`, kind: 'in' },
    { label: 'Scheduled receivables', get: (h) => c(h.receivables), kind: 'in' },
    { label: 'Projected commissions', get: (h) => c(h.projectedCommissions), kind: 'out' },
    { label: 'Payroll obligations', get: (h) => c(h.payroll), kind: 'out' },
    { label: 'Contractor obligations', get: (h) => c(h.contractor), kind: 'out' },
    { label: 'VAT exposure', get: (h) => c(h.vat), kind: 'out' },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-line px-5 py-4">
        <h4 className="flex items-center gap-2.5 text-[15px] font-semibold text-charcoal"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#b07d22] text-white"><TrendingUp size={15} /></span> Cashflow forecast</h4>
        <span className="rounded-full bg-forest/[0.07] px-3 py-1 text-xs text-forest">{forecast.activeReservations} active reservations · €{formatNumber(Math.round(forecast.monthlyPayroll))}/mo payroll</span>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-3">
        {forecast.horizons.map((h) => {
          const pos = h.net >= 0;
          return (
            <div key={h.days} className={`rounded-xl border p-4 ${pos ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white' : 'border-rose-200 bg-gradient-to-br from-rose-50 to-white'}`}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70">Net cashflow · next {h.days}d</p>
              <p className={`mt-2 flex items-center gap-1 font-display text-2xl ${pos ? 'text-emerald-700' : 'text-signal-danger'}`}>{pos ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}{c(h.net)}</p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="border-y border-stone-line bg-forest/[0.03] text-left text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70 [&_th]:px-5 [&_th]:py-2.5">
            <tr><th>Line</th>{forecast.horizons.map((h) => <th key={h.days} className="text-right">Next {h.days}d</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-stone-line/60 [&_td]:px-5 [&_td]:py-2.5">
            {rows.map((r) => (
              <tr key={r.label} className="hover:bg-forest/[0.02]">
                <td className="text-charcoal"><span className={`mr-2 inline-block h-2 w-2 rounded-full ${r.kind === 'in' ? 'bg-emerald-500' : 'bg-rose-400'}`} />{r.label}</td>
                {forecast.horizons.map((h) => <td key={h.days} className={`figure text-right ${r.kind === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>{r.get(h)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 border-t border-stone-line bg-[#faf8f4] px-5 py-3 text-[11px] text-charcoal-600/65">
        <Info size={13} className="mt-0.5 shrink-0 text-forest" />
        <span>{forecast.assumptions.join(' · ')}. Indicative planning figures, not an accounting forecast.</span>
      </div>
    </div>
  );
}
