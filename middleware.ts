import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import { createServerClient } from '@supabase/ssr';

/**
 * Route protection matrix. This is a SECOND layer of defense, not the
 * primary one — Supabase RLS (Phase 3) is what actually guarantees no row
 * leaks. This layer exists so the wrong role never even sees the wrong
 * shell/navigation, and gets redirected to where they belong instead of a
 * confusing empty page.
 */
const STAFF_ROLES = new Set(['admin', 'sales', 'management', 'finance', 'construction', 'viewer']);

const PORTAL_PREFIX_TO_ROLE: Record<string, string> = {
  '/buyer': 'buyer',
  '/homeowner': 'homeowner',
  '/investor': 'investor',
  '/contractor': 'contractor',
};

const PUBLIC_PATHS = ['/login', '/invite', '/reset-password', '/book', '/auth/signout', '/selection/'];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const path = request.nextUrl.pathname;

  if (
    PUBLIC_PATHS.some((p) => path.startsWith(p)) ||
    path.startsWith('/api/public') ||
    path.startsWith('/api/cron') // self-guarded by CRON_SECRET, no session
  ) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', path);
    return NextResponse.redirect(loginUrl);
  }

  // Look up role directly (lightweight query, cached per-request by Supabase client)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  );
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role as string | undefined;
  if (!role) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const isInternalPath =
    path.startsWith('/dashboard') ||
    path.startsWith('/crm') ||
    path.startsWith('/deal-analyzer') ||
    path.startsWith('/projects') ||
    path.startsWith('/map') ||
    path.startsWith('/property') ||
    path.startsWith('/financials') ||
    path.startsWith('/hr') ||
    path.startsWith('/automation') ||
    path.startsWith('/homeowner-requests') ||
    path.startsWith('/settings');

  if (isInternalPath && !STAFF_ROLES.has(role)) {
    return NextResponse.redirect(new URL(`/${role}`, request.url));
  }

  for (const [prefix, requiredRole] of Object.entries(PORTAL_PREFIX_TO_ROLE)) {
    if (path.startsWith(prefix) && role !== requiredRole && !STAFF_ROLES.has(role)) {
      return NextResponse.redirect(new URL(`/${role}`, request.url));
    }
  }

  if (path.startsWith('/settings/users') || path.startsWith('/settings/roles')) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Activity clock for "sign out after N hours idle" (Settings → Ασφάλεια).
  // Pages compare against the PREVIOUS value; this response stores the new one.
  // Background prefetches don't count as activity.
  if (!request.headers.get('next-router-prefetch') && request.headers.get('purpose') !== 'prefetch') {
    response.cookies.set('oramira_seen', String(Date.now()), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next.js internals.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)',
  ],
};
