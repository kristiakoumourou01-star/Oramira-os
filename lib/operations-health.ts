import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { countListingsNeedingAttention } from '@/lib/listing-health';

/**
 * Operational health — a deterministic cross-module monitor of where work is
 * stuck or at risk across the whole business (leads, follow-ups, tasks,
 * approvals, contracts, maintenance, automations). Answers the Operations
 * Director's question — "where is the business leaking right now?" — without
 * anyone running a report. Each signal is a count + severity + a one-click jump
 * to fix it. Every query is resilient (returns 0 on error) so one drifted table
 * never blanks the whole board.
 */

type Client = SupabaseClient<Database>;

export type OpsSeverity = 'ok' | 'warn' | 'risk';
export interface OpsSignal { key: string; label: string; count: number; severity: OpsSeverity; insight: string; href: string }

const MAINTENANCE_OPEN = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];

export async function buildOperationsHealth(supabase: Client): Promise<OpsSignal[]> {
  const now = new Date().toISOString();
  const in30 = new Date(Date.now() + 30 * 86400_000).toISOString();
  const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString();

  const count = async (build: () => any): Promise<number> => {
    try { const { count, error } = await build(); return error ? 0 : (count ?? 0); } catch { return 0; }
  };

  // Listings needing attention — reuse the shared Listing Health engine.
  const listingsNeedingAttention = await (async () => {
    try {
      const { data, error } = await supabase.from('units').select('id, price, bedrooms, sqm, status, created_at').eq('status', 'available');
      if (error) return 0;
      return countListingsNeedingAttention((data ?? []).map((u: any) => ({ id: u.id, price: u.price, bedrooms: u.bedrooms, sqm: u.sqm, status: u.status, createdAt: u.created_at })));
    } catch { return 0; }
  })();

  const [unassignedLeads, overdueFollowups, overdueTasks, pendingLeave, expiringContracts, openMaintenance, failedAutomations] = await Promise.all([
    count(() => supabase.from('leads').select('id', { count: 'exact', head: true }).is('assigned_to', null).not('status', 'in', '("won","lost")')),
    count(() => supabase.from('follow_up_tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lt('due_at', now)),
    count(() => supabase.from('tasks').select('id', { count: 'exact', head: true }).eq('is_done', false).lt('due_at', now)),
    count(() => supabase.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
    count(() => supabase.from('employee_contracts').select('id', { count: 'exact', head: true }).eq('status', 'active').not('expiry_date', 'is', null).gte('expiry_date', now).lte('expiry_date', in30)),
    count(() => supabase.from('maintenance_tickets').select('id', { count: 'exact', head: true }).in('status', MAINTENANCE_OPEN)),
    count(() => supabase.from('automation_runs').select('id', { count: 'exact', head: true }).neq('status', 'success').gte('started_at', weekAgo)),
  ]);

  const sev = (n: number, riskAt = 5): OpsSeverity => (n === 0 ? 'ok' : n >= riskAt ? 'risk' : 'warn');

  return [
    { key: 'unassigned', label: 'Unassigned leads', count: unassignedLeads, severity: sev(unassignedLeads, 3), insight: unassignedLeads ? 'Assign an owner so none get dropped' : 'Every lead has an owner', href: '/crm/leads' },
    { key: 'overdue_followups', label: 'Overdue follow-ups', count: overdueFollowups, severity: sev(overdueFollowups), insight: overdueFollowups ? 'Clear overdue follow-ups today' : 'Follow-ups on track', href: '/crm/leads?tab=followups' },
    { key: 'overdue_tasks', label: 'Overdue tasks', count: overdueTasks, severity: sev(overdueTasks), insight: overdueTasks ? 'Tasks past due across the team' : 'No overdue tasks', href: '/dashboard' },
    { key: 'pending_leave', label: 'Pending approvals', count: pendingLeave, severity: sev(pendingLeave, 3), insight: pendingLeave ? 'Leave requests awaiting a decision' : 'No approvals waiting', href: '/hr?tab=leave' },
    { key: 'expiring_contracts', label: 'Contracts expiring · 30d', count: expiringContracts, severity: sev(expiringContracts, 3), insight: expiringContracts ? 'Renew before they lapse' : 'None expiring soon', href: '/hr?tab=contracts' },
    { key: 'open_maintenance', label: 'Open maintenance', count: openMaintenance, severity: sev(openMaintenance, 8), insight: openMaintenance ? 'Tickets awaiting resolution' : 'No open tickets', href: '/property/maintenance' },
    { key: 'listings_attention', label: 'Listings need attention', count: listingsNeedingAttention, severity: sev(listingsNeedingAttention, 3), insight: listingsNeedingAttention ? 'Unpriced, stale or low-interest listings' : 'Listings are healthy', href: '/property' },
    { key: 'failed_automations', label: 'Failed automations · 7d', count: failedAutomations, severity: sev(failedAutomations, 3), insight: failedAutomations ? 'Runs failed — check the logs' : 'Automations healthy', href: '/automation' },
  ];
}
