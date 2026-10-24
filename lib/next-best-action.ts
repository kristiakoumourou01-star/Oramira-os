/**
 * Next-Best-Action — the ONE engine for "what to do with a lead right now".
 * Deterministic and client-safe (no AI key, no server imports). Tiered inputs:
 * list contexts (pipeline card, dashboard) pass the light signals; the lead
 * page passes the rich ones (first-response, inbound-waiting, negotiation,
 * viewings, risk) via scoreLead — but there is a SINGLE rule set, so the chip,
 * the dashboard and the lead banner can never disagree.
 *
 * Business intent: cut the decision an agent makes hundreds of times a day, and
 * keep speed-to-lead + overdue follow-ups at the top where deals are won or lost.
 */

export type NbaTone = 'urgent' | 'warm' | 'cool';
export type NbaKey =
  | 'respond' | 'reply' | 'follow_up_overdue' | 'confirm_viewing' | 'book_viewing'
  | 'viewing_followup' | 'advance_deal' | 'progress_contract' | 're_engage' | 'follow_up' | 'nurture';

export interface NextBestAction { key: NbaKey; label: string; reason: string; tone: NbaTone }

const DAY = 86_400_000;

export interface NbaInput {
  status: string;
  created_at: string;
  last_contacted_at?: string | null;
  next_follow_up?: string | null;   // earliest open follow-up due date (ISO)
  // ── rich signals (optional; supplied on the lead page via scoreLead) ──
  firstResponseAt?: string | null;
  lastInboundAt?: string | null;    // last message FROM the lead
  openFollowUpOverdue?: boolean;
  hasActiveNegotiation?: boolean;
  viewingsAttended?: number;
  viewingsCount?: number;
  riskScore?: number;               // 0–100
}

/** The one action to take now — highest-leverage rule wins. */
export function nextBestAction(l: NbaInput): NextBestAction {
  const now = Date.now();
  const lastOut = l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : null;
  const followUpMs = l.next_follow_up ? new Date(l.next_follow_up).getTime() : null;
  const coldDays = Math.floor((now - (lastOut ?? new Date(l.created_at).getTime())) / DAY);
  const inboundWaiting = !!l.lastInboundAt && (!lastOut || new Date(l.lastInboundAt).getTime() > lastOut);
  const noFirstResponse = l.status === 'new' && !(l.firstResponseAt ?? l.last_contacted_at);
  const overdueFollowUp = (followUpMs != null && followUpMs < now) || !!l.openFollowUpOverdue;
  const closed = ['won', 'lost', 'nurture'].includes(l.status);

  // 1 — Speed-to-lead: a new lead never responded to. First response wins the deal.
  if (noFirstResponse) return { key: 'respond', label: 'Respond now', reason: 'New lead — respond within 5 min to win it', tone: 'urgent' };

  // 2 — They messaged and are waiting on you.
  if (inboundWaiting) return { key: 'reply', label: 'Reply now', reason: 'They messaged — reply while it’s live', tone: 'urgent' };

  // 3 — Overdue follow-up: a promise already made and slipping.
  if (overdueFollowUp) {
    const od = followUpMs != null ? Math.max(1, Math.floor((now - followUpMs) / DAY)) : null;
    return { key: 'follow_up_overdue', label: 'Follow up now', reason: od != null ? `Follow-up overdue by ${od} day${od > 1 ? 's' : ''}` : 'Follow-up is overdue', tone: 'urgent' };
  }

  // 4 — Negotiation stalling.
  if (l.hasActiveNegotiation && coldDays > 5) return { key: 'advance_deal', label: 'Re-engage deal', reason: 'Negotiation stalling — send a counter or confirm terms', tone: 'warm' };

  // 5 — Closing-stage momentum.
  if (l.status === 'offer' || l.status === 'negotiating') return { key: 'advance_deal', label: 'Advance the deal', reason: 'Closing stage — keep the momentum', tone: 'warm' };
  if (l.status === 'reserved') return { key: 'progress_contract', label: 'Progress to contract', reason: 'Reserved — confirm deposit & paperwork', tone: 'warm' };
  if (l.status === 'viewing') return { key: 'confirm_viewing', label: 'Confirm the viewing', reason: 'Viewing stage — confirm & send details', tone: 'warm' };

  // 6 — Viewed but drifting (no offer yet).
  if ((l.viewingsAttended ?? 0) > 0 && !l.hasActiveNegotiation) return { key: 'viewing_followup', label: 'Follow up on viewing', reason: 'Viewed but no offer — gauge intent & propose terms', tone: 'warm' };

  // 7 — Going cold / at risk: re-engage before it dies.
  if (!closed && (coldDays >= 7 || (l.riskScore ?? 0) >= 60)) return { key: 're_engage', label: 'Re-engage', reason: `No contact in ${coldDays} days — reach out before it goes cold`, tone: 'cool' };

  // 8 — Warm & recent: move it toward a viewing.
  if (['contacted', 'engaged', 'qualified', 'waiting'].includes(l.status)) return { key: 'book_viewing', label: 'Book a viewing', reason: 'Warm lead — move it to a viewing', tone: 'warm' };

  // 9 — Scheduled future follow-up.
  if (followUpMs != null) return { key: 'follow_up', label: 'Follow up soon', reason: 'Follow-up scheduled', tone: 'cool' };

  return { key: 'nurture', label: 'Keep nurturing', reason: 'No urgent action — keep the relationship warm', tone: 'cool' };
}
