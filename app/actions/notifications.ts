'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Mark notifications read. The notifications_self RLS policy (migration 0007)
 * already scopes every row to the signed-in user, so these updates can only
 * ever touch the caller's own notifications — no extra ownership check needed.
 */
export async function markNotificationRead(notificationId: string) {
  await requireProfile();
  const supabase = await createSupabaseServerClient();
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', notificationId);
  revalidatePath('/homeowner/notifications');
}

export async function markAllNotificationsRead() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', profile.id)
    .is('read_at', null);
  revalidatePath('/homeowner/notifications');
}
