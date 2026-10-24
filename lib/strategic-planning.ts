import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { eur } from '@/lib/deal-analyzer';

/**
 * Strategic Planning Engine — a quarterly, deterministic scan for structural
 * gaps (hiring, pipeline, projects, cashflow, contractor load, operations) that
 * turns each finding into a recommended action. Threshold-based, not ML: the
 * point is a defensible board-level agenda, refreshed from live data.
 */

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;

export interface PlanItem { area: string; finding: string; recommendation: string; severity: 'high' | 'medium' | 'low' }
export interface StrategicPlan { quarter: string; summary: string; items: PlanItem[] }

const LEADS_PER_AGENT_MAX = 40;
const TICKETS_PER_PROP_MAX = 15;
const MIN_INVENTORY = 4;
const MIN_NEW_LEADS_30D = 15;

function quarterLabel(d = new Date()) { return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`; }

export async function buildStrategicPlan(supabase: Client): Promise<StrategicPlan> {
  const now = Date.now();
  const cut30 = new Date(now - 30 * DAY).toISOString();

  const [{ data: leads }, { data: profiles }, { data: units }, { data: tickets }, { data: invoices }, { data: contractors }, { data: tasks }, forecast] = await Promise.all([
    supabase.from('leads').select('id, status, created_at, assigned_to'),
    supabase.from('profiles').select('id, role'),
    supabase.from('units').select('id, status'),
    supabase.from('maintenance_tickets').select('id, status, contractor_id'),
    supabase.from('contractor_invoices').select('id, contractor_id, status'),
    supabase.from('contractors').select('id, company_name'),
    supabase.from('tasks').select('id, assigned_to, due_at, is_done').eq('is_done', false),
    buildFinancialForecast(supabase),
  ]);

  const items: PlanItem[] = [];
  const roleCount = (r: string) => (profiles ?? []).filter((p) => p.role === r).length;
  const activeLeads = (leads ?? []).filter((l) => !['won', 'lost'].includes(l.status));
  const salesAgents = Math.max(1, roleCount('sales'));
  const propStaff = Math.max(1, (profiles ?? []).filter((p) => ['property', 'construction'].includes(p.role)).length);

  // ── Hiring needs ──
  const leadsPerAgent = Math.round(activeLeads.length / salesAgents);
  if (leadsPerAgent > LEADS_PER_AGENT_MAX) items.push({ area: 'Hiring', severity: leadsPerAgent > LEADS_PER_AGENT_MAX * 1.5 ? 'high' : 'medium', finding: `${leadsPerAgent} active leads per sales agent (${activeLeads.length} across ${salesAgents}).`, recommendation: 'Add a sales agent — load is above the ~40/agent service threshold, risking slow response and lost deals.' });
  const openTickets = (tickets ?? []).filter((t) => !['resolved', 'closed'].includes(t.status)).length;
  if (openTickets / propStaff > TICKETS_PER_PROP_MAX) items.push({ area: 'Hiring', severity: 'medium', finding: `${openTickets} open maintenance tickets across ${propStaff} property staff.`, recommendation: 'Expand the property/maintenance team or onboard additional contractors to clear the backlog.' });

  // ── Pipeline gaps ──
  const newLeads30 = (leads ?? []).filter((l) => l.created_at >= cut30).length;
  if (newLeads30 < MIN_NEW_LEADS_30D) items.push({ area: 'Pipeline', severity: newLeads30 < MIN_NEW_LEADS_30D / 2 ? 'high' : 'medium', finding: `Only ${newLeads30} new leads in the last 30 days.`, recommendation: 'Increase marketing spend / reactivate dormant channels — top-of-funnel is thin for the coming quarter.' });
  const advanced = activeLeads.filter((l) => ['offer', 'negotiating', 'reserved'].includes(l.status)).length;
  if (advanced < 3) items.push({ area: 'Pipeline', severity: 'medium', finding: `${advanced} deal(s) in closing stages.`, recommendation: 'Late-stage pipeline is light — prioritise moving qualified leads to viewing and offer to protect next-quarter revenue.' });

  // ── Project / inventory gaps ──
  const available = (units ?? []).filter((u) => u.status === 'available').length;
  if (available <= MIN_INVENTORY) items.push({ area: 'Projects', severity: available <= 1 ? 'high' : 'medium', finding: `Only ${available} unit(s) available for sale.`, recommendation: 'Plan the next development release or acquisition — inventory will not sustain the current sales run-rate.' });

  // ── Cashflow gaps ──
  const neg = forecast.horizons.find((h) => h.net < 0);
  if (neg) items.push({ area: 'Cashflow', severity: neg.days <= 30 ? 'high' : 'medium', finding: `Projected net cashflow turns negative within ${neg.days} days (${eur(neg.net, { compact: true })}).`, recommendation: 'Sequence outflows (contractor payments, hiring) and accelerate receivables collection to bridge the gap.' });

  // ── Contractor load ──
  const invByContractor = new Map<string, number>();
  for (const iv of invoices ?? []) if (iv.contractor_id && iv.status !== 'paid') invByContractor.set(iv.contractor_id, (invByContractor.get(iv.contractor_id) ?? 0) + 1);
  const topContractor = [...invByContractor.entries()].sort((a, b) => b[1] - a[1])[0];
  const totalOpenInv = [...invByContractor.values()].reduce((s, n) => s + n, 0);
  if (topContractor && totalOpenInv > 0 && topContractor[1] / totalOpenInv > 0.6 && totalOpenInv >= 3) {
    const name = (contractors ?? []).find((c) => c.id === topContractor[0])?.company_name ?? 'one contractor';
    items.push({ area: 'Contractors', severity: 'medium', finding: `${Math.round((topContractor[1] / totalOpenInv) * 100)}% of open contractor work sits with ${name}.`, recommendation: 'Diversify the contractor panel to reduce delivery and pricing concentration risk.' });
  }

  // ── Operational bottlenecks ──
  const overdueByStaff = new Map<string, number>();
  for (const t of tasks ?? []) if (t.assigned_to && t.due_at && new Date(t.due_at).getTime() < now) overdueByStaff.set(t.assigned_to, (overdueByStaff.get(t.assigned_to) ?? 0) + 1);
  const overloaded = [...overdueByStaff.values()].filter((n) => n >= 5).length;
  if (overloaded > 0) items.push({ area: 'Operations', severity: 'medium', finding: `${overloaded} team member(s) carrying 5+ overdue tasks.`, recommendation: 'Rebalance workload or automate routine tasks — sustained overload signals a process or staffing gap.' });

  const highs = items.filter((i) => i.severity === 'high').length;
  const summary = items.length === 0
    ? 'No structural gaps detected this quarter — the business is operating within healthy thresholds.'
    : `${items.length} strategic item(s) identified${highs ? `, ${highs} high-priority` : ''}. Focus the quarter on ${[...new Set(items.filter((i) => i.severity === 'high').map((i) => i.area))].join(', ') || items[0].area}.`;

  return { quarter: quarterLabel(), summary, items: items.sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.severity] - ({ high: 0, medium: 1, low: 2 })[b.severity]) };
}
