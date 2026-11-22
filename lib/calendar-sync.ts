import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { listEvents, refreshAccessToken, googleConfigured, insertEvent, updateEvent, deleteEvent, freeBusy, type BusyBlock } from '@/lib/google-calendar';
import { getApprovedLeaveBlocks } from '@/lib/leave-availability';

/** Resolve a usable access token for a user, refreshing if expired. Returns the
 *  token + calendarId, or null when Google isn't configured / connected. */
export async function activeToken(profileId: string): Promise<{ token: string; calendarId: string } | null> {
  if (!googleConfigured()) return null;
  const svc = createSupabaseServiceRoleClient();
  const { data: conn } = await svc.from('calendar_connections').select('*').eq('profile_id', profileId).eq('provider', 'google').maybeSingle();
  if (!conn?.access_token) return null;
  let token = conn.access_token;
  if (conn.token_expiry && new Date(conn.token_expiry).getTime() < Date.now() && conn.refresh_token) {
    const r = await refreshAccessToken(conn.refresh_token);
    if (r?.access_token) {
      token = r.access_token;
      await svc.from('calendar_connections').update({ access_token: r.access_token, token_expiry: new Date(Date.now() + (r.expires_in ?? 3600) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq('id', conn.id);
    }
  }
  return { token, calendarId: conn.calendar_id ?? 'primary' };
}

const DEFAULT_DURATION_MIN = 45;

/**
 * Push a newly-created record to Google Calendar. Best-effort: returns the
 * google_event_id + meet link to store, or null when not connected (callers
 * just skip the sync fields). Never throws — sync must not break creation.
 */
export async function pushEventToGoogle(profileId: string, ev: { summary: string; description?: string; location?: string; start: string; durationMin?: number; withMeet?: boolean; attendees?: string[]; reminderMinutes?: number; recurrence?: string[] }): Promise<{ googleEventId: string; meetLink: string | null } | null> {
  try {
    const t = await activeToken(profileId);
    if (!t) return null;
    const startMs = new Date(ev.start).getTime();
    const end = new Date(startMs + (ev.durationMin ?? DEFAULT_DURATION_MIN) * 60000).toISOString();
    const res = await insertEvent(t.token, t.calendarId, { summary: ev.summary, description: ev.description, location: ev.location, start: new Date(ev.start).toISOString(), end, withMeet: ev.withMeet, attendees: ev.attendees, reminderMinutes: ev.reminderMinutes, recurrence: ev.recurrence });
    if (!res) return null;
    return { googleEventId: res.id, meetLink: res.hangoutLink ?? null };
  } catch { return null; }
}

/** Delete the mirrored Google event (event cancellation / two-way delete). */
export async function deleteGoogleEvent(profileId: string, googleEventId: string): Promise<boolean> {
  try {
    const t = await activeToken(profileId);
    if (!t) return false;
    return deleteEvent(t.token, t.calendarId, googleEventId);
  } catch { return false; }
}

/** Patch an existing Google event's time when an internal record is rescheduled. */
export async function updateGoogleEvent(profileId: string, googleEventId: string, patch: { summary?: string; start: string; durationMin?: number; location?: string | null }): Promise<boolean> {
  try {
    const t = await activeToken(profileId);
    if (!t) return false;
    const end = new Date(new Date(patch.start).getTime() + (patch.durationMin ?? DEFAULT_DURATION_MIN) * 60000).toISOString();
    return updateEvent(t.token, t.calendarId, googleEventId, { summary: patch.summary, start: new Date(patch.start).toISOString(), end, location: patch.location });
  } catch { return false; }
}

/**
 * Busy blocks for the availability engine: the user's Google Calendar free/busy
 * PLUS their approved leave as full-day blocks. Leave is always included (even
 * when Google isn't connected) so an employee on leave is never offered.
 */
export async function getBusyForUser(profileId: string, timeMin: string, timeMax: string): Promise<BusyBlock[]> {
  const leave = await getApprovedLeaveBlocks(profileId, timeMin, timeMax);
  try {
    const t = await activeToken(profileId);
    if (!t) return leave;
    const google = await freeBusy(t.token, t.calendarId, timeMin, timeMax);
    return [...google, ...leave];
  } catch {
    return leave;
  }
}

export interface ExternalEvent {
  id: string; title: string; start: string; meetingLink?: string | null; link?: string | null;
  durationMin?: number; location?: string | null; allDay?: boolean; cancelled?: boolean; seriesId?: string | null;
}

/**
 * Pull the user's Google Calendar events for a window (refreshing the token when
 * needed). Returns [] when Google isn't configured or the user hasn't connected —
 * the dashboard then just shows internal events. With includeCancelled the
 * events deleted in Google come back too (cancelled: true), so the CRM can drop
 * its own copy.
 */
export async function getGoogleEventsForUser(profileId: string, timeMin: string, timeMax: string, opts: { includeCancelled?: boolean } = {}): Promise<ExternalEvent[]> {
  const t = await activeToken(profileId);
  if (!t) return [];
  const events = await listEvents(t.token, t.calendarId, timeMin, timeMax, !!opts.includeCancelled);
  return events
    .map((e) => {
      const allDay = !e.start?.dateTime && !!e.start?.date;
      const start = e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : '');
      const endRaw = e.end?.dateTime ?? (e.end?.date ? `${e.end.date}T00:00:00` : '');
      const dur = start && endRaw ? Math.round((new Date(endRaw).getTime() - new Date(start).getTime()) / 60000) : 45;
      return {
        id: `g_${e.id}`, title: e.summary ?? '(busy)', start, meetingLink: e.hangoutLink ?? null, link: e.htmlLink ?? null,
        durationMin: allDay ? 30 : Math.max(5, Math.min(24 * 60, dur || 45)), location: e.location ?? null, allDay,
        cancelled: e.status === 'cancelled', seriesId: e.recurringEventId ?? null,
      };
    })
    .filter((e) => e.start || e.cancelled)
    .filter((e) => opts.includeCancelled || !e.cancelled);
}

export async function isCalendarConnected(profileId: string): Promise<{ connected: boolean; configured: boolean }> {
  const configured = googleConfigured();
  if (!configured) return { connected: false, configured };
  const svc = createSupabaseServiceRoleClient();
  const { data } = await svc.from('calendar_connections').select('id, access_token').eq('profile_id', profileId).eq('provider', 'google').maybeSingle();
  return { connected: !!data?.access_token, configured };
}
