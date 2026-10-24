import { NextResponse, type NextRequest } from 'next/server';
import { updateDeliveryStatus } from '@/lib/inbound-comms';

/**
 * Email analytics webhook — provider-agnostic. Accepts Resend or Postmark event
 * payloads and updates the matching message's delivery state on the timeline
 * (delivered / opened / clicked / bounced). Keyed by provider_message_id.
 * Public route; in production verify the provider's signing secret.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Resend: { type: 'email.delivered'|'email.opened'|'email.clicked'|'email.bounced', data: { email_id } }
    if (typeof body?.type === 'string' && body.type.startsWith('email.')) {
      const event = mapResend(body.type);
      const id = body?.data?.email_id ?? body?.data?.id;
      if (event && id) await updateDeliveryStatus({ providerMessageId: id, event, error: body?.data?.reason });
    }
    // Postmark: { RecordType: 'Delivery'|'Open'|'Click'|'Bounce', MessageID }
    else if (typeof body?.RecordType === 'string') {
      const event = mapPostmark(body.RecordType);
      const id = body?.MessageID;
      if (event && id) await updateDeliveryStatus({ providerMessageId: id, event, error: body?.Description });
    }
  } catch (err) {
    console.error('email webhook error', err);
  }
  return NextResponse.json({ ok: true });
}

function mapResend(type: string): 'delivered' | 'opened' | 'clicked' | 'bounced' | null {
  if (type === 'email.delivered') return 'delivered';
  if (type === 'email.opened') return 'opened';
  if (type === 'email.clicked') return 'clicked';
  if (type === 'email.bounced' || type === 'email.complained') return 'bounced';
  return null;
}

function mapPostmark(rec: string): 'delivered' | 'opened' | 'clicked' | 'bounced' | null {
  if (rec === 'Delivery') return 'delivered';
  if (rec === 'Open') return 'opened';
  if (rec === 'Click') return 'clicked';
  if (rec === 'Bounce' || rec === 'SpamComplaint') return 'bounced';
  return null;
}
