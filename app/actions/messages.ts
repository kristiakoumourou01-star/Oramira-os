'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notifyUser } from '@/lib/notifications';

/**
 * Sends a message on a ticket or construction-task thread. RLS (Phase 3,
 * `messages_contractor_rw` / `messages_homeowner_rw` / `messages_staff_all`)
 * is what actually enforces who can post where — this action just performs
 * the insert as the signed-in user and notifies the other party.
 */
export async function sendMessage(
  entityType: 'ticket' | 'construction_task',
  entityId: string,
  body: string
) {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('Not signed in');

  const { error } = await supabase.from('messages').insert({
    entity_type: entityType,
    entity_id: entityId,
    sender_id: auth.user.id,
    body,
  });
  if (error) throw error;

  // Notify the counterpart (contractor <-> staff, or homeowner <-> staff).
  // Resolving "who else is on this thread" is entity-specific — kept simple
  // here; the full module build-out will fan this out properly per thread.
  if (entityType === 'ticket') {
    const { data: ticket } = await supabase
      .from('maintenance_tickets')
      .select('contractor_id, homeowner_id')
      .eq('id', entityId)
      .single();

    // Resolve the contractor's *profile* before notifying. notifications.user_id
    // is a NOT NULL uuid FK to profiles(id), but maintenance_tickets.contractor_id
    // points at contractors(id) — a different namespace. Passing the contractor id
    // (or an empty-string fallback) straight in would violate the FK and fail the
    // whole send. Only notify when: a contractor is assigned, it maps to a profile,
    // and that profile is not the person who just posted.
    if (ticket?.contractor_id) {
      const { data: contractorProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('contractor_id', ticket.contractor_id)
        .maybeSingle();

      if (contractorProfile && contractorProfile.id !== auth.user.id) {
        await notifyUser({
          userId: contractorProfile.id,
          title: 'New message on your ticket',
          link: `/contractor/tickets/${entityId}`,
          event: 'message_received',
        });
      }
    }
  }
}
