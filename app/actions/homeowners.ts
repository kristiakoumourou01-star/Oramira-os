'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { notifyUser } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';

/**
 * Staff action: convert a buyer into a homeowner at handover. This is the
 * seam between the Projects/Units module and the Homeowner Portal. Roles
 * LAYER — flipping the profile role to 'homeowner' does NOT revoke buyer
 * access, because every buyer read policy is keyed on buyer_contact_id =
 * current_contact_id(), not on role. So the new homeowner keeps their
 * contract, payments, construction, and document history intact while gaining
 * the after-sales surfaces.
 */
export async function activateHomeowner(unitId: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: unit, error } = await supabase
    .from('units')
    .select('id, buyer_contact_id, handover_status')
    .eq('id', unitId)
    .single();
  if (error || !unit) throw new Error('Unit not found');
  if (!unit.buyer_contact_id) throw new Error('This unit has no buyer to convert to a homeowner.');

  const contactId = unit.buyer_contact_id;

  // Idempotent: don't create a second homeowners row for the same unit/contact.
  const { data: existing } = await supabase
    .from('homeowners')
    .select('id')
    .eq('unit_id', unitId)
    .eq('contact_id', contactId)
    .maybeSingle();

  if (!existing) {
    await supabase.from('homeowners').insert({ contact_id: contactId, unit_id: unitId, moved_in_at: new Date().toISOString() });
  }

  await supabase.from('contacts').update({ is_homeowner: true }).eq('id', contactId);

  // If the buyer already has a portal profile, layer them up to homeowner so
  // they land on the Homeowner Portal next sign-in (buyer access is retained).
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('contact_id', contactId)
    .maybeSingle();
  if (profile) {
    await supabase.from('profiles').update({ role: 'homeowner' }).eq('id', profile.id);
    await notifyUser({
      userId: profile.id,
      title: 'Welcome to your home',
      body: 'Your Homeowner Portal is now active — maintenance, warranties, and your full history are all in one place.',
      link: '/homeowner',
    });
  }

  await logActivity({ entityType: 'unit', entityId: unitId, action: 'homeowner_activated' });
  await logActivity({ entityType: 'contact', entityId: contactId, action: 'became_homeowner' });

  revalidatePath(`/projects`);
  revalidatePath(`/crm/${contactId}`);
}
