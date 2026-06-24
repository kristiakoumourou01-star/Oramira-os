import { NextResponse, type NextRequest } from 'next/server';
import { intakeContactForm } from '@/lib/intake';

/**
 * Public website contact-form intake. No session (the public site calls this),
 * so it runs through the service-role intake chokepoint. Middleware lets
 * /api/public/* through unauthenticated. Optionally lock down with
 * INTAKE_SECRET (sent as x-intake-key) once the site is wired up.
 */
const CORS = {
  'Access-Control-Allow-Origin': process.env.WEBSITE_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, x-intake-key',
};

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
  if (!body?.email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400, headers: CORS });
  }

  try {
    const result = await intakeContactForm({
      name: body.name,
      email: String(body.email),
      phone: body.phone,
      message: body.message,
      source: body.source,
      projectInterestId: body.projectInterestId,
      budget: body.budget,
      budgetMin: body.budgetMin != null ? Number(body.budgetMin) : undefined,
      budgetMax: body.budgetMax != null ? Number(body.budgetMax) : undefined,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Intake failed' }, { status: 500, headers: CORS });
  }
}
