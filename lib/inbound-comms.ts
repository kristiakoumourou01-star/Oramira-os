import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { intakeInboundLead } from '@/lib/intake';

/**
 * Inbound + delivery sync for the live messaging providers. Webhook routes call
 * these to (a) record inbound replies on the lead timeline and (b) update
 * outbound message delivery state (delivered / read / opened / clicked /
 * bounced / failed). Service-role only — invoked from trusted webhook handlers.
 */

type Svc = ReturnType<typeof createSupabaseServiceRoleClient>;

function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/i, '').replace(/[\s()-]/g, '');
}

/** Resolve an inbound sender to a contact + open lead, creating one if needed. */
async function resolveSender(svc: Svc, args: { phone?: string | null; name?: string | null; channel: string }): Promise<{ contactId: string; leadId: string | null } | null> {
  if (args.phone) {
    const p = normalizePhone(args.phone);
    // Match on the last 8 digits to be tolerant of country-code formatting.
    const tail = p.slice(-8);
    const { data: matches } = await svc.from('contacts').select('id').ilike('phone', `%${tail}`).limit(1);
    if (matches && matches.length > 0) {
      const contactId = matches[0].id;
      const { data: lead } = await svc.from('leads').select('id').eq('contact_id', contactId).not('status', 'in', '("won","lost")').order('created_at', { ascending: false }).limit(1).maybeSingle();
      return { contactId, leadId: lead?.id ?? null };
    }
  }
  // Unknown sender → create a lead through the intake chokepoint.
  return intakeInboundLead({ channel: args.channel, name: args.name ?? undefined, phone: args.phone ?? undefined });
}

/** Record an inbound message (a customer reply) on the unified timeline. */
export async function recordInboundMessage(args: {
  channel: 'whatsapp' | 'email';
  from: string;
  name?: string | null;
  body: string;
  provider: string;
  providerMessageId?: string | null;
}): Promise<void> {
  const svc = createSupabaseServiceRoleClient();
  const resolved = await resolveSender(svc, { phone: args.from, name: args.name, channel: args.channel });
  if (!resolved) return;

  await svc.from('contact_communications').insert({
    contact_id: resolved.contactId,
    lead_id: resolved.leadId,
    channel: args.channel,
    direction: 'inbound',
    summary: args.body.slice(0, 140),
    body: args.body,
    status: 'received',
    provider: args.provider,
    provider_message_id: args.providerMessageId ?? null,
  });

  // An inbound reply is engagement — refresh recency so priority reflects it.
  if (resolved.leadId) {
    await svc.from('leads').update({ last_contacted_at: new Date().toISOString() }).eq('id', resolved.leadId);
  }
}

type DeliveryEvent = 'delivered' | 'read' | 'opened' | 'clicked' | 'bounced' | 'failed' | 'sent';

const EVENT_COLUMN: Partial<Record<DeliveryEvent, string>> = {
  delivered: 'delivered_at',
  read: 'read_at',
  opened: 'opened_at',
  clicked: 'clicked_at',
};

/**
 * Update an outbound message's delivery state from a provider status callback,
 * keyed by provider_message_id. Sets the matching timestamp and advances the
 * lifecycle status (never downgrades a delivered/read message back to sent).
 */
export async function updateDeliveryStatus(args: { providerMessageId: string; event: DeliveryEvent; error?: string | null }): Promise<void> {
  const svc = createSupabaseServiceRoleClient();
  const { data: row } = await svc.from('contact_communications').select('id, status').eq('provider_message_id', args.providerMessageId).maybeSingle();
  if (!row) return;

  const patch: Record<string, unknown> = {};
  const col = EVENT_COLUMN[args.event];
  if (col) patch[col] = new Date().toISOString();
  if (args.event === 'bounced' || args.event === 'failed') {
    patch.status = args.event === 'bounced' ? 'bounced' : 'failed';
    if (args.error) patch.error = args.error;
  } else {
    // Advance lifecycle: sent < delivered < opened < read < clicked
    const RANK: Record<string, number> = { queued: 0, sent: 1, delivered: 2, opened: 3, read: 4, clicked: 5 };
    const current = RANK[row.status] ?? 0;
    if ((RANK[args.event] ?? 0) > current) patch.status = args.event;
  }
  if (Object.keys(patch).length > 0) await svc.from('contact_communications').update(patch).eq('id', row.id);
}
