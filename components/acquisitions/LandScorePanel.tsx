import { Gauge, TrendingUp } from 'lucide-react';
import type { ParcelScore, UpliftEstimate } from '@/lib/land-scoring';
import { formatCurrency } from '@/lib/format';

const BAND: Record<string, string> = { Prime: 'text-forest', Strong: 'text-forest', Moderate: 'text-champagne-600', Weak: 'text-charcoal-600/70' };
const barTone = (v: number) => (v >= 70 ? 'bg-forest' : v >= 45 ? 'bg-champagne-500' : 'bg-signal-danger');

/** Land score breakdown + planning-uplift/margin. Read-only. */
export function LandScorePanel({ score, uplift }: { score: ParcelScore; uplift: UpliftEstimate | null }) {
  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-charcoal"><Gauge size={16} className="text-forest" strokeWidth={1.85} /> Land score</h4>
        <div className="text-right"><span className={`figure text-3xl leading-none ${BAND[score.band]}`}>{score.score}</span><p className={`text-[11px] font-medium uppercase tracking-wide ${BAND[score.band]}`}>{score.band}</p></div>
      </div>

      <div className="space-y-2.5">
        {score.factors.map((f) => (
          <div key={f.label}>
            <div className="mb-1 flex items-center justify-between text-xs"><span className="text-charcoal-600/70">{f.label}</span><span className="figure text-charcoal-600/80">{f.value}</span></div>
            <div className="h-1.5 w-full rounded-full bg-sand-100"><div className={`h-1.5 rounded-full ${barTone(f.value)}`} style={{ width: `${Math.max(3, f.value)}%` }} /></div>
          </div>
        ))}
      </div>

      {score.drivers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {score.drivers.map((d) => <span key={d} className={`rounded px-1.5 py-0.5 text-[10px] ${d.startsWith('⚠') ? 'bg-signal-danger/10 text-signal-danger' : 'bg-forest/8 text-forest'}`}>{d}</span>)}
        </div>
      )}

      {uplift && (
        <div className="mt-4 rounded-xl border border-champagne/30 bg-champagne-50/50 p-3">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-forest"><TrendingUp size={13} /> Planning uplift {uplift.estimated && <span className="font-normal text-charcoal-600/50">(modelled)</span>}</p>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div><p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">Current</p><p className="figure text-sm text-charcoal">{formatCurrency(uplift.current)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">Post-planning</p><p className="figure text-sm text-forest">{formatCurrency(uplift.post)}</p></div>
            <div><p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">Margin</p><p className="figure text-sm text-champagne-600">{formatCurrency(uplift.marginAbs)}</p></div>
          </div>
          <p className="mt-2 text-center text-[11px] text-charcoal-600/60">{uplift.multiple.toFixed(1)}× uplift · {Math.round(uplift.marginPct)}% margin potential</p>
        </div>
      )}
    </div>
  );
}
