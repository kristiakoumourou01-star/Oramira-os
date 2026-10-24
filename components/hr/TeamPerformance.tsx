import { TrendingUp, AlertTriangle, Gauge, Clock, Reply, ListChecks } from 'lucide-react';
import type { PerformanceScore, PerformanceLabel } from '@/lib/team-performance';
import { formatMinutes } from '@/lib/sales-kpi';

/**
 * Owner-facing team responsiveness board. One clear score per employee (0–100)
 * with the plain-language reasons behind it — who's on top of their leads, who's
 * slipping. Foundation-first: employees without enough activity read "Not enough
 * activity yet" instead of a made-up number, and the whole board self-explains
 * when the team is new.
 */

const TONE: Record<PerformanceLabel, { ring: string; text: string; chip: string; dot: string }> = {
  excellent: { ring: 'border-forest/25 bg-forest/[0.06]', text: 'text-forest', chip: 'bg-forest text-white', dot: 'bg-forest' },
  solid: { ring: 'border-forest/15 bg-forest/[0.03]', text: 'text-forest', chip: 'bg-forest/10 text-forest', dot: 'bg-forest/70' },
  'needs attention': { ring: 'border-champagne/50 bg-champagne-50/50', text: 'text-champagne-600', chip: 'bg-champagne-50 text-champagne-600', dot: 'bg-champagne-600' },
  'at risk': { ring: 'border-signal-danger/30 bg-signal-danger/[0.04]', text: 'text-signal-danger', chip: 'bg-signal-danger/10 text-signal-danger', dot: 'bg-signal-danger' },
  'no data': { ring: 'border-stone-line bg-sand-50', text: 'text-charcoal-600/50', chip: 'bg-[#F0EADF] text-charcoal-600/60', dot: 'bg-charcoal-600/30' },
};

const LABEL_TEXT: Record<PerformanceLabel, string> = {
  excellent: 'Excellent', solid: 'Solid', 'needs attention': 'Needs attention', 'at risk': 'At risk', 'no data': 'Not enough activity yet',
};

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon size={13} className="text-charcoal-600/45" strokeWidth={1.85} />
      <span className="text-charcoal-600/55">{label}</span>
      <span className="figure text-charcoal">{value}</span>
    </div>
  );
}

export function TeamPerformance({ scores }: { scores: PerformanceScore[] }) {
  const rated = scores.filter((s) => s.score != null);
  const teamAvg = rated.length ? Math.round(rated.reduce((s, r) => s + (r.score ?? 0), 0) / rated.length) : null;

  return (
    <div className="space-y-4">
      {/* Header — what this is + the team read at a glance */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-charcoal">Team responsiveness</p>
          <p className="text-xs text-charcoal-600/55">How quickly each person answers new leads and keeps follow-ups on time. Visible to owners &amp; management only.</p>
        </div>
        {teamAvg != null && (
          <div className="flex items-center gap-2 rounded-xl border border-forest/15 bg-forest/[0.04] px-3 py-1.5">
            <Gauge size={15} className="text-forest" strokeWidth={1.9} />
            <span className="text-xs text-charcoal-600/60">Team average</span>
            <span className="figure text-lg leading-none text-forest">{teamAvg}</span>
          </div>
        )}
      </div>

      {scores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-forest/20 bg-forest/[0.03] p-8 text-center">
          <p className="text-sm font-medium text-charcoal">No employees yet</p>
          <p className="mx-auto mt-1 max-w-md text-xs text-charcoal-600/60">As you add staff and they start handling leads, each person&apos;s responsiveness score will appear here.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {scores.map((s) => {
            const t = TONE[s.label];
            return (
              <li key={s.agentId} className={`rounded-2xl border p-4 ${t.ring}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-charcoal">{s.name}</p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${t.chip}`}>{LABEL_TEXT[s.label]}</span>
                  </div>
                  <div className="text-right">
                    <p className={`figure text-3xl leading-none ${t.text}`}>{s.score ?? '—'}</p>
                    <p className="text-[10px] uppercase tracking-wide text-charcoal-600/40">/ 100</p>
                  </div>
                </div>

                {s.score != null && (
                  <>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <Stat icon={Clock} label="Speed" value={s.medianSpeedMinutes != null ? formatMinutes(s.medianSpeedMinutes) : '—'} />
                      <Stat icon={Reply} label="Answered" value={s.responseRatePct != null ? `${s.responseRatePct}%` : '—'} />
                      <Stat icon={ListChecks} label="Overdue" value={String(s.overdueFollowUps)} />
                    </div>
                    {(s.highlights.length > 0 || s.concerns.length > 0) && (
                      <div className="mt-3 space-y-1">
                        {s.highlights.map((h) => (
                          <p key={h} className="flex items-center gap-1.5 text-[11px] text-forest"><TrendingUp size={11} strokeWidth={2} /> {h}</p>
                        ))}
                        {s.concerns.map((c) => (
                          <p key={c} className="flex items-center gap-1.5 text-[11px] text-champagne-600"><AlertTriangle size={11} strokeWidth={2} /> {c}</p>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {s.score == null && (
                  <p className="mt-2 text-[11px] text-charcoal-600/45">{s.leadsAssigned > 0 ? `${s.leadsAssigned} lead${s.leadsAssigned > 1 ? 's' : ''} so far — score appears with a bit more activity.` : 'No leads handled yet.'}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
