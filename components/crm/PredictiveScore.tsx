import { Brain, TrendingUp, Zap, AlertTriangle } from 'lucide-react';
import type { LeadScore } from '@/lib/lead-scoring';

const bar = (v: number, tone: string) => (
  <div className="h-1.5 w-full rounded-full bg-sand-100">
    <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${Math.max(3, v)}%` }} />
  </div>
);

/** Predictive lead score — probability / urgency / risk + the recommended
 *  next action. Read-only; complements the AI insight + sales coach panels. */
export function PredictiveScore({ score }: { score: LeadScore }) {
  const tier = score.score >= 60 ? 'text-forest' : score.score >= 30 ? 'text-champagne-600' : 'text-charcoal-600/70';
  const metrics = [
    { label: 'Convert probability', value: score.convertProbability, icon: TrendingUp, tone: 'bg-forest', text: 'text-forest' },
    { label: 'Urgency to contact', value: score.urgency, icon: Zap, tone: 'bg-champagne-500', text: 'text-champagne-600' },
    { label: 'Risk of losing', value: score.risk, icon: AlertTriangle, tone: 'bg-signal-danger', text: 'text-signal-danger' },
  ];

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Brain size={15} className="text-champagne-600" strokeWidth={1.8} /> Predictive score</h4>
        <span className={`figure text-3xl leading-none ${tier}`}>{score.score}</span>
      </div>

      <div className="space-y-3">
        {metrics.map((m) => (
          <div key={m.label}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-charcoal-600/70"><m.icon size={12} strokeWidth={1.8} /> {m.label}</span>
              <span className={`figure ${m.text}`}>{m.value}</span>
            </div>
            {bar(m.value, m.tone)}
          </div>
        ))}
      </div>

      {score.drivers.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {score.drivers.map((d) => <span key={d} className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] text-charcoal-600/70">{d}</span>)}
        </div>
      )}
    </div>
  );
}
