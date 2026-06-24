import { requireRole } from '@/lib/auth';
import { getFinanceSnapshot } from '@/lib/finance';
import { eur } from '@/lib/deal-analyzer';
import { TrendingUp, Wallet, Hourglass, Users, KeySquare, Home, Wrench, ShieldAlert, Gauge, Timer } from 'lucide-react';

function Stat({ label, value, icon: Icon, hint, accent }: { label: string; value: string; icon: any; hint?: string; accent?: boolean }) {
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="eyebrow">{label}</p>
        <Icon size={16} className={accent ? 'text-champagne-600' : 'text-olive'} strokeWidth={1.75} />
      </div>
      <p className={`figure text-3xl ${accent ? 'text-champagne-600' : 'text-forest'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-charcoal-600/60">{hint}</p>}
    </div>
  );
}

export default async function FinancialsPage() {
  await requireRole(['admin', 'sales', 'management']);
  const f = await getFinanceSnapshot();
  const maintenanceTotal = f.maintenanceOpen + f.maintenanceClosed;
  const closedPct = maintenanceTotal > 0 ? Math.round((f.maintenanceClosed / maintenanceTotal) * 100) : 0;

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Management</p>
        <h1 className="text-3xl">Financial Dashboard</h1>
        <p className="mt-1 text-sm text-charcoal-600/70">Decision metrics across the portfolio — live.</p>
      </div>

      {/* Headline money */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Cash collected" value={eur(f.cashCollected, { compact: true })} icon={Wallet} accent />
        <Stat label="Outstanding balance" value={eur(f.outstandingBalance, { compact: true })} icon={Hourglass} hint="signed contracts, unpaid" />
        <Stat label="Contracted revenue" value={eur(f.totalRevenue, { compact: true })} icon={TrendingUp} />
        <Stat label="Contractor liabilities" value={eur(f.contractorLiabilities, { compact: true })} icon={Wrench} hint="submitted + approved invoices" />
      </div>

      {/* Pipeline + inventory */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Active leads" value={String(f.activeLeads)} icon={Users} />
        <Stat label="Active reservations" value={String(f.activeReservations)} icon={KeySquare} />
        <Stat label="Units sold" value={String(f.soldUnits)} icon={Home} />
        <Stat label="Units available" value={String(f.availableUnits)} icon={Home} />
      </div>

      {/* Velocity & service */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Avg. sales cycle" value={f.avgSalesCycleDays != null ? `${f.avgSalesCycleDays}d` : '—'} icon={Timer} hint="lead → reservation" />
        <Stat label="Sales velocity" value={`${f.reservationsLast90}`} icon={Gauge} hint={`last 90d · ~${(f.reservationsLast90 / 3).toFixed(1)}/mo`} />
        <Stat label="Warranty claims" value={String(f.warrantyClaims)} icon={ShieldAlert} />
        <Stat label="Maintenance closed" value={`${closedPct}%`} icon={Wrench} hint={`${f.maintenanceOpen} open · ${f.maintenanceClosed} closed`} />
      </div>

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
