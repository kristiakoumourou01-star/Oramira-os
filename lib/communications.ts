import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getChannelAdapter, type Channel } from '@/lib/providers';
import { mergeCommunication, mergeOrgSettings } from '@/lib/org-settings-shared';
import { withSignature, type MsgLang, type SignatureInfo } from '@/lib/message-format-shared';

/**
 * Communication service — the one place outbound messages are rendered, sent
 * through the provider abstraction, and recorded on the unified timeline
 * (contact_communications). Used by agent-initiated sends and the automation
 * engine alike. Runs with the service-role client (system-level, trusted).
 */

export function renderTemplate(text: string, vars: Record<string, string | null | undefined>): string {
  return text.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_, k) => (vars[k] ?? '').toString());
}

interface SendArgs {
  contactId: string;
  leadId?: string | null;
  channel: Channel;
  to: string | null;
  subject?: string | null;
  body: string;
  templateKey?: string | null;
  aiGenerated?: boolean;
  firstResponse?: boolean; // a manual agent contact — stamps speed-to-lead
  /** Όνομα αποστολέα· αν λείπει, η προεπιλογή από Ρυθμίσεις → Επικοινωνία. */
  fromName?: string | null;
  /** Γλώσσα του πελάτη (για το υποσέλιδο). */
  lang?: MsgLang;
  /** Marketing μήνυμα (καμπάνια / αυτοματισμός): το email παίρνει και γραμμή διαγραφής. */
  marketing?: boolean;
  /** false = χωρίς υπογραφή (π.χ. όταν έχει ήδη μπει). */
  signature?: boolean;
}

/** Ρυθμίσεις → Επικοινωνία (υπογραφή) και Στοιχεία εταιρείας (τηλέφωνο, email, website), με μικρή μνήμη. */
let sigCache: { at: number; v: SignatureInfo } | null = null;
export async function getSignatureInfo(): Promise<SignatureInfo> {
  if (sigCache && Date.now() - sigCache.at < 60_000) return sigCache.v;
  try {
    const { data } = await (createSupabaseServiceRoleClient() as any).from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const o = mergeOrgSettings(data?.data ?? {});
    const b = o.business;
    const v: SignatureInfo = { signature: o.communication.signature, phone: b.landline || b.mobile || '', email: o.communication.emailReplyTo || b.invoiceEmail || '', website: b.website || '' };
    sigCache = { at: Date.now(), v };
    return v;
  } catch { return { signature: 'Oramira Ltd', phone: '', email: '', website: '' }; }
}

/** Ρυθμίσεις → Επικοινωνία: όνομα αποστολέα email και SMS sender ID. */
export async function defaultSenderNames(): Promise<{ email: string; sms: string }> {
  try {
    const { data } = await (createSupabaseServiceRoleClient() as any).from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const c = mergeCommunication(data?.data?.communication);
    return { email: c.emailFromName, sms: c.smsSender };
  } catch { return { email: '', sms: '' }; }
}

/** Send a message and record it. Returns the recorded status. */
export async function sendMessage(args: SendArgs): Promise<{ status: string; provider: string }> {
  const supabase = createSupabaseServiceRoleClient();

  let status = 'queued';
  let provider = 'log';
  let providerMessageId: string | null = null;

  // Υπογραφή στο τέλος (μία φορά), και στο μήνυμα που καταγράφεται στο ιστορικό.
  if (args.signature !== false) args = { ...args, body: withSignature(args.body, args.channel, await getSignatureInfo(), { lang: args.lang, marketing: args.marketing }) };

  if (args.to) {
    const adapter = getChannelAdapter(args.channel);
    let from = args.fromName;
    if (from == null && args.channel !== 'whatsapp') { const d = await defaultSenderNames(); from = args.channel === 'email' ? d.email : d.sms; }
    const res = await adapter.send(args.to, { subject: args.subject, body: args.body, from: from || null });
    status = res.status === 'failed' ? 'failed' : res.status; // queued | sent | failed
    provider = res.provider;
    providerMessageId = res.providerMessageId ?? null;
  } else {
    status = 'failed'; // no destination on file
  }

  await supabase.from('contact_communications').insert({
    contact_id: args.contactId,
    lead_id: args.leadId ?? null,
    channel: args.channel,
    direction: 'outbound',
    summary: args.body.slice(0, 140),
    body: args.body,
    status,
    provider,
    provider_message_id: providerMessageId,
    template_key: args.templateKey ?? null,
    ai_generated: args.aiGenerated ?? false,
  });

  // Outbound contact refreshes the lead's last_contacted_at (feeds priority).
  if (args.leadId && status !== 'failed') {
    await supabase.from('leads').update({ last_contacted_at: new Date().toISOString() }).eq('id', args.leadId);
    // A manual agent contact stamps speed-to-lead (only the first one).
    if (args.firstResponse) {
      await supabase.from('leads').update({ first_response_at: new Date().toISOString() }).eq('id', args.leadId).is('first_response_at', null);
    }
  }

  return { status, provider };
}

/** Send a message from a named template, rendering placeholders. Picks the
 *  audience variant (ru/el) and falls back to the default (en). */
export async function sendTemplate(args: {
  contactId: string;
  leadId?: string | null;
  channel: Channel;
  templateKey: string;
  to: string | null;
  vars: Record<string, string | null | undefined>;
  /** Γλώσσα του πελάτη (en, el, ru, de…) — χωρίς μετάφραση πέφτει στα αγγλικά. */
  audience?: string;
}): Promise<{ status: string } | null> {
  const supabase = createSupabaseServiceRoleClient();
  const aud = (args.audience || 'en').toLowerCase();
  let { data: tpl } = await supabase
    .from('message_templates')
    .select('subject, body, is_active')
    .eq('channel', args.channel).eq('key', args.templateKey).eq('audience', aud)
    .maybeSingle();
  if (!tpl && aud !== 'en') {
    ({ data: tpl } = await supabase
      .from('message_templates')
      .select('subject, body, is_active')
      .eq('channel', args.channel).eq('key', args.templateKey).eq('audience', 'en')
      .maybeSingle());
  }
  if (!tpl || !tpl.is_active) return null;

  return sendMessage({
    contactId: args.contactId,
    leadId: args.leadId,
    channel: args.channel,
    to: args.to,
    subject: tpl.subject ? renderTemplate(tpl.subject, args.vars) : null,
    body: renderTemplate(tpl.body, args.vars),
    templateKey: args.templateKey,
  });
}
