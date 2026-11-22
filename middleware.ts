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

const PUBLIC_PATHS = ['/login', '/invite', '/reset-password', '/book', '/auth/signout', '/selection/', '/manifest.webmanifest'];

/** Times the guard; slow runs (sign-in check + role lookup) show up in the logs as «[perf] middleware …». */
export async function middleware(request: NextRequest) {
  const t0 = Date.now();
  const res = await guard(request);
  const ms = Date.now() - t0;
  if (ms > 250) console.log(`[perf] middleware ${request.nextUrl.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id')} ${ms}ms`);
  return res;
}

/** Ο χρήστης από το cookie της συνεδρίας (χωρίς δίκτυο) — μόνο για να ξεκινήσει νωρίτερα η αναζήτηση ρόλου· επιβεβαιώνεται πάντα από το getUser. */
function userIdFromCookie(request: NextRequest): string | null {
  try {
    const parts = request.cookies.getAll().filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    if (!parts.length) return null;
    let raw = parts.map((c) => c.value).join('');
    if (raw.startsWith('base64-')) raw = atob(raw.slice(7).replace(/-/g, '+').replace(/_/g, '/'));
    const token = JSON.parse(raw)?.access_token as string | undefined;
    const payload = token?.split('.')[1];
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof json.sub === 'string' ? json.sub : null;
  } catch { return null; }
}

function roleClient(request: NextRequest) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } },
  );
}

async function guard(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p)) || path.startsWith('/api/public') || path.startsWith('/api/cron');
  // Ο έλεγχος σύνδεσης και η αναζήτηση ρόλου τρέχουν ταυτόχρονα (πιο γρήγορη αλλαγή σελίδας).
  const guessId = isPublic ? null : userIdFromCookie(request);
  const earlyRole = guessId
    ? roleClient(request).from('profiles').select('role').eq('id', guessId).maybeSingle().then((r) => r.data?.role as string | undefined, () => undefined)
    : Promise.resolve(undefined);
  const [{ response, user }, early] = await Promise.all([updateSession(request), earlyRole]);

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

  // Ο ρόλος: από την ταυτόχρονη αναζήτηση αν αφορά τον ίδιο χρήστη, αλλιώς (π.χ. μετά από ανανέωση συνεδρίας) ξανά.
  let role = guessId === user.id ? early : undefined;
  if (!role) {
    const { data: profile } = await roleClient(request).from('profiles').select('role').eq('id', user.id).maybeSingle();
    role = profile?.role as string | undefined;
  }
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
    path.startsWith('/tasks') ||
    path.startsWith('/benefits') ||
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
