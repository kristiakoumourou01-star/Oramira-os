import Link from 'next/link';
import { Clock, Zap } from 'lucide-react';

/**
 * Golden Window widget — the speed-to-lead KPI. Buckets every new lead with no
 * first response into the four response-time tiers so the team can see, at a
 * glance, which leads are still inside the optimal window and which are slipping.
 */
export interface PendingLead {
  id: string;
  name: string;
  minutesWaiting: number;
}

const TIERS = [
  { key: 'optimal', label: '0–5 min', sub: 'Optimal', max: 5, ring: 'border-signal-success/40 bg-signal-success/5', dot: 'bg-signal-success', text: 'text-signal-success' },
  { key: 'good', label: '5–30 min', sub: 'Good', max: 30, ring: 'border-champagne/50 bg-champagne-50', dot: 'bg-champagne-600', text: 'text-champagne-600' },
  { key: 'declining', label: '30 min–24h', sub: 'Declining', max: 1440, ring: 'border-signal-warning/40 bg-signal-warning/5', dot: 'bg-signal-warning', text: 'text-signal-warning' },
  { key: 'recovery', label: '24h+', sub: 'Recovery', max: Infinity, ring: 'border-signal-danger/40 bg-signal-danger/5', dot: 'bg-signal-danger', text: 'text-signal-danger' },
] as const;

function tierOf(mins: number) {
  return TIERS.find((t) => mins <= t.max) ?? TIERS[TIERS.length - 1];
}

function waitLabel(mins: number): string {
  if (mins < 60) return `${mins}m`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h`;
  return `${Math.floor(mins / 1440)}d`;
}

export function SpeedToLeadWidget({ leads }: { leads: PendingLead[] }) {
  const buckets = TIERS.map((t) => ({ tier: t, items: leads.filter((l) => tierOf(l.minutesWaiting).key === t.key) }));

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Zap size={15} className="text-champagne-600" strokeWidth={1.75} /> Golden Window — speed to lead</h4>
        <span className="text-xs text-charcoal-600/60">{leads.length} awaiting first response</span>
      </div>

      {leads.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-signal-success"><Clock size={14} strokeWidth={1.75} /> Every new lead has had a first response. 🎉</p>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {buckets.map(({ tier, items }) => (
            <div key={tier.key} className={`rounded-md border p-3 ${tier.ring}`}>
              <div className="mb-2 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${tier.dot} ${tier.key === 'recovery' && items.length > 0 ? 'animate-pulse' : ''}`} />
                <p className="text-xs font-medium text-charcoal">{tier.label}</p>
              </div>
              <p className={`figure text-2xl font-semibold ${tier.text}`}>{items.length}</p>
              <p className="mb-2 text-[10px] uppercase tracking-wide text-charcoal-600/50">{tier.sub}</p>
              <ul className="space-y-1">
                {items.slice(0, 4).map((l) => (
                  <li key={l.id}>
                    <Link href={`/crm/leads/${l.id}`} className="flex items-center justify-between text-[11px] text-charcoal-600 hover:text-forest">
                      <span className="truncate">{l.name}</span>
                      <span className="figure ml-1 shrink-0 text-charcoal-600/60">{waitLabel(l.minutesWaiting)}</span>
                    </Link>
                  </li>
                ))}
                {items.length > 4 && <li className="text-[10px] text-charcoal-600/50">+{items.length - 4} more</li>}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
