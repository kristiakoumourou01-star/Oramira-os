import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { listEvents, refreshAccessToken, googleConfigured, insertEvent, updateEvent, deleteEvent, freeBusy, type BusyBlock } from '@/lib/google-calendar';
import { getApprovedLeaveBlocks } from '@/lib/leave-availability';

/** Resolve a usable access token for a user, refreshing if expired. Returns the
 *  token + calendarId, or null when Google isn't configured / connected. */
async function activeToken(profileId: string): Promise<{ token: string; calendarId: string } | null> {
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
export async function updateGoogleEvent(profileId: string, googleEventId: string, patch: { summary?: string; start: string; durationMin?: number }): Promise<boolean> {
  try {
    const t = await activeToken(profileId);
    if (!t) return false;
    const end = new Date(new Date(patch.start).getTime() + (patch.durationMin ?? DEFAULT_DURATION_MIN) * 60000).toISOString();
    return updateEvent(t.token, t.calendarId, googleEventId, { summary: patch.summary, start: new Date(patch.start).toISOString(), end });
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

export interface ExternalEvent { id: string; title: string; start: string; meetingLink?: string | null; link?: string | null; }

/**
 * Pull the user's Google Calendar events for a window, refreshing the access
 * token first if it has expired. Returns [] when Google isn't configured or the
 * user hasn't connected — the dashboard then just shows internal events.
 */
export async function getGoogleEventsForUser(profileId: string, timeMin: string, timeMax: string): Promise<ExternalEvent[]> {
  if (!googleConfigured()) return [];
  const svc = createSupabaseServiceRoleClient();
  const { data: conn } = await svc.from('calendar_connections').select('*').eq('profile_id', profileId).eq('provider', 'google').maybeSingle();
  if (!conn?.access_token) return [];

  let accessToken = conn.access_token;
  // Refresh if expired.
  if (conn.token_expiry && new Date(conn.token_expiry).getTime() < Date.now() && conn.refresh_token) {
    const refreshed = await refreshAccessToken(conn.refresh_token);
    if (refreshed?.access_token) {
      accessToken = refreshed.access_token;
      await svc.from('calendar_connections').update({
        access_token: refreshed.access_token,
        token_expiry: new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', conn.id);
    }
  }

  const events = await listEvents(accessToken, conn.calendar_id ?? 'primary', timeMin, timeMax);
  return events
    .map((e) => ({ id: `g_${e.id}`, title: e.summary ?? '(busy)', start: e.start?.dateTime ?? (e.start?.date ? `${e.start.date}T00:00:00` : ''), meetingLink: e.hangoutLink ?? null, link: e.htmlLink ?? null }))
    .filter((e) => e.start);
}

export async function isCalendarConnected(profileId: string): Promise<{ connected: boolean; configured: boolean }> {
  const configured = googleConfigured();
  if (!configured) return { connected: false, configured };
  const svc = createSupabaseServiceRoleClient();
  const { data } = await svc.from('calendar_connections').select('id, access_token').eq('profile_id', profileId).eq('provider', 'google').maybeSingle();
  return { connected: !!data?.access_token, configured };
}
