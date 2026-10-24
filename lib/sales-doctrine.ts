/**
 * Oramira sales operating doctrine — the methodology encoded as data + pure
 * rules (server + client safe). Audience behaviour, call windows, follow-up
 * cadence, email nurture, speed-to-lead tiers, and the recommendation engine
 * all live here so messaging, automation, and the UI share one source of truth.
 */

export type BuyerType = 'russian_cis' | 'local_cypriot' | 'international' | 'other';

export interface BuyerProfile {
  label: string;
  nurtureStyle: 'trust_first' | 'fast_urgent' | 'standard';
  preferredChannel: 'whatsapp' | 'call' | 'email';
  language: 'ru' | 'el' | 'en';
  callWindows: string[];
}

export const BUYER_TYPES: Record<BuyerType, BuyerProfile> = {
  russian_cis: { label: 'Russian / CIS', nurtureStyle: 'trust_first', preferredChannel: 'whatsapp', language: 'ru', callWindows: ['11:00–13:00', '17:00–19:00'] },
  local_cypriot: { label: 'Local Cypriot', nurtureStyle: 'fast_urgent', preferredChannel: 'call', language: 'el', callWindows: ['12:00–14:00', 'after 18:00'] },
  international: { label: 'International', nurtureStyle: 'standard', preferredChannel: 'email', language: 'en', callWindows: ['10:00–12:00', '16:00–18:00'] },
  other: { label: 'Other', nurtureStyle: 'standard', preferredChannel: 'whatsapp', language: 'en', callWindows: ['10:00–12:00', '16:00–18:00'] },
};

export function buyerProfile(buyerType?: string | null): BuyerProfile {
  return BUYER_TYPES[(buyerType as BuyerType) ?? 'other'] ?? BUYER_TYPES.other;
}

/** Which template variant to use, from buyer type / language. */
export function templateAudience(buyerType?: string | null, language?: string | null): 'en' | 'ru' | 'el' {
  if (language === 'ru' || buyerType === 'russian_cis') return 'ru';
  if (language === 'el' || buyerType === 'local_cypriot') return 'el';
  return 'en';
}

// ── Speed to lead ────────────────────────────────────────────────────────────
export function speedTier(minutes: number): { tier: 'optimal' | 'good' | 'declining' | 'recovery'; label: string } {
  if (minutes <= 5) return { tier: 'optimal', label: '0–5 min · optimal' };
  if (minutes <= 30) return { tier: 'good', label: '5–30 min · good' };
  if (minutes <= 1440) return { tier: 'declining', label: '30 min–24h · declining' };
  return { tier: 'recovery', label: '24h+ · recovery sequence' };
}

// ── Follow-up cadence (no response) ──────────────────────────────────────────
export interface CadenceStep {
  afterHours: number;
  action: 'whatsapp' | 'email' | 'call_task' | 'retarget';
  templateKey?: string;
  label: string;
}
export const FOLLOW_UP_CADENCE: CadenceStep[] = [
  { afterHours: 24, action: 'whatsapp', templateKey: 'follow_up', label: '2nd WhatsApp (24h)' },
  { afterHours: 48, action: 'call_task', label: 'Phone-call reminder (48h)' },
  { afterHours: 72, action: 'email', templateKey: 'nurture_market', label: 'Email nurture (Day 3)' },
  { afterHours: 168, action: 'email', templateKey: 'nurture_objections', label: 'Second nurture (Day 7)' },
  { afterHours: 240, action: 'retarget', label: 'Move to retargeting pool (Day 10)' },
];

// ── Email nurture sequence (Day 0/3/7) ───────────────────────────────────────
export const NURTURE_SEQUENCE: { dayOffset: number; templateKey: string; label: string }[] = [
  { dayOffset: 0, templateKey: 'nurture_intro', label: 'Introduction' },
  { dayOffset: 3, templateKey: 'nurture_market', label: 'Market insights' },
  { dayOffset: 7, templateKey: 'nurture_objections', label: 'Buyer objections' },
];

// ── Call strategy (per audience) ─────────────────────────────────────────────
export interface CallStrategy {
  order: 'whatsapp_first' | 'call_first';
  headline: string;
  detail: string;
}
/**
 * The audience-specific contact order. Russian/CIS buyers expect a WhatsApp
 * introduction before any call (trust-first); local Cypriots respond best to a
 * direct call first. Surfaced on the lead so the agent is guided every time.
 */
export function callStrategy(buyerType?: string | null): CallStrategy {
  const p = buyerProfile(buyerType);
  if (p.preferredChannel === 'call') {
    return { order: 'call_first', headline: 'Call first', detail: `${p.label} buyers respond best to a direct call. Phone first, then confirm details on WhatsApp.` };
  }
  if (buyerType === 'russian_cis') {
    return { order: 'whatsapp_first', headline: 'WhatsApp before calling', detail: 'Russian/CIS buyers expect a WhatsApp introduction to build trust before any phone call.' };
  }
  return { order: 'whatsapp_first', headline: 'WhatsApp first', detail: `${p.label} buyers prefer a WhatsApp message before a call.` };
}

// ── Retargeting categorisation ───────────────────────────────────────────────
export type RetargetCategory = 'warm_no_response' | 'viewed_inactive' | 'negotiation_stalled';

export const RETARGET_LABELS: Record<RetargetCategory, string> = {
  warm_no_response: 'Warm — no response',
  viewed_inactive: 'Viewed but inactive',
  negotiation_stalled: 'Negotiation stalled',
};

/**
 * Bucket an inactive lead into a retargeting audience. Used after 7+ days of
 * silence to build exportable audience lists. Returns null if the lead is still
 * active or terminal (won/lost).
 */
export function retargetCategory(args: { status: string; lastContactedAt: string | null; createdAt: string }): RetargetCategory | null {
  if (['won', 'lost'].includes(args.status)) return null;
  const last = args.lastContactedAt ? new Date(args.lastContactedAt).getTime() : new Date(args.createdAt).getTime();
  const inactive = Date.now() - last > 7 * DAY;
  // Leads explicitly in the retargeting pool always qualify.
  if (args.status !== 'retargeting' && !inactive) return null;
  if (['offer', 'negotiating'].includes(args.status)) return 'negotiation_stalled';
  if (['viewing', 'qualified'].includes(args.status)) return 'viewed_inactive';
  return 'warm_no_response';
}

// ── Recommendation engine ────────────────────────────────────────────────────
const DAY = 24 * 60 * 60 * 1000;
const TERMINAL = ['won', 'lost', 'reserved'];

export interface LeadSignals {
  status: string;
  buyerType?: string | null;
  language?: string | null;
  createdAt: string;
  lastContactedAt: string | null;
  firstResponseAt: string | null;
  aiScore: number | null;
  priority: number;
}

export interface SalesRecommendation {
  temperature: 'hot' | 'warm' | 'cold';
  urgency: 'critical' | 'high' | 'normal' | 'low';
  recommend: 'call' | 'whatsapp' | 'email' | 'nurture' | 'retarget';
  nextAction: string;
  callWindows: string[];
}

export function recommendForLead(s: LeadSignals): SalesRecommendation {
  const profile = buyerProfile(s.buyerType);
  const now = Date.now();
  const ageMs = now - new Date(s.createdAt).getTime();
  const lastMs = s.lastContactedAt ? now - new Date(s.lastContactedAt).getTime() : ageMs;

  const temperature: SalesRecommendation['temperature'] =
    s.priority >= 60 || (s.aiScore ?? 0) >= 70 ? 'hot' : s.priority >= 30 ? 'warm' : 'cold';

  // Speed-to-lead: a brand-new lead with no human response is the top priority.
  if (s.status === 'new' && !s.firstResponseAt) {
    const mins = Math.floor(ageMs / 60000);
    return {
      temperature,
      urgency: mins > 5 ? 'critical' : 'high',
      recommend: profile.preferredChannel === 'call' ? 'call' : 'whatsapp',
      nextAction: mins > 5 ? `Respond now — ${mins} min since arrival (speed-to-lead).` : 'New lead — first contact within 5 minutes.',
      callWindows: profile.callWindows,
    };
  }

  if (TERMINAL.includes(s.status)) {
    return { temperature, urgency: 'low', recommend: 'nurture', nextAction: 'Deal progressing — keep the relationship warm.', callWindows: profile.callWindows };
  }

  // Gone cold → retarget after a week of silence.
  if (lastMs > 7 * DAY) {
    return { temperature: 'cold', urgency: 'normal', recommend: 'retarget', nextAction: 'No contact in 7+ days — move to the retargeting pool.', callWindows: profile.callWindows };
  }

  // Trust-first audiences nurture; fast-urgent audiences call.
  if (profile.nurtureStyle === 'fast_urgent') {
    return { temperature, urgency: temperature === 'hot' ? 'high' : 'normal', recommend: 'call', nextAction: `Call ${profile.label} buyer in their window.`, callWindows: profile.callWindows };
  }
  if (profile.nurtureStyle === 'trust_first') {
    return { temperature, urgency: 'normal', recommend: temperature === 'hot' ? 'whatsapp' : 'nurture', nextAction: 'Trust-first audience — nurture with value, no pressure.', callWindows: profile.callWindows };
  }
  return { temperature, urgency: temperature === 'hot' ? 'high' : 'normal', recommend: profile.preferredChannel, nextAction: 'Follow up via the preferred channel.', callWindows: profile.callWindows };
}
