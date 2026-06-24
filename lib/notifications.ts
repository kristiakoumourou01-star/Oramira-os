import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Writes an in-app notification for a specific user. Uses the service-role
 * client because the `notifications_self` RLS policy (migration 0007) only
 * lets a user write their OWN notifications (user_id = auth.uid()) — so a
 * staff member, contractor, or trigger notifying *someone else* would be
 * refused under the normal session client. This is only ever called from
 * trusted server code (Server Actions, webhooks), never exposed to a browser.
 * Pair with queueNotificationEmail() when the same event should also email.
 */
export async function notifyUser(params: {
  userId: string;
  title: string;
  body?: string;
  link?: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  await supabase.from('notifications').insert({
    user_id: params.userId,
    channel: 'in_app',
    title: params.title,
    body: params.body ?? null,
    link: params.link ?? null,
  });
}

/**
 * Notifies the homeowner attached to a maintenance ticket. Resolves the
 * homeowner's profile via the service-role client (the caller — often a
 * contractor — has no RLS visibility into profiles/homeowners), then writes
 * the notification. Caller is responsible for having already authorized the
 * action; this is a trusted server-only helper.
 */
export async function notifyTicketHomeowner(
  ticketId: string,
  payload: { title: string; body?: string; link?: string }
) {
  const supabase = createSupabaseServiceRoleClient();
  const { data: ticket } = await supabase
    .from('maintenance_tickets')
    .select('homeowner_id, homeowners(contact_id)')
    .eq('id', ticketId)
    .maybeSingle();
  const contactId = (ticket as any)?.homeowners?.contact_id;
  if (!contactId) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (profile) {
    await notifyUser({ userId: profile.id, ...payload });
  }
}

/**
 * Logs an outbound email event and (in production) hands it to the email
 * provider. Uses the service-role client because notification_events is
 * staff-only under RLS, but this function itself is only ever called from
 * trusted server code (Server Actions, webhook handlers), never exposed
 * directly to a client.
 */
export async function queueNotificationEmail(params: {
  triggerType: string;
  entityType?: string;
  entityId?: string;
  recipientEmail: string;
  subject: string;
  body: string;
}) {
  const supabase = createSupabaseServiceRoleClient();
  await supabase.from('notification_events').insert({
    trigger_type: params.triggerType,
    entity_type: params.entityType ?? null,
    entity_id: params.entityId ?? null,
    channel: 'email',
    recipient: params.recipientEmail,
    payload: { subject: params.subject, body: params.body },
  });

  // Actual send — Resend. Kept as a thin call so swapping providers later
  // only touches this one function.
  if (process.env.RESEND_API_KEY) {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS ?? 'Oramira <notifications@oramira.com>',
      to: params.recipientEmail,
      subject: params.subject,
      html: params.body,
    });
  }
}
