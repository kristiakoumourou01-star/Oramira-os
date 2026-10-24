import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getFinanceSnapshot } from '@/lib/finance';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { computeSalesKpis, formatMinutes } from '@/lib/sales-kpi';
import { computeHrAlerts } from '@/lib/hr-intelligence';
import { getEnrichedLeads } from '@/lib/leads';
import { eur } from '@/lib/deal-analyzer';
import type { StructuredReport, ReportSection } from '@/lib/report-pdf';
import { formatLongDate, formatDateTime, formatNumber } from '@/lib/format';

/**
 * Board Reporting Engine — assembles the weekly summary / monthly pack from the
 * live operating data: sales, financials, pipeline health, and the HR, legal,
 * and project-delivery risk registers. One StructuredReport → screen + PDF.
 */

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;
const ACTIVE_PIPE = ['viewing', 'offer', 'negotiating', 'reserved'];

export async function buildBoardReport(supabase: Client, period: 'weekly' | 'monthly'): Promise<StructuredReport> {
  const now = Date.now();
  const windowDays = period === 'weekly' ? 7 : 30;
  const since = new Date(now - windowDays * DAY).toISOString();

  const [snapshot, forecast, kpis, hrAlerts, leads, { data: wonRecent }, { data: projects }, { data: signedPending }, { data: reservationsNoContract }, { data: emergencies }] = await Promise.all([
    getFinanceSnapshot(),
    buildFinancialForecast(supabase),
    computeSalesKpis(supabase),
    computeHrAlerts(supabase),
    getEnrichedLeads(),
    supabase.from('leads').select('id').eq('status', 'won').gte('last_contacted_at', since),
    supabase.from('projects').select('id, name, status, delivery_date, development_type'),
    supabase.from('contracts').select('id, status').in('status', ['draft', 'sent']),
    supabase.from('reservations').select('id, reserved_at, converted_contract_id').eq('status', 'active').is('converted_contract_id', null),
    supabase.from('maintenance_tickets').select('id, title').eq('priority', 'emergency').in('status', ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened']),
  ]);

  const pipelineLeads = leads.filter((l) => ACTIVE_PIPE.includes(l.status));
  const pipelineValue = pipelineLeads.reduce((s, l) => s + Number(l.budget_max ?? l.budget_min ?? 0), 0);
  const hotLeads = leads.filter((l) => l.needs_action && l.priority >= 40);
  const stalled = leads.filter((l) => ACTIVE_PIPE.includes(l.status) && (now - new Date(l.last_contacted_at ?? l.created_at).getTime()) > 7 * DAY);
  const h = (d: number) => forecast.horizons.find((x) => x.days === d)!;

  // Stage distribution
  const stageCounts = new Map<string, number>();
  for (const l of leads) if (!['won', 'lost'].includes(l.status)) stageCounts.set(l.status, (stageCounts.get(l.status) ?? 0) + 1);
  const stageLine = [...stageCounts.entries()].sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(' · ') || 'none';

  const sections: ReportSection[] = [
    {
      title: 'Executive summary',
      metrics: [
        { label: 'Cash collected', value: eur(snapshot.cashCollected, { compact: true }) },
        { label: 'Open pipeline', value: eur(pipelineValue, { compact: true }), hint: `${pipelineLeads.length} active deals` },
        { label: `Won (${windowDays}d)`, value: String((wonRecent ?? []).length) },
        { label: 'Outstanding balance', value: eur(snapshot.outstandingBalance, { compact: true }) },
        { label: 'Active reservations', value: String(snapshot.activeReservations) },
        { label: 'Net 30d cashflow', value: eur(h(30).net, { compact: true }) },
      ],
    },
    {
      title: 'Sales performance',
      metrics: [
        { label: 'Avg speed-to-lead', value: formatMinutes(kpis.speedToLeadAvgMinutes) },
        { label: 'Response rate', value: `${kpis.responseRatePct}%` },
        { label: 'Booking rate', value: `${kpis.bookingRatePct}%` },
        { label: 'Viewing→reservation', value: `${kpis.viewingToReservationPct}%` },
        { label: 'Reservation→sale', value: `${kpis.reservationToSalePct}%` },
        { label: 'Commissions pending', value: eur(kpis.commissionsPending, { compact: true }) },
      ],
      table: { headers: ['Agent', 'Leads', 'Won', 'Pending €'], rows: kpis.agents.slice(0, 6).map((a) => [a.name, String(a.leads), String(a.won), formatNumber(Math.round(a.commissionPending))]) },
    },
    {
      title: 'Financial performance',
      metrics: [
        { label: 'Contracted revenue', value: eur(snapshot.totalRevenue, { compact: true }) },
        { label: 'Contractor liabilities', value: eur(snapshot.contractorLiabilities, { compact: true }) },
        { label: 'Net 60d', value: eur(h(60).net, { compact: true }) },
        { label: 'Net 90d', value: eur(h(90).net, { compact: true }) },
        { label: 'Units sold', value: String(snapshot.soldUnits) },
        { label: 'Units available', value: String(snapshot.availableUnits) },
      ],
    },
    {
      title: 'Pipeline health',
      blurb: `Stage distribution: ${stageLine}.`,
      metrics: [
        { label: 'Active leads', value: String(snapshot.activeLeads) },
        { label: 'Hot leads', value: String(hotLeads.length), hint: 'need action now' },
        { label: 'Stalled deals', value: String(stalled.length), hint: '7d+ quiet in closing stage' },
      ],
    },
    riskSection('HR risks', hrAlerts.filter((a) => a.severity !== 'low').slice(0, 6).map((a) => `${a.employee}: ${a.message}`), 'No material HR risks flagged.'),
    riskSection('Legal risks', legalRisks(signedPending ?? [], reservationsNoContract ?? [], hrAlerts, now), 'No outstanding legal exposures.'),
    riskSection('Project delivery risks', deliveryRisks(projects ?? [], emergencies ?? [], snapshot), 'Delivery on track across projects.'),
  ];

  return {
    title: period === 'weekly' ? 'Weekly Board Summary' : 'Monthly Board Pack',
    subtitle: `${period === 'weekly' ? 'Week to' : 'Month to'} ${formatLongDate(new Date())}`,
    generatedAt: `Generated ${formatDateTime(new Date())}`,
    sections,
  };
}

function riskSection(title: string, bullets: string[], emptyText: string): ReportSection {
  return { title, bullets: bullets.length ? bullets : [emptyText] };
}

function legalRisks(signed: any[], resvNoContract: any[], hrAlerts: any[], now: number): string[] {
  const out: string[] = [];
  if (signed.length) out.push(`${signed.length} buyer contract(s) unsigned (draft/sent) — chase execution.`);
  const stale = resvNoContract.filter((r) => (now - new Date(r.reserved_at).getTime()) > 7 * DAY);
  if (stale.length) out.push(`${stale.length} reservation(s) held 7+ days without a contract issued.`);
  const expiredActive = hrAlerts.filter((a) => a.category === 'Contract' && /expired/.test(a.message));
  if (expiredActive.length) out.push(`${expiredActive.length} employee contract(s) expired but still marked active.`);
  return out;
}

function deliveryRisks(projects: any[], emergencies: any[], snapshot: any): string[] {
  const out: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = projects.filter((p) => p.delivery_date && p.delivery_date < today && p.status !== 'completed');
  if (overdue.length) out.push(`${overdue.length} project(s) past delivery date: ${overdue.slice(0, 3).map((p: any) => p.name).join(', ')}.`);
  if (emergencies.length) out.push(`${emergencies.length} emergency maintenance ticket(s) open.`);
  if (snapshot.availableUnits <= 3) out.push(`Inventory low — only ${snapshot.availableUnits} unit(s) available; plan the next release.`);
  return out;
}
