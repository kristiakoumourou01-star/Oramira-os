import Link from 'next/link';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnrichedLeads } from '@/lib/leads';
import { getOrgSettings } from '@/lib/org-settings';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { SalesNav } from '@/components/sales/SalesNav';
import { conversionFunnel, dealsPerformance, lostReasons, revenueForecast } from '@/lib/sales-insights';
import { formatCurrency, formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';
const PERIODS: [string, string, number][] = [['30', '30 μέρες', 30], ['90', '3 μήνες', 90], ['180', '6 μήνες', 180], ['365', '12 μήνες', 365]];
const mLabel = (k: string) => `${new Date(Number(k.slice(0, 4)), Number(k.slice(5)) - 1, 1).toLocaleDateString(DATE_TAG[currentLocale().lang], { month: 'short' }).replace('.', '')} ${k.slice(2, 4)}`;

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="panel min-w-0 p-5"><p className="font-semibold text-charcoal">{title}</p>{sub && <p className="mb-3 text-xs text-charcoal-600/70">{sub}</p>}{!sub && <div className="mb-3" />}{children}</section>;
}

/** Sales → Insights: αναφορές όπως στο Pipedrive. */
export default async function InsightsPage({ searchParams }: { searchParams: { period?: string; pipeline?: string; owner?: string } }) {
  await requirePermission('leads');
  const period = PERIODS.find((p) => p[0] === searchParams.period) ?? PERIODS[2];
  const since = new Date(Date.now() - period[2] * 86400000).toISOString();
  const supabase = await createSupabaseServerClient() as any;
  const [allLeads, settings, { data: reservations }] = await Promise.all([
    getEnrichedLeads(), getOrgSettings(),
    supabase.from('reservations').select('id, status, deposit_amount, deposit_paid, reserved_at, contacts(full_name), units(unit_number, projects(name))').order('reserved_at', { ascending: false }).limit(15),
  ]);
  const cfg = settings.pipelines;
  const pipeKey = cfg.pipelines.some((p) => p.key === searchParams.pipeline) ? searchParams.pipeline! : cfg.defaultKey;
  const owner = searchParams.owner ?? 'all';
  const leads = allLeads.filter((l) => owner === 'all' || l.owner_id === owner);
  const months = Math.max(3, Math.min(12, Math.round(period[2] / 30)));
  const perf = dealsPerformance(leads, months);
  const funnel = conversionFunnel(leads, cfg, pipeKey, since);
  const lost = lostReasons(leads, cfg, since);
  const fc = revenueForecast(leads, cfg);
  const maxPerf = Math.max(1, ...perf.map((r) => Math.max(r.started, r.won, r.lost)));
  const maxLost = Math.max(1, ...lost.map((r) => r.count));
  const maxFc = Math.max(1, ...fc.map((r) => r.value));
  const wonTotal = perf.reduce((s, r) => s + r.wonValue, 0), wonCount = perf.reduce((s, r) => s + r.won, 0), lostCount = perf.reduce((s, r) => s + r.lost, 0);
  const link = (p: Record<string, string>) => `/sales/insights?${new URLSearchParams({ period: period[0], pipeline: pipeKey, owner, ...p })}`;
  const agents = [...new Map(allLeads.filter((l) => l.owner_id).map((l) => [l.owner_id!, l.owner_name ?? '—'])).entries()];

  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Διαχείριση leads" description="Όλα τα leads και deals: pipeline, λίστα, πρόβλεψη, activities και στατιστικά." />
      <SalesNav active="insights" />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex rounded-lg bg-stone-100 p-0.5">{PERIODS.map(([k, l]) => <Link key={k} href={link({ period: k })} scroll={false} className={`inline-flex h-7 items-center rounded-md px-2.5 text-[13px] transition-colors ${k === period[0] ? 'bg-forest font-medium text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal'}`}>{l}</Link>)}</div>
        <div className="flex flex-wrap gap-1">{cfg.pipelines.map((p) => <Link key={p.key} href={link({ pipeline: p.key })} scroll={false} className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${p.key === pipeKey ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`} data-no-tr>{p.name}</Link>)}</div>
        <div className="ml-auto flex flex-wrap gap-1"><Link href={link({ owner: 'all' })} scroll={false} className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${owner === 'all' ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}>Όλοι</Link>{agents.map(([id, n]) => <Link key={id} href={link({ owner: id })} scroll={false} className={`inline-flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${owner === id ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}>{n}</Link>)}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[['Won', formatCurrency(wonTotal), `${wonCount} deals`], ['Lost', String(lostCount), 'deals'], ['Win rate', `${wonCount + lostCount ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0}%`, 'won / (won + lost)'], ['Νέα deals', String(perf.reduce((s, r) => s + r.started, 0)), formatCurrency(perf.reduce((s, r) => s + r.startedValue, 0))]].map(([a, b, c]) => (
          <div key={a} className="rounded-[14px] border border-stone-line bg-white p-4 shadow-sm"><p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">{a}</p><p className="mt-1 text-2xl font-semibold tabular-nums text-charcoal">{b}</p><p className="text-xs text-charcoal-600/60">{c}</p></div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Απόδοση deals" sub="Νέα, won και lost ανά μήνα">
          <div className="flex h-48 items-end gap-2">
            {perf.map((r) => (
              <div key={r.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-40 w-full items-end justify-center gap-0.5">
                  <span className="w-1/4 rounded-t bg-forest" style={{ height: `${(r.started / maxPerf) * 100}%` }} title={`Νέα: ${r.started}`} />
                  <span className="w-1/4 rounded-t bg-forest" style={{ height: `${(r.won / maxPerf) * 100}%` }} title={`Won: ${r.won}`} />
                  <span className="w-1/4 rounded-t bg-rose-400" style={{ height: `${(r.lost / maxPerf) * 100}%` }} title={`Lost: ${r.lost}`} />
                </div>
                <span className="text-[10px] text-charcoal-600/70">{mLabel(r.month)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex gap-4 text-xs text-charcoal-600"><span><span className="mr-1 inline-block h-2 w-2 rounded bg-forest" />Νέα</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-forest" />Won</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-rose-400" />Lost</span></p>
        </Card>

        <Card title="Funnel μετατροπής" sub={`Deals που ξεκίνησαν στο διάστημα και έφτασαν σε κάθε στάδιο`}>
          <div className="space-y-1.5">
            {funnel.map((f, i) => (
              <div key={f.key} className="flex items-center gap-2 text-sm">
                <span className="w-32 shrink-0 truncate text-charcoal" data-no-tr>{f.label}</span>
                <div className="h-6 flex-1 rounded bg-stone"><div className="flex h-6 items-center rounded bg-forest/80 px-2 text-xs font-medium text-white" style={{ width: `${Math.max(f.pct, 4)}%` }}>{f.reached}</div></div>
                <span className="w-24 shrink-0 text-right text-xs text-charcoal-600">{f.pct}%{i > 0 ? ` · ${f.stepPct}% από πριν` : ''}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Γιατί χάνονται" sub="Λόγοι lost στο διάστημα">
          {lost.length === 0 ? <p className="text-sm text-charcoal-600/70">Κανένα lost deal στο διάστημα.</p> : (
            <div className="space-y-1.5">{lost.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-sm"><span className="w-44 shrink-0 truncate" data-no-tr>{r.label}</span><div className="h-4 flex-1 rounded bg-stone"><div className="h-4 rounded bg-rose-400" style={{ width: `${(r.count / maxLost) * 100}%` }} /></div><span className="w-8 text-right">{r.count}</span></div>
            ))}</div>
          )}
        </Card>

        <Card title="Πρόβλεψη εσόδων" sub="Ανοιχτά deals ανά μήνα αναμενόμενου κλεισίματος · σταθμισμένα με την πιθανότητα σταδίου">
          <div className="space-y-2">{fc.map((r) => (
            <div key={r.month} className="text-sm">
              <div className="flex justify-between"><span className="font-medium text-charcoal">{mLabel(r.month)}</span><span className="text-charcoal-600">{r.count} deals · {formatCurrency(r.value)} · <span className="font-medium text-forest">{formatCurrency(Math.round(r.weighted))}</span></span></div>
              <div className="mt-1 h-3 rounded bg-stone"><div className="relative h-3 rounded bg-forest/25" style={{ width: `${(r.value / maxFc) * 100}%` }}><div className="h-3 rounded bg-forest" style={{ width: `${r.value ? (r.weighted / r.value) * 100 : 0}%` }} /></div></div>
            </div>
          ))}</div>
          <p className="mt-2 text-xs text-charcoal-600/60">Βάλτε «Αναμ. κλείσιμο» στα deals (καρτέλα deal ή Forecast) για ακριβέστερη πρόβλεψη.</p>
        </Card>
        <Card title="Κλεισίματα & κρατήσεις" sub="Οι τελευταίες κρατήσεις μονάδων">
          {(reservations ?? []).length === 0 ? <p className="text-sm text-charcoal-600/70">Καμία κράτηση ακόμη.</p> : (
            <ul className="divide-y divide-stone-line text-sm">{((reservations ?? []) as any[]).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2">
                <span><span className="text-charcoal" data-no-tr>{r.contacts?.full_name ?? '—'}</span><span className="block text-xs text-charcoal-600/70" data-no-tr>{[r.units?.projects?.name, r.units?.unit_number].filter(Boolean).join(' · ')}{r.reserved_at ? ` · ${formatDate(r.reserved_at)}` : ''}</span>{r.deposit_amount ? <span className="block text-xs text-charcoal-600/70">προκαταβολή {formatCurrency(Number(r.deposit_amount))}{r.deposit_paid ? ' ✓' : ''}</span> : null}</span>
                <span className={r.status === 'active' ? 'badge-forest' : 'badge-neutral'}>{r.status}</span>
              </li>
            ))}</ul>
          )}
          <Link href="/crm/closings" className="mt-2 inline-block text-xs text-forest hover:underline">Όλα τα κλεισίματα & προμήθειες →</Link>
        </Card>
      </div>
    </div>
  );
}
