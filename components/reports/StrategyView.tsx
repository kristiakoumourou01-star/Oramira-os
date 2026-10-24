import { Compass } from 'lucide-react';
import type { StrategicPlan } from '@/lib/strategic-planning';

const SEV: Record<string, string> = { high: 'border-signal-danger/30 bg-signal-danger/5', medium: 'border-champagne/30 bg-champagne-50/50', low: 'border-stone-line bg-white' };
const CHIP: Record<string, string> = { high: 'bg-signal-danger/10 text-signal-danger', medium: 'bg-champagne-50 text-champagne-600', low: 'bg-forest/10 text-forest' };

/** Quarterly strategic plan — findings + recommended actions per area. */
export function StrategyView({ plan }: { plan: StrategicPlan }) {
  return (
    <div className="space-y-5">
      <div className="panel flex items-start gap-3 p-6">
        <Compass size={20} className="mt-0.5 shrink-0 text-champagne-600" strokeWidth={1.8} />
        <div>
          <h3 className="text-lg text-charcoal">Strategic plan · {plan.quarter}</h3>
          <p className="mt-1 text-sm text-charcoal-600/80">{plan.summary}</p>
        </div>
      </div>

      {plan.items.length === 0 ? (
        <div className="panel p-6 text-sm text-charcoal-600/70">No structural gaps detected — the business is within healthy thresholds this quarter.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plan.items.map((it, i) => (
            <div key={i} className={`rounded-xl border p-4 ${SEV[it.severity]}`}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-forest">{it.area}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${CHIP[it.severity]}`}>{it.severity}</span>
              </div>
              <p className="mb-2 text-sm text-charcoal-600/85">{it.finding}</p>
              <p className="text-sm text-charcoal"><span className="font-medium text-forest">→ </span>{it.recommendation}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
