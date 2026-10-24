/** Client-safe AI types (no server imports). The runtime AI calls live in lib/ai.ts. */

/** Provenance for every AI output — so the UI can badge "AI" vs "Rule-based"
 *  and the agent knows whether Claude or the deterministic engine produced it.
 *  Oramira's AI layer is never a single point of failure: `heuristic` outputs
 *  stay useful when Claude is unavailable. */
export type AiSource = 'claude' | 'heuristic';

export interface DealAdvisory {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  red_flags: string[];
  recommended_strategy: string;
  suggested_pricing: string;
  source?: AiSource;
}
export interface DraftedMessage { subject?: string; message: string; source?: AiSource }
export type DraftIntent = 'follow_up' | 'objection' | 'viewing_reminder' | 'negotiation' | 'nurture';
