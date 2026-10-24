import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { nextBestAction, type NextBestAction } from '@/lib/next-best-action';

/**
 * Predictive lead scoring — a deterministic model that turns the signals we
 * already collect (stage, budget, AI fit, two-way engagement, viewings,
 * negotiations, objections, inactivity, response speed) into four numbers a
 * salesperson can act on: probability to convert, urgency to contact, risk of
 * losing, and a single 0–100 headline. Pure `scoreLead()` so it's testable and
 * client-safe; `scoreOneLead()` gathers the signals for a single lead.
 */

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(n)));

// Pipeline stage → baseline conversion weight.
const STAGE_WEIGHT: Record<string, number> = {
  new: 8, contacted: 18, engaged: 30, qualified: 40, viewing: 55, offer: 68, negotiating: 78, reserved: 90, won: 100, lost: 0,
};
const HOT_STAGES = ['offer', 'negotiating', 'reserved'];

export interface ScoringInput {
  status: string;
  budgetMin: number | null; budgetMax: number | null;
  aiScore: number | null;
  createdAt: string; lastContactedAt: string | null; firstResponseAt: string | null;
  buyerType: string | null;
  inboundCount: number; outboundCount: number; lastInboundAt: string | null;
  viewingsCount: number; viewingsAttended: number;
  hasActiveNegotiation: boolean; objections: string | null;
  openFollowUpOverdue: boolean;
  /** Empirical conversion % for this lead's source, from the learning loop. */
  sourceConversionPct?: number | null;
}

export interface LeadScore {
  score: number;              // 0–100 headline (≈ probability to convert)
  convertProbability: number;
  urgency: number;
  risk: number;
  nextAction: string;         // = nba.reason (kept for back-compat)
  nba: NextBestAction;        // the single-engine structured action
  drivers: string[];          // human-readable top signals
}

export function scoreLead(i: ScoringInput): LeadScore {
  const now = Date.now();
  if (i.status === 'won') return { score: 100, convertProbability: 100, urgency: 0, risk: 0, nextAction: 'Closed — start onboarding & handover.', nba: { key: 'nurture', label: 'Start onboarding', reason: 'Deal won — begin handover & after-sales', tone: 'warm' }, drivers: ['Deal won'] };
  if (i.status === 'lost') return { score: 0, convertProbability: 0, urgency: 0, risk: 100, nextAction: 'Marked lost — move to reactivation nurture.', nba: { key: 'nurture', label: 'Move to nurture', reason: 'Lost — add to reactivation nurture', tone: 'cool' }, drivers: ['Deal lost'] };

  const budget = Math.max(i.budgetMax ?? 0, i.budgetMin ?? 0);
  const lastOut = i.lastContactedAt ? new Date(i.lastContactedAt).getTime() : null;
  const ref = lastOut ?? new Date(i.createdAt).getTime();
  const daysInactive = (now - ref) / DAY;
  const ageDays = (now - new Date(i.createdAt).getTime()) / DAY;
  const inboundWaiting = !!i.lastInboundAt && (!lastOut || new Date(i.lastInboundAt).getTime() > lastOut);
  const noFirstResponse = i.status === 'new' && !i.firstResponseAt;
  const waitMin = noFirstResponse ? (now - new Date(i.createdAt).getTime()) / 60000 : 0;

  // ── Probability to convert ──
  const drivers: string[] = [];
  let convert = STAGE_WEIGHT[i.status] ?? 15;
  if (budget > 1_000_000) { convert += 12; drivers.push('Budget over €1M'); }
  else if (budget > 500_000) { convert += 8; drivers.push('Budget over €500k'); }
  if ((i.aiScore ?? 0) >= 70) { convert += (i.aiScore! - 70) * 0.3; drivers.push('Strong AI fit'); }
  if (i.inboundCount > 0) { convert += Math.min(i.inboundCount * 4, 16); drivers.push('Actively replying'); }
  if (i.viewingsAttended > 0) { convert += i.viewingsAttended * 6; drivers.push('Attended a viewing'); }
  if (i.hasActiveNegotiation) { convert += 10; drivers.push('In active negotiation'); }
  // Learning-loop calibration: pull toward this source's empirical conversion.
  if (i.sourceConversionPct != null) {
    convert += (i.sourceConversionPct - 40) * 0.2;
    if (i.sourceConversionPct >= 55) drivers.push('High-converting source');
    else if (i.sourceConversionPct <= 20) drivers.push('Low-converting source');
  }
  if (daysInactive > 30) { convert -= 25; }
  else if (daysInactive > 14) { convert -= 15; }
  const convertProbability = clamp(convert, 2, 98);

  // ── Urgency to contact ──
  let urgency = 0;
  if (noFirstResponse && waitMin > 15) { urgency += Math.min(50, 20 + waitMin / 30); drivers.push('First response overdue'); }
  if (inboundWaiting) { urgency += 35; drivers.push('Awaiting your reply'); }
  if (i.openFollowUpOverdue) { urgency += 30; drivers.push('Overdue follow-up'); }
  if (HOT_STAGES.includes(i.status)) urgency += 20;
  const urgencyScore = clamp(urgency);

  // ── Risk of losing ──
  let risk = 0;
  if (daysInactive > 30) { risk += 45; drivers.push('Cold — 30+ days quiet'); }
  else if (daysInactive > 14) { risk += 30; drivers.push('Going quiet'); }
  if (i.viewingsAttended > 0 && daysInactive > 10) risk += 20; // viewed but drifting
  if (i.hasActiveNegotiation && daysInactive > 7) { risk += 25; drivers.push('Negotiation stalling'); }
  if (noFirstResponse && ageDays > 2) risk += 30;
  if (inboundWaiting && daysInactive > 3) risk += 15;
  const riskScore = clamp(risk);

  // ── Recommended next action — the single shared engine, fed the rich signals ──
  const nba = nextBestAction({
    status: i.status, created_at: i.createdAt, last_contacted_at: i.lastContactedAt,
    firstResponseAt: i.firstResponseAt, lastInboundAt: i.lastInboundAt, openFollowUpOverdue: i.openFollowUpOverdue,
    hasActiveNegotiation: i.hasActiveNegotiation, viewingsAttended: i.viewingsAttended, viewingsCount: i.viewingsCount,
    riskScore,
  });

  return { score: convertProbability, convertProbability, urgency: urgencyScore, risk: riskScore, nextAction: nba.reason, nba, drivers: [...new Set(drivers)].slice(0, 4) };
}

/** Gather signals for a single lead and score it. */
export async function scoreOneLead(supabase: Client, leadId: string): Promise<LeadScore | null> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, contact_id, status, budget_min, budget_max, ai_score, created_at, last_contacted_at, first_response_at, contacts(buyer_type)')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) return null;

  const [{ data: comms }, { data: viewings }, { data: negs }, { data: follows }] = await Promise.all([
    supabase.from('contact_communications').select('direction, occurred_at').eq('lead_id', leadId),
    supabase.from('viewings').select('status').eq('lead_id', leadId),
    supabase.from('negotiations').select('agreed_price, notes').eq('lead_id', leadId).order('created_at', { ascending: false }),
    supabase.from('follow_up_tasks').select('due_at, is_done').eq('lead_id', leadId).eq('is_done', false),
  ]);

  const inbound = (comms ?? []).filter((c) => c.direction === 'inbound');
  const lastInboundAt = inbound.map((c) => c.occurred_at).sort().at(-1) ?? null;
  const activeNeg = (negs ?? []).find((n) => n.agreed_price == null);

  return scoreLead({
    status: lead.status,
    budgetMin: lead.budget_min, budgetMax: lead.budget_max, aiScore: lead.ai_score,
    createdAt: lead.created_at, lastContactedAt: lead.last_contacted_at, firstResponseAt: lead.first_response_at,
    buyerType: (lead as any).contacts?.buyer_type ?? null,
    inboundCount: inbound.length, outboundCount: (comms ?? []).length - inbound.length, lastInboundAt,
    viewingsCount: (viewings ?? []).length, viewingsAttended: (viewings ?? []).filter((v) => v.status === 'attended').length,
    hasActiveNegotiation: !!activeNeg, objections: activeNeg?.notes ?? null,
    openFollowUpOverdue: (follows ?? []).some((f) => new Date(f.due_at).getTime() < Date.now()),
  });
}
