import { createSupabaseServerClient } from '@/lib/supabase/server';
import { pipelineOf, weightedValue, lateBy, type PipelineSettings } from '@/lib/pipeline-shared';

export interface PipelineInsightData {
  reasons: [string, number][]; maxR: number; lostCount: number;
  stageDur: { label: string; avg: number | null; max: number | null; n: number }[]; mainName: string;
  openCount: number; late: number; weighted: number; returning: number; returningWon: number;
}

/** Data for Pipeline → «Ανάλυση» (last 180 days). null when migration 0068 is missing. */
export async function loadPipelineInsights(cfg: PipelineSettings): Promise<PipelineInsightData | null> {
  const supabase = await createSupabaseServerClient();
  const since = new Date(Date.now() - 180 * 86400000).toISOString();
  const db = supabase as any;
  const [{ data: leads, error }, { data: events }] = await Promise.all([
    db.from('leads').select('id, status, pipeline, stage_entered_at, lost_reason, is_returning, budget_max, updated_at').limit(5000),
    db.from('lead_stage_events').select('from_status, days_in_prev').gte('changed_at', since).limit(10000),
  ]);
  if (error) return null;
  const rows = (leads ?? []) as any[];

  const lost = rows.filter((l) => ['lost', 'nurture', 'no_response'].includes(l.status) && l.updated_at >= since);
  const byReason = new Map<string, number>();
  for (const l of lost) { const k = l.lost_reason ?? '_none'; byReason.set(k, (byReason.get(k) ?? 0) + 1); }
  const reasons = Array.from(byReason.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxR = Math.max(1, ...reasons.map((r) => r[1]));

  const dur = new Map<string, number[]>();
  for (const e of (events ?? []) as any[]) if (e.from_status && e.days_in_prev != null) (dur.get(e.from_status) ?? dur.set(e.from_status, []).get(e.from_status)!).push(Number(e.days_in_prev));
  const main = pipelineOf(cfg, null);
  const stageDur = main.stages.filter((s) => s.status !== 'won').map((s) => {
    const v = dur.get(s.status) ?? [];
    const avg = v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
    return { label: s.label, avg, max: s.maxDays, n: v.length };
  });

  const open = rows.filter((l) => !['won', 'lost', 'nurture', 'no_response', 'retargeting', 'reactivation'].includes(l.status));
  const late = open.filter((l) => (lateBy(pipelineOf(cfg, l.pipeline), l.status, l.stage_entered_at) ?? 0) > 0).length;
  const weighted = open.reduce((s, l) => s + weightedValue(pipelineOf(cfg, l.pipeline), l.status, l.budget_max != null ? Number(l.budget_max) : null), 0);
  const returning = rows.filter((l) => l.is_returning);
  const returningWon = returning.filter((l) => l.status === 'won').length;

  return { reasons, maxR, lostCount: lost.length, stageDur, mainName: main.name, openCount: open.length, late, weighted, returning: returning.length, returningWon };
}
