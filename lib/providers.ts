/**
 * Provider abstraction for outbound messaging — deliberately provider-agnostic.
 *
 * A channel adapter implements `send(to, payload)`. `getChannelAdapter(channel)`
 * is the registry: it picks an adapter from configured env credentials, falling
 * back to the LogAdapter (which captures the message without a live provider).
 * Adding a provider is a new adapter + a registry branch — no caller changes.
 * Server-only (reads secrets, never imported into the client).
 *
 * WhatsApp: Meta Cloud API or Twilio. Email: Resend or Postmark.
 */

export type Channel = 'whatsapp' | 'email';

export interface SendResult {
  status: 'queued' | 'sent' | 'failed';
  provider: string;
  providerMessageId?: string | null;
  error?: string;
}

export interface ChannelAdapter {
  provider: string;
  send(to: string, payload: { subject?: string | null; body: string }): Promise<SendResult>;
}

/** Default adapter — captures the message but performs no live send. */
const logAdapter: ChannelAdapter = {
  provider: 'log',
  async send() {
    // No external provider configured — the message is recorded by the comms
    // service with status 'queued' so it's visible and re-sendable once a real
    // provider is connected.
    return { status: 'queued', provider: 'log' };
  },
};

// ── WhatsApp: Meta Cloud API ──
const metaWhatsAppAdapter: ChannelAdapter = {
  provider: 'meta',
  async send(to, payload) {
    try {
      const phoneId = process.env.META_WHATSAPP_PHONE_ID!;
      const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${process.env.META_WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ messaging_product: 'whatsapp', to: to.replace(/[^\d+]/g, ''), type: 'text', text: { body: payload.body } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { status: 'failed', provider: 'meta', error: data?.error?.message ?? `HTTP ${res.status}` };
      return { status: 'sent', provider: 'meta', providerMessageId: data?.messages?.[0]?.id ?? null };
    } catch (err: any) {
      return { status: 'failed', provider: 'meta', error: err?.message ?? 'send failed' };
    }
  },
};

// ── WhatsApp: Twilio ──
const twilioWhatsAppAdapter: ChannelAdapter = {
  provider: 'twilio',
  async send(to, payload) {
    try {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const from = process.env.TWILIO_WHATSAPP_FROM ?? 'whatsapp:+14155238886';
      const form = new URLSearchParams({ From: from, To: `whatsapp:${to.replace(/[^\d+]/g, '')}`, Body: payload.body });
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { status: 'failed', provider: 'twilio', error: data?.message ?? `HTTP ${res.status}` };
      return { status: 'sent', provider: 'twilio', providerMessageId: data?.sid ?? null };
    } catch (err: any) {
      return { status: 'failed', provider: 'twilio', error: err?.message ?? 'send failed' };
    }
  },
};

// ── Email: Resend ──
const resendEmailAdapter: ChannelAdapter = {
  provider: 'resend',
  async send(to, payload) {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);
      const res = await resend.emails.send({
        from: process.env.RESEND_FROM_ADDRESS ?? 'Oramira <notifications@oramira.com>',
        to,
        subject: payload.subject ?? 'Oramira',
        html: payload.body,
      });
      return { status: 'sent', provider: 'resend', providerMessageId: (res as any)?.data?.id ?? null };
    } catch (err: any) {
      return { status: 'failed', provider: 'resend', error: err?.message ?? 'send failed' };
    }
  },
};

// ── Email: Postmark ──
const postmarkEmailAdapter: ChannelAdapter = {
  provider: 'postmark',
  async send(to, payload) {
    try {
      const res = await fetch('https://api.postmarkapp.com/email', {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-postmark-server-token': process.env.POSTMARK_SERVER_TOKEN!,
        },
        body: JSON.stringify({
          From: process.env.POSTMARK_FROM_ADDRESS ?? 'notifications@oramira.com',
          To: to,
          Subject: payload.subject ?? 'Oramira',
          HtmlBody: payload.body,
          MessageStream: process.env.POSTMARK_MESSAGE_STREAM ?? 'outbound',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { status: 'failed', provider: 'postmark', error: data?.Message ?? `HTTP ${res.status}` };
      return { status: 'sent', provider: 'postmark', providerMessageId: data?.MessageID ?? null };
    } catch (err: any) {
      return { status: 'failed', provider: 'postmark', error: err?.message ?? 'send failed' };
    }
  },
};

/**
 * Registry. Env-driven: the first provider with credentials wins, else the log
 * adapter. The `integrations` table is the future home for admin-configured
 * credentials surfaced through the UI.
 */
export function getChannelAdapter(channel: Channel): ChannelAdapter {
  if (channel === 'whatsapp') {
    if (process.env.META_WHATSAPP_TOKEN && process.env.META_WHATSAPP_PHONE_ID) return metaWhatsAppAdapter;
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) return twilioWhatsAppAdapter;
    return logAdapter;
  }
  if (channel === 'email') {
    if (process.env.RESEND_API_KEY) return resendEmailAdapter;
    if (process.env.POSTMARK_SERVER_TOKEN) return postmarkEmailAdapter;
    return logAdapter;
  }
  return logAdapter;
}
