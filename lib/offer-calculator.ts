/**
 * Acquisition offer calculator — residual land valuation. Works back from GDV
 * and all development costs (incl. the developer's required profit) to the
 * maximum land price that still clears the target return. Pure + deterministic.
 */

export interface OfferInputs {
  currentLandValue: number;
  gdv: number;                 // expected gross development value
  constructionCost: number;
  financeCost: number;
  professionalFees: number;
  marketingCost: number;
  contingency: number;
  developerProfitPct: number;  // % of GDV
}

export interface OfferResult {
  totalCosts: number;          // all non-land costs
  requiredProfit: number;      // developerProfitPct% of GDV
  residualLandValue: number;   // max the land can be worth
  maxOffer: number;            // = residual (rounded down a touch for negotiation room)
  offerMargin: number;         // residual − current land value (headroom vs asking)
  profit: number;              // profit at the current land value
  roi: number;                 // profit / total invested, %
  verdict: 'excellent' | 'acceptable' | 'too_expensive';
}

export const DEFAULT_OFFER_INPUTS: OfferInputs = {
  currentLandValue: 0, gdv: 0, constructionCost: 0, financeCost: 0,
  professionalFees: 0, marketingCost: 0, contingency: 0, developerProfitPct: 20,
};

export function computeOffer(i: OfferInputs): OfferResult {
  const nonLand = i.constructionCost + i.financeCost + i.professionalFees + i.marketingCost + i.contingency;
  const requiredProfit = i.gdv * (i.developerProfitPct / 100);
  const residualLandValue = Math.max(0, i.gdv - nonLand - requiredProfit);
  const maxOffer = Math.floor(residualLandValue / 1000) * 1000; // round down to €1k

  // Economics at the *current* land value the seller is anchored to.
  const totalInvested = i.currentLandValue + nonLand;
  const profit = i.gdv - totalInvested;
  const roi = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;

  // Verdict: how the current land value compares to the residual (what we can pay).
  const ratio = residualLandValue > 0 ? i.currentLandValue / residualLandValue : (i.currentLandValue > 0 ? 2 : 0);
  const verdict: OfferResult['verdict'] = ratio <= 0.85 ? 'excellent' : ratio <= 1.0 ? 'acceptable' : 'too_expensive';

  return { totalCosts: nonLand, requiredProfit, residualLandValue, maxOffer, offerMargin: residualLandValue - i.currentLandValue, profit, roi, verdict };
}
