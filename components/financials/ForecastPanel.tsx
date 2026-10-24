import { eur } from '@/lib/deal-analyzer';
import { TrendingUp, ArrowDownRight, ArrowUpRight, Info } from 'lucide-react';
import type { FinancialForecast } from '@/lib/financial-forecast';
import { formatNumber } from '@/lib/format';

const c = (n: number) => eur(n, { compact: true });

/** Forward-looking cashflow forecast — 30/60/90 day horizons across projected
 *  closings, receivables, payroll, contractor, VAT and net position. */
export function ForecastPanel({ forecast }: { forecast: FinancialForecast }) {
  const rows: { label: string; get: (h: FinancialForecast['horizons'][number]) => string; tone?: string }[] = [
    { label: 'Projected closings', get: (h) => `${h.projectedClosingsCount} · ${c(h.projectedClosingsValue)}` },
    { label: 'Scheduled receivables', get: (h) => c(h.receivables) },
    { label: 'Projected commissions', get: (h) => c(h.projectedCommissions), tone: 'text-charcoal-600' },
    { label: 'Payroll obligations', get: (h) => c(h.payroll), tone: 'text-charcoal-600' },
    { label: 'Contractor obligations', get: (h) => c(h.contractor), tone: 'text-charcoal-600' },
    { label: 'VAT exposure', get: (h) => c(h.vat), tone: 'text-charcoal-600' },
  ];

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-stone-line px-6 py-4">
        <h4 className="flex items-center gap-2"><TrendingUp size={16} className="text-champagne-600" strokeWidth={1.8} /> Cashflow forecast</h4>
        <span className="text-xs text-charcoal-600/50">{forecast.activeReservations} active reservations · €{formatNumber(Math.round(forecast.monthlyPayroll))}/mo payroll</span>
      </div>

      <table className="table-base w-full">
        <thead>
          <tr><th>Line</th>{forecast.horizons.map((h) => <th key={h.days} className="text-right">Next {h.days}d</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="text-charcoal-600/80">{r.label}</td>
              {forecast.horizons.map((h) => <td key={h.days} className={`figure text-right ${r.tone ?? 'text-charcoal'}`}>{r.get(h)}</td>)}
            </tr>
          ))}
          <tr className="border-t-2 border-stone-line">
            <td className="font-medium text-charcoal">Net cashflow</td>
            {forecast.horizons.map((h) => (
              <td key={h.days} className={`figure text-right font-medium ${h.net >= 0 ? 'text-signal-success' : 'text-signal-danger'}`}>
                <span className="inline-flex items-center gap-1">{h.net >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{c(h.net)}</span>
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <div className="flex items-start gap-2 border-t border-stone-line px-6 py-3 text-[11px] text-charcoal-600/55">
        <Info size={13} className="mt-0.5 shrink-0" />
        <span>{forecast.assumptions.join(' · ')}. Indicative planning figures, not an accounting forecast.</span>
      </div>
    </div>
  );
}
