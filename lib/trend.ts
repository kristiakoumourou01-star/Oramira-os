/**
 * Trend engine — turns any metric from a bare number into a decision: "up or
 * down, and is that good or bad?" Pure/deterministic infrastructure reused by
 * every KPI surface (Dashboard, Sales, Marketing, Finance, Operations, Reports,
 * CEO). Nothing in the app computed period-over-period before this; now one
 * engine gives consistent, sentiment-aware trends everywhere.
 */

export type TrendDirection = 'up' | 'down' | 'flat';
export type TrendSentiment = 'positive' | 'negative' | 'neutral';

export interface Trend {
  current: number;
  previous: number;
  delta: number;
  deltaPct: number | null;      // null when previous is 0 and current > 0 (i.e. "new")
  direction: TrendDirection;
  sentiment: TrendSentiment;    // whether the direction is good, given the metric
  label: string;                // "+12%" | "−8%" | "flat" | "new"
}

/** Compare a current value to a previous one. `higherIsBetter` decides sentiment
 *  (false for cost/risk/overdue metrics where up is bad). */
export function computeTrend(current: number, previous: number, opts: { higherIsBetter?: boolean; flatThresholdPct?: number } = {}): Trend {
  const higherIsBetter = opts.higherIsBetter ?? true;
  const flat = opts.flatThresholdPct ?? 2;
  const delta = current - previous;
  const deltaPct = previous === 0 ? (current === 0 ? 0 : null) : (delta / Math.abs(previous)) * 100;

  let direction: TrendDirection;
  if (deltaPct === null) direction = current > 0 ? 'up' : 'flat';
  else if (Math.abs(deltaPct) < flat) direction = 'flat';
  else direction = deltaPct > 0 ? 'up' : 'down';

  const sentiment: TrendSentiment =
    direction === 'flat' ? 'neutral' : (direction === 'up') === higherIsBetter ? 'positive' : 'negative';

  const label =
    deltaPct === null ? (current > 0 ? 'new' : 'flat')
    : direction === 'flat' ? 'flat'
    : `${deltaPct > 0 ? '+' : '−'}${Math.abs(Math.round(deltaPct))}%`;

  return { current, previous, delta, deltaPct, direction, sentiment, label };
}

/**
 * Period-over-period trend over timestamped rows: computes `reduce()` for the
 * current window [now−w, now] vs the prior window [now−2w, now−w]. Works for any
 * metric — count (`rows => rows.length`), sum (`rows => rows.reduce(...)`), etc.
 */
export function periodOverPeriod<T>(
  rows: T[],
  getTime: (r: T) => number | null,
  reduce: (subset: T[]) => number,
  opts: { windowDays: number; now?: number; higherIsBetter?: boolean },
): Trend {
  const now = opts.now ?? Date.now();
  const w = opts.windowDays * 86_400_000;
  const inWindow = (lo: number, hi: number) => rows.filter((r) => { const t = getTime(r); return t != null && t > lo && t <= hi; });
  const current = reduce(inWindow(now - w, now));
  const previous = reduce(inWindow(now - 2 * w, now - w));
  return computeTrend(current, previous, { higherIsBetter: opts.higherIsBetter });
}

export const countRows = (rows: unknown[]): number => rows.length;
