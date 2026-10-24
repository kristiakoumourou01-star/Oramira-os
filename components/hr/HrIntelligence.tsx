import { AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import type { HrAlert, AlertSeverity } from '@/lib/hr-intelligence';

const SEV: Record<AlertSeverity, { ring: string; chip: string; icon: any }> = {
  high: { ring: 'border-signal-danger/30 bg-signal-danger/5', chip: 'bg-signal-danger/10 text-signal-danger', icon: ShieldAlert },
  medium: { ring: 'border-champagne/30 bg-champagne-50/60', chip: 'bg-champagne-50 text-champagne-600', icon: AlertTriangle },
  low: { ring: 'border-stone-line bg-white', chip: 'bg-forest/10 text-forest', icon: Info },
};

/** Read-only intelligence panel: grouped risk & anomaly alerts across HR. */
export function HrIntelligence({ alerts }: { alerts: HrAlert[] }) {
  if (alerts.length === 0) {
    return <div className="panel p-6 text-sm text-charcoal-600/70">No anomalies detected — contracts, payroll, leave and commissions all look consistent.</div>;
  }
  const high = alerts.filter((a) => a.severity === 'high').length;
  const medium = alerts.filter((a) => a.severity === 'medium').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-3 text-sm">
        <span className="rounded-lg bg-signal-danger/10 px-3 py-1.5 text-signal-danger"><span className="figure font-semibold">{high}</span> high</span>
        <span className="rounded-lg bg-champagne-50 px-3 py-1.5 text-champagne-600"><span className="figure font-semibold">{medium}</span> medium</span>
        <span className="rounded-lg bg-forest/10 px-3 py-1.5 text-forest"><span className="figure font-semibold">{alerts.length - high - medium}</span> low</span>
      </div>
      <ul className="space-y-2">
        {alerts.map((a) => {
          const s = SEV[a.severity];
          return (
            <li key={a.id} className={`flex items-start gap-3 rounded-xl border p-3.5 ${s.ring}`}>
              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${s.chip}`}><s.icon size={15} strokeWidth={1.85} /></span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-charcoal">{a.employee}</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${s.chip}`}>{a.category}</span>
                </div>
                <p className="mt-0.5 text-sm text-charcoal-600/80">{a.message}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
