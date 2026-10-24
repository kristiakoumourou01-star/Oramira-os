'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { pushEventToGoogle, deleteGoogleEvent, updateGoogleEvent } from '@/lib/calendar-sync';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';

/** Disconnect the signed-in user's Google Calendar. */
export async function disconnectCalendar() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  await supabase.from('calendar_connections').delete().eq('profile_id', profile.id).eq('provider', 'google');
  revalidatePath('/dashboard');
}

export type PlannerEventType = 'meeting' | 'viewing' | 'followup' | 'task' | 'reminder';

export interface CalendarConflict { title: string; startISO: string; durationMin: number }

/**
 * Conflict detection for the signed-in user's calendar — the overlapping
 * commitments a proposed slot would clash with. Non-blocking: the planner shows
 * these as a warning so the agent can double-book deliberately, never silently.
 */
export async function checkCalendarConflicts(startISO: string, durationMin = 45, excludeId?: string): Promise<CalendarConflict[]> {
  const startMs = new Date(startISO).getTime();
  if (Number.isNaN(startMs)) return [];
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const endMs = startMs + durationMin * 60000;
  const { data } = await supabase
    .from('calendar_events')
    .select('id, title, start_at, duration_min')
    .eq('profile_id', profile.id)
    .neq('status', 'cancelled')
    .neq('type', 'task') // all-day-ish todos don't block a time slot
    .gte('start_at', new Date(startMs - 24 * 3600_000).toISOString())
    .lte('start_at', new Date(endMs + 24 * 3600_000).toISOString());
  return (data ?? [])
    .filter((e) => e.id !== excludeId)
    .filter((e) => {
      const s = new Date(e.start_at).getTime();
      const en = s + (e.duration_min ?? 45) * 60000;
      return startMs < en && endMs > s; // interval overlap
    })
    .map((e) => ({ title: e.title, startISO: e.start_at, durationMin: e.duration_min ?? 45 }));
}

/**
 * Create a calendar event from the planner. Oramira is the source of truth: the
 * internal record is created first, then mirrored to Google Calendar (with an
 * optional Google Meet link). Returns nothing — the dashboard revalidates.
 */
export async function createCalendarEvent(params: {
  type: PlannerEventType;
  title: string;
  startISO: string;
  durationMin?: number;
  notes?: string | null;
  location?: string | null;
  withMeet?: boolean;
  leadId?: string | null;
  contactId?: string | null;
  projectId?: string | null;
  priority?: 'low' | 'normal' | 'high' | 'critical';
  reminderMinutes?: number;
  color?: string | null;
  recurringRule?: string | null;
  attendees?: { email: string; name?: string | null; avatar_url?: string | null }[];
}) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const dur = params.durationMin ?? 45;

  // Planner events are first-class rows — priority/color/relations are columns.
  const payload = {
    profile_id: profile.id,
    title: params.title,
    type: params.type,
    start_at: params.startISO,
    duration_min: dur,
    priority: params.priority ?? 'normal',
    color: params.color ?? null,
    related_lead_id: params.leadId ?? null,
    related_property_id: params.projectId ?? null,
    related_client_id: params.contactId ?? null,
    recurring_rule: params.recurringRule ?? null,
    reminder_minutes: params.reminderMinutes ?? null,
    location: params.location ?? null,
    notes: params.notes ?? null,
    status: 'scheduled',
    attendees: (params.attendees ?? []) as any,
  };
  const { data: event, error } = await supabase.from('calendar_events').insert(payload).select('id').single();
  if (error || !event) {
    console.error('[createCalendarEvent] insert failed', { message: error?.message, code: (error as any)?.code, details: (error as any)?.details, payload });
    return { ok: false as const, error: error?.message ?? 'Insert returned no row' };
  }
  console.log('[createCalendarEvent] inserted', { id: event.id, type: params.type, start: params.startISO, dur });

  // Side-effects below must never abort the create: the row already exists, so
  // a Google/timeline failure should not stop the UI from refreshing.
  try {
    // Mirror to Google Calendar — Meet link, attendee invites, reminder, recurrence.
    const freq = params.recurringRule ? params.recurringRule.toUpperCase() : null; // daily|weekly|monthly → DAILY|…
    const sync = await pushEventToGoogle(profile.id, {
      summary: params.title, description: params.notes ?? undefined, location: params.location ?? undefined,
      start: params.startISO, durationMin: dur, withMeet: params.withMeet,
      attendees: (params.attendees ?? []).map((a) => a.email).filter(Boolean), reminderMinutes: params.reminderMinutes,
      recurrence: freq ? [`RRULE:FREQ=${freq}`] : undefined,
    });
    if (sync) {
      await supabase.from('calendar_events').update({ google_event_id: sync.googleEventId, calendar_synced_at: new Date().toISOString(), meeting_link: sync.meetLink }).eq('id', event.id);
    }
    // Linked to a lead → record on the lead's timeline.
    if (params.leadId) {
      await logActivity({ entityType: 'lead', entityId: params.leadId, action: 'event_scheduled', metadata: { type: params.type, title: params.title, at: params.startISO } });
    }
  } catch (e) {
    console.error('[createCalendarEvent] post-insert side-effect failed (event still created)', e);
  }

  revalidatePath('/dashboard');
  return { ok: true as const, id: event.id };
}

/** Reschedule / resize a planner event (drag + resize): persist time/duration
 *  and patch the mirrored Google event. */
export async function rescheduleCalendarEvent(id: string, startISO: string, durationMin?: number) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { start_at: startISO };
  if (durationMin != null) patch.duration_min = durationMin;
  const { data: row } = await supabase.from('calendar_events').update(patch).eq('id', id).select('google_event_id, title, duration_min').maybeSingle();
  if (row?.google_event_id) {
    await updateGoogleEvent(profile.id, row.google_event_id, { summary: row.title, start: startISO, durationMin: durationMin ?? row.duration_min ?? 45 });
  }
  revalidatePath('/dashboard');
}

/** Cancel a planner event: mark cancelled and delete the mirrored Google event. */
export async function cancelCalendarEvent(id: string) {
  return setEventStatus(id, 'cancelled');
}

export type RecurScope = 'this' | 'future' | 'series';

/** Edit a recurring event with scope: this occurrence / this + future / whole series. */
export async function updateRecurringEvent(masterId: string, scope: RecurScope, occurrenceISO: string, patch: {
  title?: string; startISO?: string; durationMin?: number; notes?: string | null; location?: string | null; priority?: string; color?: string | null;
}) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: master } = await supabase.from('calendar_events').select('*').eq('id', masterId).maybeSingle();
  if (!master) return;

  if (scope === 'series') {
    await updateCalendarEvent(masterId, patch); // patches DB + Google recurring event
    return;
  }

  const occDate = occurrenceISO.slice(0, 10);
  const newStart = patch.startISO ?? occurrenceISO;

  if (scope === 'this') {
    // Skip this occurrence in the master, create a detached single with the edits.
    const excluded = Array.isArray(master.excluded_dates) ? (master.excluded_dates as string[]) : [];
    await supabase.from('calendar_events').update({ excluded_dates: [...excluded, occDate] as any }).eq('id', masterId);
    await supabase.from('calendar_events').insert({
      profile_id: profile.id, parent_event_id: masterId, recurring_rule: null,
      title: patch.title ?? master.title, start_at: newStart, duration_min: patch.durationMin ?? master.duration_min,
      priority: patch.priority ?? master.priority, color: patch.color ?? master.color, notes: patch.notes ?? master.notes,
      location: patch.location ?? master.location, type: master.type, status: 'scheduled',
    });
    return;
  }

  // 'future' — cap the current series before this occurrence, start a new series here.
  await supabase.from('calendar_events').update({ recurs_until: new Date(new Date(occurrenceISO).getTime() - 60000).toISOString() }).eq('id', masterId);
  await supabase.from('calendar_events').insert({
    profile_id: profile.id, parent_event_id: masterId, recurring_rule: master.recurring_rule,
    title: patch.title ?? master.title, start_at: newStart, duration_min: patch.durationMin ?? master.duration_min,
    priority: patch.priority ?? master.priority, color: patch.color ?? master.color, notes: patch.notes ?? master.notes,
    location: patch.location ?? master.location, type: master.type, status: 'scheduled',
  });
  revalidatePath('/dashboard');
}

/** Cancel a recurring event with scope. Series → cancels + removes Google event. */
export async function cancelRecurringEvent(masterId: string, scope: RecurScope, occurrenceISO: string) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  if (scope === 'series') { await setEventStatus(masterId, 'cancelled'); return; }
  const { data: master } = await supabase.from('calendar_events').select('excluded_dates').eq('id', masterId).maybeSingle();
  if (scope === 'this') {
    const excluded = Array.isArray(master?.excluded_dates) ? (master!.excluded_dates as string[]) : [];
    await supabase.from('calendar_events').update({ excluded_dates: [...excluded, occurrenceISO.slice(0, 10)] as any }).eq('id', masterId);
  } else {
    await supabase.from('calendar_events').update({ recurs_until: new Date(new Date(occurrenceISO).getTime() - 60000).toISOString() }).eq('id', masterId);
  }
  revalidatePath('/dashboard');
}

/** Set a planner event's status. Cancelled also deletes the Google event. */
export async function setEventStatus(id: string, status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled') {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from('calendar_events').update({ status }).eq('id', id).select('google_event_id').maybeSingle();
  if (status === 'cancelled' && row?.google_event_id) await deleteGoogleEvent(profile.id, row.google_event_id);
  revalidatePath('/dashboard');
}

/** Hard-delete a planner event and its Google mirror. */
export async function deleteCalendarEvent(id: string) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase.from('calendar_events').select('google_event_id').eq('id', id).maybeSingle();
  if (row?.google_event_id) await deleteGoogleEvent(profile.id, row.google_event_id);
  await supabase.from('calendar_events').delete().eq('id', id);
  revalidatePath('/dashboard');
}

/** Update an existing planner event (from the modal in edit mode) + patch Google. */
export async function updateCalendarEvent(id: string, patch: {
  title?: string; startISO?: string; durationMin?: number; notes?: string | null; location?: string | null;
  priority?: string; color?: string | null;
}) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = {};
  if (patch.title != null) update.title = patch.title;
  if (patch.startISO != null) update.start_at = patch.startISO;
  if (patch.durationMin != null) update.duration_min = patch.durationMin;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.location !== undefined) update.location = patch.location;
  if (patch.priority != null) update.priority = patch.priority;
  if (patch.color !== undefined) update.color = patch.color;
  const { data: row } = await supabase.from('calendar_events').update(update).eq('id', id).select('google_event_id, title, start_at, duration_min').maybeSingle();
  if (row?.google_event_id) {
    await updateGoogleEvent(profile.id, row.google_event_id, { summary: row.title, start: patch.startISO ?? row.start_at, durationMin: patch.durationMin ?? row.duration_min ?? 45 });
  }
  revalidatePath('/dashboard');
}
