import { createSupabaseServerClient } from '@/lib/supabase/server';
import { scoreParcel, estimateUplift, sellerReadiness } from '@/lib/land-scoring';
import { summarizeDD } from '@/lib/due-diligence';
import type { OfferInputs } from '@/lib/offer-calculator';
import type { ParcelItem } from '@/lib/acquisitions-shared';

/**
 * Enriched acquisition parcels (server) — resolves a parcel + landowner + owner
 * + computed land score / uplift / due-diligence / readiness. Client-safe
 * constants and the ParcelItem shape live in lib/acquisitions-shared.ts.
 */

export { PARCEL_STAGES, STAGE_LABEL, STAGE_COLOR, type ParcelStage, type ParcelItem } from '@/lib/acquisitions-shared';

function toItem(p: any): ParcelItem {
  const score = scoreParcel({
    locationQuality: p.location_quality, planningUplift: p.planning_uplift, frontageM: p.frontage_m,
    accessQuality: p.access_quality, plotShape: p.plot_shape, densityPotential: p.density_potential,
    sellerUrgency: p.seller_urgency, flexibility: p.flexibility, financialPressure: p.financial_pressure,
    inheritance: p.inheritance, familySplit: p.family_split,
  });
  const uplift = estimateUplift({ currentValue: p.current_value, postPlanningValue: p.post_planning_value, planningUplift: p.planning_uplift });
  const dd = summarizeDD(p.due_diligence);
  const readiness = sellerReadiness({
    sellerUrgency: p.seller_urgency, flexibility: p.flexibility, financialPressure: p.financial_pressure, inheritance: p.inheritance,
    familySplit: p.family_split, relocation: p.relocation, divorce: p.divorce, debtPressure: p.debt_pressure, timelineToSell: p.timeline_to_sell,
  });
  return {
    id: p.id, reference: p.reference, location: p.location, areaRef: p.area_ref, plotSizeSqm: p.plot_size_sqm, stage: p.stage,
    contactId: p.contact_id, ownerName: p.contacts?.full_name ?? null, ownerPhone: p.contacts?.phone ?? null, ownerEmail: p.contacts?.email ?? null,
    buyerType: p.contacts?.buyer_type ?? null, language: p.contacts?.preferred_language ?? null,
    assignedTo: p.assigned_to, assignedName: p.owner?.full_name ?? null, nextActionDate: p.next_action_date, lastContactedAt: p.last_contacted_at, notes: p.notes,
    locationQuality: p.location_quality, planningUplift: p.planning_uplift, frontageM: p.frontage_m, accessQuality: p.access_quality,
    plotShape: p.plot_shape, densityPotential: p.density_potential, zone: p.zone,
    sellerUrgency: p.seller_urgency, reasonForSelling: p.reason_for_selling, flexibility: p.flexibility,
    financialPressure: p.financial_pressure, inheritance: p.inheritance, familySplit: p.family_split,
    relocation: p.relocation, divorce: p.divorce, debtPressure: p.debt_pressure, timelineToSell: p.timeline_to_sell,
    currentValue: p.current_value, postPlanningValue: p.post_planning_value, askingPrice: p.asking_price, offerAmount: p.offer_amount,
    latitude: p.latitude, longitude: p.longitude,
    dueDiligenceRaw: (p.due_diligence ?? {}) as Record<string, boolean>,
    offerInputs: (p.offer_inputs ?? null) as Partial<OfferInputs> | null,
    createdAt: p.created_at, score, uplift, dd, readiness,
  };
}

const SELECT = `id, reference, location, area_ref, plot_size_sqm, stage, contact_id, assigned_to, next_action_date, last_contacted_at, notes,
  location_quality, planning_uplift, frontage_m, access_quality, plot_shape, density_potential, zone, building_density,
  seller_urgency, reason_for_selling, flexibility, financial_pressure, inheritance, family_split,
  relocation, divorce, debt_pressure, timeline_to_sell, latitude, longitude, due_diligence, offer_inputs,
  current_value, post_planning_value, asking_price, offer_amount, created_at,
  contacts(full_name, phone, email, buyer_type, preferred_language), owner:assigned_to(full_name)`;

export async function getParcels(): Promise<ParcelItem[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('land_parcels').select(SELECT).order('created_at', { ascending: false });
  return (data ?? []).map(toItem).sort((a, b) => b.score.score - a.score.score);
}

export async function getParcel(id: string): Promise<ParcelItem | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from('land_parcels').select(SELECT).eq('id', id).maybeSingle();
  return data ? toItem(data) : null;
}
