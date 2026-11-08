'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';

/**
 * Projects & Units module — unit (inventory) Server Actions. A unit is the
 * atom the whole downstream chain hangs off: reservation → contract →
 * payments → handover → warranty → maintenance. Staff-only; RLS enforces it.
 */

const STAFF: ['admin', 'sales', 'management'] = ['admin', 'sales', 'management'];

export async function createUnit(params: {
  projectId: string;
  unitNumber: string;
  buildingId?: string;
  phaseId?: string;
  floor?: number;
  type?: string;
  sqm?: number;
  price?: number;
  bedrooms?: number;
  bathrooms?: number;
  description?: string;
  internalSpecs?: Record<string, unknown>;
}) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('units')
    .insert({
      project_id: params.projectId,
      building_id: params.buildingId ?? null,
      phase_id: params.phaseId ?? null,
      unit_number: params.unitNumber,
      floor: params.floor ?? null,
      type: params.type ?? null,
      sqm: params.sqm ?? null,
      price: params.price ?? null,
      bedrooms: params.bedrooms ?? null,
      bathrooms: params.bathrooms ?? null,
      description: params.description ?? null,
      internal_specs: (params.internalSpecs ?? {}) as any,
    })
    .select()
    .single();

  if (error) throw error;
  await logActivity({ entityType: 'unit', entityId: data.id, action: 'created', metadata: { unit_number: params.unitNumber } });
  revalidatePath(`/projects/${params.projectId}`);
  return data;
}

export async function updateUnit(
  unitId: string,
  projectId: string,
  patch: {
    unitNumber?: string;
    buildingId?: string | null;
    phaseId?: string | null;
    floor?: number | null;
    type?: string | null;
    sqm?: number | null;
    price?: number | null;
    bedrooms?: number | null;
    bathrooms?: number | null;
    description?: string | null;
    internalSpecs?: Record<string, unknown>;
  }
) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const update: Record<string, unknown> = {};
  if (patch.unitNumber !== undefined) update.unit_number = patch.unitNumber;
  if (patch.buildingId !== undefined) update.building_id = patch.buildingId;
  if (patch.phaseId !== undefined) update.phase_id = patch.phaseId;
  if (patch.floor !== undefined) update.floor = patch.floor;
  if (patch.type !== undefined) update.type = patch.type;
  if (patch.sqm !== undefined) update.sqm = patch.sqm;
  if (patch.price !== undefined) update.price = patch.price;
  if (patch.bedrooms !== undefined) update.bedrooms = patch.bedrooms;
  if (patch.bathrooms !== undefined) update.bathrooms = patch.bathrooms;
  if (patch.description !== undefined) update.description = patch.description;
  if (patch.internalSpecs !== undefined) update.internal_specs = patch.internalSpecs;
  update.updated_at = new Date().toISOString();

  await supabase.from('units').update(update).eq('id', unitId);
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'updated' });
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateUnitStatus(
  unitId: string,
  projectId: string,
  status: 'available' | 'reserved' | 'sold' | 'handed_over' | 'blocked'
) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await supabase.from('units').update({ status, updated_at: new Date().toISOString() }).eq('id', unitId);
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'status_changed', metadata: { to: status } });
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  revalidatePath(`/projects/${projectId}`);
}

export async function updateHandover(params: {
  unitId: string;
  projectId: string;
  handoverStatus: string;
  handoverDate?: string | null;
  warrantyStartDate?: string | null;
  warrantyPeriodMonths?: number;
}) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const update: Record<string, unknown> = {
    handover_status: params.handoverStatus,
    updated_at: new Date().toISOString(),
  };
  if (params.handoverDate !== undefined) update.handover_date = params.handoverDate;
  if (params.warrantyStartDate !== undefined) update.warranty_start_date = params.warrantyStartDate;
  if (params.warrantyPeriodMonths !== undefined) update.warranty_period_months = params.warrantyPeriodMonths;

  // Handover complete implies the unit has left inventory for good.
  if (params.handoverStatus === 'completed') update.status = 'handed_over';

  await supabase.from('units').update(update).eq('id', params.unitId);
  await logActivity({ entityType: 'unit', entityId: params.unitId, action: 'handover_updated', metadata: { status: params.handoverStatus } });
  revalidatePath(`/projects/${params.projectId}/units/${params.unitId}`);
}

/** «UNIT A» → «UNIT B», «A12» → «A13», «Villa 3» → «Villa 4», αλλιώς «… (2)». */
function nextNumber(n: string, taken: Set<string>): string {
  let cur = n;
  for (let i = 0; i < 500; i++) {
    const num = cur.match(/^(.*?)(\d+)$/);
    const let1 = cur.match(/^(.*?)([A-Za-z])$/);
    if (num) cur = `${num[1]}${String(Number(num[2]) + 1).padStart(num[2].length, '0')}`;
    else if (let1 && let1[2].toLowerCase() !== 'z') cur = `${let1[1]}${String.fromCharCode(let1[2].charCodeAt(0) + 1)}`;
    else cur = `${n} (${i + 2})`;
    if (!taken.has(cur.toLowerCase())) return cur;
  }
  return `${n} (${Date.now() % 10000})`;
}

/**
 * Αντιγραφή μονάδας: ίδια χαρακτηριστικά, τιμή, προδιαγραφές, χώροι και πεδία —
 * νέα μονάδα «Διαθέσιμη», χωρίς αγοραστή, παράδοση, θέση στον χάρτη ή έγγραφα.
 * `count` αντίγραφα με διαδοχικούς αριθμούς ξεκινώντας από `firstNumber`.
 */
export async function duplicateUnit(unitId: string, firstNumber: string, count = 1): Promise<{ ok: true; ids: string[]; numbers: string[] } | { ok: false; error: string }> {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { data: u, error } = await (supabase as any).from('units').select('*').eq('id', unitId).single();
  if (error || !u) return { ok: false, error: 'Η μονάδα δεν βρέθηκε.' };
  const { data: existing } = await supabase.from('units').select('unit_number').eq('project_id', u.project_id);
  const taken = new Set((existing ?? []).map((x: any) => String(x.unit_number).toLowerCase()));
  const n = Math.min(50, Math.max(1, Math.round(count || 1)));
  const numbers: string[] = [];
  let name = (firstNumber || '').trim().slice(0, 40) || nextNumber(u.unit_number, taken);
  for (let i = 0; i < n; i++) {
    if (taken.has(name.toLowerCase())) name = nextNumber(name, taken);
    numbers.push(name); taken.add(name.toLowerCase());
    name = nextNumber(name, taken);
  }
  const KEEP = ['project_id', 'building_id', 'phase_id', 'floor', 'type', 'sqm', 'price', 'bedrooms', 'bathrooms', 'internal_specs', 'description', 'rooms', 'responsible_agent_id', 'commission_pct', 'custom_fields', 'internal_sqm', 'covered_veranda_sqm', 'uncovered_veranda_sqm', 'storage_sqm', 'parking_spaces', 'plot_size_sqm', 'garden_sqm', 'has_pool', 'construction_progress', 'payment_plan', 'warranty_period_months'];
  const base: Record<string, unknown> = {};
  for (const k of KEEP) if (k in u) base[k] = u[k];
  const rows = numbers.map((unit_number) => ({ ...base, unit_number, status: 'available' }));
  const { data: ins, error: e2 } = await (supabase as any).from('units').insert(rows).select('id');
  if (e2) return { ok: false, error: e2.message };
  await logActivity({ entityType: 'unit', entityId: unitId, action: 'unit_duplicated', metadata: { copies: numbers } });
  revalidatePath(`/projects/${u.project_id}`);
  return { ok: true, ids: (ins ?? []).map((x: any) => x.id), numbers };
}
