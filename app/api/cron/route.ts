import { NextResponse, type NextRequest } from 'next/server';
import { runAllJobs, runJob, JOB_KEYS } from '@/lib/automations';

/**
 * Automation Center cron entrypoint. Called by Vercel Cron (vercel.json) or a
 * Supabase scheduled Edge Function (supabase/functions/automations). Self-guards
 * with CRON_SECRET — sent as `Authorization: Bearer <secret>` (Vercel Cron) or
 * `?key=<secret>`. Pass `?job=<key>` to run a single automation, otherwise all
 * scheduled jobs run. Every run is logged to automation_runs.
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset in local dev — allow
  const auth = request.headers.get('authorization');
  if (auth === `Bearer ${secret}`) return true;
  return new URL(request.url).searchParams.get('key') === secret;
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const job = new URL(request.url).searchParams.get('job');
  try {
    if (job) {
      if (!JOB_KEYS.includes(job)) return NextResponse.json({ error: `Unknown job: ${job}` }, { status: 400 });
      const result = await runJob(job, 'cron');
      return NextResponse.json({ ok: true, job, result });
    }
    const results = await runAllJobs('cron');
    return NextResponse.json({ ok: true, results });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Cron failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}
export async function POST(request: NextRequest) {
  return handle(request);
}
