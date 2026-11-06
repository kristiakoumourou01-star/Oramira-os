'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { homeRouteForRole, type UserRole } from '@/lib/auth';
import { setImpersonationCookie, clearImpersonationCookie } from '@/lib/impersonation';
import { logActivity } from '@/lib/activity';

/**
 * Resolve the REAL signed-in profile, bypassing any impersonation override —
 * starting/stopping must be authorized against who actually holds the session,
 * not the identity currently being viewed.
 */
async function realProfile(): Promise<{ id: string; role: UserRole; fullName: string | null } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from('profiles').select('id, role, full_name').eq('id', auth.user.id).single();
  if (!data) return null;
  return { id: data.id, role: data.role as UserRole, fullName: data.full_name };
}

export type ImpersonationResult = { ok: false; error: string };

/**
 * Begin viewing the OS as another user. Admin-only; cannot target yourself.
 * On success sets the cookie, records it in activity_log (attributed to the
 * real admin), and redirects into the target's home surface.
 */
export async function startImpersonation(targetUserId: string): Promise<ImpersonationResult> {
  const me = await realProfile();
  if (!me || me.role !== 'admin') return { ok: false, error: 'Μόνο admin μπορεί να κάνει impersonation.' };
  if (!targetUserId || targetUserId === me.id) return { ok: false, error: 'Μη έγκυρος χρήστης.' };

  const supabase = await createSupabaseServerClient();
  const { data: target } = await supabase.from('profiles').select('id, role, full_name').eq('id', targetUserId).single();
  if (!target) return { ok: false, error: 'Ο χρήστης δεν βρέθηκε.' };

  await setImpersonationCookie(target.id);
  await logActivity({
    entityType: 'impersonation',
    entityId: target.id,
    action: 'impersonation_started',
    metadata: { targetName: target.full_name, targetRole: target.role },
  });

  redirect(homeRouteForRole(target.role as UserRole));
}

/**
 * Stop impersonating and return to the admin's own workspace. Safe for anyone
 * to call (it only clears their own cookie).
 */
export async function stopImpersonation(): Promise<void> {
  const me = await realProfile();
  await clearImpersonationCookie();
  if (me) {
    await logActivity({ entityType: 'impersonation', entityId: me.id, action: 'impersonation_stopped' });
  }
  redirect(me ? homeRouteForRole(me.role) : '/login');
}
