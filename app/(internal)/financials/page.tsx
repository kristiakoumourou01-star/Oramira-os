import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFinanceSnapshot } from '@/lib/finance';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { ForecastPanel } from '@/components/financials/ForecastPanel';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { eur } from '@/lib/deal-analyzer';
import { TrendingUp, Wallet, Hourglass, Wrench } from 'lucide-react';

// Primary headline metric — prominent money card.
function Stat({ label, value, icon: Icon, hint, accent }: { label: string; value: string; icon: any; hint?: string; accent?: boolean }) {
  return (
    <div className="panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <Icon size={15} className={accent ? 'text-champagne-600' : 'text-forest/70'} strokeWidth={1.85} />
      </div>
      <p className={`figure text-[26px] leading-none ${accent ? 'text-champagne-600' : 'text-forest'}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-charcoal-600/60">{hint}</p>}
    </div>
  );
}

// Secondary operational metric — quiet cell inside the merged panel.
function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="figure text-xl leading-none text-charcoal">{value}</p>
      <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-charcoal-600/50">{label}</p>
      {hint && <p className="text-[10px] text-charcoal-600/45">{hint}</p>}
    </div>
  );
}

export default async function FinancialsPage() {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  const [f, forecast] = await Promise.all([getFinanceSnapshot(), buildFinancialForecast(supabase)]);
  const maintenanceTotal = f.maintenanceOpen + f.maintenanceClosed;
  const closedPct = maintenanceTotal > 0 ? Math.round((f.maintenanceClosed / maintenanceTotal) * 100) : 0;

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Management" title="Financial Dashboard" description="Decision metrics across the portfolio — live." />

      {/* PRIMARY — headline money (prominent) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Cash collected" value={eur(f.cashCollected, { compact: true })} icon={Wallet} accent />
        <Stat label="Outstanding balance" value={eur(f.outstandingBalance, { compact: true })} icon={Hourglass} hint="signed contracts, unpaid" />
        <Stat label="Contracted revenue" value={eur(f.totalRevenue, { compact: true })} icon={TrendingUp} />
        <Stat label="Contractor liabilities" value={eur(f.contractorLiabilities, { compact: true })} icon={Wrench} hint="submitted + approved invoices" />
      </div>

      {/* SECONDARY — operational metrics merged into one quiet panel */}
      <div className="panel p-5">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4 lg:grid-cols-8">
          <Metric label="Active leads" value={String(f.activeLeads)} />
          <Metric label="Reservations" value={String(f.activeReservations)} />
          <Metric label="Units sold" value={String(f.soldUnits)} />
          <Metric label="Available" value={String(f.availableUnits)} />
          <Metric label="Sales cycle" value={f.avgSalesCycleDays != null ? `${f.avgSalesCycleDays}d` : '—'} hint="lead → reservation" />
          <Metric label="Velocity 90d" value={String(f.reservationsLast90)} hint={`~${(f.reservationsLast90 / 3).toFixed(1)}/mo`} />
          <Metric label="Warranty claims" value={String(f.warrantyClaims)} />
          <Metric label="Maint. closed" value={`${closedPct}%`} hint={`${f.maintenanceOpen} open`} />
        </div>
      </div>

      {/* Predictive cashflow forecast */}
      <ForecastPanel forecast={forecast} />

      {/* Project performance comparison */}
      <div className="panel overflow-hidden">
        <div className="border-b border-stone-line px-6 py-4">
          <h4>Project performance</h4>
        </div>
        {f.projects.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal-600/70">No projects yet.</p>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr><th>Project</th><th>Units (sold / total)</th><th>Available</th><th>Revenue</th><th>Collected</th><th>Contractor cost</th><th>Net contribution</th></tr>
            </thead>
            <tbody>
              {f.projects.map((p) => {
                const collectedPct = p.revenue > 0 ? Math.round((p.collected / p.revenue) * 100) : 0;
                return (
                  <tr key={p.projectId} className="hover:bg-stone/60">
                    <td className="font-medium text-charcoal">{p.name}</td>
                    <td className="figure text-charcoal-600">{p.soldUnits} / {p.totalUnits}</td>
                    <td className="figure text-charcoal-600">{p.availableUnits}</td>
                    <td className="figure">{eur(p.revenue, { compact: true })}</td>
                    <td className="figure text-charcoal-600">{eur(p.collected, { compact: true })} <span className="text-[10px] text-charcoal-600/50">{collectedPct}%</span></td>
                    <td className="figure text-charcoal-600">{eur(p.contractorLiabilities, { compact: true })}</td>
                    <td className={`figure ${p.contribution >= 0 ? 'text-signal-success' : 'text-signal-danger'}`}>{eur(p.contribution, { compact: true })}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-charcoal-600/50">
        Management view — indicative figures for decision-making, not a statutory accounting record. “Net contribution” is contracted revenue less open contractor liabilities.
      </p>
    </div>
  );
}
