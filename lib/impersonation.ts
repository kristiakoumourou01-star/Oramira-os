import { cookies } from 'next/headers';

/**
 * Admin impersonation ("View as user").
 *
 * The target user's id is held in an httpOnly cookie. getCurrentProfile()
 * (lib/auth) reads it and — ONLY when the real signed-in user is an admin —
 * resolves the EFFECTIVE profile to the target, so every page guard, nav item,
 * and data query (portals filter by profile.contactId / contractorId, not raw
 * auth.uid()) renders as that user. The underlying Supabase session stays the
 * admin's, so activity_log keeps attributing actions to the real admin — the
 * audit trail never lies about who actually clicked.
 *
 * Starting/stopping sets or clears the cookie and must happen in a Server
 * Action or Route Handler (cookies are read-only during RSC render).
 */
export const IMPERSONATION_COOKIE = 'oramira_impersonate';

/** Read the impersonation target user id from the cookie, if any. */
export async function readImpersonationTarget(): Promise<string | null> {
  try {
    const store = await cookies();
    return store.get(IMPERSONATION_COOKIE)?.value || null;
  } catch {
    return null;
  }
}

/** Set the impersonation cookie (call from a Server Action). */
export async function setImpersonationCookie(targetUserId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, targetUserId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 4, // 4h — a review session, not a standing grant
  });
}

/** Clear the impersonation cookie (call from a Server Action). */
export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
