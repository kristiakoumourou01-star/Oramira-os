/**
 * Lead priority scoring — pure and deterministic, importable on client + server.
 *
 *   priority_score = intent_score + budget_score + urgency_score + engagement_score
 *
 * Rules (per the sales spec):
 *   • budget > €500k ............ +30  (budget)
 *   • viewing requested ......... +40  (intent)
 *   • high AI fit (score ≥ 70) .. +25  (intent)
 *   • replied recently (≤3d) .... +20  (engagement)
 *   • no contact in 7+ days ..... +15  (urgency)
 *
 * Higher = work it first. The leads list sorts descending by this.
 */

const DAY = 24 * 60 * 60 * 1000;

export interface PriorityInput {
  status: string;
  budget_min: number | null;
  budget_max: number | null;
  ai_score: number | null;
  last_contacted_at: string | null;
  created_at: string;
}

export interface PriorityResult {
  score: number;
  reasons: string[];
  breakdown: { intent: number; budget: number; urgency: number; engagement: number };
}

export function computePriority(l: PriorityInput): PriorityResult {
  const reasons: string[] = [];
  const now = Date.now();

  // Budget
  const budget = Math.max(l.budget_max ?? 0, l.budget_min ?? 0);
  const budgetScore = budget > 500_000 ? 30 : 0;
  if (budgetScore) reasons.push('Budget over €500k (+30)');

  // Intent: explicit viewing request + AI fit
  let intent = 0;
  if (l.status === 'viewing') {
    intent += 40;
    reasons.push('Viewing requested (+40)');
  }
  if ((l.ai_score ?? 0) >= 70) {
    intent += 25;
    reasons.push('High AI fit (+25)');
  }

  // Engagement: contacted within the last 3 days (a live conversation)
  const last = l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : null;
  let engagement = 0;
  if (last != null && now - last <= 3 * DAY) {
    engagement = 20;
    reasons.push('Replied recently (+20)');
  }

  // Urgency: gone cold — 7+ days since last contact (or since creation if never)
  const ref = last ?? new Date(l.created_at).getTime();
  let urgency = 0;
  if (now - ref >= 7 * DAY) {
    urgency = 15;
    reasons.push('No contact in 7+ days (+15)');
  }

  return {
    score: intent + budgetScore + urgency + engagement,
    reasons,
    breakdown: { intent, budget: budgetScore, urgency, engagement },
  };
}

/** Visual tier for a priority score — drives badge colour. */
export function priorityTier(score: number): 'hot' | 'warm' | 'cool' {
  if (score >= 60) return 'hot';
  if (score >= 30) return 'warm';
  return 'cool';
}
