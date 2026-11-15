'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { sendMessage } from '@/lib/communications';
import { getChannelAdapter } from '@/lib/providers';
import { cleanAudience, renderCampaign, type CampaignAudience, type CampaignChannel } from '@/lib/campaigns-shared';

type R<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Recipient { contactId: string | null; name: string; to: string }

/** Ποιοι θα το λάβουν: μόνο όσοι έχουν δώσει συγκατάθεση marketing (GDPR), εκτός από τις γραπτές διευθύνσεις. */
async function resolve(audience: CampaignAudience, channel: CampaignChannel): Promise<{ list: Recipient[]; total: number; noConsent: number; noAddress: number }> {
  const db = (await createSupabaseServerClient()) as any;
  if (audience.kind === 'addresses') {
    const list = audience.addresses.map((a) => ({ contactId: null, name: '', to: a }));
    return { list, total: list.length, noConsent: 0, noAddress: 0 };
  }
  let q = db.from('contacts').select('id, full_name, email, phone, marketing_opt_in, status').is('anonymized_at', null).limit(5000);
  if (audience.kind === 'groups') q = q.overlaps('groups', audience.groups);
  else if (audience.kind === 'contacts') q = q.in('id', audience.ids.filter((x) => UUID.test(x)));
  else if (audience.kind === 'tag') q = q.contains('tags', [audience.tag]);
  else if (audience.kind === 'role') {
    const col: Record<string, string> = { lead: 'is_lead', buyer: 'is_buyer', investor: 'is_investor', homeowner: 'is_homeowner', newsletter: 'is_newsletter_subscriber' };
    if (col[audience.role]) q = q.eq(col[audience.role], true); else q = q.contains('extra_roles', [audience.role]);
  }
  const { data } = await q;
  const rows = ((data ?? []) as any[]).filter((c) => c.status !== 'archived' && c.status !== 'do_not_contact');
  let noConsent = 0, noAddress = 0;
  const list: Recipient[] = [];
  for (const c of rows) {
    if (!c.marketing_opt_in) { noConsent++; continue; }
    const to = channel === 'email' ? (c.email ?? '').trim() : (c.phone ?? '').trim();
    if (!to) { noAddress++; continue; }
    list.push({ contactId: c.id, name: c.full_name ?? '', to });
  }
  return { list, total: rows.length, noConsent, noAddress };
}

export async function previewAudience(audience: unknown, channel: CampaignChannel): Promise<R<{ total: number; reachable: number; noConsent: number; noAddress: number }>> {
  await requirePermission('marketing');
  const a = cleanAudience(audience, channel);
  if (!a) return { ok: true, total: 0, reachable: 0, noConsent: 0, noAddress: 0 };
  const r = await resolve(a, channel);
  return { ok: true, total: r.total, reachable: r.list.length, noConsent: r.noConsent, noAddress: r.noAddress };
}

export interface CampaignInput { id?: string; name: string; channel: CampaignChannel; audience: unknown; subject?: string; preview?: string; body: string }

/** Αποθήκευση ως πρόχειρο, ή αποθήκευση και αποστολή. */
export async function saveCampaign(input: CampaignInput, send: boolean): Promise<R<{ id: string; sent?: number; failed?: number; queued?: number; providerMissing?: boolean }>> {
  const me = await requirePermission('marketing', 'edit');
  const channel: CampaignChannel = input.channel === 'whatsapp' ? 'whatsapp' : 'email';
  const name = (input.name ?? '').trim().slice(0, 120);
  const body = (input.body ?? '').trim().slice(0, 20000);
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

  const { list, noConsent, noAddress } = await resolve(audience, channel);
  if (!list.length) return { ok: false, error: 'Κανένας παραλήπτης με συγκατάθεση marketing και διεύθυνση σε αυτό το κοινό.' };
  await db.from('marketing_campaigns').update({ status: 'sending', recipients: list.length, skipped: noConsent + noAddress }).eq('id', id);

  let sent = 0, failed = 0, queued = 0;
  const providerMissing = getChannelAdapter(channel).provider === 'log';
  const one = async (r: Recipient) => {
    const text = renderCampaign(body, r.name);
    const html = channel === 'email' ? text.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('') : text;
    const subject = channel === 'email' ? renderCampaign(row.subject ?? name, r.name) : null;
    let status = 'failed';
    if (r.contactId) {
      const res = await sendMessage({ contactId: r.contactId, channel, to: r.to, subject, body: html, templateKey: `campaign:${id}` });
      status = res.status;
    } else {
      const res = await getChannelAdapter(channel).send(r.to, { subject, body: html });
      status = res.status;
    }
    if (status === 'sent') sent++; else if (status === 'queued') queued++; else failed++;
  };
  for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(one));
  await (db.from('contact_communications') as any).update({ campaign_id: id }).eq('template_key', `campaign:${id}`);
  await db.from('marketing_campaigns').update({ status: 'sent', sent: sent + queued, failed, sent_at: new Date().toISOString() }).eq('id', id);
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
