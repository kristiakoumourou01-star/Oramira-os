import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database.types';

/**
 * Client-side Supabase instance. Used inside Client Components only
 * (e.g. realtime subscriptions, interactive forms before a Server Action
 * takes over). All sensitive reads/writes still go through RLS — this
 * client never carries elevated privileges.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
