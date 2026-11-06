import type { SupabaseClient } from '@supabase/supabase-js';
import { selectResilient } from '@/lib/db-resilient';

/**
 * Team performance engine — turns raw activity into ONE clear responsiveness
 * score per employee, so an owner can see at a glance who is on top of their
 * leads and who is slipping. Deliberately narrow: it scores RESPONSIVENESS only
 * (speed-to-lead + follow-ups kept on time), the clearest "are they on it"
 * signal, and never invents data — an employee with too little activity scores
 * `null` ("Not enough activity") rather than a fake number.
 *
 * Pure + deterministic (`scoreResponsiveness`), so it's unit-testable today and
 * reusable by HR (owner Team view), the CEO dashboard, and reviews without
 * duplication. Owner/management-gated at the call site.
 */

export type PerformanceLabel = 'excellent' | 'solid' | 'needs attention' | 'at risk' | 'no data';

export interface ResponsivenessInput {
  agentId: string;
  name: string;
  leadsAssigned: number;
  leadsResponded: number;
  firstResponseMinutes: number[]; // minutes to first response, per responded lead
  openFollowUps: number;
  overdueFollowUps: number;
  // False when the first_response_at column is unavailable (schema drift): we
  // then treat speed + response-rate as UNKNOWN rather than scoring a false 0%.
  responseDataAvailable?: boolean;
}

export interface PerformanceScore {
  agentId: string;
  name: string;
  score: number | null;            // 0–100, null when there isn't enough activity
  label: PerformanceLabel;
  responseRatePct: number | null;
  medianSpeedMinutes: number | null;
  overdueFollowUps: number;
  openFollowUps: number;
  leadsAssigned: number;
  highlights: string[];
  concerns: string[];
}

const MIN_SIGNALS = 3; // below this, we don't pretend to have a read on someone

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.floor(s.length / 2)]);
}

/** Map a median first-response time (minutes) to a 0–100 speed score. */
function speedScore(mins: number): number {
  if (mins <= 15) return 100;
  if (mins <= 60) return 85;
  if (mins <= 240) return 65;   // 4h
  if (mins <= 1440) return 45;  // 1 day
  return 25;
}

function labelFor(score: number): PerformanceLabel {
  if (score >= 80) return 'excellent';
  if (score >= 62) return 'solid';
  if (score >= 42) return 'needs attention';
  return 'at risk';
}

export function scoreResponsiveness(input: ResponsivenessInput): PerformanceScore {
  const responseAvailable = input.responseDataAvailable ?? true;
  const responseRatePct = responseAvailable && input.leadsAssigned > 0 ? Math.round((input.leadsResponded / input.leadsAssigned) * 100) : null;
  const medianSpeedMinutes = median(input.firstResponseMinutes);

  // Weighted sub-scores — only the ones we actually have signal for count.
  const parts: { score: number; weight: number }[] = [];
  if (medianSpeedMinutes != null) parts.push({ score: speedScore(medianSpeedMinutes), weight: 0.45 });
  if (responseRatePct != null) parts.push({ score: responseRatePct, weight: 0.3 });
  if (input.openFollowUps > 0) {
    const onTime = 1 - input.overdueFollowUps / input.openFollowUps;
    parts.push({ score: Math.round(onTime * 100), weight: 0.25 });
  }

  const signals = input.leadsAssigned + input.openFollowUps;
  const base: Omit<PerformanceScore, 'score' | 'label' | 'highlights' | 'concerns'> = {
    agentId: input.agentId, name: input.name, responseRatePct, medianSpeedMinutes,
    overdueFollowUps: input.overdueFollowUps, openFollowUps: input.openFollowUps, leadsAssigned: input.leadsAssigned,
  };

  if (parts.length === 0 || signals < MIN_SIGNALS) {
    return { ...base, score: null, label: 'no data', highlights: [], concerns: [] };
  }

  const totalWeight = parts.reduce((s, p) => s + p.weight, 0);
  const score = Math.round(parts.reduce((s, p) => s + p.score * p.weight, 0) / totalWeight);

  // Plain-language read of what's driving the score.
  const highlights: string[] = [];
  const concerns: string[] = [];
  if (medianSpeedMinutes != null) {
    if (medianSpeedMinutes <= 60) highlights.push(medianSpeedMinutes <= 15 ? 'Replies almost instantly' : 'Replies within the hour');
    else if (medianSpeedMinutes > 240) concerns.push('Slow first reply to new leads');
  }
  if (responseRatePct != null) {
    if (responseRatePct >= 90) highlights.push('Answers nearly every lead');
    else if (responseRatePct < 60) concerns.push(`${100 - responseRatePct}% of leads left unanswered`);
  }
  if (input.overdueFollowUps > 0) concerns.push(`${input.overdueFollowUps} follow-up${input.overdueFollowUps > 1 ? 's' : ''} overdue`);
  else if (input.openFollowUps > 0) highlights.push('No overdue follow-ups');

  return { ...base, score, label: labelFor(score), highlights, concerns };
}

export function rankTeam(inputs: ResponsivenessInput[]): PerformanceScore[] {
  return inputs
    .map(scoreResponsiveness)
    .sort((a, b) => {
      if (a.score == null && b.score == null) return a.name.localeCompare(b.name);
      if (a.score == null) return 1;   // "no data" sinks to the bottom
      if (b.score == null) return -1;
      return b.score - a.score;
    });
}

type Client = SupabaseClient<any>;

/**
 * Builds each internal employee's responsiveness score from live activity.
 * Resilient to schema drift (first_response_at may be absent → speed/response
 * signals degrade rather than erroring). Owner/management-gated by the caller.
 */
export async function buildTeamPerformance(supabase: Client, roles: string[]): Promise<PerformanceScore[]> {
  const now = Date.now();
  const [{ data: staff }, leads, { data: followUps }] = await Promise.all([
    supabase.from('profiles').select('id, full_name').in('role', roles).order('full_name'),
    selectResilient(
      supabase.from('leads').select('id, assigned_to, created_at, first_response_at'),
      () => supabase.from('leads').select('id, assigned_to, created_at'),
      'buildTeamPerformance',
    ),
    supabase.from('follow_up_tasks').select('assigned_to, due_at, is_done'),
  ]);

  const L = (leads ?? []) as any[];
  const F = (followUps ?? []) as any[];
  // If the resilient select fell back to base columns, first_response_at is
  // absent — mark response data unavailable so we don't score a false 0%.
  const responseDataAvailable = L.some((l) => 'first_response_at' in l);

  const inputs: ResponsivenessInput[] = (staff ?? []).map((p: any) => {
    const mine = L.filter((l) => l.assigned_to === p.id);
    const responded = mine.filter((l) => l.first_response_at);
    const firstResponseMinutes = responded
      .map((l) => (new Date(l.first_response_at).getTime() - new Date(l.created_at).getTime()) / 60000)
      .filter((m) => m >= 0);
    const openFu = F.filter((f) => f.assigned_to === p.id && !f.is_done);
    const overdueFu = openFu.filter((f) => f.due_at && new Date(f.due_at).getTime() < now);
    return {
      agentId: p.id,
      name: p.full_name ?? 'Employee',
      leadsAssigned: mine.length,
      leadsResponded: responded.length,
      firstResponseMinutes,
      openFollowUps: openFu.length,
      overdueFollowUps: overdueFu.length,
      responseDataAvailable,
    };
  });

  return rankTeam(inputs);
}
