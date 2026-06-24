import type { RiskBreakdown, SensitivityRow } from '@/lib/deal-analyzer';
import { eur, pct } from '@/lib/deal-analyzer';

function riskColor(v: number): string {
  if (v < 30) return 'bg-signal-success';
  if (v < 50) return 'bg-champagne';
  if (v < 70) return 'bg-signal-warning';
  return 'bg-signal-danger';
}

const bandClass: Record<string, string> = {
  Low: 'badge-forest',
  Moderate: 'badge-champagne',
  Elevated: 'border-signal-warning/30 bg-champagne-50 text-signal-warning badge',
  High: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
};

/**
 * Risk read-out: the four risk vectors as calibrated bars, plus a sensitivity
 * table showing how net profit / ROI swing under ±10% on the three variables
 * that move a development most — price, build cost, and land.
 */
export function RiskPanel({ risk, sensitivity }: { risk: RiskBreakdown; sensitivity: SensitivityRow[] }) {
  const rows: { label: string; value: number }[] = [
    { label: 'Market', value: risk.market },
    { label: 'Permit', value: risk.permit },
    { label: 'Construction', value: risk.construction },
    { label: 'Liquidity', value: risk.liquidity },
  ];

  return (
    <div className="grid grid-cols-2 gap-6">
      <section className="panel p-6">
        <div className="mb-4 flex items-center justify-between">
          <h4>Risk profile</h4>
          <span className={bandClass[risk.band] ?? 'badge-neutral'}>{risk.band} · {Math.round(risk.overall)}/100</span>
        </div>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-charcoal-600/80">{r.label}</span>
                <span className="figure text-charcoal-600/70">{Math.round(r.value)}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-sand-100">
                <div className={`h-full rounded-full ${riskColor(r.value)}`} style={{ width: `${r.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-6">
        <h4 className="mb-4">Sensitivity (±10%)</h4>
        <table className="table-base w-full">
          <thead>
            <tr><th>Variable</th><th>Downside</th><th>Base</th><th>Upside</th></tr>
          </thead>
          <tbody>
            {sensitivity.map((s) => (
              <tr key={s.variable}>
                <td className="text-charcoal">{s.variable}</td>
                <td className="figure text-signal-danger">{eur(s.downsideNetProfit, { compact: true })}<span className="ml-1 text-[10px] text-charcoal-600/50">{pct(s.downsideRoi, 0)}</span></td>
                <td className="figure text-charcoal-600">{eur(s.baseNetProfit, { compact: true })}</td>
                <td className="figure text-signal-success">{eur(s.upsideNetProfit, { compact: true })}<span className="ml-1 text-[10px] text-charcoal-600/50">{pct(s.upsideRoi, 0)}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-charcoal-600/55">Net profit under a 10% move in each variable, holding others constant.</p>
      </section>
    </div>
  );
}
