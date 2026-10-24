'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { getBusyForUser } from '@/lib/calendar-sync';
import { suggestSlots, eventsToBusy, type Urgency } from '@/lib/scheduling';
import { recommendForLead } from '@/lib/sales-doctrine';
import { computePriority } from '@/lib/priority';

export interface BusyEntry { memberId: string; start: string; end: string }

/**
 * Team availability — merges each selected member's Google free/busy with their
 * internal commitments (viewings, follow-ups, tasks, calendar events) into busy
 * blocks, so the planner can overlay "who's free" before booking. Service-role
 * read (team schedules), gated to staff.
 */
export async function getTeamBusy(params: { memberIds: string[]; timeMin: string; timeMax: string }): Promise<BusyEntry[]> {
  await requirePermission('leads', 'view');
  const svc = createSupabaseServiceRoleClient();
  const out: BusyEntry[] = [];
  for (const id of params.memberIds.slice(0, 8)) {
    const gb = await getBusyForUser(id, params.timeMin, params.timeMax);
    for (const b of gb) out.push({ memberId: id, start: b.start, end: b.end });
    const [{ data: vs }, { data: fs }, { data: ts }, { data: ce }] = await Promise.all([
      svc.from('viewings').select('scheduled_at').eq('agent_id', id).gte('scheduled_at', params.timeMin).lte('scheduled_at', params.timeMax),
      svc.from('follow_up_tasks').select('due_at').eq('assigned_to', id).eq('is_done', false).gte('due_at', params.timeMin).lte('due_at', params.timeMax),
      svc.from('tasks').select('due_at').eq('assigned_to', id).eq('is_done', false).gte('due_at', params.timeMin).lte('due_at', params.timeMax),
      svc.from('calendar_events').select('start_at, duration_min').eq('profile_id', id).neq('status', 'cancelled').gte('start_at', params.timeMin).lte('start_at', params.timeMax),
    ]);
    const add = (start: string, mins: number) => out.push({ memberId: id, start, end: new Date(new Date(start).getTime() + mins * 60000).toISOString() });
    for (const v of vs ?? []) add(v.scheduled_at, 60);
    for (const f of fs ?? []) add(f.due_at, 30);
    for (const t of ts ?? []) if (t.due_at) add(t.due_at as string, 30);
    for (const c of ce ?? []) add(c.start_at, c.duration_min ?? 45);
  }
  return out;
}

export interface SchedulingSuggestion { slots: string[]; urgency: Urgency }

/**
 * Smart scheduling: suggest the best next slots for a follow-up / viewing /
 * negotiation call. Urgency is derived from the lead's stage + recency (sales
 * doctrine); availability merges the agent's Google free/busy with their
 * internal commitments so suggestions never double-book.
 */
export async function getSchedulingSuggestion(params: { leadId?: string; durationMin?: number }): Promise<SchedulingSuggestion> {
  const profile = await requirePermission('leads', 'view');
  const supabase = await createSupabaseServerClient();

  const now = new Date();
  const horizon = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString();

  let urgency: Urgency = 'normal';
  if (params.leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .select('status, created_at, last_contacted_at, first_response_at, budget_min, budget_max, ai_score, contacts(buyer_type, preferred_language)')
      .eq('id', params.leadId)
      .maybeSingle();
    if (lead) {
      const { score } = computePriority({ status: lead.status, budget_min: lead.budget_min, budget_max: lead.budget_max, ai_score: lead.ai_score, last_contacted_at: lead.last_contacted_at, created_at: lead.created_at });
      const rec = recommendForLead({
        status: lead.status, buyerType: (lead as any).contacts?.buyer_type, language: (lead as any).contacts?.preferred_language,
        createdAt: lead.created_at, lastContactedAt: lead.last_contacted_at, firstResponseAt: lead.first_response_at, aiScore: lead.ai_score, priority: score,
      });
      urgency = rec.urgency;
    }
  }

  // Busy = Google free/busy + internal commitments (viewings, follow-ups, tasks).
  const [googleBusy, { data: viewings }, { data: followUps }, { data: tasks }] = await Promise.all([
    getBusyForUser(profile.id, now.toISOString(), horizon),
    supabase.from('viewings').select('scheduled_at').eq('agent_id', profile.id).gte('scheduled_at', now.toISOString()).lte('scheduled_at', horizon),
    supabase.from('follow_up_tasks').select('due_at').eq('assigned_to', profile.id).eq('is_done', false).gte('due_at', now.toISOString()).lte('due_at', horizon),
    supabase.from('tasks').select('due_at').eq('assigned_to', profile.id).eq('is_done', false).gte('due_at', now.toISOString()).lte('due_at', horizon),
  ]);

  const internal = eventsToBusy([
    ...(viewings ?? []).map((v) => ({ start: v.scheduled_at, durationMin: 60 })),
    ...(followUps ?? []).map((f) => ({ start: f.due_at, durationMin: 30 })),
    ...(tasks ?? []).filter((t) => t.due_at).map((t) => ({ start: t.due_at as string, durationMin: 30 })),
  ]);

  const slots = suggestSlots({ busy: [...googleBusy, ...internal], durationMin: params.durationMin ?? 45, urgency, count: 3, now });
  return { slots, urgency };
}
