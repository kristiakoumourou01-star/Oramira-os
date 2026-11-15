import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFinanceSnapshot } from '@/lib/finance';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { ForecastPanel } from '@/components/financials/ForecastPanel';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { eur } from '@/lib/deal-analyzer';
import { TrendingUp, Wallet, Hourglass, Wrench, Users, CalendarCheck, Home, KeyRound, Timer, Gauge, ShieldCheck, Hammer, Building2 } from 'lucide-react';

type Tone = 'green' | 'amber' | 'forest' | 'rose' | 'sky' | 'violet' | 'sand';
const TONE: Record<Tone, { card: string; ico: string; val: string }> = {
  green: { card: 'from-emerald-50 to-white border-emerald-200/70', ico: 'bg-emerald-500 text-white', val: 'text-emerald-800' },
  amber: { card: 'from-amber-50 to-white border-amber-200/70', ico: 'bg-amber-500 text-white', val: 'text-amber-800' },
  forest: { card: 'from-forest/[0.08] to-white border-forest/20', ico: 'bg-forest text-white', val: 'text-forest' },
  rose: { card: 'from-rose-50 to-white border-rose-200/70', ico: 'bg-rose-500 text-white', val: 'text-rose-800' },
  sky: { card: 'from-sky-50 to-white border-sky-200/70', ico: 'bg-sky-500 text-white', val: 'text-sky-800' },
  violet: { card: 'from-violet-50 to-white border-violet-200/70', ico: 'bg-violet-500 text-white', val: 'text-violet-800' },
  sand: { card: 'from-[#c9a063]/15 to-white border-[#c9a063]/30', ico: 'bg-[#b07d22] text-white', val: 'text-[#7a5518]' },
};

// Κύριος αριθμός (χρήματα): έγχρωμη κάρτα με εικονίδιο.
function Stat({ label, value, icon: Icon, hint, tone }: { label: string; value: string; icon: any; hint?: string; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div className={`rounded-2xl border bg-gradient-to-br p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)] ${t.card}`}>
      <div className="flex items-center gap-2.5">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl shadow-sm ${t.ico}`}><Icon size={17} strokeWidth={2} /></span>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70">{label}</p>
      </div>
      <p className={`mt-3 font-display text-[30px] leading-none ${t.val}`}>{value}</p>
      {hint && <p className="mt-1.5 text-xs text-charcoal-600/65">{hint}</p>}
    </div>
  );
}

// Δευτερεύων αριθμός: μικρό πλακίδιο με χρωματιστό εικονίδιο.
function Metric({ label, value, hint, icon: Icon, tone }: { label: string; value: string; hint?: string; icon: any; tone: Tone }) {
  const t = TONE[tone];
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-3 py-3 ring-1 ring-inset ring-stone-line/70">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${t.ico} opacity-90`}><Icon size={16} strokeWidth={2} /></span>
      <div className="min-w-0">
        <p className={`text-lg font-semibold leading-none ${t.val}`}>{value}</p>
        <p className="mt-1 truncate text-[11px] font-medium text-charcoal-600/70">{label}</p>
        {hint && <p className="truncate text-[10px] text-charcoal-600/50">{hint}</p>}
      </div>
    </div>
  );
}

const Bar = ({ pct, cls }: { pct: number; cls: string }) => (
  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-stone"><div className={`h-full rounded-full ${cls}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></div>
);

export default async function FinancialsPage() {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  const [f, forecast] = await Promise.all([getFinanceSnapshot(), buildFinancialForecast(supabase)]);
  const maintenanceTotal = f.maintenanceOpen + f.maintenanceClosed;
  const closedPct = maintenanceTotal > 0 ? Math.round((f.maintenanceClosed / maintenanceTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Finance" title="Financial Dashboard" description="Decision metrics across the portfolio — live." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat tone="green" label="Cash collected" value={eur(f.cashCollected, { compact: true })} icon={Wallet} hint="Εισπράξεις μέχρι σήμερα" />
        <Stat tone="amber" label="Outstanding balance" value={eur(f.outstandingBalance, { compact: true })} icon={Hourglass} hint="signed contracts, unpaid" />
        <Stat tone="forest" label="Contracted revenue" value={eur(f.totalRevenue, { compact: true })} icon={TrendingUp} hint="Σύνολο υπογεγραμμένων συμβολαίων" />
        <Stat tone="rose" label="Contractor liabilities" value={eur(f.contractorLiabilities, { compact: true })} icon={Wrench} hint="submitted + approved invoices" />
      </div>

      <div className="rounded-2xl border border-stone-line bg-[#faf8f4] p-4">
        <p className="mb-3 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-forest"><span className="h-4 w-1 rounded-full bg-forest" /> Πωλήσεις & λειτουργία</p>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric tone="sky" icon={Users} label="Active leads" value={String(f.activeLeads)} />
          <Metric tone="amber" icon={CalendarCheck} label="Reservations" value={String(f.activeReservations)} />
          <Metric tone="green" icon={KeyRound} label="Units sold" value={String(f.soldUnits)} />
          <Metric tone="forest" icon={Home} label="Available" value={String(f.availableUnits)} />
          <Metric tone="violet" icon={Timer} label="Sales cycle" value={f.avgSalesCycleDays != null ? `${f.avgSalesCycleDays}d` : '—'} hint="lead → reservation" />
          <Metric tone="sky" icon={Gauge} label="Velocity 90d" value={String(f.reservationsLast90)} hint={`~${(f.reservationsLast90 / 3).toFixed(1)}/mo`} />
          <Metric tone="sand" icon={ShieldCheck} label="Warranty claims" value={String(f.warrantyClaims)} />
          <Metric tone={f.maintenanceOpen ? 'rose' : 'green'} icon={Hammer} label="Maint. closed" value={`${closedPct}%`} hint={`${f.maintenanceOpen} open`} />
        </div>
      </div>

      <ForecastPanel forecast={forecast} />

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <div className="flex items-center gap-2.5 border-b border-stone-line px-5 py-4">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-white"><Building2 size={15} /></span>
          <h4 className="text-[15px] font-semibold text-charcoal">Project performance</h4>
        </div>
        {f.projects.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal-600/70">No projects yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-forest/[0.03] text-left text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70 [&_th]:px-4 [&_th]:py-3">
                <tr><th>Project</th><th>Units (sold / total)</th><th>Revenue</th><th>Collected</th><th>Contractor cost</th><th className="text-right">Net contribution</th></tr>
              </thead>
              <tbody className="divide-y divide-stone-line/70 [&_td]:px-4 [&_td]:py-3">
                {f.projects.map((p) => {
                  const collectedPct = p.revenue > 0 ? Math.round((p.collected / p.revenue) * 100) : 0;
                  const soldPct = p.totalUnits > 0 ? Math.round((p.soldUnits / p.totalUnits) * 100) : 0;
                  return (
                    <tr key={p.projectId} className="transition-colors hover:bg-forest/[0.025]">
                      <td className="font-semibold text-charcoal" data-no-tr>{p.name}<span className="block text-xs font-normal text-charcoal-600/60">{p.availableUnits} available</span></td>
                      <td className="w-44"><span className="figure text-charcoal">{p.soldUnits} / {p.totalUnits}</span> <span className="text-xs text-charcoal-600/60">{soldPct}%</span><Bar pct={soldPct} cls="bg-forest" /></td>
                      <td className="figure font-medium text-charcoal">{eur(p.revenue, { compact: true })}</td>
                      <td className="w-44"><span className="figure text-emerald-700">{eur(p.collected, { compact: true })}</span> <span className="text-xs text-charcoal-600/60">{collectedPct}%</span><Bar pct={collectedPct} cls="bg-emerald-500" /></td>
                      <td className="figure text-rose-700">{eur(p.contractorLiabilities, { compact: true })}</td>
                      <td className="text-right"><span className={`figure inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${p.contribution >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200' : 'bg-rose-50 text-signal-danger ring-1 ring-inset ring-rose-200'}`}>{eur(p.contribution, { compact: true })}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-charcoal-600/50">
        Management view — indicative figures for decision-making, not a statutory accounting record. “Net contribution” is contracted revenue less open contractor liabilities.
      </p>
    </div>
  );
}
