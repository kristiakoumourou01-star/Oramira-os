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

import { locationFit } from '@/lib/areas';
import { checkRequirements, type FieldValue, type Requirements, type UnitField } from '@/lib/unit-forms-shared';

export interface MatchCriteria {
  budgetMin?: number | null;
  budgetMax?: number | null;
  bedrooms?: number | null;
  preferredProjectId?: string | null;
  /** Areas the buyer wants (e.g. «Λεμεσός», «Γερμασόγεια») — see lib/areas. */
  areas?: string[] | null;
  /** What they want in the unit's own fields (Settings → Φόρμες μονάδων). */
  requirements?: Requirements | null;
}

export interface PropertyFacts {
  id: string;
  price?: number | null;
  bedrooms?: number | null;
  sqm?: number | null;
  projectId?: string | null;
  status?: string | null; // only 'available' can match
  /** Where the property is: the project's location text and/or coordinates. */
  locationText?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** The unit's own field values (units.custom_fields). */
  features?: Record<string, FieldValue> | null;
}

export interface MatchResult {
  score: number;                 // 0–100
  reasons: string[];
  fits: { budget: boolean; beds: boolean; project: boolean; location: boolean };
  tier: 'strong' | 'possible' | 'weak';
  /** «Τι λείπει»: the buyer's criteria this property does not meet. */
  misses: string[];
  /** How many of the buyer's stated criteria it meets, e.g. 5 of 6. */
  met: number;
  total: number;
}

/** Score how well a property fits a buyer's criteria (0–100). */
export function scorePropertyMatch(c: MatchCriteria, p: PropertyFacts, fields: UnitField[] = []): MatchResult {
  // A sold/reserved unit can never be a match.
  if (p.status && p.status !== 'available') {
    return { score: 0, reasons: ['Δεν είναι διαθέσιμη'], fits: { budget: false, beds: false, project: false, location: false }, tier: 'weak', misses: ['Διαθεσιμότητα'], met: 0, total: 1 };
  }

  const reasons: string[] = [];
  const misses: string[] = [];
  let met = 0;
  let total = 0;
  let score = 0;
  const price = p.price ?? null;

  // ── Budget (max 55) — the dominant factor ──
  let budget = false;
  const hasBudget = !!(c.budgetMin || c.budgetMax);
  if (price != null && hasBudget) {
    const min = c.budgetMin ?? 0;
    const max = c.budgetMax ?? Infinity;
    total++;
    if (price >= min && price <= max) { score += 55; budget = true; met++; reasons.push('Μέσα στον προϋπολογισμό'); }
    else if (price <= max * 1.1 && price >= min * 0.85) { score += 33; reasons.push('Λίγο έξω από τον προϋπολογισμό'); }
    else { score += 4; reasons.push(price > max ? 'Πάνω από τον προϋπολογισμό' : 'Κάτω από τον προϋπολογισμό'); }
    if (!budget) misses.push('Προϋπολογισμός');
  } else {
    score += 28; // unknown budget → neutral
  }

  // ── Bedrooms (max 25) ──
  let beds = false;
  if (c.bedrooms != null && p.bedrooms != null) {
    const d = Math.abs(c.bedrooms - p.bedrooms);
    total++;
    if (d !== 0) misses.push('Υπνοδωμάτια');
    if (d === 0) { score += 25; beds = true; met++; reasons.push(`${p.bedrooms} υπνοδωμάτια, όπως θέλει`); }
    else if (d === 1) { score += 14; reasons.push('±1 υπνοδωμάτιο'); }
    else reasons.push('Άλλος αριθμός υπνοδωματίων');
  } else {
    score += 12; // no bedroom preference → neutral
  }

  // ── Preferred development (max 20) ──
  let project = false;
  if (c.preferredProjectId) total++;
  if (c.preferredProjectId && p.projectId && c.preferredProjectId === p.projectId) {
    score += 20; project = true; met++; reasons.push('Το έργο που προτιμά');
  } else if (!c.preferredProjectId) {
    score += 8; // no preference → small neutral
  } else misses.push('Έργο');

  // ── Location — a buyer who named areas rarely buys elsewhere ──
  let location = false;
  if (c.areas && c.areas.length) {
    const f = locationFit(c.areas, { text: p.locationText, lat: p.lat, lng: p.lng });
    total++;
    if (f.fit !== 'match') misses.push('Περιοχή');
    if (f.fit === 'match') { location = true; met++; score += 6; reasons.unshift(`Στην περιοχή που θέλει (${f.label})`); }
    else if (f.fit === 'near') { score -= 8; reasons.push(`Κοντά σε ${f.label}${f.km != null ? `, ${f.km} km` : ''}`); }
    else if (f.fit === 'other') { score -= 30; reasons.push('Άλλη περιοχή από αυτή που θέλει'); }
    else { score -= 4; reasons.push('Άγνωστη τοποθεσία έργου'); }
  }

  // ── The buyer's wishes in your own fields (sea view, furnished, distance…) ──
  if (c.requirements && fields.length && Object.keys(c.requirements).length) {
    const r = checkRequirements(c.requirements, p.features ?? {}, fields);
    total += Object.keys(c.requirements).length;
    met += r.met.length;
    misses.push(...r.missed);
    if (r.met.length) { score += Math.min(12, r.met.length * 4); reasons.push(`Έχει: ${r.met.join(', ')}`); }
    if (r.missed.length) { score -= Math.min(36, r.missed.length * 12); reasons.push(`Δεν έχει: ${r.missed.join(', ')}`); }
  }

  const total100 = Math.max(0, Math.min(100, Math.round(score)));
  const tier = total100 >= 70 ? 'strong' : total100 >= 45 ? 'possible' : 'weak';
  return { score: total100, reasons, fits: { budget, beds, project, location }, tier, misses, met, total };
}

/** Rank available properties for a lead, best first (drops weak matches). */
export function rankPropertiesForLead<T extends PropertyFacts>(c: MatchCriteria, units: T[], opts: { min?: number; limit?: number; fields?: UnitField[] } = {}): (T & { match: MatchResult })[] {
  const min = opts.min ?? 45;
  return units
    .map((u) => ({ ...u, match: scorePropertyMatch(c, u, opts.fields) }))
    .filter((u) => u.match.score >= min)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, opts.limit ?? 6);
}

/** Rank leads that fit a given property, best first — the inverse view for the
 *  Property workspace ("who should we call about this listing?"). */
export function rankLeadsForProperty<T extends { criteria: MatchCriteria }>(p: PropertyFacts, leads: T[], opts: { min?: number; limit?: number; fields?: UnitField[] } = {}): (T & { match: MatchResult })[] {
  const min = opts.min ?? 45;
  return leads
    .map((l) => ({ ...l, match: scorePropertyMatch(l.criteria, p, opts.fields) }))
    .filter((l) => l.match.score >= min)
    .sort((a, b) => b.match.score - a.match.score)
    .slice(0, opts.limit ?? 6);
}
