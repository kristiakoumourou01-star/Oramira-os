import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database.types';

/**
 * Server-side Supabase client for use inside Server Components, Server
 * Actions, and Route Handlers. Runs as the AUTHENTICATED USER (cookie-based
 * session) — RLS applies in full. This is the client every internal and
 * portal page should use for reads/writes on behalf of the signed-in user.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component render — safe to ignore;
            // middleware refreshes the session cookie on the next request.
          }
        },
      },
    }
  );
}

/**
 * Service-role Supabase client — BYPASSES RLS ENTIRELY.
 *
 * This must only ever be instantiated inside trusted server-only code paths:
 * the public contact-form/newsletter intake routes (app/api/public/*) and
 * Edge Function equivalents that run the find_or_create_contact() chokepoint.
 * Never import this into anything reachable from a Client Component, and
 * never use it to serve data back to a browser without re-checking the
 * caller's role yourself first.
 */
export function createSupabaseServiceRoleClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
