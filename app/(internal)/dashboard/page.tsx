import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ROLE_LABEL, INTERNAL_ROLES, type AppRole } from '@/lib/permissions';
import Link from 'next/link';
import { DownloadPayslipButton } from '@/components/hr/DownloadPayslipButton';
import { type CalendarEvent } from '@/components/dashboard/CalendarStrip';
import { PlannerBoard } from '@/components/dashboard/PlannerBoard';
import { MorningBrief } from '@/components/dashboard/MorningBrief';
import { buildRoutePlan } from '@/lib/route-planner';
import { ExecutiveCommandCenter } from '@/components/dashboard/ExecutiveCommandCenter';
import { buildCommandCenter } from '@/lib/command-center';
import { KpiStrip, type KpiSegment } from '@/components/dashboard/KpiStrip';
import { CompactTaskList, type CompactTask } from '@/components/dashboard/CompactTaskList';
import { NotificationsPanel } from '@/components/dashboard/NotificationsPanel';
import { AvatarStack } from '@/components/dashboard/AvatarStack';
import { GoogleCalendarConnect } from '@/components/dashboard/GoogleCalendarConnect';
import { computeLeaveSummary } from '@/lib/leave';
import { getGoogleEventsForUser, isCalendarConnected } from '@/lib/calendar-sync';
import { getEnrichedLeads } from '@/lib/leads';
import { Wallet, FileText, BadgePercent, Bell, CheckSquare, Plane, Video, Target, Flame, Clock, TrendingUp, CalendarClock } from 'lucide-react';
import { formatDayMonth, formatWeekdayTime, formatCurrency } from '@/lib/format';
import { nextBestAction } from '@/lib/next-best-action';

const DAY = 24 * 60 * 60 * 1000;

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`ws-card ws-card-hover ${className}`}>{children}</div>
);
const PanelTitle = ({ icon: Icon, children, action }: { icon: any; children: React.ReactNode; action?: React.ReactNode }) => (
  <div className="mb-4 flex items-center justify-between">
    <h4 className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight text-charcoal"><span className="ws-ico"><Icon size={15} strokeWidth={1.9} /></span> {children}</h4>
    {action}
  </div>
);
// Deterministic currency grouping (no locale → identical on server + client).

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const year = new Date().getFullYear();
  const winStart = new Date(Date.now() - 7 * DAY).toISOString();
  const winEnd = new Date(Date.now() + 30 * DAY).toISOString();

  const [{ data: me }, { data: balances }, { data: requests }, { data: payslips }, { data: contracts }, { data: followUps }, { data: tasks }, { data: commissions }, { data: viewings }, { data: notifications }, { data: approvals }, calConn, googleEvents, leadsEnriched, projectsRes, calEventsRes, teamRes] =
    await Promise.all([
      supabase.from('profiles').select('full_name, role, job_title, department, employment_start_date, work_schedule, annual_leave_days, sick_leave_days').eq('id', profile.id).maybeSingle(),
      supabase.from('leave_balances').select('leave_type, total_days, used_days').eq('profile_id', profile.id).eq('year', year),
      supabase.from('leave_requests').select('id, leave_type, start_date, end_date, days, status').eq('profile_id', profile.id).gte('start_date', `${year}-01-01`).order('created_at', { ascending: false }),
      supabase.from('payslips').select('id, period, net_amount, currency').eq('profile_id', profile.id).eq('status', 'approved').order('issued_at', { ascending: false }).limit(6),
      supabase.from('employee_contracts').select('id, type, title, status, expiry_date, documents(storage_path, bucket)').eq('profile_id', profile.id).order('created_at', { ascending: false }),
      supabase.from('follow_up_tasks').select('id, note, due_at, lead_id, meeting_link, contacts(full_name)').eq('assigned_to', profile.id).eq('is_done', false).order('due_at').limit(20),
      supabase.from('tasks').select('id, title, description, due_at, is_done, meeting_link, related_entity_type, related_entity_id').eq('assigned_to', profile.id).eq('is_done', false).order('due_at', { ascending: true }).limit(20),
      supabase.from('commissions').select('id, base_value, commission_pct, amount, status').eq('profile_id', profile.id).order('created_at', { ascending: false }).limit(8),
      supabase.from('viewings').select('id, scheduled_at, status, lead_id, meeting_link, contacts(full_name)').eq('agent_id', profile.id).gte('scheduled_at', winStart).lte('scheduled_at', winEnd).limit(40),
      supabase.from('notifications').select('id, title, body, link, read_at, created_at').eq('user_id', profile.id).order('created_at', { ascending: false }).limit(6),
      supabase.from('leave_requests').select('id, leave_type, days, start_date, profiles(full_name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(8),
      isCalendarConnected(profile.id),
      getGoogleEventsForUser(profile.id, winStart, winEnd),
      getEnrichedLeads().catch(() => []),
      supabase.from('projects').select('id, name').order('name'),
      supabase.from('calendar_events').select('id, title, type, start_at, duration_min, priority, color, status, meeting_link, related_lead_id, attendees, recurring_rule, recurs_until, excluded_dates').eq('profile_id', profile.id).neq('status', 'cancelled').lte('start_at', winEnd),
      supabase.from('profiles').select('id, full_name, avatar_url, contacts(email)').in('role', INTERNAL_ROLES).order('full_name'),
    ]);
  const routePlan = await buildRoutePlan(supabase, profile.id);
  // Executive Command Center — CEO-level cross-module board, admins/management only.
  const isExec = ['admin', 'management'].includes(me?.role ?? profile.role);
  const commandCenter = isExec ? await buildCommandCenter(supabase) : null;
  const projectOptions = (projectsRes?.data ?? []).map((p) => ({ id: p.id, name: p.name }));
  const leadOptions = (leadsEnriched ?? []).slice(0, 100).map((l) => ({ id: l.id, name: l.full_name ?? 'Lead', contactId: l.contact_id }));
  const teamOptions = (teamRes?.data ?? []).map((m: any) => ({ id: m.id, name: m.full_name ?? 'Team member', email: m.contacts?.email ?? '', avatar_url: m.avatar_url ?? null }));

  const roleLabel = ROLE_LABEL[(me?.role ?? profile.role) as AppRole] ?? (me?.role ?? profile.role);
  const leaveSummary = computeLeaveSummary({ workSchedule: me?.work_schedule ?? null, annualLeaveDays: me?.annual_leave_days, sickLeaveDays: me?.sick_leave_days, balances: balances ?? [], requests: requests ?? [] });

  const commissionRows = commissions ?? [];
  const commTotal = commissionRows.reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const commPaid = commissionRows.filter((c) => c.status === 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0);

  // Expand a calendar_events row into its occurrences within the window (a
  // recurring master fans out daily/weekly/monthly; a one-off yields itself).
  const winStartMs = new Date(winStart).getTime();
  const winEndMs = new Date(winEnd).getTime();
  const expandCal = (c: any): CalendarEvent[] => {
    const type = (['meeting', 'viewing', 'followup', 'task'].includes(c.type) ? c.type : 'task') as CalendarEvent['type'];
    const recurring = !!c.recurring_rule;
    const mk = (startMs: number, master: boolean): CalendarEvent => ({
      id: master ? `ce_${c.id}` : `ce_${c.id}_${startMs}`, title: c.title, start: new Date(startMs).toISOString(), type,
      durationMin: c.duration_min ?? 45, color: c.color, priority: c.priority, status: c.status,
      // Recurring occurrences carry the master id (for scope edits) but stay non-draggable.
      eventId: recurring || master ? c.id : null, recurring, occurrenceISO: new Date(startMs).toISOString(),
      meetingLink: c.meeting_link, href: c.related_lead_id ? `/crm/leads/${c.related_lead_id}` : null,
      attendees: Array.isArray(c.attendees) ? c.attendees : [],
    });
    const base = new Date(c.start_at).getTime();
    if (!recurring) return base >= winStartMs && base <= winEndMs ? [mk(base, true)] : [];
    const rule = String(c.recurring_rule).toLowerCase();
    const until = c.recurs_until ? new Date(c.recurs_until).getTime() : Infinity;
    const excluded = new Set(Array.isArray(c.excluded_dates) ? (c.excluded_dates as string[]) : []);
    const step = (d: Date) => { if (rule.includes('month')) d.setMonth(d.getMonth() + 1); else if (rule.includes('week')) d.setDate(d.getDate() + 7); else d.setDate(d.getDate() + 1); };
    const out: CalendarEvent[] = []; const cur = new Date(base); let i = 0;
    while (cur.getTime() <= Math.min(winEndMs, until) && i < 200) {
      if (cur.getTime() >= winStartMs && !excluded.has(cur.toISOString().slice(0, 10))) out.push(mk(cur.getTime(), false));
      step(cur); i += 1;
    }
    return out;
  };

  // ── Build calendar events from internal records + Google ──
  const events: CalendarEvent[] = [
    ...(viewings ?? []).map((v: any) => ({ id: `v_${v.id}`, title: `Viewing · ${v.contacts?.full_name ?? 'Lead'}`, start: v.scheduled_at, type: 'viewing' as const, href: v.lead_id ? `/crm/leads/${v.lead_id}` : null, meetingLink: v.meeting_link, durationMin: 60 })),
    ...(followUps ?? []).map((f: any) => ({ id: `f_${f.id}`, title: f.note ?? 'Follow-up', start: f.due_at, type: 'followup' as const, href: f.lead_id ? `/crm/leads/${f.lead_id}` : null, meetingLink: f.meeting_link, durationMin: 30 })),
    ...(tasks ?? []).filter((t: any) => t.due_at).map((t: any) => ({ id: `t_${t.id}`, title: t.title, start: t.due_at, type: 'task' as const, meetingLink: t.meeting_link, durationMin: 30 })),
    ...(googleEvents ?? []).map((g) => ({ id: g.id, title: g.title, start: g.start, type: (g.meetingLink ? 'meeting' : 'external') as 'meeting' | 'external', href: g.link, meetingLink: g.meetingLink, durationMin: 45 })),
    ...(calEventsRes?.data ?? []).flatMap(expandCal),
  ];

  // Today agenda
  const todayStr = new Date().toDateString();
  const agenda = events.filter((e) => new Date(e.start).toDateString() === todayStr).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Unified My Tasks feed: `tasks` + `follow_up_tasks` + planner tasks stored in
  // calendar_events (type='task'). All three route completion to their own
  // source via toggleTaskDone; ids are UUIDs so there is no cross-table collision.
  const compactTasks: CompactTask[] = [
    ...(tasks ?? []).map((t: any) => ({ id: t.id, title: t.title, due_at: t.due_at, is_done: t.is_done, table: 'tasks' as const, detail: t.description, meeting_link: t.meeting_link, entity: t.related_entity_type === 'lead' ? 'Lead' : t.related_entity_type === 'project' ? 'Property' : 'Task', href: t.related_entity_type === 'lead' && t.related_entity_id ? `/crm/leads/${t.related_entity_id}` : null })),
    ...(followUps ?? []).map((f: any) => ({ id: f.id, title: f.note ?? 'Follow-up', due_at: f.due_at, is_done: false, table: 'follow_up_tasks' as const, detail: f.contacts?.full_name ?? null, meeting_link: f.meeting_link, entity: 'Lead', href: f.lead_id ? `/crm/leads/${f.lead_id}` : null })),
    ...(calEventsRes?.data ?? [])
      .filter((c: any) => c.type === 'task' && c.status !== 'cancelled')
      .map((c: any) => ({ id: c.id, title: c.title, due_at: c.start_at, is_done: c.status === 'completed', table: 'calendar_events' as const, meeting_link: c.meeting_link, priority: (c.priority === 'critical' ? 'high' : c.priority) as 'low' | 'normal' | 'high', entity: c.related_lead_id ? 'Lead' : 'Task', href: c.related_lead_id ? `/crm/leads/${c.related_lead_id}` : null, attendees: Array.isArray(c.attendees) ? c.attendees : [] })),
  ].sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity));

  // ── Executive metrics ──
  const now = Date.now();
  const myLeads = (leadsEnriched ?? []).filter((l) => l.owner_id === profile.id || !l.owner_id);
  const upcomingMeetings = events
    .filter((e) => (e.type === 'viewing' || e.type === 'meeting') && new Date(e.start).getTime() >= now)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
    .slice(0, 5);
  const overdueFollowUps = (followUps ?? []).filter((f: any) => new Date(f.due_at).getTime() < now);
  const hotLeads = myLeads.filter((l) => l.needs_action && l.priority >= 40).sort((a, b) => b.priority - a.priority).slice(0, 6);
  const ACTIVE_PIPE = ['viewing', 'offer', 'negotiating', 'reserved'];
  const pipelineLeads = (leadsEnriched ?? []).filter((l) => ACTIVE_PIPE.includes(l.status));
  const pipelineValue = pipelineLeads.reduce((s, l) => s + Number(l.budget_max ?? l.budget_min ?? 0), 0);
  // Connected KPI strip (replaces the old isolated metric cards).
  const kpiSegments: KpiSegment[] = [
    { key: 'meetings', label: 'Meetings today', value: String(agenda.length), tone: 'forest', icon: CalendarClock },
    { key: 'overdue', label: 'Overdue follow-ups', value: String(overdueFollowUps.length), tone: overdueFollowUps.length > 0 ? 'danger' : 'forest', icon: Clock, href: '/crm/leads' },
    { key: 'hot', label: 'Hot leads', value: String(hotLeads.length), tone: 'champagne', icon: Flame, href: '/crm/leads' },
    { key: 'pipeline', label: 'Open pipeline', value: formatCurrency(pipelineValue), tone: 'forest', icon: TrendingUp },
    { key: 'deals', label: 'Active deals', value: String(pipelineLeads.length), tone: 'neutral', icon: Target },
  ];

  return (
    <div className="-mx-6 -my-5 min-h-screen bg-[#F7F4EE] px-6 py-5 text-charcoal">
      {/* A · Greeting — the dashboard header (no separate profile header) */}
      <MorningBrief supabase={supabase} profileId={profile.id} name={me?.full_name ?? profile.fullName ?? 'there'} action={<GoogleCalendarConnect connected={calConn.connected} configured={calConn.configured} />} />

      {/* Executive command bar (leadership) → full board at /command-center */}
      {commandCenter && <ExecutiveCommandCenter data={commandCenter} />}

      {/* B · Calendar + quick actions (main operational surface) */}
      <PlannerBoard events={events} leads={leadOptions} projects={projectOptions} team={teamOptions} routePlan={routePlan} />

      {/* C · Today's Pipeline + Today's Tasks side by side */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Card>
        <PanelTitle icon={Target}>Today Pipeline</PanelTitle>
        <div className="grid gap-x-6 gap-y-5 divide-y divide-[#F0EADF] md:grid-cols-3 md:divide-x md:divide-y-0">
          {/* Meetings */}
          <div className="md:pr-6 [&:not(:first-child)]:pt-5 md:[&:not(:first-child)]:pt-0">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/50"><span className="h-1.5 w-1.5 rounded-full bg-forest ws-pulse-live" /> Upcoming meetings</p>
            {upcomingMeetings.length === 0 ? <p className="text-[13px] text-charcoal-600/60">No meetings ahead — a good window to call hot leads.</p> : (
              <ul className="space-y-2">
                {upcomingMeetings.slice(0, 4).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 text-[13px]">
                    <span className="overflow-hidden"><span className="block truncate text-charcoal">{e.title}</span><span className="figure text-[11px] text-charcoal-600/55">{formatWeekdayTime(new Date(e.start))}</span></span>
                    <span className="flex shrink-0 items-center gap-2">
                      {e.attendees && e.attendees.length > 0 && <AvatarStack attendees={e.attendees} size={18} />}
                      {e.meetingLink && <a href={e.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700 hover:bg-violet-500/20"><Video size={10} /> Join</a>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Overdue */}
          <div className="pt-5 md:px-6 md:pt-0">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/50"><span className={`h-1.5 w-1.5 rounded-full ${overdueFollowUps.length > 0 ? 'bg-signal-danger ws-pulse-danger' : 'bg-signal-success'}`} /> Overdue follow-ups</p>
            {overdueFollowUps.length === 0 ? <p className="text-[13px] text-charcoal-600/60">Nothing overdue — the pipeline is fully tended.</p> : (
              <ul className="space-y-2">
                {overdueFollowUps.slice(0, 4).map((f: any) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 text-[13px]">
                    {f.lead_id ? <Link href={`/crm/leads/${f.lead_id}`} className="truncate text-charcoal hover:text-champagne-600">{f.note ?? 'Follow-up'}</Link> : <span className="truncate text-charcoal">{f.note ?? 'Follow-up'}</span>}
                    <span className="figure shrink-0 text-[11px] text-signal-danger">{formatDayMonth(new Date(f.due_at))}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {/* Hot leads */}
          <div className="pt-5 md:pl-6 md:pt-0">
            <p className="mb-2.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/50"><span className={`h-1.5 w-1.5 rounded-full ${hotLeads.length > 0 ? 'bg-champagne-600 ws-pulse-urgent' : 'bg-signal-success'}`} /> Hot leads</p>
            {hotLeads.length === 0 ? <p className="text-[13px] text-charcoal-600/60">No leads need chasing — nurture cooling leads to stay warm.</p> : (
              <ul className="space-y-2">
                {hotLeads.slice(0, 4).map((l) => {
                  const nba = nextBestAction({ status: l.status, last_contacted_at: l.last_contacted_at, created_at: l.created_at, next_follow_up: l.next_follow_up });
                  const tone = nba.tone === 'urgent' ? 'text-signal-danger' : nba.tone === 'warm' ? 'text-forest' : 'text-charcoal-600/55';
                  return (
                    <li key={l.id} className="flex items-center justify-between gap-2 text-[13px]">
                      <Link href={`/crm/leads/${l.id}`} className="truncate text-charcoal hover:text-champagne-600">{l.full_name ?? 'Lead'}</Link>
                      <span className={`shrink-0 text-[11px] font-medium ${tone}`} title={nba.reason}>{nba.label}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </Card>
      {/* Today's Tasks — the unified task feed (tasks + follow-ups + planner tasks) */}
      <Card>
        <PanelTitle icon={CheckSquare}>Today&apos;s Tasks</PanelTitle>
        <CompactTaskList tasks={compactTasks} />
      </Card>
      </div>
    </div>
  );
}
