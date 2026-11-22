import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { langOf, pickText } from '@/lib/message-format-shared';
import { sendMessage } from '@/lib/communications';
import { mergeLeadAutomation, renderAppt, type ApptChannel } from '@/lib/lead-automation-shared';
import { formatDate, formatTime } from '@/lib/format';

/**
 * Μηνύματα ραντεβού προς τον πελάτη (επιβεβαίωση / υπενθύμιση), με τις ρυθμίσεις του
 * Marketing → Αυτοματισμοί leads. Server-only· δεν πετάει σφάλμα (η αποστολή δεν
 * πρέπει να σταματά τη δημιουργία του ραντεβού).
 */
export async function appointmentSettings() {
  const svc = createSupabaseServiceRoleClient();
  const { data } = await svc.from('org_settings').select('data').eq('id', 'org').maybeSingle();
  return mergeLeadAutomation((data?.data as any)?.leadAutomation).appointments;
}

export async function sendAppointmentMessage(kind: 'confirm' | 'reminder', p: {
  contactId: string | null | undefined; leadId?: string | null; startISO: string; title?: string | null; place?: string | null; agentId?: string | null;
}): Promise<boolean> {
  try {
    if (!p.contactId) return false;
    const cfg = (await appointmentSettings())[kind];
    if (!cfg.enabled) return false;
    const svc = createSupabaseServiceRoleClient();
    const [{ data: c }, agent] = await Promise.all([
      svc.from('contacts').select('full_name, email, phone, preferred_language').eq('id', p.contactId).maybeSingle(),
      p.agentId ? svc.from('profiles').select('full_name').eq('id', p.agentId).maybeSingle().then((r) => r.data) : Promise.resolve(null),
    ]);
    const to = cfg.channel === 'email' ? (c as any)?.email : (c as any)?.phone;
    if (!to) return false;
    const lang = langOf((c as any)?.preferred_language);
    const body = renderAppt(pickText(cfg.text, cfg.textEn, lang), { name: (c as any)?.full_name, date: formatDate(p.startISO), time: formatTime(p.startISO), place: p.place, title: p.title, agent: (agent as any)?.full_name ?? null });
    const r = await sendMessage({
      contactId: p.contactId, leadId: p.leadId ?? null, channel: cfg.channel as ApptChannel, to,
      subject: lang === 'en' ? (kind === 'confirm' ? 'Appointment confirmation' : 'Appointment reminder') : (kind === 'confirm' ? 'Επιβεβαίωση ραντεβού' : 'Υπενθύμιση ραντεβού'),
      lang,
      body: cfg.channel === 'email' ? body.replace(/\n/g, '<br>') : body,
      templateKey: kind === 'confirm' ? 'appointment_confirm' : 'appointment_reminder',
    });
    return r.status !== 'failed';
  } catch (e) {
    console.error('[appointment-message]', e);
    return false;
  }
}
