import Link from 'next/link';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getFinanceSnapshot } from '@/lib/finance';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { ForecastPanel } from '@/components/financials/ForecastPanel';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { HubLinks } from '@/components/ui/HubTabs';
import { SummaryTiles } from '@/components/reports/ReportParts';
import { formatCurrency } from '@/lib/format';

export const dynamic = 'force-dynamic';

const Bar = ({ pct }: { pct: number }) => (
  <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-forest" style={{ width: `${Math.max(0, Math.min(100, pct))}%` }} /></span>
);

/** Οικονομικά: εισπράξεις, έσοδα ανά πηγή (πωλήσεις + τέλη συντήρησης), ταμειακή ροή και απόδοση ανά έργο. */
export default async function FinancialsPage() {
  await requirePermission('financials');
  const supabase = await createSupabaseServerClient();
  const [f, forecast] = await Promise.all([getFinanceSnapshot(), buildFinancialForecast(supabase)]);
  const collectedPct = f.totalRevenue > 0 ? Math.round((f.cashCollected / f.totalRevenue) * 100) : 0;

  return (
    <div className="space-y-5">
      <WorkspaceHeader title="Οικονομικά" description="Εισπράξεις, υπόλοιπα, ταμειακή ροή και απόδοση ανά έργο." />
      <HubLinks cols={3} active="overview" cards={[
        { key: 'overview', icon: 'Wallet', title: 'Επισκόπηση', sub: 'Εισπράξεις, ταμειακή ροή, έργα', href: '/financials' },
        { key: 'invoices', icon: 'Receipt', title: 'Τιμολόγια', sub: 'Τιμολόγια, αποδείξεις, πιστωτικά', href: '/financials/invoices' },
        { key: 'reports', icon: 'BarChart3', title: 'Αναφορές', sub: 'Εισπράξεις & δόσεις, πωλήσεις', href: '/reports?tab=collections' },
      ]} />

      <SummaryTiles items={[
        { label: 'Εισπράξεις', value: f.cashCollected, fmt: 'money' },
        { label: 'Υπόλοιπο προς είσπραξη', value: f.outstandingBalance, fmt: 'money' },
        { label: 'Έσοδα συμβολαίων', value: f.totalRevenue, fmt: 'money' },
        { label: 'Υποχρεώσεις σε εργολάβους', value: f.contractorLiabilities, fmt: 'money' },
      ]} />

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-stone-line px-5 py-4">
          <h4 className="text-[15px] font-semibold text-charcoal">Έσοδα ανά πηγή</h4>
          <p className="text-[13px] text-charcoal-600">Πωλήσεις μονάδων και ετήσια τέλη συντήρησης των ιδιοκτητών.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="o-table">
            <thead><tr><th>Πηγή</th><th className="text-right">Αξία</th><th className="text-right">Εισπράχθηκαν</th><th className="text-right">Υπόλοιπο</th><th className="w-40">Πρόοδος</th></tr></thead>
            <tbody>
              <tr>
                <td className="o-strong"><Link href="/reports?tab=sales" className="hover:text-forest hover:underline">Πωλήσεις μονάδων</Link><span className="block text-[12px] font-normal text-charcoal-600">Υπογεγραμμένα συμβόλαια</span></td>
                <td className="text-right tabular-nums">{formatCurrency(f.totalRevenue)}</td>
                <td className="text-right tabular-nums text-forest">{formatCurrency(f.cashCollected)}</td>
                <td className="text-right tabular-nums">{formatCurrency(f.outstandingBalance)}</td>
                <td><span className="text-[12px] tabular-nums text-charcoal-600">{`${collectedPct}%`}</span><Bar pct={collectedPct} /></td>
              </tr>
              <tr>
                <td className="o-strong"><Link href="/reports?tab=property" className="hover:text-forest hover:underline">Τέλη συντήρησης</Link><span className="block text-[12px] font-normal text-charcoal-600">Ετήσιο τέλος ανά μονάδα</span></td>
                <td className="text-right tabular-nums">{f.maintenanceFeesAnnual != null ? formatCurrency(f.maintenanceFeesAnnual) : '—'}</td>
                <td className="text-right tabular-nums">—</td>
                <td className="text-right tabular-nums">—</td>
                <td className="text-[12px] text-charcoal-600">{f.maintenanceFeesAnnual != null ? 'Ανά έτος' : 'Ορίστε το ετήσιο τέλος στις μονάδες'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <ForecastPanel forecast={forecast} />

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="border-b border-stone-line px-5 py-4"><h4 className="text-[15px] font-semibold text-charcoal">Απόδοση ανά έργο</h4></div>
        {f.projects.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-charcoal-600">Δεν υπάρχουν ακόμη έργα.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="o-table">
              <thead><tr><th>Έργο</th><th>Πωλημένες</th><th className="text-right">Έσοδα</th><th>Εισπράχθηκαν</th><th className="text-right">Εργολάβοι</th><th className="text-right">Καθαρή συνεισφορά</th></tr></thead>
              <tbody>
                {f.projects.map((p) => {
                  const cPct = p.revenue > 0 ? Math.round((p.collected / p.revenue) * 100) : 0;
                  const sPct = p.totalUnits > 0 ? Math.round((p.soldUnits / p.totalUnits) * 100) : 0;
                  return (
                    <tr key={p.projectId}>
                      <td className="o-strong" data-no-tr>{p.name}</td>
                      <td className="w-40"><span className="text-[13px] tabular-nums text-charcoal">{`${p.soldUnits} / ${p.totalUnits}`}</span><Bar pct={sPct} /></td>
                      <td className="text-right tabular-nums">{formatCurrency(p.revenue)}</td>
                      <td className="w-40"><span className="text-[13px] tabular-nums text-forest">{formatCurrency(p.collected)}</span><Bar pct={cPct} /></td>
                      <td className="text-right tabular-nums">{formatCurrency(p.contractorLiabilities)}</td>
                      <td className={`text-right font-semibold tabular-nums ${p.contribution >= 0 ? 'text-forest' : 'text-signal-danger'}`}>{formatCurrency(p.contribution)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-[12px] text-charcoal-600">Καθαρή συνεισφορά = έσοδα συμβολαίων μείον ανοιχτές υποχρεώσεις σε εργολάβους. Διοικητική εικόνα, όχι λογιστικό βιβλίο.</p>
    </div>
  );
}
