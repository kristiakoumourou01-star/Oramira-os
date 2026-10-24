import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { selectResilient } from '@/lib/db-resilient';

/**
 * Learning loop — mines closed history (won / lost / delayed deals, negotiation
 * outcomes) into empirical insights that make the rest of the system smarter:
 * which sources convert, how much first-response speed matters, the cadence and
 * cycle length of deals that close, and the discount pattern on won deals.
 * Computed live by `computeLearningInsights`; the daily job persists a snapshot
 * to `learning_insights` so scoring and the command center can read it cheaply.
 */

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;

export interface SourceConversion { source: string; won: number; lost: number; total: number; conversionPct: number }
export interface LearningInsights {
  sampleSize: number;
  sources: SourceConversion[];
  responseTime: { wonAvgMin: number | null; lostAvgMin: number | null; verdict: string };
  cadence: { avgCycleDays: number | null; recommendedFollowUpDays: number; verdict: string };
  negotiation: { avgDiscountPct: number | null; winRatePct: number | null; verdict: string };
  sourceConversionMap: Record<string, number>; // source → conversion pct (for scoring)
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export async function computeLearningInsights(supabase: Client): Promise<LearningInsights> {
  const [leads, { data: negs }] = await Promise.all([
    // Resilient: first_response_at (0027) may be absent — degrade to base columns.
    selectResilient(
      supabase.from('leads').select('id, status, source, created_at, first_response_at, budget_max, budget_min').in('status', ['won', 'lost']),
      () => supabase.from('leads').select('id, status, source, created_at, budget_max, budget_min').in('status', ['won', 'lost']),
      'computeLearningInsights',
    ),
    supabase.from('negotiations').select('lead_id, offered_price, agreed_price, leads(status)'),
  ]);
  const L = (leads ?? []) as any[];
  const won = L.filter((l) => l.status === 'won');
  const lost = L.filter((l) => l.status === 'lost');

  // ── Source conversion ──
  const bySource = new Map<string, { won: number; lost: number }>();
  for (const l of L) {
    const s = l.source ?? 'unknown';
    const e = bySource.get(s) ?? { won: 0, lost: 0 };
    if (l.status === 'won') e.won += 1; else e.lost += 1;
    bySource.set(s, e);
  }
  const sources: SourceConversion[] = [...bySource.entries()]
    .map(([source, v]) => ({ source, won: v.won, lost: v.lost, total: v.won + v.lost, conversionPct: v.won + v.lost ? Math.round((v.won / (v.won + v.lost)) * 100) : 0 }))
    .sort((a, b) => b.conversionPct - a.conversionPct || b.total - a.total);
  const sourceConversionMap: Record<string, number> = Object.fromEntries(sources.map((s) => [s.source, s.conversionPct]));

  // ── Response-time impact ──
  const respMin = (l: any) => (l.first_response_at ? (new Date(l.first_response_at).getTime() - new Date(l.created_at).getTime()) / 60000 : null);
  const wonResp = won.map(respMin).filter((m): m is number => m != null && m >= 0);
  const lostResp = lost.map(respMin).filter((m): m is number => m != null && m >= 0);
  const wonAvgMin = avg(wonResp) != null ? Math.round(avg(wonResp)!) : null;
  const lostAvgMin = avg(lostResp) != null ? Math.round(avg(lostResp)!) : null;
  const responseVerdict = wonAvgMin != null && lostAvgMin != null
    ? wonAvgMin < lostAvgMin
      ? `Won deals were answered ${Math.max(1, Math.round(lostAvgMin - wonAvgMin))} min faster on average — speed correlates with winning.`
      : 'Response speed shows little separation here — other factors dominate.'
    : 'Not enough responded-then-closed history yet to judge speed impact.';

  // ── Cadence / cycle length ──
  const cycles = won.map((l) => (Date.now() - new Date(l.created_at).getTime()) / DAY).filter((d) => d > 0); // proxy: age at close
  const avgCycleDays = avg(cycles) != null ? Math.round(avg(cycles)!) : null;
  const recommendedFollowUpDays = avgCycleDays == null ? 3 : Math.max(2, Math.min(7, Math.round(avgCycleDays / 6)));
  const cadenceVerdict = avgCycleDays == null
    ? 'Default to a follow-up every 3 days until more deals close.'
    : `Won deals took ~${avgCycleDays} days to close; keeping contact every ~${recommendedFollowUpDays} days fits that rhythm.`;

  // ── Negotiation ──
  const wonLeadIds = new Set(won.map((l) => l.id));
  const wonNegs = (negs ?? []).filter((n) => n.lead_id && wonLeadIds.has(n.lead_id) && n.offered_price && n.agreed_price);
  const discounts = wonNegs.map((n) => ((Number(n.offered_price) - Number(n.agreed_price)) / Number(n.offered_price)) * 100).filter((d) => d >= 0 && d < 100);
  const avgDiscountPct = avg(discounts) != null ? Math.round(avg(discounts)! * 10) / 10 : null;
  const negotiatedLeads = new Set((negs ?? []).map((n) => n.lead_id).filter(Boolean));
  const negWon = [...negotiatedLeads].filter((id) => wonLeadIds.has(id as string)).length;
  const winRatePct = negotiatedLeads.size ? Math.round((negWon / negotiatedLeads.size) * 100) : null;
  const negotiationVerdict = avgDiscountPct == null
    ? 'No closed negotiations to learn from yet — hold list pricing and concede on terms first.'
    : `Won deals closed at an average ${avgDiscountPct}% off the opening figure — anchor high and treat that as your concession ceiling.`;

  return {
    sampleSize: L.length,
    sources,
    responseTime: { wonAvgMin, lostAvgMin, verdict: responseVerdict },
    cadence: { avgCycleDays, recommendedFollowUpDays, verdict: cadenceVerdict },
    negotiation: { avgDiscountPct, winRatePct, verdict: negotiationVerdict },
    sourceConversionMap,
  };
}

/** Persist a snapshot into learning_insights (one row per kind). Service-role. */
export async function persistLearningInsights(svc: Client): Promise<number> {
  const insights = await computeLearningInsights(svc);
  const rows = [
    { kind: 'source_conversion', payload: { sources: insights.sources, map: insights.sourceConversionMap } as any, sample_size: insights.sampleSize },
    { kind: 'response_time', payload: insights.responseTime as any, sample_size: insights.sampleSize },
    { kind: 'cadence', payload: insights.cadence as any, sample_size: insights.sampleSize },
    { kind: 'negotiation', payload: insights.negotiation as any, sample_size: insights.sampleSize },
  ];
  for (const r of rows) {
    await svc.from('learning_insights').upsert({ ...r, computed_at: new Date().toISOString() }, { onConflict: 'kind' });
  }
  return rows.length;
}

/** Read the persisted source→conversion map (empty if the loop hasn't run). */
export async function getSourceConversionMap(supabase: Client): Promise<Record<string, number>> {
  const { data } = await supabase.from('learning_insights').select('payload').eq('kind', 'source_conversion').maybeSingle();
  return ((data?.payload as any)?.map ?? {}) as Record<string, number>;
}
