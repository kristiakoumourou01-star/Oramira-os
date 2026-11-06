/**
 * Land scoring engine — turns a parcel's attributes into an acquisition score.
 * Pure and deterministic (client + server safe). Weighted across location,
 * planning uplift, density, access, frontage, plot shape, and a composite
 * seller-motivation signal. Also estimates planning uplift / margin potential.
 */

export interface ParcelScoringInput {
  locationQuality: number | null;   // 1–10
  planningUplift: number | null;    // 1–10
  frontageM: number | null;
  accessQuality: string | null;     // none | track | paved | main_road
  plotShape: string | null;         // regular | irregular | narrow | triangular
  densityPotential: number | null;  // 1–10
  sellerUrgency: number | null;     // 1–10
  flexibility: number | null;       // 1–10
  financialPressure: boolean;
  inheritance: boolean;
  familySplit: boolean;
}

export interface ScoreFactor { label: string; value: number; weight: number }
export interface ParcelScore {
  score: number;                    // 0–100
  band: 'Prime' | 'Strong' | 'Moderate' | 'Weak';
  factors: ScoreFactor[];
  sellerMotivation: number;         // 0–100
  drivers: string[];
}

const ACCESS: Record<string, number> = { none: 0.2, track: 0.45, paved: 0.75, main_road: 1 };
const SHAPE: Record<string, number> = { regular: 1, irregular: 0.6, narrow: 0.4, triangular: 0.35 };
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const n10 = (v: number | null) => clamp01((v ?? 0) / 10);

/** 0–1 composite of the seller's willingness/pressure to transact. */
export function sellerMotivation(i: ParcelScoringInput): number {
  const m =
    n10(i.sellerUrgency) * 0.4 +
    n10(i.flexibility) * 0.2 +
    (i.financialPressure ? 0.2 : 0) +
    (i.inheritance ? 0.1 : 0) +
    (i.familySplit ? 0.1 : 0);
  return clamp01(m);
}

const WEIGHTS = { location: 18, planning: 20, density: 14, access: 10, frontage: 8, shape: 8, seller: 22 };

export function scoreParcel(i: ParcelScoringInput): ParcelScore {
  const motivation = sellerMotivation(i);
  const dims: Record<keyof typeof WEIGHTS, number> = {
    location: n10(i.locationQuality),
    planning: n10(i.planningUplift),
    density: n10(i.densityPotential),
    access: ACCESS[i.accessQuality ?? ''] ?? 0.3,
    frontage: clamp01((i.frontageM ?? 0) / 30),
    shape: SHAPE[i.plotShape ?? ''] ?? 0.5,
    seller: motivation,
  };

  const factors: ScoreFactor[] = [
    { label: 'Location', value: Math.round(dims.location * 100), weight: WEIGHTS.location },
    { label: 'Planning uplift', value: Math.round(dims.planning * 100), weight: WEIGHTS.planning },
    { label: 'Density potential', value: Math.round(dims.density * 100), weight: WEIGHTS.density },
    { label: 'Access', value: Math.round(dims.access * 100), weight: WEIGHTS.access },
    { label: 'Frontage', value: Math.round(dims.frontage * 100), weight: WEIGHTS.frontage },
    { label: 'Plot shape', value: Math.round(dims.shape * 100), weight: WEIGHTS.shape },
    { label: 'Seller motivation', value: Math.round(motivation * 100), weight: WEIGHTS.seller },
  ];

  const score = Math.round((Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).reduce((s, k) => s + dims[k] * WEIGHTS[k], 0));
  const band: ParcelScore['band'] = score >= 75 ? 'Prime' : score >= 55 ? 'Strong' : score >= 35 ? 'Moderate' : 'Weak';

  const drivers: string[] = [];
  if (dims.planning >= 0.7) drivers.push('Strong planning uplift potential');
  if (dims.location >= 0.7) drivers.push('Prime location');
  if (motivation >= 0.6) drivers.push('Motivated seller');
  if (i.inheritance) drivers.push('Inherited — often flexible');
  if (i.familySplit) drivers.push('Family split — resolution pressure');
  if (i.financialPressure) drivers.push('Financial pressure');
  if (dims.access <= 0.3) drivers.push('⚠ Poor access');
  if (dims.shape <= 0.4) drivers.push('⚠ Difficult plot shape');

  return { score, band, factors, sellerMotivation: Math.round(motivation * 100), drivers: drivers.slice(0, 5) };
}

// ── Seller readiness ─────────────────────────────────────────────────────────

export interface SellerReadinessInput {
  sellerUrgency: number | null;
  flexibility: number | null;
  financialPressure: boolean;
  inheritance: boolean;
  familySplit: boolean;
  relocation: boolean;
  divorce: boolean;
  debtPressure: boolean;
  timelineToSell: string | null; // asap | 3_months | 6_months | 12_months | flexible
}

export interface SellerReadiness { score: number; label: 'Ready' | 'Warming' | 'Early'; signals: string[] }

const TIMELINE: Record<string, number> = { asap: 1, '3_months': 0.8, '6_months': 0.6, '12_months': 0.4, flexible: 0.3 };

/**
 * Seller Readiness Score (0–100) — how prepared/pressured the seller is to
 * transact, from urgency, flexibility, timeline, and life-event pressures.
 */
export function sellerReadiness(i: SellerReadinessInput): SellerReadiness {
  const signals: string[] = [];
  let s = n10(i.sellerUrgency) * 0.28 + n10(i.flexibility) * 0.12;
  s += (i.timelineToSell ? TIMELINE[i.timelineToSell] ?? 0.3 : 0.2) * 0.2;
  const pressures: [boolean, number, string][] = [
    [i.financialPressure, 0.09, 'Financial pressure'],
    [i.debtPressure, 0.09, 'Debt pressure'],
    [i.inheritance, 0.07, 'Inheritance'],
    [i.familySplit, 0.06, 'Family dispute'],
    [i.divorce, 0.06, 'Divorce'],
    [i.relocation, 0.05, 'Relocation'],
  ];
  for (const [on, w, label] of pressures) if (on) { s += w; signals.push(label); }
  if (i.timelineToSell === 'asap') signals.unshift('Wants to sell ASAP');
  const score = Math.round(clamp01(s) * 100);
  const label: SellerReadiness['label'] = score >= 65 ? 'Ready' : score >= 40 ? 'Warming' : 'Early';
  return { score, label, signals: signals.slice(0, 5) };
}

// ── Planning uplift estimator ────────────────────────────────────────────────

export interface UpliftEstimate {
  current: number;
  post: number;
  marginAbs: number;
  marginPct: number;   // margin over current, %
  multiple: number;    // post / current
  estimated: boolean;  // true when post was modelled (not provided)
}

/**
 * Estimate margin between current and post-planning value. If post-planning
 * value isn't provided, model it from the planning-uplift score (agricultural →
 * residential land in Cyprus can multiply 2–4×, scaled by the uplift rating).
 */
export function estimateUplift(p: { currentValue: number | null; postPlanningValue: number | null; planningUplift: number | null }): UpliftEstimate | null {
  const current = Number(p.currentValue ?? 0);
  if (current <= 0) return null;
  let post = Number(p.postPlanningValue ?? 0);
  let estimated = false;
  if (post <= 0) {
    const uplift = (p.planningUplift ?? 5) / 10;          // 0–1
    post = current * (1 + uplift * 3);                     // up to ~4× at max uplift
    estimated = true;
  }
  const marginAbs = post - current;
  return { current, post, marginAbs, marginPct: current ? (marginAbs / current) * 100 : 0, multiple: current ? post / current : 0, estimated };
}
