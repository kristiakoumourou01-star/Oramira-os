// Oramira OS — Automation Center, Supabase Edge Function (Deno).
//
// An alternative scheduler to Vercel Cron: configure this function on a cron
// schedule in the Supabase dashboard. It keeps a SINGLE source of automation
// logic by delegating to the Next.js cron entrypoint (POST /api/cron) with the
// shared secret, rather than re-implementing the jobs in Deno.
//
// Required Edge Function secrets (supabase secrets set ...):
//   APP_URL      — the deployed app base URL, e.g. https://os.oramira.com
//   CRON_SECRET  — same value as the app's CRON_SECRET
//
// Schedule individual jobs by passing ?job=<key>, or omit to run them all.
//
// NOTE: this file targets the Deno runtime and is excluded from the Next.js
// TypeScript build (see tsconfig "exclude").

// @ts-nocheck
Deno.serve(async (req: Request) => {
  const appUrl = Deno.env.get('APP_URL');
  const secret = Deno.env.get('CRON_SECRET');
  if (!appUrl || !secret) {
    return new Response(JSON.stringify({ error: 'APP_URL and CRON_SECRET must be set' }), { status: 500 });
  }

  const job = new URL(req.url).searchParams.get('job');
  const target = `${appUrl}/api/cron${job ? `?job=${encodeURIComponent(job)}` : ''}`;

  const res = await fetch(target, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });

  const body = await res.text();
  return new Response(body, { status: res.status, headers: { 'content-type': 'application/json' } });
});
