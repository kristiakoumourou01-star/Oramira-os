'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cleanAudience, type CampaignChannel } from '@/lib/campaigns-shared';
import { resolveAudience, deliverCampaign } from '@/lib/campaign-send';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function previewAudience(audience: unknown, channel: CampaignChannel): Promise<R<{ total: number; reachable: number; noConsent: number; noAddress: number }>> {
  await requirePermission('marketing');
  const a = cleanAudience(audience, channel);
  if (!a) return { ok: true, total: 0, reachable: 0, noConsent: 0, noAddress: 0 };
  const r = await resolveAudience((await createSupabaseServerClient()) as any, a, channel);
  return { ok: true, total: r.total, reachable: r.list.length, noConsent: r.noConsent, noAddress: r.noAddress };
}

export interface CampaignInput { id?: string; name: string; channel: CampaignChannel; audience: unknown; subject?: string; preview?: string; body: string }

/** Αποθήκευση ως πρόχειρο, ή αποθήκευση και αποστολή. */
export async function saveCampaign(input: CampaignInput, send: boolean): Promise<R<{ id: string; sent?: number; failed?: number; queued?: number; providerMissing?: boolean }>> {
  const me = await requirePermission('marketing', 'edit');
  const channel: CampaignChannel = (['sms', 'whatsapp', 'push'] as const).find((c) => c === input.channel) ?? 'email';
  const name = (input.name ?? '').trim().slice(0, 120);
  const body = (input.body ?? '').trim().slice(0, channel === 'sms' ? 1000 : 20000);
  const audience = cleanAudience(input.audience, channel);
  if (!name) return { ok: false, error: 'Γράψτε όνομα campaign.' };
  if (!audience) return { ok: false, error: 'Διαλέξτε κοινό.' };
  if (send && !body) return { ok: false, error: 'Γράψτε το μήνυμα.' };
  if (send && channel === 'email' && !(input.subject ?? '').trim()) return { ok: false, error: 'Γράψτε θέμα για το email.' };
  const db = (await createSupabaseServerClient()) as any;
  const row = { name, channel, audience, subject: (input.subject ?? '').trim().slice(0, 200) || null, preview: (input.preview ?? '').trim().slice(0, 200) || null, body };
  let id = input.id && UUID.test(input.id) ? input.id : '';
  if (id) {
    const { data: cur } = await db.from('marketing_campaigns').select('status').eq('id', id).maybeSingle();
    if (!cur) return { ok: false, error: 'Το campaign δεν βρέθηκε.' };
    if (cur.status !== 'draft') return { ok: false, error: 'Το campaign έχει ήδη σταλεί.' };
    const { error } = await db.from('marketing_campaigns').update(row).eq('id', id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { data, error } = await db.from('marketing_campaigns').insert({ ...row, created_by: me.id }).select('id').single();
    if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Λείπει το migration 0080 στη βάση.' : error.message };
    id = data.id;
  }
  if (!send) { revalidatePath('/marketing'); return { ok: true, id }; }

  const { list, noConsent, noAddress } = await resolveAudience(db, audience, channel);
  if (!list.length) return { ok: false, error: 'Κανένας παραλήπτης με συγκατάθεση marketing και διεύθυνση σε αυτό το κοινό.' };
  const { sent, failed, queued, providerMissing } = await deliverCampaign(db, { id, name, channel, subject: row.subject, body }, list, noConsent + noAddress);
  revalidatePath('/marketing');
  return { ok: true, id, sent, failed, queued, providerMissing };
}

export async function deleteCampaign(id: string): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρο campaign.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('marketing_campaigns').delete().eq('id', id).eq('status', 'draft');
  if (error) return { ok: false, error: error.message };
  revalidatePath('/marketing');
  return { ok: true };
}
