import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getChannelAdapter, type Channel } from '@/lib/providers';

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
}

/** Send a message and record it. Returns the recorded status. */
export async function sendMessage(args: SendArgs): Promise<{ status: string; provider: string }> {
  const supabase = createSupabaseServiceRoleClient();

  let status = 'queued';
  let provider = 'log';
  let providerMessageId: string | null = null;

  if (args.to) {
    const adapter = getChannelAdapter(args.channel);
    const res = await adapter.send(args.to, { subject: args.subject, body: args.body });
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
  audience?: 'en' | 'ru' | 'el';
}): Promise<{ status: string } | null> {
  const supabase = createSupabaseServiceRoleClient();
  const aud = args.audience ?? 'en';
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
