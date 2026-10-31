import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { IMPERSONATION_COOKIE } from '@/lib/impersonation';
import { LAST_SEEN_COOKIE } from '@/lib/security-shared';

/**
 * Sign-out used by the security rules (inactivity timeout, IP allow-list):
 * ends the session and returns to the login page with the reason.
 */
export async function GET(request: NextRequest) {
  const r = request.nextUrl.searchParams.get('reason');
  const reason = r === 'ip' ? 'ip' : r === 'manual' ? 'manual' : 'timeout';
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  } catch { /* already signed out */ }
  const res = NextResponse.redirect(new URL(reason === 'manual' ? '/login' : `/login?${reason === 'ip' ? 'ip=1' : 'expired=1'}`, request.url));
  res.cookies.delete(IMPERSONATION_COOKIE);
  res.cookies.delete(LAST_SEEN_COOKIE);
  return res;
}
