import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Resolves the signed-in buyer's primary unit and everything that hangs off
 * it — project, building/phase, reservation, contract. Every Buyer Portal
 * page starts here so the unit lookup + RLS pass happens in exactly one place.
 * Reads run as the buyer's own session: unit access is granted by
 * `units_buyer_read` / `owns_unit_as_buyer` (migration 0007), so a buyer who
 * doesn't own a unit simply gets null back, never someone else's row.
 *
 * Built to carry into the Homeowner Portal: a homeowner keeps the same
 * buyer-era read access, so the same resolver serves both.
 */
export interface BuyerUnit {
  id: string;
  project_id: string;
  unit_number: string;
  floor: number | null;
  type: string | null;
  sqm: number | null;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  description: string | null;
  internal_specs: Record<string, unknown>;
  floorplan_document_id: string | null;
  status: string;
  handover_status: string;
  handover_date: string | null;
  warranty_start_date: string | null;
  warranty_period_months: number;
  title_deed_status: string;
  project_name: string | null;
  project_location: string | null;
  building_name: string | null;
  phase_name: string | null;
  contract: { id: string; status: string; total_price: number | null } | null;
  reservation: { id: string; status: string; deposit_paid: boolean; deposit_amount: number | null; expires_at: string | null } | null;
}

export async function getBuyerUnit(contactId: string | null): Promise<BuyerUnit | null> {
  if (!contactId) return null;
  const supabase = await createSupabaseServerClient();

  const { data: row } = await supabase
    .from('units')
    .select('id')
    .eq('buyer_contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;
  return loadUnitDetail(row.id);
}

/**
 * Loads the full BuyerUnit shape for a known unit id. Shared by the Buyer and
 * Homeowner portals so the unit lookup + mapping lives in exactly one place —
 * the Homeowner Portal "extends, doesn't replace" by reusing this verbatim.
 * Runs under the caller's session; RLS returns null if they can't see it.
 */
export async function loadUnitDetail(unitId: string): Promise<BuyerUnit | null> {
  const supabase = await createSupabaseServerClient();

  const { data: unit } = await supabase
    .from('units')
    .select(
      `id, project_id, unit_number, floor, type, sqm, price, bedrooms, bathrooms, description,
       internal_specs, floorplan_document_id, status, handover_status, handover_date,
       warranty_start_date, warranty_period_months, title_deed_status,
       projects(name, location), buildings(name), project_phases(name)`
    )
    .eq('id', unitId)
    .maybeSingle();

  if (!unit) return null;

  const [{ data: contract }, { data: reservation }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, status, total_price')
      .eq('unit_id', unit.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('reservations')
      .select('id, status, deposit_paid, deposit_amount, expires_at')
      .eq('unit_id', unit.id)
      .order('reserved_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    id: unit.id,
    project_id: unit.project_id,
    unit_number: unit.unit_number,
    floor: unit.floor,
    type: unit.type,
    sqm: unit.sqm,
    price: unit.price,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    description: unit.description,
    internal_specs: (unit.internal_specs ?? {}) as Record<string, unknown>,
    floorplan_document_id: unit.floorplan_document_id,
    status: unit.status,
    handover_status: unit.handover_status,
    handover_date: unit.handover_date,
    warranty_start_date: unit.warranty_start_date,
    warranty_period_months: unit.warranty_period_months,
    title_deed_status: unit.title_deed_status,
    project_name: (unit as any).projects?.name ?? null,
    project_location: (unit as any).projects?.location ?? null,
    building_name: (unit as any).buildings?.name ?? null,
    phase_name: (unit as any).project_phases?.name ?? null,
    contract: contract ?? null,
    reservation: reservation ?? null,
  };
}
