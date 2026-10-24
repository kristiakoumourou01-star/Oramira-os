import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Personal executive morning brief — aggregates the day's operational signals
 * for one user (scoped by RLS through the caller's client) and composes a short,
 * actionable summary. Deterministic by default; the email path may AI-enhance.
 */

export interface BriefStat { key: string; label: string; count: number; tone: 'urgent' | 'info' | 'good'; href: string }
export interface MorningBrief {
  meetingsToday: number;
  overdueTasks: number;
  hotLeads: number;
  urgentFollowUps: number;
  pendingApprovals: number;
  contractExpiries: number;
  payrollDue: boolean;
  reservationDeadlines: number;
  maintenanceIssues: number;
  stats: BriefStat[];
  summary: string;
}

type Client = SupabaseClient<Database>;
const OPEN_TICKET = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];

async function count(q: PromiseLike<{ count: number | null }>): Promise<number> {
  try { const { count: c } = await q; return c ?? 0; } catch { return 0; }
}

export async function buildMorningBrief(supabase: Client, profileId: string): Promise<MorningBrief> {
  const now = new Date();
  const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
  const nowISO = now.toISOString();
  const startISO = dayStart.toISOString();
  const endISO = dayEnd.toISOString();
  const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
  const in3 = new Date(now.getTime() + 3 * 86400000).toISOString();
  const todayISO = now.toISOString().slice(0, 10);

  const head = (t: any) => t.select('id', { count: 'exact', head: true });

  const [calMeetings, viewingsToday, tasksOverdue, followOverdue, hotLeads, urgentFollowUps, approvals, contractExp, reservations, maintenance] = await Promise.all([
    count(head(supabase.from('calendar_events')).eq('profile_id', profileId).neq('status', 'cancelled').gte('start_at', startISO).lte('start_at', endISO)),
    count(head(supabase.from('viewings')).eq('agent_id', profileId).eq('status', 'scheduled').gte('scheduled_at', startISO).lte('scheduled_at', endISO)),
    count(head(supabase.from('tasks')).eq('assigned_to', profileId).eq('is_done', false).lt('due_at', nowISO)),
    count(head(supabase.from('follow_up_tasks')).eq('assigned_to', profileId).eq('is_done', false).lt('due_at', nowISO)),
    count(head(supabase.from('leads')).eq('assigned_to', profileId).eq('status', 'new').is('first_response_at', null)),
    count(head(supabase.from('follow_up_tasks')).eq('assigned_to', profileId).eq('is_done', false).lte('due_at', endISO)),
    count(head(supabase.from('leave_requests')).eq('status', 'pending')),
    count(head(supabase.from('employee_contracts')).eq('status', 'active').gte('expiry_date', todayISO).lte('expiry_date', in30)),
    count(head(supabase.from('reservations')).eq('created_by', profileId).eq('status', 'active').gte('expires_at', nowISO).lte('expires_at', in3)),
    count(head(supabase.from('maintenance_tickets')).in('status', OPEN_TICKET)),
  ]);

  const meetingsToday = calMeetings + viewingsToday;
  const overdueTasks = tasksOverdue + followOverdue;
  const dom = now.getDate();
  const payrollDue = dom >= 22 && dom <= 25; // approaching monthly payroll run

  const stats: BriefStat[] = ([
    { key: 'meetings', label: 'Meetings today', count: meetingsToday, tone: 'info', href: '/dashboard' },
    { key: 'overdue', label: 'Overdue tasks', count: overdueTasks, tone: 'urgent', href: '/dashboard' },
    { key: 'hot', label: 'Hot leads to contact', count: hotLeads, tone: 'urgent', href: '/crm/leads' },
    { key: 'followups', label: 'Follow-ups due', count: urgentFollowUps, tone: 'info', href: '/crm/leads' },
    { key: 'approvals', label: 'Pending approvals', count: approvals, tone: 'info', href: '/hr' },
    { key: 'contracts', label: 'Contracts expiring', count: contractExpiries(contractExp), tone: 'info', href: '/hr' },
    { key: 'reservations', label: 'Reservation deadlines', count: reservations, tone: 'urgent', href: '/crm/leads' },
    { key: 'maintenance', label: 'Open maintenance', count: maintenance, tone: 'info', href: '/property' },
  ] as BriefStat[]).filter((s) => s.count > 0);

  const summary = composeSummary({ meetingsToday, overdueTasks, hotLeads, urgentFollowUps, approvals, contractExp, payrollDue, reservations, maintenance });

  return { meetingsToday, overdueTasks, hotLeads, urgentFollowUps, pendingApprovals: approvals, contractExpiries: contractExp, payrollDue, reservationDeadlines: reservations, maintenanceIssues: maintenance, stats, summary };
}

function contractExpiries(n: number) { return n; }

function composeSummary(d: { meetingsToday: number; overdueTasks: number; hotLeads: number; urgentFollowUps: number; approvals: number; contractExp: number; payrollDue: boolean; reservations: number; maintenance: number }): string {
  const parts: string[] = [];
  parts.push(d.meetingsToday > 0 ? `You have ${d.meetingsToday} meeting${d.meetingsToday === 1 ? '' : 's'} today` : 'No meetings scheduled today');
  if (d.overdueTasks > 0) parts.push(`${d.overdueTasks} task${d.overdueTasks === 1 ? ' is' : 's are'} overdue`);
  if (d.hotLeads > 0) parts.push(`${d.hotLeads} hot lead${d.hotLeads === 1 ? '' : 's'} still need${d.hotLeads === 1 ? 's' : ''} a first response`);
  if (d.urgentFollowUps > 0) parts.push(`${d.urgentFollowUps} follow-up${d.urgentFollowUps === 1 ? '' : 's'} due`);
  if (d.reservations > 0) parts.push(`${d.reservations} reservation${d.reservations === 1 ? '' : 's'} lapsing soon`);
  if (d.approvals > 0) parts.push(`${d.approvals} approval${d.approvals === 1 ? '' : 's'} pending`);
  if (d.contractExp > 0) parts.push(`${d.contractExp} contract${d.contractExp === 1 ? '' : 's'} expiring within 30 days`);
  if (d.maintenance > 0) parts.push(`${d.maintenance} open maintenance ticket${d.maintenance === 1 ? '' : 's'}`);
  if (d.payrollDue) parts.push('payroll run is due this week');

  const priority = d.hotLeads > 0 ? 'Start with the leads awaiting a first response — speed wins.'
    : d.overdueTasks > 0 ? 'Clear the overdue items first.'
    : d.reservations > 0 ? 'Protect the reservations lapsing soon.'
    : 'A clear day — a good chance to get ahead.';

  const body = parts.length ? parts.join('; ') + '.' : 'Nothing pressing on the board.';
  return `${body} ${priority}`;
}
