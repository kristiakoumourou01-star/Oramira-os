import { NextResponse } from 'next/server';

/** Δέχεται τις μετρήσεις του PerfReporter και τις γράφει στα logs. */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const kind = b?.kind === 'load' ? 'load' : 'nav';
    const path = String(b?.path ?? '').replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id').slice(0, 120);
    const ms = Math.max(0, Math.min(600000, Number(b?.ms) || 0));
    const ttfb = b?.ttfb != null ? Math.max(0, Math.min(600000, Number(b.ttfb) || 0)) : null;
    console.log(`[perf] ${kind} ${path} ${ms}ms${ttfb !== null ? ` ttfb=${ttfb}ms` : ''}`);
  } catch { /* ignore */ }
  return new NextResponse(null, { status: 204 });
}
