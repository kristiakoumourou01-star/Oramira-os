import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { mergeNotifications, type NotificationSettings } from '@/lib/org-settings-shared';

type Svc = ReturnType<typeof createSupabaseServiceRoleClient>;

/* ─── Channel choices (Settings → Ειδοποιήσεις) ───────────────────────────────
   Read with the service client (notifications are also sent from webhooks and
   cron, where there is no signed-in user) and cached briefly per server. */
let prefsCache: { at: number; value: NotificationSettings } | null = null;
async function notificationPrefs(svc: Svc): Promise<NotificationSettings> {
  if (prefsCache && Date.now() - prefsCache.at < 60_000) return prefsCache.value;
  let value = mergeNotifications(null);
  try {
    const { data } = await svc.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    value = mergeNotifications((data as any)?.data?.notifications);
  } catch { /* defaults */ }
  prefsCache = { at: Date.now(), value };
  return value;
}

/**
 * Deliver one notification for an event, on the channels the admin chose:
 * in-app (the bell) and/or email to the user's login address. Without an
 * event key it behaves as before (in-app only). Push/SMS are stored choices
 * that take effect once a provider is connected (Settings → Integrations).
 * Returns whether an in-app notification was written.
 */
export async function deliverNotification(
  svc: Svc,
  p: { userId: string; title: string; body?: string | null; link?: string | null; event?: string },
): Promise<boolean> {
  const prefs = p.event ? await notificationPrefs(svc) : null;
  const row = prefs?.rows.find((r) => r.key === p.event);
  const inApp = row ? row.inApp : true;
  if (inApp) {
    await svc.from('notifications').insert({ user_id: p.userId, channel: 'in_app', title: p.title, body: p.body ?? null, link: p.link ?? null });
  }
  if (row?.email) {
    try {
      const { data } = await svc.auth.admin.getUserById(p.userId);
      const email = data?.user?.email;
      if (email) {
        const url = p.link && process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}${p.link}` : null;
        await queueNotificationEmail({
          triggerType: p.event ?? 'notification',
          recipientEmail: email,
          subject: p.title,
          body: `<p>${escapeHtml(p.body ?? p.title)}</p>${url ? `<p><a href="${url}">Άνοιγμα στο Oramira</a></p>` : ''}`,
        });
      }
    } catch { /* email is best-effort; the in-app copy is the record */ }
  }
  return inApp;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

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
  /** Event key (lib/notification-events) → the admin's channel choices apply. */
  event?: string;
}) {
  await deliverNotification(createSupabaseServiceRoleClient(), params);
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
}): Promise<boolean> {
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
  if (!process.env.RESEND_API_KEY) return false; // δεν έχει ρυθμιστεί αποστολή email
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { error } = await resend.emails.send({
      from: process.env.RESEND_FROM_ADDRESS ?? 'Oramira <notifications@oramira.com>',
      to: params.recipientEmail,
      subject: params.subject,
      html: params.body,
    });
    if (error) { console.error('[email]', error); return false; }
    return true;
  } catch (e) {
    console.error('[email]', e);
    return false;
  }
}
