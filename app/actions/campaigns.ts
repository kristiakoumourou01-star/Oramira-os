'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cleanAudience, cleanSender, type CampaignChannel } from '@/lib/campaigns-shared';
import { resolveAudience, deliverCampaign, stripNewCols, NEW_COL_RE } from '@/lib/campaign-send';
import { zonedToUtc } from '@/lib/marketing-automations-shared';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function previewAudience(audience: unknown, channel: CampaignChannel): Promise<R<{ total: number; reachable: number; noConsent: number; noAddress: number }>> {
  await requirePermission('marketing');
  const a = cleanAudience(audience, channel);
  if (!a) return { ok: true, total: 0, reachable: 0, noConsent: 0, noAddress: 0 };
  const r = await resolveAudience((await createSupabaseServerClient()) as any, a, channel);
  return { ok: true, total: r.total, reachable: r.list.length, noConsent: r.noConsent, noAddress: r.noAddress };
}

export interface CampaignInput {
  id?: string; name: string; channel: CampaignChannel; audience: unknown; subject?: string; preview?: string; body: string;
  /** Αγγλική εκδοχή. */
  subjectEn?: string; bodyEn?: string;
  /** «Προγραμματισμός»: ημερομηνία (YYYY-MM-DD) και ώρα (HH:MM) Κύπρου. */
  scheduleDate?: string; scheduleTime?: string;
  /** Όνομα αποστολέα (κενό = Ρυθμίσεις → Επικοινωνία). */
  senderName?: string;
}

/** Αποθήκευση ως πρόχειρο, ή αποθήκευση και αποστολή. */
export async function saveCampaign(input: CampaignInput, send: boolean): Promise<R<{ id: string; sent?: number; failed?: number; queued?: number; providerMissing?: boolean; scheduledAt?: string }>> {
  const me = await requirePermission('marketing', 'edit');
  const channel: CampaignChannel = (['sms', 'whatsapp', 'push'] as const).find((c) => c === input.channel) ?? 'email';
  const name = (input.name ?? '').trim().slice(0, 120);
  const max = channel === 'sms' ? 1000 : 20000;
  const body = (input.body ?? '').trim().slice(0, max);
  const bodyEn = (input.bodyEn ?? '').trim().slice(0, max);
  const subjectEn = (input.subjectEn ?? '').trim().slice(0, 200) || null;
  const audience = cleanAudience(input.audience, channel);
  if (!name) return { ok: false, error: 'Γράψτε όνομα campaign.' };
  if (!audience) return { ok: false, error: 'Διαλέξτε κοινό.' };
  if (send && !body && !bodyEn) return { ok: false, error: 'Γράψτε το μήνυμα.' };
  if (send && channel === 'email' && !(input.subject ?? '').trim() && !subjectEn) return { ok: false, error: 'Γράψτε θέμα για το email.' };
  const sender = cleanSender(input.senderName, channel);
  if (!sender.ok) return sender;
  const db = (await createSupabaseServerClient()) as any;
  const row = { sender_name: sender.value, subject_en: subjectEn, body_en: bodyEn || null, name, channel, audience, subject: (input.subject ?? '').trim().slice(0, 200) || null, preview: (input.preview ?? '').trim().slice(0, 200) || null, body };
  let id = input.id && UUID.test(input.id) ? input.id : '';
  if (id) {
    const { data: cur } = await db.from('marketing_campaigns').select('status').eq('id', id).maybeSingle();
    if (!cur) return { ok: false, error: 'Το campaign δεν βρέθηκε.' };
    if (cur.status !== 'draft' && cur.status !== 'scheduled') return { ok: false, error: 'Το campaign έχει ήδη σταλεί.' };
    // Αλλαγή προγραμματισμένης: ξαναγίνεται πρόχειρο μέχρι να ξαναπατηθεί «Προγραμματισμός» / «Αποστολή».
    let { error } = await db.from('marketing_campaigns').update({ ...row, status: 'draft' }).eq('id', id);
    if (error && NEW_COL_RE.test(error.message)) ({ error } = await db.from('marketing_campaigns').update({ ...stripNewCols(row), status: 'draft' }).eq('id', id));
    if (error) return { ok: false, error: error.message };
  } else {
    let { data, error } = await db.from('marketing_campaigns').insert({ ...row, created_by: me.id }).select('id').single();
    if (error && NEW_COL_RE.test(error.message)) ({ data, error } = await db.from('marketing_campaigns').insert({ ...stripNewCols(row), created_by: me.id }).select('id').single());
    if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Λείπει το migration 0080 στη βάση.' : error.message };
    id = data.id;
  }
  if (!send) { revalidatePath('/marketing'); return { ok: true, id }; }

  if (input.scheduleDate) {
    const d = /^\d{4}-\d{2}-\d{2}$/.test(input.scheduleDate) ? input.scheduleDate.split('-').map(Number) : null;
    const t = /^([01]\d|2[0-3]):[0-5]\d$/.test(input.scheduleTime ?? '') ? (input.scheduleTime as string).split(':').map(Number) : null;
    if (!d || !t) return { ok: false, error: 'Συμπληρώστε ημερομηνία και ώρα αποστολής.' };
    const at = zonedToUtc(d[0], d[1], d[2], t[0], t[1]);
    if (at.getTime() <= Date.now()) return { ok: false, error: 'Η ώρα αποστολής έχει ήδη περάσει. Διαλέξτε μελλοντική ημερομηνία.' };
    const { error } = await db.from('marketing_campaigns').update({ status: 'scheduled', scheduled_at: at.toISOString() }).eq('id', id);
    if (error) return { ok: false, error: /scheduled_at|check constraint/i.test(error.message) ? 'Λείπει το migration 0110 στη βάση.' : error.message };
    revalidatePath('/marketing');
    return { ok: true, id, scheduledAt: at.toISOString() };
  }

  const { list, noConsent, noAddress } = await resolveAudience(db, audience, channel);
  if (!list.length) return { ok: false, error: 'Κανένας παραλήπτης με συγκατάθεση marketing και διεύθυνση σε αυτό το κοινό.' };
  const { sent, failed, queued, providerMissing } = await deliverCampaign(db, { id, name, channel, subject: row.subject, body, subjectEn, bodyEn, senderName: sender.value }, list, noConsent + noAddress);
  revalidatePath('/marketing');
  return { ok: true, id, sent, failed, queued, providerMissing };
}

export async function deleteCampaign(id: string): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρο campaign.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('marketing_campaigns').delete().eq('id', id).in('status', ['draft', 'scheduled']);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}
