/**
 * Listing Health engine — scores a property listing on how well it's set up to
 * sell and flags the ones that need attention (incomplete, stale, no interest,
 * mispriced). Pure/deterministic (no DB, no AI) so it's unit-testable today and
 * reusable everywhere: Property ("which listings need attention"), Operations
 * (stale-inventory signal), Intelligence (portfolio health), CEO Dashboard.
 *
 * Context (comparables median, interest counts) is OPTIONAL — with only the unit
 * it still scores completeness + staleness, and sharpens as data arrives.
 */

const DAY = 86_400_000;

export interface ListingFacts {
  id: string;
  price?: number | null;
  bedrooms?: number | null;
  sqm?: number | null;
  status?: string | null;        // only 'available' listings are scored for selling
  createdAt?: string | null;     // when it was listed
  photosCount?: number;
  viewingsCount?: number;        // scheduled/attended viewings
  matchedLeadsCount?: number;    // leads whose criteria fit this unit
}

export interface ListingContext {
  medianPricePerSqm?: number | null; // across comparable units (same project)
  now?: number;
}

export type HealthSeverity = 'high' | 'medium' | 'low';
export interface HealthIssue { key: string; label: string; severity: HealthSeverity }
export interface ListingHealth {
  score: number;                 // 0–100 (higher = healthier)
  status: 'healthy' | 'watch' | 'attention';
  issues: HealthIssue[];
  topIssue: HealthIssue | null;
  recommendation: string;
}

const SEV_WEIGHT: Record<HealthSeverity, number> = { high: 3, medium: 2, low: 1 };

const RECS: Record<string, string> = {
  no_price: 'Add an asking price — it can’t be marketed or matched without one.',
  no_media: 'Add photos/floorplans — listings without media get far fewer enquiries.',
  incomplete: 'Fill in beds & size so it appears in buyer matches.',
  stale: 'Stale on the market — refresh the listing, re-market, or review the price.',
  no_interest: 'No viewings or matched buyers — widen the audience or adjust the price.',
  overpriced: 'Priced well above comparable units — a price review could unlock demand.',
  underpriced: 'Priced below comparables — you may be leaving margin on the table.',
};

/** Health for one listing. */
export function scoreListingHealth(u: ListingFacts, ctx: ListingContext = {}): ListingHealth {
  const now = ctx.now ?? Date.now();
  const issues: HealthIssue[] = [];

  // Only 'available' listings are "on the market"; others are informational.
  const onMarket = !u.status || u.status === 'available';

  // Only penalise on missing core fields or EXPLICITLY-known-bad values — never
  // on absent optional context (photos/interest), so callers that don't supply
  // those don't get false flags.
  if (u.price == null) issues.push({ key: 'no_price', label: 'No price', severity: 'high' });
  if (u.photosCount === 0) issues.push({ key: 'no_media', label: 'No photos', severity: 'medium' });
  if (u.bedrooms == null || u.sqm == null) issues.push({ key: 'incomplete', label: 'Missing details', severity: 'low' });

  const ageDays = u.createdAt ? Math.floor((now - new Date(u.createdAt).getTime()) / DAY) : null;
  if (onMarket && ageDays != null && ageDays >= 90) issues.push({ key: 'stale', label: `On market ${ageDays}d`, severity: 'high' });

  if (onMarket && ageDays != null && ageDays >= 30 && u.viewingsCount === 0 && u.matchedLeadsCount === 0) {
    issues.push({ key: 'no_interest', label: 'No interest', severity: 'medium' });
  }

  if (u.price != null && u.sqm && ctx.medianPricePerSqm) {
    const ppsqm = u.price / u.sqm;
    if (ppsqm > ctx.medianPricePerSqm * 1.25) issues.push({ key: 'overpriced', label: 'Above comparables', severity: 'medium' });
    else if (ppsqm < ctx.medianPricePerSqm * 0.75) issues.push({ key: 'underpriced', label: 'Below comparables', severity: 'low' });
  }

  // Score: start healthy, subtract weighted penalties. A single HIGH issue (no
  // price, or long-stale) alone drops the listing into "attention" — it can't
  // sell as-is; a MEDIUM issue lands it in "watch".
  const PENALTY: Record<HealthSeverity, number> = { high: 46, medium: 25, low: 10 };
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + PENALTY[i.severity], 0));
  const status: ListingHealth['status'] = score >= 80 ? 'healthy' : score >= 55 ? 'watch' : 'attention';
  const topIssue = [...issues].sort((a, b) => SEV_WEIGHT[b.severity] - SEV_WEIGHT[a.severity])[0] ?? null;

  return { score, status, issues, topIssue, recommendation: topIssue ? RECS[topIssue.key] : 'Healthy — well-configured and getting interest.' };
}

/** Rank listings worst-first — the ones needing attention surface at the top. */
export function rankListingsByHealth<T extends ListingFacts>(units: T[], ctx: ListingContext = {}): (T & { health: ListingHealth })[] {
  return units
    .map((u) => ({ ...u, health: scoreListingHealth(u, ctx) }))
    .sort((a, b) => a.health.score - b.health.score);
}

/** How many listings need attention (score < 55) — for the Operations/CEO signal. */
export function countListingsNeedingAttention(units: ListingFacts[], ctx: ListingContext = {}): number {
  return units.reduce((n, u) => n + (scoreListingHealth(u, ctx).status === 'attention' ? 1 : 0), 0);
}
