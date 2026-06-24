import { NextResponse, type NextRequest } from 'next/server';
import { intakeNewsletter } from '@/lib/intake';

/** Public newsletter signup — syncs into the same `contacts` identity table. */
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
    const result = await intakeNewsletter({
      email: String(body.email),
      name: body.name,
      source: body.source,
      tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    });
    return NextResponse.json({ ok: true, ...result }, { headers: CORS });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Intake failed' }, { status: 500, headers: CORS });
  }
}
