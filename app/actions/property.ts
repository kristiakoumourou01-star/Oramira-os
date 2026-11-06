'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { notifyTicketHomeowner } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';

/**
 * Property Management — admin layer over the post-sale owner lifecycle. Extends
 * the existing units/homeowners/maintenance model (not a separate module).
 */

/** Record an uploaded plan/render in the project media library (powers the
 *  interactive development map). The file is uploaded client-side to the
 *  'project-media' bucket; here we record the row. */
export async function addProjectMedia(params: {
  projectId: string;
  kind: string; // masterplan | architectural | floor_plan | render | block_layout
  storagePath: string;
  title?: string;
  buildingId?: string | null;
  floor?: number | null;
}) {
  const profile = await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('project_media').insert({
    project_id: params.projectId,
    kind: params.kind,
    storage_path: params.storagePath,
    bucket: 'project-media',
    title: params.title ?? null,
    building_id: params.buildingId ?? null,
    floor: params.floor ?? null,
    created_by: profile.id,
  });
  revalidatePath(`/projects/${params.projectId}/map`);
  revalidatePath(`/projects/${params.projectId}`);
}

export async function deleteProjectMedia(id: string, projectId: string) {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('project_media').delete().eq('id', id);
  revalidatePath(`/projects/${projectId}/map`);
}

/** Edit a unit/house's detailed specifications (areas, plot, garden, pool, parking, handover). */
export async function updateUnitSpecs(params: {
  unitId: string;
  projectId: string;
  internalSqm?: number | null;
  coveredVerandaSqm?: number | null;
  uncoveredVerandaSqm?: number | null;
  storageSqm?: number | null;
  parkingSpaces?: number | null;
  plotSizeSqm?: number | null;
  gardenSqm?: number | null;
  hasPool?: boolean;
  handoverDate?: string | null;
}) {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('units')
    .update({
      internal_sqm: params.internalSqm ?? null,
      covered_veranda_sqm: params.coveredVerandaSqm ?? null,
      uncovered_veranda_sqm: params.uncoveredVerandaSqm ?? null,
      storage_sqm: params.storageSqm ?? null,
      parking_spaces: params.parkingSpaces ?? null,
      plot_size_sqm: params.plotSizeSqm ?? null,
      garden_sqm: params.gardenSqm ?? null,
      has_pool: params.hasPool ?? false,
      handover_date: params.handoverDate ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.unitId);
  revalidatePath(`/projects/${params.projectId}/units/${params.unitId}`);
  revalidatePath(`/projects/${params.projectId}/map`);
}

/** Update a house's lifecycle state: construction %, utilities, handover checklist. */
export async function updateHouseLifecycle(params: {
  unitId: string;
  projectId: string;
  constructionProgress?: number;
  utilityWater?: string;
  utilityElectricity?: string;
  utilityInternet?: string;
  handoverChecklist?: { label: string; done: boolean }[];
}) {
  await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (params.constructionProgress != null) patch.construction_progress = Math.max(0, Math.min(100, Math.round(params.constructionProgress)));
  if (params.utilityWater) patch.utility_water = params.utilityWater;
  if (params.utilityElectricity) patch.utility_electricity = params.utilityElectricity;
  if (params.utilityInternet) patch.utility_internet = params.utilityInternet;
  if (params.handoverChecklist) patch.handover_checklist = params.handoverChecklist;
  await supabase.from('units').update(patch).eq('id', params.unitId);
  revalidatePath(`/projects/${params.projectId}/units/${params.unitId}`);
}

/** Position a house on the project site plan (percentages of the plan image). */
export async function updateHousePosition(params: { unitId: string; projectId: string; mapX: number; mapY: number }) {
  await requirePermission('projects', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('units')
    .update({ map_x: Math.max(0, Math.min(100, params.mapX)), map_y: Math.max(0, Math.min(100, params.mapY)), updated_at: new Date().toISOString() })
    .eq('id', params.unitId);
  revalidatePath(`/projects/${params.projectId}/map`);
}

/** Assign (or transfer) a unit's owner. Records ownership history and layers the
 *  contact up to homeowner — contact-keyed RLS then gives them portal access. */
export async function assignUnitOwner(params: {
  unitId: string;
  contactId: string;
  occupancyStatus?: string;
  note?: string;
}) {
  const profile = await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase.from('homeowners').select('id, contact_id').eq('unit_id', params.unitId).maybeSingle();
  const previous = existing?.contact_id ?? null;

  if (existing) {
    await supabase.from('homeowners').update({ contact_id: params.contactId, moved_in_at: new Date().toISOString() }).eq('id', existing.id);
  } else {
    await supabase.from('homeowners').insert({ contact_id: params.contactId, unit_id: params.unitId, moved_in_at: new Date().toISOString() });
  }

  await supabase
    .from('units')
    .update({ buyer_contact_id: params.contactId, occupancy_status: params.occupancyStatus ?? 'owner_occupied', updated_at: new Date().toISOString() })
    .eq('id', params.unitId);
  await supabase.from('contacts').update({ is_homeowner: true }).eq('id', params.contactId);

  // Layer a buyer profile up to homeowner (never demote staff).
  const { data: prof } = await supabase.from('profiles').select('id, role').eq('contact_id', params.contactId).maybeSingle();
  if (prof && prof.role === 'buyer') {
    await supabase.from('profiles').update({ role: 'homeowner' }).eq('id', prof.id);
  }

  await supabase.from('unit_ownership_history').insert({
    unit_id: params.unitId, previous_contact_id: previous, new_contact_id: params.contactId, note: params.note ?? null, created_by: profile.id,
  });
  await logActivity({ entityType: 'unit', entityId: params.unitId, action: previous ? 'owner_transferred' : 'owner_assigned', metadata: { contactId: params.contactId } });
  revalidatePath('/property');
  return { ok: true };
}

/** Remove a unit's owner — unit becomes vacant; recorded in history. */
export async function removeUnitOwner(unitId: string, note?: string) {
  const profile = await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase.from('homeowners').select('id, contact_id').eq('unit_id', unitId).maybeSingle();
  if (existing) await supabase.from('homeowners').delete().eq('id', existing.id);
  await supabase.from('units').update({ buyer_contact_id: null, occupancy_status: 'vacant', updated_at: new Date().toISOString() }).eq('id', unitId);
  await supabase.from('unit_ownership_history').insert({ unit_id: unitId, previous_contact_id: existing?.contact_id ?? null, new_contact_id: null, note: note ?? 'Owner removed', created_by: profile.id });
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'owner_removed' });
  revalidatePath('/property');
}

export async function setOccupancy(unitId: string, status: string) {
  await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('units').update({ occupancy_status: status, updated_at: new Date().toISOString() }).eq('id', unitId);
  revalidatePath('/property');
}

export async function updateProjectInfo(params: {
  projectId: string;
  deliveryDate?: string | null;
  commonAreas?: string;
  maintenanceSchedule?: string;
  managementContact?: string;
  emergencyContact?: string;
}) {
  await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('projects')
    .update({
      delivery_date: params.deliveryDate ?? null,
      common_areas: params.commonAreas ?? null,
      maintenance_schedule: params.maintenanceSchedule ?? null,
      management_contact: params.managementContact ?? null,
      emergency_contact: params.emergencyContact ?? null,
    })
    .eq('id', params.projectId);
  await logActivity({ entityType: 'project', entityId: params.projectId, action: 'owner_info_updated' });
  revalidatePath('/property');
  revalidatePath(`/projects/${params.projectId}`);
}

/** Assign a contractor to a maintenance ticket and notify the homeowner. */
export async function assignTicketContractor(ticketId: string, contractorId: string) {
  const profile = await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('maintenance_tickets').update({ contractor_id: contractorId, status: 'acknowledged' }).eq('id', ticketId);
  await supabase.from('ticket_updates').insert({ ticket_id: ticketId, author_id: profile.id, note: 'Contractor assigned', status_change: 'acknowledged' });
  await notifyTicketHomeowner(ticketId, { title: 'A contractor was assigned', body: 'Your maintenance request has been assigned to a contractor.', link: `/homeowner/maintenance/${ticketId}` });
  revalidatePath('/property/maintenance');
  return { ok: true };
}

/** Staff updates a ticket's status. */
export async function setTicketStatus(
  ticketId: string,
  status: 'open' | 'acknowledged' | 'in_progress' | 'awaiting_parts' | 'resolved' | 'closed' | 'reopened',
  note?: string,
) {
  const profile = await requirePermission('property', 'edit');
  const supabase = await createSupabaseServerClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'resolved' || status === 'closed') patch.resolved_at = new Date().toISOString();
  await supabase.from('maintenance_tickets').update(patch).eq('id', ticketId);
  await supabase.from('ticket_updates').insert({ ticket_id: ticketId, author_id: profile.id, note: note ?? `Status: ${status}`, status_change: status });
  await notifyTicketHomeowner(ticketId, { title: `Maintenance update: ${status.replace('_', ' ')}`, link: `/homeowner/maintenance/${ticketId}` });
  revalidatePath('/property/maintenance');
}
