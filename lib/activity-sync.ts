import 'server-only';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { pushEventToGoogle, updateGoogleEvent, deleteGoogleEvent } from '@/lib/calendar-sync';
import { activityLabel } from '@/lib/activity-types';

/**
 * Κλείνει μια activity στο Google Calendar του υπεύθυνου (αν έχει συνδέσει Google).
 * Νέα → δημιουργία· αλλαγή ώρας → ενημέρωση· αλλαγή υπεύθυνου → μεταφορά·
 * ολοκληρωμένη → μένει όπως είναι. Ποτέ δεν πετάει σφάλμα.
 */
export async function syncActivityToCalendar(id: string): Promise<void> {
  try {
    const svc = createSupabaseServiceRoleClient();
    const { data: a } = await (svc as any).from('follow_up_tasks')
      .select('id, lead_id, assigned_to, due_at, note, type, duration_min, location, is_done, google_event_id, google_profile_id, leads(title, full_name), contacts(full_name, phone)')
      .eq('id', id).maybeSingle();
    if (!a || a.is_done || !a.assigned_to) return;
    const who = a.leads?.title || a.contacts?.full_name || a.leads?.full_name || '';
    const summary = `${activityLabel(a.type)}: ${a.note || ''}${who ? ` — ${who}` : ''}`.slice(0, 250);
    const dur = a.duration_min ?? 30;
    if (a.google_event_id && a.google_profile_id === a.assigned_to) {
      await updateGoogleEvent(a.assigned_to, a.google_event_id, { summary, start: a.due_at, durationMin: dur });
      return;
    }
    if (a.google_event_id && a.google_profile_id) await deleteGoogleEvent(a.google_profile_id, a.google_event_id);
    const app = process.env.NEXT_PUBLIC_APP_URL ?? '';
    const res = await pushEventToGoogle(a.assigned_to, {
      summary, start: a.due_at, durationMin: dur, location: a.location ?? undefined, reminderMinutes: 15,
      description: [a.contacts?.phone ? `Τηλ.: ${a.contacts.phone}` : '', a.lead_id && app ? `${app}/crm/leads/${a.lead_id}` : ''].filter(Boolean).join('\n') || undefined,
    });
    await (svc as any).from('follow_up_tasks').update({ google_event_id: res?.googleEventId ?? null, google_profile_id: res ? a.assigned_to : null }).eq('id', id);
  } catch { /* best-effort: το ημερολόγιο δεν σταματά ποτέ την αποθήκευση */ }
}
