import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getFinanceSnapshot } from '@/lib/finance';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { eur } from '@/lib/deal-analyzer';
import type { StructuredReport, ReportSection } from '@/lib/report-pdf';
import { formatLongDate, formatDateTime } from '@/lib/format';

/**
 * Investor Reporting Engine — an investor-ready pack: cash position, expected
 * inflows, active developments, sales velocity, reservations, liabilities, and
 * per-project ROI snapshots. Built from the same ledger as the board pack.
 */

type Client = SupabaseClient<Database>;

export async function buildInvestorReport(supabase: Client): Promise<StructuredReport> {
  const [snapshot, forecast] = await Promise.all([getFinanceSnapshot(), buildFinancialForecast(supabase)]);
  const h = (d: number) => forecast.horizons.find((x) => x.days === d)!;

  const netAssets = snapshot.cashCollected + snapshot.outstandingBalance - snapshot.contractorLiabilities;
  const monthlyRunRate = snapshot.reservationsLast90 / 3;

  const sections: ReportSection[] = [
    {
      title: 'Cash position',
      metrics: [
        { label: 'Cash collected', value: eur(snapshot.cashCollected, { compact: true }) },
        { label: 'Outstanding (contracted)', value: eur(snapshot.outstandingBalance, { compact: true }) },
        { label: 'Net asset position', value: eur(netAssets, { compact: true }), hint: 'collected + receivable − liabilities' },
      ],
    },
    {
      title: 'Expected inflows',
      blurb: 'Projected cash into the business over the next quarter, from scheduled receivables and expected reservation conversions.',
      metrics: [
        { label: 'Next 30 days', value: eur(h(30).inflows, { compact: true }) },
        { label: 'Next 60 days', value: eur(h(60).inflows, { compact: true }) },
        { label: 'Next 90 days', value: eur(h(90).inflows, { compact: true }) },
      ],
    },
    {
      title: 'Active developments',
      table: {
        headers: ['Project', 'Sold/Total', 'Revenue', 'Collected', 'Contribution'],
        rows: snapshot.projects.map((p) => [p.name, `${p.soldUnits}/${p.totalUnits}`, eur(p.revenue, { compact: true }), eur(p.collected, { compact: true }), eur(p.contribution, { compact: true })]),
      },
    },
    {
      title: 'Sales velocity',
      metrics: [
        { label: 'Reservations (90d)', value: String(snapshot.reservationsLast90), hint: `~${monthlyRunRate.toFixed(1)}/mo` },
        { label: 'Avg sales cycle', value: snapshot.avgSalesCycleDays != null ? `${snapshot.avgSalesCycleDays}d` : '—' },
        { label: 'Units sold to date', value: String(snapshot.soldUnits) },
      ],
    },
    {
      title: 'Reservations & liabilities',
      metrics: [
        { label: 'Active reservations', value: String(snapshot.activeReservations) },
        { label: 'Contractor liabilities', value: eur(snapshot.contractorLiabilities, { compact: true }) },
        { label: 'Available inventory', value: String(snapshot.availableUnits) },
      ],
    },
    {
      title: 'ROI snapshots',
      blurb: 'Contribution margin per development — contracted revenue less open contractor liabilities, relative to revenue.',
      table: {
        headers: ['Project', 'Revenue', 'Contribution', 'Margin'],
        rows: snapshot.projects.map((p) => [p.name, eur(p.revenue, { compact: true }), eur(p.contribution, { compact: true }), p.revenue > 0 ? `${Math.round((p.contribution / p.revenue) * 100)}%` : '—']),
      },
    },
  ];

  return {
    title: 'Investor Report',
    subtitle: `Position as at ${formatLongDate(new Date())}`,
    generatedAt: `Generated ${formatDateTime(new Date())}`,
    sections,
  };
}
