import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getEnrichedLeads } from '@/lib/leads';
import { buildFinancialForecast } from '@/lib/financial-forecast';
import { computeLearningInsights } from '@/lib/learning-loop';
import type { PriorityModule, PriorityItem, RiskItem, Bottleneck, CommandCenter } from '@/lib/command-center-shared';

/**
 * Executive Command Center — a single CEO-level read across every module. The
 * AI Priority Engine ranks leads, tasks, approvals, maintenance and finance
 * actions into one queue; the command center then frames the day: top
 * priorities, biggest risks, cashflow risks, team bottlenecks, and the urgent
 * contracts / deals / maintenance. Org-wide (admins/management), RLS-scoped.
 * Types live in the client-safe shared module.
 */

export type { PriorityModule, PriorityItem, RiskItem, Bottleneck, CommandCenter } from '@/lib/command-center-shared';
import { formatCurrency } from '@/lib/format';

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export async function buildCommandCenter(supabase: Client): Promise<CommandCenter> {
  const now = Date.now();
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);

  const [leads, { data: tasks }, { data: approvals }, { data: tickets }, { data: schedules }, { data: payments }, { data: reservations }, { data: empContracts }, { data: buyerContracts }, { data: profiles }, forecast, learning] = await Promise.all([
    getEnrichedLeads(),
    supabase.from('tasks').select('id, title, due_at, assigned_to, related_entity_type, related_entity_id').eq('is_done', false),
    supabase.from('leave_requests').select('id, leave_type, created_at, profiles(full_name)').eq('status', 'pending'),
    supabase.from('maintenance_tickets').select('id, title, priority, status, created_at').in('status', ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened']),
    supabase.from('payment_schedules').select('id, amount, due_date').not('due_date', 'is', null),
    supabase.from('payments').select('payment_schedule_id, amount_paid'),
    supabase.from('reservations').select('id, deposit_paid, expires_at, contacts:buyer_contact_id(full_name)').eq('status', 'active').not('expires_at', 'is', null),
    supabase.from('employee_contracts').select('id, title, expiry_date, profiles(full_name)').eq('status', 'active').not('expiry_date', 'is', null),
    supabase.from('contracts').select('id, status').in('status', ['draft', 'sent']),
    supabase.from('profiles').select('id, full_name'),
    buildFinancialForecast(supabase),
    computeLearningInsights(supabase),
  ]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name ?? 'Team member']));
  const queue: PriorityItem[] = [];

  // ── Leads (needs-action only) ──
  for (const l of leads) {
    if (!l.needs_action || ['won', 'lost'].includes(l.status)) continue;
    queue.push({ id: `lead_${l.id}`, module: 'lead', title: l.full_name ?? 'Lead', subtitle: `${l.status} · owner ${l.owner_name ?? 'unassigned'}`, score: clamp(l.priority), href: `/crm/leads/${l.id}`, due: l.next_follow_up });
  }

  // ── Tasks (overdue / today) ──
  for (const t of tasks ?? []) {
    if (!t.due_at) continue;
    const due = new Date(t.due_at).getTime();
    if (due > todayEnd.getTime()) continue;
    const overdueDays = Math.max(0, (now - due) / DAY);
    const score = due < now ? clamp(70 + overdueDays * 4) : 55;
    const href = t.related_entity_type === 'lead' && t.related_entity_id ? `/crm/leads/${t.related_entity_id}` : '/dashboard';
    queue.push({ id: `task_${t.id}`, module: 'task', title: t.title, subtitle: due < now ? `overdue ${Math.floor(overdueDays)}d · ${nameById.get(t.assigned_to ?? '') ?? 'unassigned'}` : 'due today', score, href, due: t.due_at });
  }

  // ── Approvals (pending leave) ──
  for (const a of approvals ?? []) {
    const days = Math.floor((now - new Date(a.created_at).getTime()) / DAY);
    queue.push({ id: `appr_${a.id}`, module: 'approval', title: `Approve ${a.leave_type} leave — ${(a as any).profiles?.full_name ?? 'employee'}`, subtitle: `pending ${days}d`, score: clamp(55 + days * 5), href: '/hr', due: null });
  }

  // ── Maintenance (open) ──
  const PRIO_BASE: Record<string, number> = { emergency: 92, high: 78, medium: 52, low: 32 };
  for (const t of tickets ?? []) {
    const ageDays = (now - new Date(t.created_at).getTime()) / DAY;
    queue.push({ id: `maint_${t.id}`, module: 'maintenance', title: t.title, subtitle: `${t.priority} · ${t.status} · ${Math.floor(ageDays)}d old`, score: clamp((PRIO_BASE[t.priority] ?? 40) + ageDays * 2), href: '/property', due: null });
  }

  // ── Finance (overdue receivables, unpaid reservations) ──
  const paidBySchedule = new Map<string, number>();
  for (const p of payments ?? []) { if (p.payment_schedule_id) paidBySchedule.set(p.payment_schedule_id, (paidBySchedule.get(p.payment_schedule_id) ?? 0) + Number(p.amount_paid ?? 0)); }
  let overdueReceivables = 0;
  for (const s of schedules ?? []) {
    if (!s.due_date || new Date(s.due_date).getTime() >= now) continue;
    const outstanding = Number(s.amount ?? 0) - (paidBySchedule.get(s.id) ?? 0);
    if (outstanding <= 0) continue;
    overdueReceivables += outstanding;
    const days = Math.floor((now - new Date(s.due_date).getTime()) / DAY);
    queue.push({ id: `fin_${s.id}`, module: 'finance', title: `Overdue payment · ${formatCurrency(Math.round(outstanding))}`, subtitle: `due ${days}d ago`, score: clamp(75 + days), href: '/financials', due: s.due_date });
  }
  for (const r of reservations ?? []) {
    if (r.deposit_paid) continue;
    const days = Math.floor((new Date(r.expires_at!).getTime() - now) / DAY);
    if (days > 7) continue;
    queue.push({ id: `fin_res_${r.id}`, module: 'finance', title: `Unpaid deposit — ${(r as any).contacts?.full_name ?? 'buyer'}`, subtitle: days < 0 ? 'reservation lapsed' : `lapses in ${days}d`, score: clamp(80 + (7 - days) * 2), href: '/crm/leads', due: r.expires_at });
  }

  queue.sort((a, b) => b.score - a.score);

  // ── Biggest risks ──
  const risks: RiskItem[] = [];
  const atRiskDeals = leads.filter((l) => ['offer', 'negotiating', 'reserved'].includes(l.status) && (now - new Date(l.last_contacted_at ?? l.created_at).getTime()) / DAY > 7);
  if (atRiskDeals.length) risks.push({ label: `${atRiskDeals.length} closing-stage deal(s) going cold`, detail: atRiskDeals.slice(0, 3).map((l) => l.full_name ?? 'Lead').join(', '), severity: 'high' });
  const unresponded = leads.filter((l) => l.status === 'new' && l.needs_action);
  if (unresponded.length) risks.push({ label: `${unresponded.length} new lead(s) awaiting first response`, detail: 'Speed-to-lead breach — assign or contact now.', severity: unresponded.length > 3 ? 'high' : 'medium' });
  const emergencies = (tickets ?? []).filter((t) => t.priority === 'emergency');
  if (emergencies.length) risks.push({ label: `${emergencies.length} emergency maintenance ticket(s)`, detail: emergencies.slice(0, 2).map((t) => t.title).join(', '), severity: 'high' });
  if (overdueReceivables > 0) risks.push({ label: `${formatCurrency(Math.round(overdueReceivables))} in overdue receivables`, detail: 'Cash owed past its due date.', severity: overdueReceivables > 100000 ? 'high' : 'medium' });

  // ── Cashflow risks ──
  const h = (d: number) => forecast.horizons.find((x) => x.days === d)!;
  const cashflow = {
    net30: h(30).net, net60: h(60).net, net90: h(90).net, overdueReceivables,
    note: h(30).net < 0 ? `Projected 30-day cashflow is negative (${formatCurrency(Math.round(h(30).net))}) — outflows outpace expected inflows.` : 'Projected 30-day cashflow is positive.',
  };

  // ── Team bottlenecks ──
  const by = new Map<string, { overdue: number; unresponded: number }>();
  const bump = (id: string | null, key: 'overdue' | 'unresponded') => { if (!id) return; const e = by.get(id) ?? { overdue: 0, unresponded: 0 }; e[key] += 1; by.set(id, e); };
  for (const t of tasks ?? []) if (t.due_at && new Date(t.due_at).getTime() < now) bump(t.assigned_to, 'overdue');
  for (const l of unresponded) bump(l.owner_id, 'unresponded');
  const bottlenecks: Bottleneck[] = [...by.entries()]
    .map(([id, v]) => ({ name: nameById.get(id) ?? 'Team member', overdueTasks: v.overdue, unresponded: v.unresponded }))
    .filter((b) => b.overdueTasks + b.unresponded >= 2)
    .sort((a, b) => (b.overdueTasks + b.unresponded) - (a.overdueTasks + a.unresponded)).slice(0, 5);

  // ── Urgent contracts ──
  const urgentContracts: { label: string; days: number }[] = [];
  for (const c of empContracts ?? []) {
    const days = Math.floor((new Date(c.expiry_date!).getTime() - now) / DAY);
    if (days <= 15) urgentContracts.push({ label: `${(c as any).profiles?.full_name ?? 'Employee'} — ${c.title}`, days });
  }
  const pendingBuyer = (buyerContracts ?? []).length;
  if (pendingBuyer) urgentContracts.push({ label: `${pendingBuyer} buyer contract(s) unsigned`, days: 0 });
  urgentContracts.sort((a, b) => a.days - b.days);

  // ── Urgent deals & maintenance ──
  const urgentDeals = atRiskDeals.slice(0, 5).map((l) => ({ id: l.id, name: l.full_name ?? 'Lead', reason: `${l.status} · quiet ${Math.floor((now - new Date(l.last_contacted_at ?? l.created_at).getTime()) / DAY)}d` }));
  const urgentMaintenance = (tickets ?? [])
    .filter((t) => t.priority === 'emergency' || t.priority === 'high')
    .map((t) => ({ id: t.id, title: t.title, priority: t.priority, ageDays: Math.floor((now - new Date(t.created_at).getTime()) / DAY) }))
    .sort((a, b) => b.ageDays - a.ageDays).slice(0, 5);

  // ── Learning headline ──
  const topSource = learning.sources.find((s) => s.total >= 3);
  const learningItems = [
    topSource ? `${topSource.source} converts best (${topSource.conversionPct}% over ${topSource.total} deals).` : learning.sources[0] ? `${learning.sources[0].source} leads the funnel so far.` : 'Not enough closed deals to rank sources yet.',
    learning.responseTime.verdict,
    learning.cadence.verdict,
    learning.negotiation.verdict,
  ];

  return {
    topPriorities: queue.slice(0, 5),
    queueSize: queue.length,
    risks,
    cashflow,
    bottlenecks,
    urgentContracts: urgentContracts.slice(0, 5),
    urgentDeals,
    urgentMaintenance,
    learning: { headline: `Learned from ${learning.sampleSize} closed deals`, items: learningItems },
  };
}
