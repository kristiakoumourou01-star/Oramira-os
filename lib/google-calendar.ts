/**
 * Google Calendar integration — OAuth + Calendar API. Server-only. Inert until
 * GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are configured, so the dashboard works
 * (showing internal events) whether or not Google is connected.
 */

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
  'openid',
  'email',
];

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/google/callback`;
}

/** Build the consent URL. `state` carries the user id back to the callback. */
export function googleAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES.join(' '),
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export interface GoogleTokens { access_token: string; refresh_token?: string; expires_in: number; }

export async function exchangeCode(code: string): Promise<GoogleTokens | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(), grant_type: 'authorization_code',
      }).toString(),
    });
    if (!res.ok) return null;
    return (await res.json()) as GoogleTokens;
  } catch { return null; }
}

export async function refreshAccessToken(refreshToken: string): Promise<GoogleTokens | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        refresh_token: refreshToken, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: 'refresh_token',
      }).toString(),
    });
    if (!res.ok) return null;
    return (await res.json()) as GoogleTokens;
  } catch { return null; }
}

export interface GCalEvent { id: string; summary?: string; start?: { dateTime?: string; date?: string }; hangoutLink?: string; htmlLink?: string }

export async function listEvents(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<GCalEvent[]> {
  try {
    const params = new URLSearchParams({ timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '50' });
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items ?? []) as GCalEvent[];
  } catch { return []; }
}

/** Create an event — optional Google Meet, attendee invites, and a reminder. */
export async function insertEvent(accessToken: string, calendarId: string, event: {
  summary: string; description?: string; location?: string; start: string; end: string;
  withMeet?: boolean; attendees?: string[]; reminderMinutes?: number; recurrence?: string[];
}): Promise<{ id: string; hangoutLink?: string } | null> {
  try {
    const body: any = {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: { dateTime: event.start },
      end: { dateTime: event.end },
    };
    if (event.recurrence && event.recurrence.length) body.recurrence = event.recurrence;
    if (event.withMeet) body.conferenceData = { createRequest: { requestId: crypto.randomUUID() } };
    if (event.attendees && event.attendees.length) body.attendees = event.attendees.map((email) => ({ email }));
    if (event.reminderMinutes != null) body.reminders = { useDefault: false, overrides: [{ method: 'popup', minutes: event.reminderMinutes }] };
    const params = new URLSearchParams({ conferenceDataVersion: '1' });
    if (event.attendees && event.attendees.length) params.set('sendUpdates', 'all'); // email the invites
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { id: data.id, hangoutLink: data.hangoutLink };
  } catch { return null; }
}

/** Delete an event (event cancellation → notifies attendees). */
export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}?sendUpdates=all`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 410; // 410 = already gone
  } catch { return false; }
}

/** Patch an existing event's time (two-way sync on internal reschedule). */
export async function updateEvent(accessToken: string, calendarId: string, eventId: string, patch: { summary?: string; start?: string; end?: string }): Promise<boolean> {
  try {
    const body: any = {};
    if (patch.summary) body.summary = patch.summary;
    if (patch.start) body.start = { dateTime: patch.start };
    if (patch.end) body.end = { dateTime: patch.end };
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${eventId}`, {
      method: 'PATCH',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return res.ok;
  } catch { return false; }
}

export interface BusyBlock { start: string; end: string }

/** Free/busy lookup for the availability engine. */
export async function freeBusy(accessToken: string, calendarId: string, timeMin: string, timeMax: string): Promise<BusyBlock[]> {
  try {
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: calendarId }] }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.calendars?.[calendarId]?.busy ?? []) as BusyBlock[];
  } catch { return []; }
}
