import { createSupabaseServerClient } from '@/lib/supabase/server';
import { loadUnitDetail, getBuyerUnit, type BuyerUnit } from '@/lib/buyer';

/**
 * Resolves the signed-in homeowner's unit. A homeowner is linked through the
 * `homeowners` table (created at handover), but — because roles layer rather
 * than replace — their unit is usually the very same one they bought, still
 * carrying their `buyer_contact_id`. So we look up the homeowners row first,
 * then fall back to the buyer linkage. Either way we return the shared
 * BuyerUnit shape, so every Buyer Portal component renders unchanged here.
 */
export interface HomeownerUnit extends BuyerUnit {
  homeowner_id: string | null;
  moved_in_at: string | null;
}

export async function getHomeownerUnit(contactId: string | null): Promise<HomeownerUnit | null> {
  if (!contactId) return null;
  const supabase = await createSupabaseServerClient();

  const { data: homeowner } = await supabase
    .from('homeowners')
    .select('id, unit_id, moved_in_at')
    .eq('contact_id', contactId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const base = homeowner ? await loadUnitDetail(homeowner.unit_id) : await getBuyerUnit(contactId);
  if (!base) return null;

  return {
    ...base,
    homeowner_id: homeowner?.id ?? null,
    moved_in_at: homeowner?.moved_in_at ?? null,
  };
}
