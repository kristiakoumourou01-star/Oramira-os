import { sendMessage, defaultSenderNames, getSignatureInfo } from '@/lib/communications';
import { langOf, pickText, withSignature, type MsgLang } from '@/lib/message-format-shared';
import { getChannelAdapter } from '@/lib/providers';
import { notifyUser } from '@/lib/notifications';
import { renderCampaign, type CampaignAudience, type CampaignChannel } from '@/lib/campaigns-shared';

/**
 * Ο πυρήνας αποστολής των campaigns του Marketing: ποιοι το λαμβάνουν και
 * η ίδια η αποστολή. Το χρησιμοποιούν το κουμπί «Αποστολή» (με τον client του
 * χρήστη) και οι προγραμματισμένοι αυτοματισμοί (με τον service-role client).
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Db = any;

/** Απλό κείμενο → HTML email (παράγραφοι και αλλαγές γραμμής). */
export function htmlBody(text: string): string {
  return text.split(/\n{2,}/).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p>`).join('');
}

export interface Recipient { contactId: string | null; name: string; to: string; lang?: MsgLang }

/** Ποιοι θα το λάβουν: μόνο όσοι έχουν δώσει συγκατάθεση marketing (GDPR), εκτός από τις γραπτές διευθύνσεις. */
export async function resolveAudience(db: Db, audience: CampaignAudience, channel: CampaignChannel): Promise<{ list: Recipient[]; total: number; noConsent: number; noAddress: number }> {
  if (audience.kind === 'addresses') {
    const list = audience.addresses.map((a) => ({ contactId: null, name: '', to: a }));
    return { list, total: list.length, noConsent: 0, noAddress: 0 };
  }
  let q = db.from('contacts').select('id, full_name, email, phone, marketing_opt_in, status, preferred_language').is('anonymized_at', null).limit(5000);
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
  if (channel === 'push') {
    // Push = ειδοποίηση στην εφαρμογή (portal) αγοραστών / ιδιοκτητών που έχουν λογαριασμό.
    const ok = rows.filter((c) => { if (!c.marketing_opt_in) { noConsent++; return false; } return true; });
    const { data: profs } = ok.length ? await db.from('profiles').select('id, contact_id').in('contact_id', ok.map((c) => c.id)) : { data: [] };
    const byContact = new Map(((profs ?? []) as any[]).map((p) => [p.contact_id, p.id]));
    for (const c of ok) { const pid = byContact.get(c.id); if (pid) list.push({ contactId: c.id, name: c.full_name ?? '', to: pid, lang: langOf(c.preferred_language) }); else noAddress++; }
    return { list, total: rows.length, noConsent, noAddress };
  }
  for (const c of rows) {
    if (!c.marketing_opt_in) { noConsent++; continue; }
    const to = channel === 'email' ? (c.email ?? '').trim() : (c.phone ?? '').trim();
    if (!to) { noAddress++; continue; }
    list.push({ contactId: c.id, name: c.full_name ?? '', to, lang: langOf(c.preferred_language) });
  }
  return { list, total: rows.length, noConsent, noAddress };
}


/** Στήλες του migration 0111: αν λείπουν ακόμη, αποθηκεύουμε χωρίς αυτές. */
export const NEW_COL_RE = /sender_name|subject_en|body_en|automation_id/;
export function stripNewCols<T extends Record<string, unknown>>(r: T): T {
  const { sender_name: _a, subject_en: _b, body_en: _c, automation_id: _d, ...rest } = r as any;
  return rest as T;
}

export interface CampaignToSend {
  id: string; name: string; channel: CampaignChannel; subject: string | null; body: string;
  /** Αγγλική εκδοχή (για πελάτες με γλώσσα εκτός ελληνικών). */
  subjectEn?: string | null; bodyEn?: string | null;
  senderName?: string | null;
}

/** Στέλνει ένα campaign που είναι ήδη γραμμένο στο marketing_campaigns και ενημερώνει τα νούμερά του. */
export async function deliverCampaign(db: Db, c: CampaignToSend, list: Recipient[], skipped: number): Promise<{ sent: number; failed: number; queued: number; providerMissing: boolean }> {
  const { id, name, channel } = c;
  await db.from('marketing_campaigns').update({ status: 'sending', recipients: list.length, skipped }).eq('id', id);
  // Γραπτές διευθύνσεις (χωρίς επαφή): αποστολέας και υπογραφή από τις Ρυθμίσεις.
  const loose = list.some((r) => !r.contactId);
  const defaults = loose && !c.senderName ? await defaultSenderNames() : null;
  const sig = loose ? await getSignatureInfo() : null;
  let sent = 0, failed = 0, queued = 0;
  const providerMissing = channel !== 'push' && getChannelAdapter(channel).provider === 'log';
  const one = async (r: Recipient) => {
    // Χωρίς γνωστή γλώσσα (γραπτές διευθύνσεις): ελληνικά.
    const lang: MsgLang = r.lang ?? 'el';
    const text = renderCampaign(pickText(c.body, c.bodyEn, lang), r.name);
    const subj = pickText(c.subject, c.subjectEn, lang) || name;
    const html = channel === 'email' ? htmlBody(text) : text;
    const subject = channel === 'email' ? renderCampaign(subj, r.name) : null;
    let status = 'failed';
    if (channel === 'push') {
      try { await notifyUser({ userId: r.to, title: renderCampaign(subj, r.name), body: text.slice(0, 500), link: '/' }); status = 'sent'; } catch { status = 'failed'; }
    } else if (r.contactId) {
      const res = await sendMessage({ contactId: r.contactId, channel: channel as 'email' | 'sms' | 'whatsapp', to: r.to, subject, body: html, templateKey: `campaign:${id}`, lang, marketing: true, ...(c.senderName ? { fromName: c.senderName } : {}) });
      status = res.status;
    } else {
      const res = await getChannelAdapter(channel as 'email' | 'sms' | 'whatsapp').send(r.to, { subject, body: withSignature(html, channel, sig, { lang, marketing: true }), from: c.senderName ?? defaults?.[channel === 'email' ? 'email' : 'sms'] ?? null });
      status = res.status;
    }
    if (status === 'sent') sent++; else if (status === 'queued') queued++; else failed++;
  };
  for (let i = 0; i < list.length; i += 10) await Promise.all(list.slice(i, i + 10).map(one));
  await (db.from('contact_communications') as any).update({ campaign_id: id }).eq('template_key', `campaign:${id}`);
  await db.from('marketing_campaigns').update({ status: 'sent', sent: sent + queued, failed, sent_at: new Date().toISOString() }).eq('id', id);
  return { sent, failed, queued, providerMissing };
}
