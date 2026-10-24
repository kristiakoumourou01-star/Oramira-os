import { NextResponse, type NextRequest } from 'next/server';
import { intakeInboundLead } from '@/lib/intake';

/**
 * Normalized inbound lead ingestion for social/manual channels. A channel
 * webhook or import tool POSTs a normalized payload here — no provider API is
 * integrated; this just creates/updates a CRM lead, deduped by the identity
 * chokepoint. Middleware lets /api/public/* through; lock down with INTAKE_SECRET.
 */
const CORS = {
  'Access-Control-Allow-Origin': process.env.WEBSITE_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-intake-key',
};
const CHANNELS = ['instagram', 'facebook', 'website', 'whatsapp', 'manual'];

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const secret = process.env.INTAKE_SECRET;
  if (secret && request.headers.get('x-intake-key') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS });
  }
  const channel = CHANNELS.includes(body?.channel) ? body.channel : 'manual';
  if (!body?.email && !body?.phone && !body?.externalId) {
    return NextResponse.json({ error: 'email, phone, or externalId required' }, { status: 400, headers: CORS });
  }

  try {
    const result = await intakeInboundLead({
      channel,
      name: body.name,
      email: body.email,
      phone: body.phone,
      message: body.message,
      source: body.source,
      externalId: body.externalId,
      // Optional qualification from the bot / ad form (ManyChat, Meta Lead Ads).
      budgetMin: Number(body.budgetMin) || undefined,
      budgetMax: Number(body.budgetMax) || undefined,
      projectInterestId: body.projectInterestId || undefined,
      timeline: body.timeline || undefined,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Intake failed' }, { status: 500, headers: CORS });
  }
}
