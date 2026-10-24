/**
 * Matching engine — the shared infrastructure that pairs a buyer's criteria with
 * a property's facts, both directions. ONE scoring function, used across the OS:
 *   • Sales / lead page → "recommended properties for this lead"
 *   • Property / listing → "matching buyers for this unit"
 *   • Marketing → similar-buyer / audience building
 * Pure and deterministic (no DB, no AI key) so it's unit-testable today and works
 * the moment inventory + leads exist. Budget dominates (as in real deals), then
 * bedrooms, then a preferred-development bonus.
 */

export interface MatchCriteria {
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: number | null;
  preferredProjectId?: string | null;
}

export interface PropertyFacts {
  id: string;
  price?: number | null;
  bedrooms?: number | null;
  sqm?: number | null;
  projectId?: string | null;
  status?: string | null; // only 'available' can match
}

export interface MatchResult {
  score: number;                 // 0–100
  reasons: string[];
  fits: { budget: boolean; beds: boolean; project: boolean };
  tier: 'strong' | 'possible' | 'weak';
}

/** Score how well a property fits a buyer's criteria (0–100). */
export function scorePropertyMatch(c: MatchCriteria, p: PropertyFacts): MatchResult {
  // A sold/reserved unit can never be a match.
  if (p.status && p.status !== 'available') {
    return { score: 0, reasons: ['Not available'], fits: { budget: false, beds: false, project: false }, tier: 'weak' };
  }

  const reasons: string[] = [];
  let score = 0;
  const price = p.price ?? null;

  // ── Budget (max 55) — the dominant factor ──
  let budget = false;
  const hasBudget = !!(c.budgetMin || c.budgetMax);
  if (price != null && hasBudget) {
    const min = c.budgetMin ?? 0;
    const max = c.budgetMax ?? Infinity;
    if (price >= min && price <= max) { score += 55; budget = true; reasons.push('Within budget'); }
    else if (price <= max * 1.1 && price >= min * 0.85) { score += 33; reasons.push('Just outside budget'); }
    else { score += 4; reasons.push(price > max ? 'Above budget' : 'Below budget'); }
  } else {
    score += 28; // unknown budget → neutral
  }

  // ── Bedrooms (max 25) ──
  let beds = false;
  if (c.bedrooms != null && p.bedrooms != null) {
    const d = Math.abs(c.bedrooms - p.bedrooms);
    if (d === 0) { score += 25; beds = true; reasons.push(`${p.bedrooms}-bed match`); }
    else if (d === 1) { score += 14; reasons.push('±1 bedroom'); }
    else reasons.push('Bedroom mismatch');
  } else {
    score += 12; // no bedroom preference → neutral
  }

  // ── Preferred development (max 20) ──
  let project = false;
  if (c.preferredProjectId && p.projectId && c.preferredProjectId === p.projectId) {
    score += 20; project = true; reasons.push('Their preferred development');
  } else if (!c.preferredProjectId) {
    score += 8; // no preference → small neutral
  }

  const total = Math.min(100, Math.round(score));
  const tier = total >= 70 ? 'strong' : total >= 45 ? 'possible' : 'weak';
  return { score: total, reasons, fits: { budget, beds, project }, tier };
}

/** Rank available properties for a lead, best first (drops weak matches). */
export function rankPropertiesForLead<T extends PropertyFacts>(c: MatchCriteria, units: T[], opts: { min?: number; limit?: number } = {}): (T & { match: MatchResult })[] {
  const min = opts.min ?? 45;
  return units
    .map((u) => ({ ...u, match: scorePropertyMatch(c, u) }))
    .filter((u) => u.match.score >= min)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, opts.limit ?? 6);
}

/** Rank leads that fit a given property, best first — the inverse view for the
 *  Property workspace ("who should we call about this listing?"). */
export function rankLeadsForProperty<T extends { criteria: MatchCriteria }>(p: PropertyFacts, leads: T[], opts: { min?: number; limit?: number } = {}): (T & { match: MatchResult })[] {
  const min = opts.min ?? 45;
  return leads
    .map((l) => ({ ...l, match: scorePropertyMatch(l.criteria, p) }))
    .filter((l) => l.match.score >= min)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, opts.limit ?? 6);
}
