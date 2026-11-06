import type { ParcelScore, UpliftEstimate, SellerReadiness } from '@/lib/land-scoring';
import type { DDSummary } from '@/lib/due-diligence';
import type { OfferInputs } from '@/lib/offer-calculator';

/**
 * Client-safe acquisition constants + the ParcelItem shape. Kept separate from
 * lib/acquisitions.ts (which imports the server Supabase client) so client
 * components can use these without pulling server-only code into the bundle.
 */

export const PARCEL_STAGES = ['new', 'contacted', 'interested', 'under_review', 'negotiation', 'due_diligence', 'offer_made', 'acquired', 'lost'] as const;
export type ParcelStage = typeof PARCEL_STAGES[number];

export const STAGE_LABEL: Record<string, string> = {
  new: 'New landowner', contacted: 'Contacted', interested: 'Interested', under_review: 'Under review',
  negotiation: 'Negotiation', due_diligence: 'Due diligence', offer_made: 'Offer made', acquired: 'Acquired', lost: 'Lost',
};

/** Stage → pin/badge hex, shared by the map and board. */
export const STAGE_COLOR: Record<string, string> = {
  new: '#8A8560', contacted: '#3B82C4', interested: '#6E59C7', under_review: '#C8A96B',
  negotiation: '#A8793B', due_diligence: '#0EA5A0', offer_made: '#C87A2B', acquired: '#1F4D3A', lost: '#9C4A3A',
};

export interface ParcelItem {
  id: string;
  reference: string;
  location: string | null;
  areaRef: string | null;
  plotSizeSqm: number | null;
  stage: string;
  contactId: string | null;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerEmail: string | null;
  buyerType: string | null;
  language: string | null;
  assignedTo: string | null;
  assignedName: string | null;
  nextActionDate: string | null;
  lastContactedAt: string | null;
  notes: string | null;
  locationQuality: number | null; planningUplift: number | null; frontageM: number | null; accessQuality: string | null;
  plotShape: string | null; densityPotential: number | null; zone: string | null;
  sellerUrgency: number | null; reasonForSelling: string | null; flexibility: number | null;
  financialPressure: boolean; inheritance: boolean; familySplit: boolean;
  relocation: boolean; divorce: boolean; debtPressure: boolean; timelineToSell: string | null;
  currentValue: number | null; postPlanningValue: number | null; askingPrice: number | null; offerAmount: number | null;
  latitude: number | null; longitude: number | null;
  dueDiligenceRaw: Record<string, boolean>;
  offerInputs: Partial<OfferInputs> | null;
  createdAt: string;
  score: ParcelScore;
  uplift: UpliftEstimate | null;
  dd: DDSummary;
  readiness: SellerReadiness;
}
