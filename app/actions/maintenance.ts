'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { onMaintenanceOpened } from '@/lib/automation-events';
import { revalidatePath } from 'next/cache';

/**
 * Homeowner Portal — maintenance Server Actions. The homeowner is the one
 * external role that genuinely writes operational data (raising tickets,
 * filing warranty claims). RLS (tickets_homeowner_all, ticket_photos_homeowner_all,
 * migration 0007) is the real boundary; we derive homeowner_id + project_id
 * server-side from the unit so the client can't forge ownership.
 */

async function resolveOwnedUnit(unitId: string, contactId: string | null) {
  if (!contactId) throw new Error('No linked contact');
  const supabase = await createSupabaseServerClient();

  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('id')
    .eq('unit_id', unitId)
    .eq('contact_id', contactId)
    .maybeSingle();
  if (!homeowner) throw new Error('You do not own this unit.');

  const { data: unit } = await supabase.from('units').select('project_id').eq('id', unitId).single();
  if (!unit) throw new Error('Unit not found');

  return { homeownerId: homeowner.id, projectId: unit.project_id };
}

export async function createTicket(params: {
  unitId: string;
  title: string;
  description?: string;
  category?: string;
  priority?: 'low' | 'medium' | 'high' | 'emergency';
  photoPaths?: string[];
  warrantyId?: string;
}) {
  const profile = await requireRole(['homeowner']);
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const { homeownerId, projectId } = await resolveOwnedUnit(params.unitId, profile.contactId);

  const { data: ticket, error } = await supabase
    .from('maintenance_tickets')
    .insert({
      homeowner_id: homeownerId,
      unit_id: params.unitId,
      project_id: projectId,
      title: params.title,
      description: params.description ?? null,
      category: params.category ?? null,
      priority: params.priority ?? 'medium',
      warranty_id: params.warrantyId ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  // Photos were uploaded to the defect-reports bucket client-side (storage
  // RLS allows the homeowner); here we just record the rows against the ticket.
  if (params.photoPaths && params.photoPaths.length > 0) {
    await supabase.from('ticket_photos').insert(
      params.photoPaths.map((path) => ({ ticket_id: ticket.id, storage_path: path, uploaded_by: auth.user?.id ?? null }))
    );
  }

  await logActivity({
    entityType: 'ticket',
    entityId: ticket.id,
    action: params.warrantyId ? 'warranty_claim_filed' : 'ticket_created',
    metadata: { category: params.category, priority: params.priority },
  });
  await onMaintenanceOpened(ticket.id);

  revalidatePath('/homeowner/maintenance');
  revalidatePath('/homeowner/warranty');
  return ticket;
}

/** File a warranty claim — a maintenance ticket bound to a specific warranty. */
export async function fileWarrantyClaim(params: { warrantyId: string; unitId: string; description: string }) {
  await requireRole(['homeowner']);
  const supabase = await createSupabaseServerClient();
  const { data: warranty } = await supabase
    .from('warranties')
    .select('category')
    .eq('id', params.warrantyId)
    .single();

  return createTicket({
    unitId: params.unitId,
    title: `Warranty claim — ${warranty?.category ?? 'covered item'}`,
    description: params.description,
    category: 'warranty',
    priority: 'medium',
    warrantyId: params.warrantyId,
  });
}

/** Homeowner reopens or closes their own ticket (status they're allowed to set). */
export async function setTicketStatusByOwner(
  ticketId: string,
  status: 'closed' | 'reopened'
) {
  await requireRole(['homeowner']);
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('maintenance_tickets')
    .update({ status, ...(status === 'closed' ? { resolved_at: new Date().toISOString() } : {}) })
    .eq('id', ticketId);
  await logActivity({ entityType: 'ticket', entityId: ticketId, action: status === 'closed' ? 'closed_by_owner' : 'reopened_by_owner' });
  revalidatePath(`/homeowner/maintenance/${ticketId}`);
  revalidatePath('/homeowner/maintenance');
}
