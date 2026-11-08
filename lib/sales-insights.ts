import type { LeadListItem } from '@/lib/leads-shared';
import { dealValue } from '@/lib/leads-shared';
import { CLOSED, pipelineOf, stageIndex, type PipelineSettings } from '@/lib/pipeline-shared';

/** Αναφορές Sales (όπως τα Insights του Pipedrive) — καθαρές συναρτήσεις. */
const closedStatus = (s: string) => s === 'won' || (CLOSED as readonly string[]).includes(s);
const ym = (iso: string) => iso.slice(0, 7);

export interface MonthRow { month: string; started: number; startedValue: number; won: number; wonValue: number; lost: number; lostValue: number }
export function dealsPerformance(leads: LeadListItem[], months: number, now = new Date()): MonthRow[] {
  const keys = Array.from({ length: months }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const rows = new Map(keys.map((k) => [k, { month: k, started: 0, startedValue: 0, won: 0, wonValue: 0, lost: 0, lostValue: 0 }]));
  for (const l of leads) {
    const v = dealValue(l);
    const s = rows.get(ym(l.created_at)); if (s) { s.started++; s.startedValue += v; }
    if (l.status === 'won' && l.won_at) { const w = rows.get(ym(l.won_at)); if (w) { w.won++; w.wonValue += v; } }
    if (closedStatus(l.status) && l.status !== 'won' && l.lost_at) { const x = rows.get(ym(l.lost_at)); if (x) { x.lost++; x.lostValue += v; } }
  }
  return keys.map((k) => rows.get(k)!);
}

export interface FunnelStep { key: string; label: string; reached: number; pct: number; stepPct: number }
/** Πόσα deals έφτασαν σε κάθε στάδιο (από την τρέχουσα θέση· τα won έφτασαν σε όλα). */
export function conversionFunnel(leads: LeadListItem[], cfg: PipelineSettings, pipelineKey: string, sinceIso: string): FunnelStep[] {
  const p = pipelineOf(cfg, pipelineKey);
  const mine = leads.filter((l) => pipelineOf(cfg, l.pipeline).key === p.key && l.created_at >= sinceIso && !l.in_inbox);
  const stages = p.stages;
  const reachedIdx = (l: LeadListItem) => (l.status === 'won' ? stages.length - 1 : stageIndex(p, l.status, l.stage));
  const counts = stages.map((_, i) => mine.filter((l) => { const r = reachedIdx(l); return r >= i || (r < 0 && i === 0); }).length);
  return stages.map((s, i) => ({ key: s.key, label: s.label, reached: counts[i], pct: counts[0] ? Math.round((counts[i] / counts[0]) * 100) : 0, stepPct: i === 0 ? 100 : counts[i - 1] ? Math.round((counts[i] / counts[i - 1]) * 100) : 0 }));
}

export interface OwnerRow { ownerId: string | null; name: string; open: number; openValue: number; won: number; wonValue: number; lost: number; winRate: number }
export function byOwner(leads: LeadListItem[], sinceIso: string): OwnerRow[] {
  const m = new Map<string, OwnerRow>();
  for (const l of leads) {
    const k = l.owner_id ?? 'none';
    const r = m.get(k) ?? { ownerId: l.owner_id, name: l.owner_name ?? 'Χωρίς υπεύθυνο', open: 0, openValue: 0, won: 0, wonValue: 0, lost: 0, winRate: 0 };
    if (!closedStatus(l.status)) { r.open++; r.openValue += dealValue(l); }
    else if (l.status === 'won' && (l.won_at ?? '') >= sinceIso) { r.won++; r.wonValue += dealValue(l); }
    else if (l.status !== 'won' && (l.lost_at ?? '') >= sinceIso) r.lost++;
    m.set(k, r);
  }
  return [...m.values()].map((r) => ({ ...r, winRate: r.won + r.lost ? Math.round((r.won / (r.won + r.lost)) * 100) : 0 })).sort((a, b) => b.wonValue - a.wonValue || b.openValue - a.openValue);
}

export function lostReasons(leads: LeadListItem[], cfg: PipelineSettings, sinceIso: string): { label: string; count: number }[] {
  const m = new Map<string, number>();
  for (const l of leads) if (closedStatus(l.status) && l.status !== 'won' && (l.lost_at ?? '') >= sinceIso) { const k = l.lost_reason ?? '—'; m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].map(([k, count]) => ({ label: cfg.lostReasons.find((r) => r.key === k)?.label ?? (k === '—' ? 'Χωρίς λόγο' : k), count })).sort((a, b) => b.count - a.count);
}

export interface ForecastRow { month: string; count: number; value: number; weighted: number }
export function revenueForecast(leads: LeadListItem[], cfg: PipelineSettings, months = 4, now = new Date()): ForecastRow[] {
  const keys = Array.from({ length: months }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() + i, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const rows = new Map(keys.map((k) => [k, { month: k, count: 0, value: 0, weighted: 0 }]));
  for (const l of leads) {
    if (closedStatus(l.status) || !l.expected_close_date) continue;
    const r = rows.get(l.expected_close_date.slice(0, 7)); if (!r) continue;
    const p = pipelineOf(cfg, l.pipeline); const i = stageIndex(p, l.status, l.stage);
    const prob = i >= 0 ? p.stages[i].probability : 0;
    r.count++; r.value += dealValue(l); r.weighted += dealValue(l) * prob / 100;
  }
  return keys.map((k) => rows.get(k)!);
}
