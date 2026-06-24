'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { queueNotificationEmail } from '@/lib/notifications';
import { randomBytes } from 'crypto';

/**
 * Generic invite creator used by every "Activate Portal" flow (buyer,
 * investor, homeowner, contractor). Staff-only — there is no public sign-up.
 */
export async function createInvite(params: {
  email: string;
  role: 'buyer' | 'investor' | 'homeowner' | 'contractor';
  contactId?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: invite, error } = await supabase
    .from('invites')
    .insert({
      email: params.email,
      role: params.role,
      contact_id: params.contactId ?? null,
      related_entity_type: params.relatedEntityType ?? null,
      related_entity_id: params.relatedEntityId ?? null,
      token,
      expires_at: expiresAt,
      invited_by: auth.user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw error;

  await logActivity({
    entityType: params.relatedEntityType ?? 'invite',
    entityId: params.relatedEntityId ?? invite.id,
    action: 'invite_sent',
    metadata: { role: params.role },
  });

  await queueNotificationEmail({
    triggerType: 'invite_sent',
    recipientEmail: params.email,
    subject: 'Your Oramira access is ready',
    body: `<p>Set up your account: <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}">Activate access</a></p>`,
  });

  return invite;
}

/**
 * Buyer Portal activation — the semi-automatic flow from Phase 4. Only
 * callable once buyers.portal_eligible is true (contract signed + deposit
 * confirmed); the button calling this in the UI is disabled until then,
 * and this is the defense-in-depth check on the server side.
 */
export async function activateBuyerPortal(buyerId: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: buyer, error } = await supabase
    .from('buyers')
    .select('id, portal_eligible, contact_id, contacts(email)')
    .eq('id', buyerId)
    .single();

  if (error || !buyer) throw new Error('Buyer not found');
  if (!buyer.portal_eligible) {
    throw new Error('This buyer is not yet eligible for portal access — contract must be signed and deposit confirmed.');
  }

  const email = (buyer as any).contacts?.email;
  await createInvite({
    email,
    role: 'buyer',
    contactId: buyer.contact_id,
    relatedEntityType: 'buyer',
    relatedEntityId: buyer.id,
  });

  await supabase
    .from('buyers')
    .update({ portal_activated: true, portal_activated_at: new Date().toISOString() })
    .eq('id', buyerId);

  await logActivity({ entityType: 'buyer', entityId: buyerId, action: 'portal_activated' });
}
