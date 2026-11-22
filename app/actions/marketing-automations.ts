'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getChannelAdapter } from '@/lib/providers';
import { notifyUser } from '@/lib/notifications';
import { htmlBody } from '@/lib/campaign-send';
import { cleanAutomation, cleanSchedule, nextRun, renderAutomation, SAMPLE_VARS, type AutomationInput } from '@/lib/marketing-automations-shared';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = (m: string) => (/does not exist|schema cache/i.test(m) ? 'Λείπει το migration 0109 στη βάση.' : m);

/** Marketing → Δικοί μου αυτοματισμοί: νέος ή αλλαγή. */
export async function saveAutomation(input: AutomationInput): Promise<R<{ id: string }>> {
  const me = await requirePermission('marketing', 'edit');
  const c = cleanAutomation(input);
  if (!c.ok) return c;
  const v = c.value;
  const now = new Date();
  let next: string | null = null;
  if (v.kind === 'schedule') {
    const n = v.schedule ? nextRun(v.schedule, now) : null;
    if (!n) return { ok: false, error: 'Η ώρα αποστολής έχει ήδη περάσει. Διαλέξτε μελλοντική ημερομηνία.' };
    next = n.toISOString();
  }
  const row = { name: v.name, kind: v.kind, channel: v.channel, audience: v.audience ?? {}, trigger: v.trigger ?? {}, schedule: v.schedule ?? {}, subject: v.subject, body: v.body, next_run_at: next, updated_at: now.toISOString() };
  const db = (await createSupabaseServerClient()) as any;
  if (input.id && UUID.test(input.id)) {
    // Μετά από αλλαγή, μετρούν μόνο τα γεγονότα από τώρα και πέρα (όχι αναδρομικά).
    const { error } = await db.from('marketing_automations').update({ ...row, active_since: now.toISOString() }).eq('id', input.id);
    if (error) return { ok: false, error: missing(error.message) };
    revalidatePath('/marketing');
    return { ok: true, id: input.id };
  }
  const { data, error } = await db.from('marketing_automations').insert({ ...row, active: true, active_since: now.toISOString(), created_by: me.id }).select('id').single();
  if (error) return { ok: false, error: missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true, id: data.id };
}

/** Ενεργό / σε παύση. Στην επανενεργοποίηση δεν στέλνει όσα έγιναν όσο ήταν σε παύση. */
export async function setAutomationActive(id: string, active: boolean): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρος αυτοματισμός.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data: cur } = await db.from('marketing_automations').select('kind, schedule').eq('id', id).maybeSingle();
  if (!cur) return { ok: false, error: 'Ο αυτοματισμός δεν βρέθηκε.' };
  const now = new Date();
  const patch: Record<string, unknown> = { active, updated_at: now.toISOString() };
  if (active) {
    patch.active_since = now.toISOString();
    if (cur.kind === 'schedule') {
      const s = cleanSchedule(cur.schedule);
      const n = s ? nextRun(s, now) : null;
      if (!n) return { ok: false, error: 'Δεν υπάρχει επόμενη ώρα αποστολής. Αλλάξτε την ημερομηνία.' };
      patch.next_run_at = n.toISOString();
    }
  }
  const { error } = await db.from('marketing_automations').update(patch).eq('id', id);
  if (error) return { ok: false, error: missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true };
}

export async function deleteAutomation(id: string): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρος αυτοματισμός.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('marketing_automations').delete().eq('id', id);
  if (error) return { ok: false, error: missing(error.message) };
  revalidatePath('/marketing');
  return { ok: true };
}

/** «Δοκιμή»: στέλνει το μήνυμα (με δείγμα τιμών) μόνο στον χρήστη που το πατάει. */
export async function testAutomation(input: AutomationInput): Promise<R<{ to: string; logged?: boolean }>> {
  const me = await requirePermission('marketing', 'edit');
  const channel = input.channel;
  const vars = { ...SAMPLE_VARS, name: me.fullName ?? SAMPLE_VARS.name };
  const text = renderAutomation((input.body ?? '').trim(), vars);
  if (!text) return { ok: false, error: 'Γράψτε το μήνυμα.' };
  const subject = renderAutomation((input.subject ?? '').trim() || (input.name ?? '').trim() || 'Δοκιμή', vars);
  if (channel === 'push') {
    await notifyUser({ userId: me.id, title: subject, body: text.slice(0, 500), link: '/marketing' });
    return { ok: true, to: me.fullName ?? '' };
  }
  let to = '';
  if (channel === 'email') {
    const { data } = await (await createSupabaseServerClient()).auth.getUser();
    to = data.user?.email ?? '';
  } else {
    const { data } = await (createSupabaseServiceRoleClient() as any).from('profiles').select('phone').eq('id', me.id).maybeSingle();
    to = String(data?.phone ?? '').trim();
  }
  if (!to) return { ok: false, error: channel === 'email' ? 'Ο λογαριασμός σας δεν έχει email.' : 'Προσθέστε το κινητό σας στο προφίλ σας για δοκιμή SMS / WhatsApp.' };
  const adapter = getChannelAdapter(channel);
  const res = await adapter.send(to, { subject: channel === 'email' ? `[Δοκιμή] ${subject}` : null, body: channel === 'email' ? htmlBody(text) : text });
  if (res.status === 'failed') return { ok: false, error: 'Η δοκιμή δεν στάλθηκε. Ελέγξτε τη σύνδεση του παρόχου.' };
  return { ok: true, to, logged: adapter.provider === 'log' };
}
