import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getGoogleEventsForUser } from '@/lib/calendar-sync';
import type { CalendarSource, CalendarItem } from '@/lib/calendar-feed-shared';
export type { CalendarSource, CalendarItem } from '@/lib/calendar-feed-shared';

/**
 * Unified calendar feed for the Calendar page.
 *
 * Merges three sources into one normalized stream over a time window:
 *  - internal calendar_events (first-class planner events)
 *  - viewings (property viewings carry their own table)
 *  - the user's Google Calendar (two-way: we also push internal events there)
 *
 * Google items already mirrored from an internal row/viewing are de-duplicated
 * by google_event_id so a synced event appears once. Resilient: any source
 * failing degrades to the others rather than blanking the calendar.
 */



export async function getCalendarFeed(profileId: string, fromISO: string, toISO: string): Promise<CalendarItem[]> {
  const supabase = await createSupabaseServerClient();
  const items: CalendarItem[] = [];
  const mirroredGoogleIds = new Set<string>();

  // Internal planner events.
  try {
    const { data } = await supabase
      .from('calendar_events')
      .select('id, title, type, start_at, duration_min, status, color, location, meeting_link, google_event_id, related_lead_id')
      .eq('profile_id', profileId)
      .neq('status', 'cancelled')
      .gte('start_at', fromISO)
      .lte('start_at', toISO);
    for (const e of data ?? []) {
      if (e.google_event_id) mirroredGoogleIds.add(e.google_event_id);
      items.push({
        id: e.id,
        source: 'internal',
        type: e.type || 'meeting',
        title: e.title,
        start: e.start_at,
        durationMin: e.duration_min ?? 45,
        status: e.status ?? null,
        color: e.color ?? null,
        location: e.location ?? null,
        meetingLink: e.meeting_link ?? null,
        leadId: e.related_lead_id ?? null,
        editable: true,
      });
    }
  } catch { /* degrade */ }

  // Viewings (their own table).
  try {
    const { data } = await supabase
      .from('viewings')
      .select('id, scheduled_at, status, google_event_id, meeting_link, lead_id, contacts(full_name)')
      .eq('agent_id', profileId)
      .not('status', 'in', '("cancelled","no_show")')
      .gte('scheduled_at', fromISO)
      .lte('scheduled_at', toISO);
    for (const v of (data ?? []) as any[]) {
      if (v.google_event_id) mirroredGoogleIds.add(v.google_event_id);
      items.push({
        id: v.id,
        source: 'viewing',
        type: 'viewing',
        title: `Viewing${v.contacts?.full_name ? ` — ${v.contacts.full_name}` : ''}`,
        start: v.scheduled_at,
        durationMin: 60,
        status: v.status ?? null,
        color: null,
        location: null,
        meetingLink: v.meeting_link ?? null,
        leadId: v.lead_id ?? null,
        editable: false,
      });
    }
  } catch { /* degrade */ }

  // Google Calendar — anything not already mirrored from an internal row/viewing.
  try {
    const gevents = await getGoogleEventsForUser(profileId, fromISO, toISO);
    for (const g of gevents) {
      const rawId = g.id.replace(/^g_/, '');
      if (mirroredGoogleIds.has(rawId)) continue;
      items.push({
        id: g.id,
        source: 'google',
        type: 'google',
        title: g.title,
        start: g.start,
        durationMin: 45,
        status: null,
        color: null,
        location: null,
        meetingLink: g.meetingLink ?? null,
        leadId: null,
        editable: false,
      });
    }
  } catch { /* degrade */ }

  items.sort((a, b) => a.start.localeCompare(b.start));
  return items;
}

/**
 * Team calendar feed — internal events + viewings for several members over a
 * window, grouped by member (one column each in the day Team view). Google is
 * intentionally skipped here (N API calls); the per-person view keeps it.
 * View-only (editable:false); resilient ({} on error).
 */
export async function getTeamCalendarFeed(memberIds: string[], fromISO: string, toISO: string): Promise<Record<string, CalendarItem[]>> {
  const out: Record<string, CalendarItem[]> = {};
  if (memberIds.length === 0) return out;
  for (const id of memberIds) out[id] = [];
  try {
    const supabase = await createSupabaseServerClient();
    const [{ data: events }, { data: viewings }] = await Promise.all([
      supabase
        .from('calendar_events')
        .select('id, title, type, start_at, duration_min, status, color, location, meeting_link, related_lead_id, profile_id')
        .in('profile_id', memberIds)
        .neq('status', 'cancelled')
        .gte('start_at', fromISO)
        .lte('start_at', toISO),
      supabase
        .from('viewings')
        .select('id, scheduled_at, status, meeting_link, lead_id, agent_id, contacts(full_name)')
        .in('agent_id', memberIds)
        .not('status', 'in', '("cancelled","no_show")')
        .gte('scheduled_at', fromISO)
        .lte('scheduled_at', toISO),
    ]);
    for (const e of (events ?? []) as any[]) {
      (out[e.profile_id] ??= []).push({
        id: e.id, source: 'internal', type: e.type || 'meeting', title: e.title, start: e.start_at,
        durationMin: e.duration_min ?? 45, status: e.status ?? null, color: e.color ?? null,
        location: e.location ?? null, meetingLink: e.meeting_link ?? null, leadId: e.related_lead_id ?? null, editable: false,
      });
    }
    for (const v of (viewings ?? []) as any[]) {
      (out[v.agent_id] ??= []).push({
        id: v.id, source: 'viewing', type: 'viewing', title: `Viewing${v.contacts?.full_name ? ` — ${v.contacts.full_name}` : ''}`,
        start: v.scheduled_at, durationMin: 60, status: v.status ?? null, color: null, location: null,
        meetingLink: v.meeting_link ?? null, leadId: v.lead_id ?? null, editable: false,
      });
    }
    for (const id of memberIds) out[id].sort((a, b) => a.start.localeCompare(b.start));
    return out;
  } catch {
    return out;
  }
}
