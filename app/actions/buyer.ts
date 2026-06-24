'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

/**
 * Buyer Portal — client-facing Server Actions. Deliberately thin: the buyer
 * only ever writes one thing (a message to the Oramira team). Everything else
 * in the portal is read-only and gated by buyer-scoped RLS (migrations 0007 +
 * 0011). RLS is the real boundary here — `requireRole` keeps a wrong-role
 * session from even reaching the action.
 */
export async function sendBuyerMessage(unitId: string, body: string) {
  // Homeowners keep buyer-era access (roles layer, they don't replace), so
  // both can post on their unit thread.
  await requireRole(['buyer', 'homeowner']);
  const trimmed = body.trim();
  if (!trimmed) return;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  // entity_type 'unit' + the messages_buyer_rw policy (with_check) enforce
  // that the sender actually owns this unit — no server-side ownership
  // re-check needed beyond letting RLS reject a forged unitId.
  const { error } = await supabase.from('messages').insert({
    entity_type: 'unit',
    entity_id: unitId,
    sender_id: auth.user.id,
    body: trimmed,
  });
  if (error) throw error;

  revalidatePath('/buyer/messages');
}
