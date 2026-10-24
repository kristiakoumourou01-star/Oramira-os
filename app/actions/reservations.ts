'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { onReservationCreated } from '@/lib/automation-events';
import { revalidatePath } from 'next/cache';

/**
 * Projects & Units module — reservation lifecycle. This is the seam between
 * the CRM (a contact) and the inventory (a unit): reserve → hold window →
 * deposit → convert to contract. Confirming the deposit and signing the
 * contract together flip buyers.portal_eligible via the triggers in
 * migration 0006, which is what later unlocks Buyer Portal activation — so
 * this module is what prepares the Buyer Portal without ever activating it
 * directly (staff still press the button on the CRM record).
 */

const STAFF: ['admin', 'sales', 'management'] = ['admin', 'sales', 'management'];
const DEFAULT_HOLD_DAYS = 14;

/** Reserve a unit for an existing CRM contact and place it on hold. */
export async function createReservation(params: {
  unitId: string;
  buyerContactId: string;
  depositAmount?: number;
  holdDays?: number;
}) {
  const profile = await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('id, project_id, status')
    .eq('id', params.unitId)
    .single();
  if (unitError || !unit) throw new Error('Unit not found');
  if (unit.status !== 'available') {
    throw new Error('This unit is not available — it is already reserved, sold, or handed over.');
  }

  const expiresAt = new Date(
    Date.now() + (params.holdDays ?? DEFAULT_HOLD_DAYS) * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: reservation, error } = await supabase
    .from('reservations')
    .insert({
      unit_id: params.unitId,
      buyer_contact_id: params.buyerContactId,
      deposit_amount: params.depositAmount ?? null,
      status: 'active',
      expires_at: expiresAt,
      created_by: profile.id,
    })
    .select()
    .single();
  if (error) throw error;

  // Hold the unit and stamp the buyer onto it (buyer assignment).
  await supabase
    .from('units')
    .update({ status: 'reserved', buyer_contact_id: params.buyerContactId, updated_at: new Date().toISOString() })
    .eq('id', params.unitId);

  // Promote the contact to a buyer and ensure a buyers row exists so the
  // CRM record and eventual portal activation have something to hang off.
  await supabase.from('contacts').update({ is_buyer: true }).eq('id', params.buyerContactId);
  const { data: existingBuyer } = await supabase
    .from('buyers')
    .select('id')
    .eq('contact_id', params.buyerContactId)
    .maybeSingle();
  if (!existingBuyer) {
    await supabase.from('buyers').insert({ contact_id: params.buyerContactId });
  }

  await logActivity({ entityType: 'unit', entityId: params.unitId, action: 'reserved', metadata: { reservationId: reservation.id } });
  await logActivity({ entityType: 'contact', entityId: params.buyerContactId, action: 'unit_reserved', metadata: { unitId: params.unitId } });
  await onReservationCreated(params.buyerContactId, params.unitId);

  revalidatePath(`/projects/${unit.project_id}/units/${params.unitId}`);
  revalidatePath(`/crm/${params.buyerContactId}`);
  return reservation;
}

/** Confirm the deposit — this is one half of the portal-eligibility trigger. */
export async function confirmDeposit(reservationId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, unit_id, buyer_contact_id, units(project_id)')
    .eq('id', reservationId)
    .single();

  await supabase.from('reservations').update({ deposit_paid: true }).eq('id', reservationId);
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'deposit_confirmed' });

  const projectId = (reservation as any)?.units?.project_id;
  if (projectId && reservation) {
    revalidatePath(`/projects/${projectId}/units/${reservation.unit_id}`);
    revalidatePath(`/crm/${reservation.buyer_contact_id}`);
  }
}

/** Extend an active hold's expiry window. */
export async function extendReservation(reservationId: string, days: number) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  await supabase.from('reservations').update({ expires_at: expiresAt }).eq('id', reservationId);
  await logActivity({ entityType: 'reservation', entityId: reservationId, action: 'extended', metadata: { days } });
  revalidatePath('/projects');
}

/** Cancel a hold and return the unit to inventory. */
export async function cancelReservation(reservationId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: reservation } = await supabase
    .from('reservations')
    .select('id, unit_id, buyer_contact_id, units(project_id, status)')
    .eq('id', reservationId)
    .single();
  if (!reservation) throw new Error('Reservation not found');

  await supabase.from('reservations').update({ status: 'cancelled' }).eq('id', reservationId);

  // Only release the unit if it is still merely reserved (not already sold).
  if ((reservation as any).units?.status === 'reserved') {
    await supabase
      .from('units')
      .update({ status: 'available', buyer_contact_id: null, updated_at: new Date().toISOString() })
      .eq('id', reservation.unit_id);
  }

  await logActivity({ entityType: 'unit', entityId: reservation.unit_id, action: 'reservation_cancelled' });
  const projectId = (reservation as any).units?.project_id;
  if (projectId) revalidatePath(`/projects/${projectId}/units/${reservation.unit_id}`);
  revalidatePath(`/crm/${reservation.buyer_contact_id}`);
}

/**
 * Convert a reservation into a contract. Creates a draft contract linked to
 * the same unit + buyer, carries the unit price across as the contract total,
 * and stamps the reservation as converted. The contract stays a draft — the
 * Sales module drives it to 'signed', at which point the migration-0006
 * trigger (with a confirmed deposit) flips portal eligibility.
 */
export async function convertReservationToContract(reservationId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: reservation, error: resError } = await supabase
    .from('reservations')
    .select('id, unit_id, buyer_contact_id, status, converted_contract_id, units(project_id, price)')
    .eq('id', reservationId)
    .single();
  if (resError || !reservation) throw new Error('Reservation not found');
  if (reservation.converted_contract_id) {
    throw new Error('This reservation has already been converted to a contract.');
  }

  const { data: contract, error } = await supabase
    .from('contracts')
    .insert({
      unit_id: reservation.unit_id,
      buyer_contact_id: reservation.buyer_contact_id,
      reservation_id: reservation.id,
      status: 'draft',
      total_price: (reservation as any).units?.price ?? null,
    })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from('reservations')
    .update({ status: 'converted', converted_contract_id: contract.id })
    .eq('id', reservationId);

  await supabase
    .from('units')
    .update({ status: 'sold', updated_at: new Date().toISOString() })
    .eq('id', reservation.unit_id);

  await logActivity({ entityType: 'unit', entityId: reservation.unit_id, action: 'contract_drafted', metadata: { contractId: contract.id } });
  await logActivity({ entityType: 'contract', entityId: contract.id, action: 'created_from_reservation' });

  const projectId = (reservation as any).units?.project_id;
  if (projectId) revalidatePath(`/projects/${projectId}/units/${reservation.unit_id}`);
  revalidatePath(`/crm/${reservation.buyer_contact_id}`);
  return contract;
}
