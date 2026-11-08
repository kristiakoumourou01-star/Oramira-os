import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getEnrichedLeads } from '@/lib/leads';
import { getOrgSettings } from '@/lib/org-settings';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { byOwner, conversionFunnel, dealsPerformance, lostReasons, revenueForecast } from '@/lib/sales-insights';
import { ACTIVITY_TYPES, activityLabel } from '@/lib/activity-types';
import { formatCurrency, formatDate } from '@/lib/format';
import { computeSalesKpis, formatMinutes } from '@/lib/sales-kpi';

export const dynamic = 'force-dynamic';
const PERIODS: [string, string, number][] = [['30', '30 μέρες', 30], ['90', '3 μήνες', 90], ['180', '6 μήνες', 180], ['365', '12 μήνες', 365]];
const MON = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'];
const mLabel = (k: string) => `${MON[Number(k.slice(5)) - 1]} ${k.slice(2, 4)}`;

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return <section className="panel p-5"><p className="font-semibold text-charcoal">{title}</p>{sub && <p className="mb-3 text-xs text-charcoal-600/70">{sub}</p>}{!sub && <div className="mb-3" />}{children}</section>;
}

/** Sales → Insights: αναφορές όπως στο Pipedrive. */
export default async function InsightsPage({ searchParams }: { searchParams: { period?: string; pipeline?: string; owner?: string } }) {
  await requirePermission('leads');
  const period = PERIODS.find((p) => p[0] === searchParams.period) ?? PERIODS[2];
  const since = new Date(Date.now() - period[2] * 86400000).toISOString();
  const supabase = await createSupabaseServerClient() as any;
  const [allLeads, settings, { data: acts }, kpis, { data: reservations }] = await Promise.all([
    getEnrichedLeads(), getOrgSettings(),
    supabase.from('follow_up_tasks').select('type, is_done, done_at, due_at, assigned_to, owner:assigned_to(full_name)').gte('due_at', since).limit(5000),
    computeSalesKpis(supabase),
    supabase.from('reservations').select('id, status, deposit_amount, deposit_paid, reserved_at, contacts(full_name), units(unit_number, projects(name))').order('reserved_at', { ascending: false }).limit(15),
  ]);
  const cfg = settings.pipelines;
  const pipeKey = cfg.pipelines.some((p) => p.key === searchParams.pipeline) ? searchParams.pipeline! : cfg.defaultKey;
  const owner = searchParams.owner ?? 'all';
  const leads = allLeads.filter((l) => owner === 'all' || l.owner_id === owner);
  const months = Math.max(3, Math.min(12, Math.round(period[2] / 30)));
  const perf = dealsPerformance(leads, months);
  const funnel = conversionFunnel(leads, cfg, pipeKey, since);
  const owners = byOwner(allLeads, since);
  const lost = lostReasons(leads, cfg, since);
  const fc = revenueForecast(leads, cfg);
  const maxPerf = Math.max(1, ...perf.map((r) => Math.max(r.started, r.won, r.lost)));
  const maxLost = Math.max(1, ...lost.map((r) => r.count));
  const maxFc = Math.max(1, ...fc.map((r) => r.value));
  const wonTotal = perf.reduce((s, r) => s + r.wonValue, 0), wonCount = perf.reduce((s, r) => s + r.won, 0), lostCount = perf.reduce((s, r) => s + r.lost, 0);
  // Activities ανά χρήστη / τύπο
  const actRows = new Map<string, { name: string; done: number; planned: number; byType: Record<string, number> }>();
  for (const a of (acts ?? []) as any[]) {
    if (owner !== 'all' && a.assigned_to !== owner) continue;
    const k = a.assigned_to ?? 'none';
    const r = actRows.get(k) ?? { name: a.owner?.full_name ?? '—', done: 0, planned: 0, byType: {} as Record<string, number> };
    if (a.is_done) { const tk: string = a.type ?? 'task'; r.done++; r.byType[tk] = (r.byType[tk] ?? 0) + 1; } else r.planned++;
    actRows.set(k, r);
  }
  const link = (p: Record<string, string>) => `/sales/insights?${new URLSearchParams({ period: period[0], pipeline: pipeKey, owner, ...p })}`;
  const agents = [...new Map(allLeads.filter((l) => l.owner_id).map((l) => [l.owner_id!, l.owner_name ?? '—'])).entries()];

  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Insights" description="Απόδοση deals, funnel μετατροπής, won/lost, activities και πρόβλεψη εσόδων." />
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="flex gap-1 rounded-lg bg-stone p-1">{PERIODS.map(([k, l]) => <Link key={k} href={link({ period: k })} className={`rounded-md px-3 py-1 ${k === period[0] ? 'bg-white font-medium text-charcoal shadow-sm' : 'text-charcoal-600'}`}>{l}</Link>)}</div>
        <div className="flex flex-wrap gap-1">{cfg.pipelines.map((p) => <Link key={p.key} href={link({ pipeline: p.key })} className={`rounded-full px-3 py-1 ${p.key === pipeKey ? 'bg-forest text-white' : 'bg-stone text-charcoal-600'}`} data-no-tr>{p.name}</Link>)}</div>
        <div className="ml-auto flex flex-wrap gap-1"><Link href={link({ owner: 'all' })} className={`rounded-full px-3 py-1 ${owner === 'all' ? 'bg-forest text-white' : 'bg-stone text-charcoal-600'}`}>Όλοι</Link>{agents.map(([id, n]) => <Link key={id} href={link({ owner: id })} className={`rounded-full px-3 py-1 ${owner === id ? 'bg-forest text-white' : 'bg-stone text-charcoal-600'}`}>{n}</Link>)}</div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[['Won', formatCurrency(wonTotal), `${wonCount} deals`], ['Lost', String(lostCount), 'deals'], ['Win rate', `${wonCount + lostCount ? Math.round((wonCount / (wonCount + lostCount)) * 100) : 0}%`, 'won / (won + lost)'], ['Νέα deals', String(perf.reduce((s, r) => s + r.started, 0)), formatCurrency(perf.reduce((s, r) => s + r.startedValue, 0))]].map(([a, b, c]) => (
          <div key={a} className="panel p-4"><p className="text-xs uppercase tracking-wide text-charcoal-600/70">{a}</p><p className="figure text-2xl text-forest">{b}</p><p className="text-xs text-charcoal-600/60">{c}</p></div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[['Ταχύτητα απάντησης', formatMinutes(kpis.speedToLeadAvgMinutes), `διάμεσος ${formatMinutes(kpis.speedToLeadMedianMinutes)}`], ['Απαντήθηκαν', `${kpis.responseRatePct}%`, `${kpis.totalLeads} leads`], ['Με προβολή', `${kpis.bookingRatePct}%`, 'leads με προβολή'], ['Προβολή → κράτηση', `${kpis.viewingToReservationPct}%`, `${kpis.reservationsCount} κρατήσεις`], ['Κράτηση → πώληση', `${kpis.reservationToSalePct}%`, `${kpis.wonCount} won`], ['Προμήθειες σε εκκρεμότητα', formatCurrency(kpis.commissionsPending), `${formatCurrency(kpis.commissionsPaid)} πληρωμένες`]].map(([a, b, c]) => (
          <div key={a} className="panel p-3"><p className="text-[11px] uppercase tracking-wide text-charcoal-600/70">{a}</p><p className="figure text-xl text-charcoal">{b}</p><p className="text-[11px] text-charcoal-600/60">{c}</p></div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Απόδοση deals" sub="Νέα, won και lost ανά μήνα">
          <div className="flex h-48 items-end gap-2">
            {perf.map((r) => (
              <div key={r.month} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-40 w-full items-end justify-center gap-0.5">
                  <span className="w-1/4 rounded-t bg-sky-400" style={{ height: `${(r.started / maxPerf) * 100}%` }} title={`Νέα: ${r.started}`} />
                  <span className="w-1/4 rounded-t bg-emerald-500" style={{ height: `${(r.won / maxPerf) * 100}%` }} title={`Won: ${r.won}`} />
                  <span className="w-1/4 rounded-t bg-rose-400" style={{ height: `${(r.lost / maxPerf) * 100}%` }} title={`Lost: ${r.lost}`} />
                </div>
                <span className="text-[10px] text-charcoal-600/70">{mLabel(r.month)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 flex gap-4 text-xs text-charcoal-600"><span><span className="mr-1 inline-block h-2 w-2 rounded bg-sky-400" />Νέα</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-emerald-500" />Won</span><span><span className="mr-1 inline-block h-2 w-2 rounded bg-rose-400" />Lost</span></p>
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

        <Card title="Ανά υπεύθυνο" sub="Ανοιχτά τώρα · won / lost στο διάστημα">
          <div className="overflow-x-auto">
            <table className="table-base w-full min-w-[480px] text-sm">
              <thead><tr><th>Υπεύθυνος</th><th className="text-right">Ανοιχτά</th><th className="text-right">Αξία</th><th className="text-right">Won</th><th className="text-right">Won €</th><th className="text-right">Lost</th><th className="text-right">Win rate</th></tr></thead>
              <tbody>{owners.map((r) => <tr key={r.ownerId ?? 'none'}><td>{r.name}</td><td className="text-right">{r.open}</td><td className="text-right">{formatCurrency(r.openValue)}</td><td className="text-right text-emerald-700">{r.won}</td><td className="text-right">{formatCurrency(r.wonValue)}</td><td className="text-right text-signal-danger">{r.lost}</td><td className="text-right font-medium">{r.winRate}%</td></tr>)}</tbody>
            </table>
          </div>
        </Card>

        <Card title="Γιατί χάνονται" sub="Λόγοι lost στο διάστημα">
          {lost.length === 0 ? <p className="text-sm text-charcoal-600/70">Κανένα lost deal στο διάστημα.</p> : (
            <div className="space-y-1.5">{lost.map((r) => (
              <div key={r.label} className="flex items-center gap-2 text-sm"><span className="w-44 shrink-0 truncate" data-no-tr>{r.label}</span><div className="h-4 flex-1 rounded bg-stone"><div className="h-4 rounded bg-rose-400" style={{ width: `${(r.count / maxLost) * 100}%` }} /></div><span className="w-8 text-right">{r.count}</span></div>
            ))}</div>
          )}
        </Card>

        <Card title="Activities ανά χρήστη" sub="Ολοκληρωμένες και προγραμματισμένες στο διάστημα">
          <div className="overflow-x-auto">
            <table className="table-base w-full min-w-[480px] text-sm">
              <thead><tr><th>Χρήστης</th><th className="text-right">Έγιναν</th><th className="text-right">Ανοιχτές</th>{ACTIVITY_TYPES.slice(0, 4).map((a) => <th key={a.key} className="text-right">{a.label}</th>)}</tr></thead>
              <tbody>
                {actRows.size === 0 && <tr><td colSpan={7} className="py-4 text-center text-charcoal-600/70">Καμία activity στο διάστημα.</td></tr>}
                {[...actRows.values()].sort((a, b) => b.done - a.done).map((r) => <tr key={r.name}><td>{r.name}</td><td className="text-right font-medium">{r.done}</td><td className="text-right">{r.planned}</td>{ACTIVITY_TYPES.slice(0, 4).map((a) => <td key={a.key} className="text-right">{r.byType[a.key] ?? 0}</td>)}</tr>)}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-charcoal-600/60">Τύποι: {ACTIVITY_TYPES.map((a) => activityLabel(a.key)).join(' · ')}</p>
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
                <span><span className="text-charcoal" data-no-tr>{r.contacts?.full_name ?? '—'}</span><span className="block text-xs text-charcoal-600/70" data-no-tr>{[r.units?.projects?.name, r.units?.unit_number].filter(Boolean).join(' · ')}{r.reserved_at ? ` · ${formatDate(r.reserved_at)}` : ''}{r.deposit_amount ? ` · προκαταβολή ${formatCurrency(Number(r.deposit_amount))}${r.deposit_paid ? ' ✓' : ''}` : ''}</span></span>
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
