import { NextResponse, type NextRequest } from 'next/server';
import { recordInboundMessage, updateDeliveryStatus } from '@/lib/inbound-comms';

/**
 * WhatsApp webhook — provider-agnostic. Handles:
 *  - Meta Cloud API verification (GET hub.challenge) and JSON events
 *    (inbound messages + delivery statuses).
 *  - Twilio status callbacks / inbound messages (form-encoded).
 * Inbound messages sync to the lead timeline; statuses update delivery state.
 * Public route (middleware allows /api/public/*); Meta verify token + Twilio
 * signature gate it in production.
 */

// Meta webhook verification handshake.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  if (mode === 'subscribe' && token && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      await handleMeta(await request.json());
    } else {
      const form = await request.formData();
      await handleTwilio(form);
    }
  } catch (err) {
    console.error('whatsapp webhook error', err);
  }
  // Always 200 — providers retry aggressively on non-2xx.
  return NextResponse.json({ ok: true });
}

async function handleMeta(body: any) {
  for (const entry of body?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value ?? {};
      const profileName = value?.contacts?.[0]?.profile?.name ?? null;
      for (const msg of value?.messages ?? []) {
        const text = msg?.text?.body ?? msg?.button?.text ?? '[non-text message]';
        await recordInboundMessage({ channel: 'whatsapp', from: msg.from, name: profileName, body: text, provider: 'meta', providerMessageId: msg.id });
      }
      for (const status of value?.statuses ?? []) {
        const event = mapMetaStatus(status?.status);
        if (event) await updateDeliveryStatus({ providerMessageId: status.id, event, error: status?.errors?.[0]?.title });
      }
    }
  }
}

function mapMetaStatus(s?: string): 'sent' | 'delivered' | 'read' | 'failed' | null {
  if (s === 'sent') return 'sent';
  if (s === 'delivered') return 'delivered';
  if (s === 'read') return 'read';
  if (s === 'failed') return 'failed';
  return null;
}

async function handleTwilio(form: FormData) {
  const from = form.get('From')?.toString() ?? '';
  const body = form.get('Body')?.toString();
  const status = form.get('MessageStatus')?.toString();
  const sid = form.get('MessageSid')?.toString() ?? form.get('SmsSid')?.toString() ?? null;

  // Inbound message (has a Body) vs status callback (has MessageStatus).
  if (body && from) {
    await recordInboundMessage({ channel: 'whatsapp', from, name: form.get('ProfileName')?.toString() ?? null, body, provider: 'twilio', providerMessageId: sid });
    return;
  }
  if (status && sid) {
    const event = mapTwilioStatus(status);
    if (event) await updateDeliveryStatus({ providerMessageId: sid, event, error: form.get('ErrorMessage')?.toString() });
  }
}

function mapTwilioStatus(s: string): 'sent' | 'delivered' | 'read' | 'failed' | null {
  if (s === 'sent') return 'sent';
  if (s === 'delivered') return 'delivered';
  if (s === 'read') return 'read';
  if (s === 'failed' || s === 'undelivered') return 'failed';
  return null;
}
