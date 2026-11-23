import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getGoogleEventsForUser, type ExternalEvent } from '@/lib/calendar-sync';
import type { CalendarSource, CalendarItem } from '@/lib/calendar-feed-shared';
import { activityLabel } from '@/lib/activity-types';

/** Activities (Sales → Activities) του υπεύθυνου ως «κλεισμένες» ώρες στο ημερολόγιο. */
async function activityItems(supabase: any, ids: string[], fromISO: string, toISO: string): Promise<(CalendarItem & { owner: string; googleId: string | null })[]> {
  try {
    const { data } = await supabase.from('follow_up_tasks')
      .select('id, lead_id, assigned_to, due_at, note, type, duration_min, location, google_event_id, leads(title, full_name), contacts(full_name)')
      .in('assigned_to', ids).eq('is_done', false).gte('due_at', fromISO).lte('due_at', toISO);
    return ((data ?? []) as any[]).map((a) => {
      const who = a.leads?.title || a.contacts?.full_name || a.leads?.full_name || '';
      return { id: a.id, source: 'activity' as const, type: a.type ?? 'task', title: `${activityLabel(a.type)}: ${a.note || ''}${who ? ` — ${who}` : ''}`, start: a.due_at, durationMin: a.duration_min ?? 30, status: null, color: null, location: a.location ?? null, meetingLink: null, leadId: a.lead_id ?? null, editable: false, owner: a.assigned_to, googleId: a.google_event_id ?? null };
    });
  } catch { return []; }
}
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



const msEq = (a: string, b: string) => Math.abs(new Date(a).getTime() - new Date(b).getTime()) < 60000;

export async function getCalendarFeed(profileId: string, fromISO: string, toISO: string): Promise<CalendarItem[]> {
  const supabase = await createSupabaseServerClient();
  const items: CalendarItem[] = [];
  const mirroredGoogleIds = new Set<string>();

  // Google πρώτα: ό,τι άλλαξε ή σβήστηκε στο Google Calendar περνάει και στο CRM (αμφίδρομος συγχρονισμός).
  let gevents: ExternalEvent[] = [];
  try { gevents = await getGoogleEventsForUser(profileId, fromISO, toISO, { includeCancelled: true }); } catch { /* degrade */ }
  const gById = new Map(gevents.map((g) => [g.id.replace(/^g_/, ''), g]));
  /** Η εκδοχή του Google για ένα δικό μας γεγονός, αν διαφέρει (ώρα, διάρκεια, τίτλος) ή αν σβήστηκε. */
  const fromGoogle = (gid: string | null | undefined, cur: { start: string; durationMin?: number; title?: string }) => {
    const g = gid ? gById.get(gid) : undefined;
    if (!g || g.allDay) return null;
    if (g.cancelled) return { cancelled: true as const, g };
    const changed = !msEq(g.start, cur.start) || (cur.durationMin != null && g.durationMin != null && g.durationMin !== cur.durationMin) || (cur.title != null && g.title !== cur.title);
    return changed ? { cancelled: false as const, g } : null;
  };

  // Internal planner events.
  try {
    const { data } = await supabase
      .from('calendar_events')
      .select('id, title, type, start_at, duration_min, status, color, location, meeting_link, google_event_id, related_lead_id, attendees')
      .eq('profile_id', profileId)
      .neq('status', 'cancelled')
      .gte('start_at', fromISO)
      .lte('start_at', toISO);
    for (const e of data ?? []) {
      if (e.google_event_id) mirroredGoogleIds.add(e.google_event_id);
      const sync = fromGoogle(e.google_event_id, { start: e.start_at, durationMin: e.duration_min ?? 45, title: e.title });
      if (sync?.cancelled) { await supabase.from('calendar_events').update({ status: 'cancelled' }).eq('id', e.id); continue; }
      if (sync) {
        e.start_at = sync.g.start; e.duration_min = sync.g.durationMin ?? e.duration_min; e.title = sync.g.title;
        await supabase.from('calendar_events').update({ start_at: e.start_at, duration_min: e.duration_min, title: e.title, ...(sync.g.location != null ? { location: sync.g.location } : {}) }).eq('id', e.id);
        if (sync.g.location != null) e.location = sync.g.location;
      }
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
        guests: (() => {
          const own = Array.isArray((e as any).attendees) ? ((e as any).attendees as any[]).map((a) => a?.email).filter(Boolean) : [];
          const g = e.google_event_id ? gById.get(e.google_event_id)?.guests : undefined;
          return Array.from(new Set([...(g ?? []), ...own]));
        })(),
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
      const sync = fromGoogle(v.google_event_id, { start: v.scheduled_at });
      if (sync?.cancelled) { await supabase.from('viewings').update({ status: 'cancelled' }).eq('id', v.id); continue; }
      if (sync) { v.scheduled_at = sync.g.start; await supabase.from('viewings').update({ scheduled_at: v.scheduled_at }).eq('id', v.id); }
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

  // Activities του χρήστη (κλήσεις, συναντήσεις, εργασίες…).
  for (const { owner: _o, googleId, ...it } of await activityItems(supabase, [profileId], fromISO, toISO)) {
    if (googleId) mirroredGoogleIds.add(googleId);
    const sync = fromGoogle(googleId, { start: it.start, durationMin: it.durationMin });
    if (sync && !sync.cancelled) {
      it.start = sync.g.start; it.durationMin = sync.g.durationMin ?? it.durationMin;
      try { await supabase.from('follow_up_tasks').update({ due_at: it.start, duration_min: it.durationMin }).eq('id', it.id); } catch { /* degrade */ }
    }
    items.push(it);
  }

  // Google Calendar — ό,τι δεν είναι ήδη δικό μας γεγονός. Αλλάζει και σβήνει από εδώ (περνάει αμέσως στο Google).
  for (const g of gevents) {
    const rawId = g.id.replace(/^g_/, '');
    if (g.cancelled || mirroredGoogleIds.has(rawId) || (g.seriesId && mirroredGoogleIds.has(g.seriesId))) continue;
    items.push({
      id: g.id,
      source: 'google',
      type: 'google',
      title: g.title,
      start: g.start,
      durationMin: g.durationMin ?? 45,
      status: null,
      color: null,
      location: g.location ?? null,
      meetingLink: g.meetingLink ?? null,
      leadId: null,
      editable: !g.allDay,
      guests: g.guests ?? [],
    });
  }

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
    for (const { owner, googleId: _g, ...it } of await activityItems(supabase, memberIds, fromISO, toISO)) (out[owner] ??= []).push(it);
    for (const id of memberIds) out[id].sort((a, b) => a.start.localeCompare(b.start));
    return out;
  } catch {
    return out;
  }
}
