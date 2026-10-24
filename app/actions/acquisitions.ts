'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { summarizeDD } from '@/lib/due-diligence';

/**
 * Acquisition Engine actions — landowner/parcel CRUD, stage moves, contact
 * logging and assignment. Gated by the `acquisitions` module permission.
 */

type ParcelPatch = Record<string, unknown>;

/** Create a parcel + resolve/create the landowner contact. */
export async function createParcel(params: {
  reference: string;
  ownerName?: string;
  ownerEmail?: string;
  ownerPhone?: string;
  location?: string;
  areaRef?: string;
  plotSizeSqm?: number;
  zone?: string;
  reasonForSelling?: string;
  assignedTo?: string;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const profile = await requirePermission('acquisitions', 'edit');
  if (!params.reference?.trim()) return { ok: false, error: 'A parcel reference is required.' };
  const supabase = await createSupabaseServerClient();

  let contactId: string | null = null;
  if (params.ownerName || params.ownerEmail || params.ownerPhone) {
    // Landowners often have no email — synthesize a stable placeholder so the
    // contact record (email NOT NULL) is created and the timeline still works.
    const email = params.ownerEmail?.trim() || `land-${Date.now()}-${Math.floor(Math.random() * 1e4)}@parcel.oramira.local`;
    const { data: cid, error: cErr } = await supabase.rpc('find_or_create_contact', { p_email: email, p_name: params.ownerName ?? null, p_phone: params.ownerPhone ?? null });
    if (cErr) { console.error('[createParcel] contact', cErr); return { ok: false, error: cErr.message }; }
    contactId = cid as string;
  }

  const { data, error } = await supabase.from('land_parcels').insert({
    reference: params.reference.trim(),
    contact_id: contactId,
    location: params.location ?? null,
    area_ref: params.areaRef ?? null,
    plot_size_sqm: params.plotSizeSqm ?? null,
    zone: params.zone ?? null,
    reason_for_selling: params.reasonForSelling ?? null,
    assigned_to: params.assignedTo ?? null,
    created_by: profile.id,
    stage: 'new',
  }).select('id').single();

  if (error || !data) { console.error('[createParcel] insert', error); return { ok: false, error: error?.message ?? 'Insert failed' }; }
  revalidatePath('/acquisitions');
  return { ok: true, id: data.id };
}

/** Move a parcel through the sourcing pipeline. Acquired is gated on mandatory
 *  due-diligence checks being complete. */
export async function updateParcelStage(id: string, stage: string): Promise<{ ok: boolean; error?: string }> {
  await requirePermission('acquisitions', 'edit');
  const supabase = await createSupabaseServerClient();

  if (stage === 'acquired') {
    const { data: p } = await supabase.from('land_parcels').select('due_diligence').eq('id', id).maybeSingle();
    const dd = summarizeDD((p?.due_diligence ?? {}) as Record<string, boolean>);
    if (!dd.mandatoryComplete) return { ok: false, error: `Complete mandatory due diligence first (${dd.mandatoryDone}/${dd.mandatoryTotal} done).` };
  }

  await supabase.from('land_parcels').update({ stage }).eq('id', id);
  await logActivity({ entityType: 'land_parcel', entityId: id, action: 'stage_changed', metadata: { stage } });
  revalidatePath('/acquisitions');
  return { ok: true };
}

/** Toggle a due-diligence checklist item. */
export async function setDueDiligence(id: string, key: string, done: boolean) {
  await requirePermission('acquisitions', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: p } = await supabase.from('land_parcels').select('due_diligence').eq('id', id).maybeSingle();
  const dd = { ...((p?.due_diligence ?? {}) as Record<string, boolean>), [key]: done };
  await supabase.from('land_parcels').update({ due_diligence: dd }).eq('id', id);
  await logActivity({ entityType: 'land_parcel', entityId: id, action: 'due_diligence_updated', metadata: { key, done } });
  revalidatePath(`/acquisitions/${id}`);
  return { ok: true };
}

/** Persist the offer-calculator inputs on the parcel. */
export async function saveOfferInputs(id: string, inputs: Record<string, number>) {
  await requirePermission('acquisitions', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('land_parcels').update({ offer_inputs: inputs as any }).eq('id', id);
  revalidatePath(`/acquisitions/${id}`);
  return { ok: true };
}

/** Add a document to the parcel's vault (registry entry). */
export async function addParcelDocument(params: { parcelId: string; category: string; name: string; url?: string; note?: string }) {
  const profile = await requirePermission('acquisitions', 'edit');
  if (!params.name?.trim()) return { ok: false, error: 'A document name is required.' };
  const supabase = await createSupabaseServerClient();
  await supabase.from('parcel_documents').insert({ parcel_id: params.parcelId, category: params.category, name: params.name.trim(), url: params.url?.trim() || null, note: params.note?.trim() || null, uploaded_by: profile.id });
  await logActivity({ entityType: 'land_parcel', entityId: params.parcelId, action: 'document_added', metadata: { category: params.category, name: params.name } });
  revalidatePath(`/acquisitions/${params.parcelId}`);
  return { ok: true };
}

export async function deleteParcelDocument(docId: string, parcelId: string) {
  await requirePermission('acquisitions', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('parcel_documents').delete().eq('id', docId);
  revalidatePath(`/acquisitions/${parcelId}`);
  return { ok: true };
}

/** Patch land attributes / seller profile / valuation from the detail form. */
export async function updateParcel(id: string, patch: ParcelPatch) {
  await requirePermission('acquisitions', 'edit');
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('land_parcels').update(patch as any).eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/acquisitions');
  revalidatePath(`/acquisitions/${id}`);
  return { ok: true };
}

/** Log an outreach touch against the landowner + stamp last_contacted_at. */
export async function logParcelContact(params: { parcelId: string; contactId: string | null; channel: 'phone' | 'whatsapp' | 'email' | 'meeting'; direction: 'inbound' | 'outbound'; summary: string }) {
  const profile = await requirePermission('acquisitions', 'edit');
  const supabase = await createSupabaseServerClient();
  if (params.contactId) {
    await supabase.from('contact_communications').insert({ contact_id: params.contactId, channel: params.channel, direction: params.direction, summary: params.summary, logged_by: profile.id });
  }
  await supabase.from('land_parcels').update({ last_contacted_at: new Date().toISOString() }).eq('id', params.parcelId);
  await logActivity({ entityType: 'land_parcel', entityId: params.parcelId, action: 'contact_logged', metadata: { channel: params.channel } });
  revalidatePath(`/acquisitions/${params.parcelId}`);
  return { ok: true };
}

/** Assign a parcel to an acquisitions agent. */
export async function assignParcel(id: string, assignedTo: string | null) {
  await requirePermission('acquisitions', 'assign');
  const supabase = await createSupabaseServerClient();
  await supabase.from('land_parcels').update({ assigned_to: assignedTo }).eq('id', id);
  revalidatePath('/acquisitions');
}
