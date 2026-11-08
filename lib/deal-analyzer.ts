import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
/**
 * Oramira Deal Analyzer — pure calculation engine.
 *
 * This file is the analytical core of the acquisitions module: deterministic,
 * side-effect-free, and importable on both server and client (no Supabase, no
 * env). Every figure the UI shows is derived here from the raw land + cost
 * inputs, so the model is fully transparent and reproducible — change an input,
 * see exactly how it flows through to ROI. Currency is EUR; areas are m².
 *
 * Assumptions are explicit and conservative by default (Cyprus development
 * context): prices are quoted VAT-inclusive and discounted to a net developer
 * receipt; construction-derived costs scale off buildable area; soft costs are
 * rates on construction or net revenue.
 */

export interface UnitMixRow {
  type: string;        // e.g. "1-bed", "2-bed", "penthouse"
  count: number;
  avgSqm: number;
  pricePerSqm: number; // VAT-inclusive sale price
}

export interface DealInputs {
  // 1 — Land
  plotSizeSqm: number;
  zone: string;
  buildingDensity: number;   // building coefficient (buildable ÷ plot)
  coverageRatio: number;     // max footprint ÷ plot (0–1)
  floorsAllowed: number;
  heightM: number;
  roadAccess: string;        // qualitative (e.g. "primary road", "shared lane")
  greenAreaPct: number;      // share of plot reserved as green (0–1)
  planningRestrictions: string;

  // 2 — Development
  efficiencyRatio: number;   // sellable ÷ buildable (0–1)
  avgUnitSqm: number;        // used when no explicit unit mix
  unitMix: UnitMixRow[];
  constructionCostPerSqm: number;
  infrastructureCost: number;
  permitCost: number;
  professionalFeesRate: number; // share of construction cost (0–1)

  // 3 — Financial
  landAcquisitionCost: number;
  financeCost: number;
  marketingRate: number;     // share of net revenue (0–1)
  contingencyRate: number;   // share of construction cost (0–1)
  vatRate: number;           // e.g. 0.19
  salePricePerSqm: number;   // blended VAT-inclusive price, used when no unit mix
  durationMonths: number;
  /** true = οι τιμές πώλησης δίνονται ΧΩΡΙΣ ΦΠΑ (π.χ. «€3.500/m² + ΦΠΑ»). */
  pricesExVat?: boolean;
}

export interface CashflowPeriod {
  label: string;
  outflow: number;
  inflow: number;
  net: number;
  cumulative: number;
}

export interface RiskBreakdown {
  market: number;       // 0–100 (higher = riskier)
  permit: number;
  construction: number;
  liquidity: number;
  overall: number;
  band: 'Low' | 'Moderate' | 'Elevated' | 'High';
}

export interface SensitivityRow {
  variable: string;
  downsideNetProfit: number; // -10%
  baseNetProfit: number;
  upsideNetProfit: number;   // +10%
  downsideRoi: number;
  upsideRoi: number;
}

export interface DealOutputs {
  buildableSqm: number;
  greenAreaSqm: number;
  sellableSqm: number;
  /** m² που πουλιούνται (unit mix: Σ μονάδες × m²· αλλιώς το sellable). */
  soldSqm: number;
  /** m² που κατασκευάζονται (με unit mix: πωλούμενα ÷ efficiency, μέχρι το buildable). */
  constructedSqm: number;
  /** Οι τιμές δόθηκαν χωρίς ΦΠΑ. */
  exVat: boolean;
  estimatedUnits: number;
  effectivePricePerSqm: number;
  // costs
  constructionCost: number;
  contingency: number;
  professionalFees: number;
  infrastructureCost: number;
  permitCost: number;
  financeCost: number;
  marketingCost: number;
  landAcquisitionCost: number;
  totalDevelopmentCost: number;
  costPerBuildableSqm: number;
  // revenue & profit
  grossRevenueInclVat: number;
  netRevenue: number;
  grossProfit: number;
  netProfit: number;
  roi: number;
  profitMargin: number;
  revenuePerUnit: number;
  breakEvenPricePerSqm: number;
  breakEvenSellableSqm: number;
  // projections & risk
  cashflow: CashflowPeriod[];
  risk: RiskBreakdown;
  sensitivity: SensitivityRow[];
}

export const DEFAULT_DEAL_INPUTS: DealInputs = {
  plotSizeSqm: 2000,
  zone: 'Ka5',
  buildingDensity: 1.6,
  coverageRatio: 0.5,
  floorsAllowed: 5,
  heightM: 17,
  roadAccess: 'Primary road',
  greenAreaPct: 0.1,
  planningRestrictions: '',
  efficiencyRatio: 0.82,
  avgUnitSqm: 90,
  unitMix: [],
  constructionCostPerSqm: 1450,
  infrastructureCost: 120000,
  permitCost: 60000,
  professionalFeesRate: 0.08,
  landAcquisitionCost: 1400000,
  financeCost: 180000,
  marketingRate: 0.02,
  contingencyRate: 0.07,
  vatRate: 0.19,
  salePricePerSqm: 3200,
  durationMonths: 30,
};

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const safeDiv = (a: number, b: number) => (b > 0 ? a / b : 0);

/** Core financial computation, factored out so sensitivity can re-run it. */
function computeCore(inp: DealInputs) {
  const buildableSqm = inp.plotSizeSqm * inp.buildingDensity;
  const sellableSqm = buildableSqm * inp.efficiencyRatio;

  const hasMix = inp.unitMix.length > 0;
  const grossRevenueInclVat = hasMix
    ? inp.unitMix.reduce((s, u) => s + u.count * u.avgSqm * u.pricePerSqm, 0)
    : sellableSqm * inp.salePricePerSqm;
  const estimatedUnits = hasMix
    ? inp.unitMix.reduce((s, u) => s + u.count, 0)
    : Math.floor(safeDiv(sellableSqm, inp.avgUnitSqm));
  // Με unit mix χτίζονται/πουλιούνται τα m² των μονάδων, όχι όλο το επιτρεπόμενο.
  const soldSqm = hasMix ? inp.unitMix.reduce((s, u) => s + u.count * u.avgSqm, 0) : sellableSqm;
  const constructedSqm = hasMix ? Math.min(buildableSqm, safeDiv(soldSqm, inp.efficiencyRatio || 1)) : buildableSqm;
  const effectivePricePerSqm = safeDiv(grossRevenueInclVat, soldSqm);

  // Τιμές «+ ΦΠΑ» → ο developer κρατά όλο το ποσό· τιμές «με ΦΠΑ» → αφαιρείται ο ΦΠΑ.
  const netRevenue = inp.pricesExVat ? grossRevenueInclVat : grossRevenueInclVat / (1 + inp.vatRate);

  const constructionCost = constructedSqm * inp.constructionCostPerSqm;
  const contingency = constructionCost * inp.contingencyRate;
  const professionalFees = constructionCost * inp.professionalFeesRate;
  const marketingCost = netRevenue * inp.marketingRate;

  const totalDevelopmentCost =
    inp.landAcquisitionCost +
    constructionCost +
    contingency +
    professionalFees +
    inp.infrastructureCost +
    inp.permitCost +
    inp.financeCost +
    marketingCost;

  const grossProfit = netRevenue - constructionCost - contingency - inp.infrastructureCost;
  const netProfit = netRevenue - totalDevelopmentCost;
  const roi = safeDiv(netProfit, totalDevelopmentCost);
  const profitMargin = safeDiv(netProfit, netRevenue);

  return {
    buildableSqm, sellableSqm, soldSqm, constructedSqm, estimatedUnits, effectivePricePerSqm,
    grossRevenueInclVat, netRevenue, constructionCost, contingency, professionalFees,
    marketingCost, totalDevelopmentCost, grossProfit, netProfit, roi, profitMargin,
  };
}

function buildCashflow(inp: DealInputs, c: ReturnType<typeof computeCore>): CashflowPeriod[] {
  const quarters = Math.max(2, Math.ceil(inp.durationMonths / 3));
  // Costs other than land are spread across the build; land lands up front.
  const spreadCost = (c.totalDevelopmentCost - inp.landAcquisitionCost) / quarters;
  // Revenue: ~30% as off-plan deposits across the middle, ~70% at completion.
  const deposits = c.netRevenue * 0.3;
  const completion = c.netRevenue * 0.7;
  const depositPerQ = deposits / Math.max(1, quarters - 1);

  const periods: CashflowPeriod[] = [];
  let cumulative = 0;
  for (let q = 0; q < quarters; q++) {
    const outflow = (q === 0 ? inp.landAcquisitionCost : 0) + spreadCost;
    const inflow = (q === 0 ? 0 : depositPerQ) + (q === quarters - 1 ? completion : 0);
    const net = inflow - outflow;
    cumulative += net;
    periods.push({ label: `Q${q + 1}`, outflow, inflow, net, cumulative });
  }
  return periods;
}

function assessRisk(inp: DealInputs, c: ReturnType<typeof computeCore>): RiskBreakdown {
  // Market: driven by margin — thin margins are fragile to price moves.
  const m = c.profitMargin;
  const market = clamp(m >= 0.3 ? 15 : m >= 0.25 ? 28 : m >= 0.2 ? 42 : m >= 0.15 ? 60 : m >= 0.1 ? 78 : 92);

  // Permit: restrictions + intensity of the entitlement ask.
  let permit = 25;
  if (inp.planningRestrictions.trim()) permit += 28;
  if (inp.floorsAllowed >= 7) permit += 14;
  if (inp.buildingDensity >= 2) permit += 12;
  permit = clamp(permit);

  // Construction: thin contingency, height/floors, and cost intensity.
  let construction = inp.contingencyRate >= 0.1 ? 22 : inp.contingencyRate >= 0.07 ? 36 : 52;
  if (inp.floorsAllowed >= 8 || inp.heightM >= 30) construction += 20;
  if (inp.constructionCostPerSqm >= 1800) construction += 12;
  construction = clamp(construction);

  // Liquidity: more units + higher ticket = slower absorption.
  const units = c.estimatedUnits;
  let liquidity = units > 60 ? 75 : units > 35 ? 58 : units > 18 ? 42 : units > 8 ? 30 : 22;
  if (c.effectivePricePerSqm >= 4500) liquidity += 12;
  liquidity = clamp(liquidity);

  const overall = clamp(market * 0.3 + permit * 0.25 + construction * 0.2 + liquidity * 0.25);
  const band = overall < 30 ? 'Low' : overall < 50 ? 'Moderate' : overall < 70 ? 'Elevated' : 'High';
  return { market, permit, construction, liquidity, overall, band };
}

function sensitivity(inp: DealInputs): SensitivityRow[] {
  const base = computeCore(inp);
  const scale = (factorKey: 'price' | 'construction' | 'land', mult: number): DealInputs => {
    if (factorKey === 'price') {
      return {
        ...inp,
        salePricePerSqm: inp.salePricePerSqm * mult,
        unitMix: inp.unitMix.map((u) => ({ ...u, pricePerSqm: u.pricePerSqm * mult })),
      };
    }
    if (factorKey === 'construction') return { ...inp, constructionCostPerSqm: inp.constructionCostPerSqm * mult };
    return { ...inp, landAcquisitionCost: inp.landAcquisitionCost * mult };
  };
  const rows: { variable: string; key: 'price' | 'construction' | 'land' }[] = [
    { variable: 'Sale price', key: 'price' },
    { variable: 'Construction cost', key: 'construction' },
    { variable: 'Land cost', key: 'land' },
  ];
  return rows.map(({ variable, key }) => {
    const down = computeCore(scale(key, 0.9));
    const up = computeCore(scale(key, 1.1));
    return {
      variable,
      downsideNetProfit: down.netProfit,
      baseNetProfit: base.netProfit,
      upsideNetProfit: up.netProfit,
      downsideRoi: down.roi,
      upsideRoi: up.roi,
    };
  });
}

/** Full model: the one function the UI calls on every input change. */
export function analyzeDeal(inp: DealInputs): DealOutputs {
  const c = computeCore(inp);
  const greenAreaSqm = inp.plotSizeSqm * inp.greenAreaPct;
  const costPerBuildableSqm = safeDiv(c.totalDevelopmentCost, c.constructedSqm);
  const vatMult = inp.pricesExVat ? 1 : 1 + inp.vatRate;
  const revenuePerUnit = safeDiv(c.netRevenue, c.estimatedUnits);
  const breakEvenPricePerSqm = safeDiv(c.totalDevelopmentCost * vatMult, c.soldSqm);
  const breakEvenSellableSqm = safeDiv(c.totalDevelopmentCost * vatMult, c.effectivePricePerSqm || inp.salePricePerSqm);

  return {
    buildableSqm: c.buildableSqm,
    greenAreaSqm,
    sellableSqm: c.sellableSqm,
    soldSqm: c.soldSqm,
    constructedSqm: c.constructedSqm,
    exVat: !!inp.pricesExVat,
    estimatedUnits: c.estimatedUnits,
    effectivePricePerSqm: c.effectivePricePerSqm,
    constructionCost: c.constructionCost,
    contingency: c.contingency,
    professionalFees: c.professionalFees,
    infrastructureCost: inp.infrastructureCost,
    permitCost: inp.permitCost,
    financeCost: inp.financeCost,
    marketingCost: c.marketingCost,
    landAcquisitionCost: inp.landAcquisitionCost,
    totalDevelopmentCost: c.totalDevelopmentCost,
    costPerBuildableSqm,
    grossRevenueInclVat: c.grossRevenueInclVat,
    netRevenue: c.netRevenue,
    grossProfit: c.grossProfit,
    netProfit: c.netProfit,
    roi: c.roi,
    profitMargin: c.profitMargin,
    revenuePerUnit,
    breakEvenPricePerSqm,
    breakEvenSellableSqm,
    cashflow: buildCashflow(inp, c),
    risk: assessRisk(inp, c),
    sensitivity: sensitivity(inp),
  };
}

/** Convenience currency alias used across the deal-analyzer module — delegates
 *  to the single formatter in lib/format so there is one currency implementation. */
export function eur(n: number, opts: { compact?: boolean } = {}): string {
  if (!isFinite(n)) return '—';
  return opts.compact ? formatCurrencyCompact(n) : formatCurrency(Math.round(n));
}

export const pct = (n: number, digits = 1): string => `${(n * 100).toFixed(digits)}%`;
