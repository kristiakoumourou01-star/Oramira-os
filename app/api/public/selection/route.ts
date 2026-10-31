import { NextResponse, type NextRequest } from 'next/server';
import { registerInterest } from '@/lib/selection';

/** «Θέλω προβολή» from a shared selection page (no sign-in; the token is the key). */
export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const ok = await registerInterest(String(body?.token ?? ''), String(body?.unitId ?? ''));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Not found' }, { status: 404 });
}
