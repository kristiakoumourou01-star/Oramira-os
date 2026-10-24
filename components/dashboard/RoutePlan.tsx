import Link from 'next/link';
import { Route, Car, MapPin, Clock, Sparkles, AlertTriangle } from 'lucide-react';
import type { RoutePlan as RoutePlanData } from '@/lib/route-planner';
import { formatTime } from '@/lib/format';

const fmtDur = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60 ? `${m % 60}m` : ''}`.trim());
const LEG_TONE = { ok: 'text-charcoal-600/50', tight: 'text-champagne-600', conflict: 'text-signal-danger' } as const;

/**
 * Today's viewing route — estimated driving between stops, tight-gap warnings,
 * a location-clustered reorder suggestion, and bookable windows. Sits under the
 * planner; travel times are heuristic (town-to-town), not GPS.
 */
export function RoutePlan({ plan, embedded = false }: { plan: RoutePlanData; embedded?: boolean }) {
  if (plan.stops.length === 0) {
    if (!embedded) return null; // nothing to route today
    return <div className="flex flex-col items-center py-10 text-center"><span className="mb-2 flex h-10 w-10 items-center justify-center rounded-2xl bg-forest/8 text-forest"><Route size={18} /></span><p className="text-sm text-charcoal-600/60">No viewings scheduled today — nothing to route.</p></div>;
  }

  const legByToId = new Map(plan.legs.map((l) => [l.toId, l]));

  return (
    <div className={embedded ? '' : 'ws-card mt-6'}>
      <div className={`${embedded ? 'mb-3' : 'mb-5'} flex flex-wrap items-center justify-between gap-3`}>
        <h4 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-forest">
          <span className="ws-ico"><Route size={15} strokeWidth={1.9} /></span> Today&apos;s Route
        </h4>
        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 rounded-lg bg-sand-100 px-2.5 py-1 text-charcoal-600/70"><Car size={12} /> {fmtDur(plan.totalTravelMin)} driving</span>
          {plan.warnings > 0 && <span className="flex items-center gap-1 rounded-lg bg-signal-danger/10 px-2.5 py-1 text-signal-danger"><AlertTriangle size={12} /> {plan.warnings} tight gap{plan.warnings === 1 ? '' : 's'}</span>}
        </div>
      </div>

      {/* Sequenced stops with travel legs */}
      <ol className="relative space-y-1">
        {plan.stops.map((s, i) => {
          const leg = legByToId.get(s.id);
          return (
            <li key={s.id}>
              {i > 0 && leg && (
                <div className={`flex items-center gap-1.5 py-1 pl-3 text-[11px] ${LEG_TONE[leg.status]}`}>
                  <Car size={11} />
                  <span>{fmtDur(leg.travelMin)} drive</span>
                  {leg.status === 'conflict' && <span className="font-medium">· overlaps previous viewing — reschedule</span>}
                  {leg.status === 'tight' && <span className="font-medium">· only {leg.slackMin}m spare</span>}
                </div>
              )}
              <div className="flex items-center gap-3 rounded-xl border border-stone-line bg-white px-3 py-2.5">
                <span className="figure flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/10 text-xs text-forest">{formatTime(new Date(s.time))}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-charcoal">{s.contact}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-charcoal-600/60"><MapPin size={11} /> {[s.project, s.unit].filter(Boolean).join(' · ') || 'Property TBC'}{s.location ? ` · ${s.location}` : ''}</p>
                </div>
                {s.leadId && <Link href={`/crm/leads/${s.leadId}`} className="shrink-0 text-xs text-forest hover:underline">Open</Link>}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Optimization suggestion */}
      {plan.savedMin >= 10 && plan.stops.length > 2 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-champagne/30 bg-champagne-50/60 p-3 text-xs text-charcoal-600/80">
          <Sparkles size={14} className="mt-0.5 shrink-0 text-champagne-600" />
          <span>
            Visiting in this order — {plan.optimizedOrder.map((s) => s.contact.split(' ')[0]).join(' → ')} — cuts driving by about <span className="font-medium text-forest">{fmtDur(plan.savedMin)}</span>. Reschedule times to match if the day is still flexible.
          </span>
        </div>
      )}

      {/* Bookable windows */}
      {plan.windows.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-charcoal-600/50"><Clock size={12} /> Open windows to book</p>
          <div className="flex flex-wrap gap-2">
            {plan.windows.map((w, i) => (
              <span key={i} className="figure rounded-lg bg-sand-100 px-2.5 py-1 text-xs text-charcoal-600/75">{formatTime(new Date(w.start))}–{formatTime(new Date(w.end))} · {fmtDur(w.minutes)}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
