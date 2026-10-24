import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { computeSalesKpis, formatMinutes } from '@/lib/sales-kpi';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { BarChart3, Users, Reply, CalendarCheck, Trophy, Zap, Megaphone, Lightbulb } from 'lucide-react';
import { TrendChip } from '@/components/ui/TrendChip';
import type { Trend } from '@/lib/trend';

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic',
  referral: 'Referral', whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', walk_in: 'Walk-in', other: 'Other',
};

/**
 * Marketing workspace — the top of the funnel (Marketing → Leads → Sales).
 * Surfaces live lead-source performance and funnel efficiency from the CRM.
 */
export default async function MarketingPage() {
  await requirePermission('marketing');
  const supabase = await createSupabaseServerClient();
  const k = await computeSalesKpis(supabase);
  const bestSource = [...k.sources].sort((a, b) => b.conversionPct - a.conversionPct || b.leads - a.leads)[0];
  const label = (s: string) => SOURCE_LABEL[s] ?? s;

  // Where to focus — a deterministic recommendation on reliable signals only
  // (source volume + closes), never on drift-degraded response/speed metrics.
  const focus: { headline: string; detail: string; tone: 'good' | 'warn' | 'info' } = (() => {
    if (k.totalLeads === 0) return { headline: 'No leads yet — prime the funnel', detail: 'Launch a Meta lead campaign or embed your website form to start generating leads.', tone: 'info' };
    const withWins = k.sources.filter((s) => s.won > 0);
    const waste = k.sources.filter((s) => s.leads >= 3 && s.won === 0);
    if (withWins.length) {
      const best = [...withWins].sort((a, b) => b.conversionPct - a.conversionPct)[0];
      if (waste.length) return { headline: `Double down on ${label(best.source)}`, detail: `${label(best.source)} converts at ${best.conversionPct}%, while ${waste.map((w) => label(w.source)).join(', ')} produced ${waste.reduce((n, w) => n + w.leads, 0)} leads with no closes — review the targeting or cut the spend.`, tone: 'good' };
      return { headline: `${label(best.source)} is converting best`, detail: `${best.conversionPct}% conversion — scale what's already working.`, tone: 'good' };
    }
    const top = [...k.sources].sort((a, b) => b.leads - a.leads)[0];
    const topShare = top ? Math.round((top.leads / k.totalLeads) * 100) : 0;
    if (topShare >= 70) return { headline: 'You depend on a single channel', detail: `${topShare}% of leads come from ${label(top.source)}. Diversify (Meta, referrals, website) so your lead flow isn't single-threaded.`, tone: 'warn' };
    return { headline: `${k.totalLeads} leads in, no closes yet`, detail: 'Tighten speed-to-lead and follow-up to convert the pipeline you already have.', tone: 'warn' };
  })();
  const focusRing = focus.tone === 'good' ? 'border-forest/20 bg-forest/[0.05]' : focus.tone === 'warn' ? 'border-champagne/40 bg-champagne-50/60' : 'border-stone-line bg-white';

  const kpis: { label: string; value: string; icon: any; tone: string; trend?: Trend }[] = [
    { label: 'Total leads', value: String(k.totalLeads), icon: Users, tone: 'text-forest', trend: k.leadsTrend },
    { label: 'Response rate', value: `${k.responseRatePct}%`, icon: Reply, tone: 'text-forest' },
    { label: 'Speed to lead', value: formatMinutes(k.speedToLeadAvgMinutes), icon: Zap, tone: 'text-charcoal' },
    { label: 'Booking rate', value: `${k.bookingRatePct}%`, icon: CalendarCheck, tone: 'text-forest' },
    { label: 'Won', value: String(k.wonCount), icon: Trophy, tone: 'text-champagne-600' },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Workspace" title="Marketing" description="The top of the funnel — Marketing generates the leads Sales converts." />

      {/* Funnel KPIs (live from the CRM) */}
      <div className="ws-card grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-5 !py-4">
        {kpis.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/[0.06] text-forest"><s.icon size={15} strokeWidth={1.9} /></span>
            <div>
              <p className={`figure flex items-center gap-1.5 text-xl leading-none ${s.tone}`}>{s.value}{s.trend && <TrendChip trend={s.trend} />}</p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wide text-charcoal-600/50">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Where to focus — the defining Marketing insight */}
      <div className={`panel flex items-start gap-3 border p-4 ${focusRing}`}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white"><Lightbulb size={16} strokeWidth={1.9} /></span>
        <div className="min-w-0">
          <p className="eyebrow">Where to focus</p>
          <p className="text-[15px] font-semibold text-charcoal">{focus.headline}</p>
          <p className="text-[13px] text-charcoal-600/75">{focus.detail}</p>
        </div>
      </div>

      {/* Lead source performance */}
      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-charcoal"><BarChart3 size={15} className="text-forest" strokeWidth={1.85} /> Lead source performance</h4>
          {bestSource && <span className="text-xs text-charcoal-600/60">Best converting: <span className="font-medium text-forest">{SOURCE_LABEL[bestSource.source] ?? bestSource.source}</span> ({bestSource.conversionPct}%)</span>}
        </div>
        {k.sources.length === 0 ? (
          <EmptyState icon={Megaphone} title="No lead sources yet" description="Once leads start arriving from your channels — website, Meta, Google, referrals — their volume and conversion will break down here." />
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50">
              <th className="pb-2">Source</th><th className="pb-2 text-right">Leads</th><th className="pb-2 text-right">Won</th><th className="pb-2 text-right">Conversion</th><th className="pb-2 pl-4">Share</th>
            </tr></thead>
            <tbody>
              {k.sources.map((s) => {
                const share = k.totalLeads ? Math.round((s.leads / k.totalLeads) * 100) : 0;
                return (
                  <tr key={s.source} className="border-t border-stone-line">
                    <td className="py-2 text-charcoal">{SOURCE_LABEL[s.source] ?? s.source}</td>
                    <td className="py-2 text-right figure text-charcoal-600">{s.leads}</td>
                    <td className="py-2 text-right figure text-forest">{s.won}</td>
                    <td className="py-2 text-right figure text-charcoal-600">{s.conversionPct}%</td>
                    <td className="py-2 pl-4"><div className="flex items-center gap-2"><div className="h-1.5 w-24 rounded-full bg-sand-100"><div className="h-1.5 rounded-full bg-forest/70" style={{ width: `${Math.max(3, share)}%` }} /></div><span className="figure text-[11px] text-charcoal-600/50">{share}%</span></div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
