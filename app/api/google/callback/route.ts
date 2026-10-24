import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { exchangeCode } from '@/lib/google-calendar';

/** Google OAuth callback — exchanges the code and stores the user's tokens. */
export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const params = request.nextUrl.searchParams;
  const code = params.get('code');
  const state = params.get('state'); // profile id

  if (!code || !state) return NextResponse.redirect(`${base}/dashboard?calendar=error`);

  const tokens = await exchangeCode(code);
  if (!tokens) return NextResponse.redirect(`${base}/dashboard?calendar=error`);

  const svc = createSupabaseServiceRoleClient();
  await svc.from('calendar_connections').upsert(
    {
      profile_id: state,
      provider: 'google',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
      token_expiry: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'profile_id,provider' },
  );

  return NextResponse.redirect(`${base}/dashboard?calendar=connected`);
}
