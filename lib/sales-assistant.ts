import { formatCurrency } from '@/lib/format';
/**
 * Advanced sales-assistant intelligence — deterministic, server-safe analysis
 * that turns a lead's live state into tactical guidance: buyer-intent read,
 * objection handling, a negotiation move, the best time to follow up, and tone
 * adaptation for the buyer profile. Complements the on-demand AI drafting in
 * lib/ai.ts (draftLeadMessage) and the doctrine-level SalesCoach.
 */

export interface SalesStrategyInput {
  status: string;
  buyerType: string | null;
  language: string | null;
  convertProbability: number;
  urgency: number;
  viewingsAttended: number;
  offered: number | null;
  counter: number | null;
  agreed: number | null;
  objectionsNote: string | null;
  lastInboundText: string | null;
}

export interface SalesStrategy {
  intent: { score: number; label: 'high' | 'medium' | 'low'; note: string };
  objections: { point: string; response: string }[];
  negotiation: string;
  bestFollowUp: string;
  tone: string;
}


// Keyword → suggested objection response.
const OBJECTION_LIBRARY: { match: RegExp; point: string; response: string }[] = [
  { match: /price|expensive|cost|budget|discount/i, point: 'Price sensitivity', response: 'Reframe on value and yield — comparable sales, rental returns, and the phased payment plan — before discussing any concession.' },
  { match: /financ|mortgage|loan|payment|installment/i, point: 'Financing concern', response: 'Walk through the developer payment schedule and local mortgage options; offer to connect them with a partner bank.' },
  { match: /distance|far|location|area|access/i, point: 'Location / distance', response: 'Emphasise proximity to key amenities, the airport, and lifestyle; offer a guided area tour alongside the viewing.' },
  { match: /time|timing|wait|delay|ready|completion|handover/i, point: 'Timing / delivery', response: 'Give a concrete delivery timeline and construction milestones; note early-reservation advantages on unit choice and price.' },
  { match: /think|consider|not sure|maybe|later/i, point: 'Hesitation', response: 'Create gentle urgency with limited availability and a clear, low-commitment next step (a reservation hold).' },
  { match: /tax|vat|legal|title|permit/i, point: 'Legal / tax', response: 'Reassure with the clean title process, VAT treatment, and offer an intro to the conveyancing lawyer.' },
];

// Buyer-profile tone guidance.
const TONE_BY_TYPE: Record<string, string> = {
  investor: 'Concise and numbers-led — lead with ROI, yield, and exit; keep it professional and efficient.',
  end_user: 'Warm and lifestyle-led — paint the living experience, be reassuring and personal.',
  holiday_home: 'Aspirational and relaxed — focus on lifestyle, climate, and ease of ownership/management.',
  relocation: 'Practical and supportive — residency, schools, healthcare, and the settling-in process.',
};
const TONE_BY_LANG: Record<string, string> = {
  ru: 'Russian/CIS buyer: formal address, direct, status- and investment-aware.',
  el: 'Local Greek-Cypriot buyer: relationship-first, warm, trust and referrals matter.',
  en: 'International buyer: thorough and process-oriented — spell out steps and paperwork.',
};

export function analyzeSalesStrategy(i: SalesStrategyInput): SalesStrategy {
  // ── Buyer intent ──
  const intentScore = Math.round(i.convertProbability * 0.7 + Math.min(30, i.viewingsAttended * 15) + (i.status === 'negotiating' || i.status === 'offer' ? 10 : 0));
  const label = intentScore >= 60 ? 'high' : intentScore >= 35 ? 'medium' : 'low';
  const intentNote = label === 'high'
    ? 'Strong buying signals — prioritise a decisive next step (viewing → offer → reservation).'
    : label === 'medium'
      ? 'Warming up — deepen engagement with tailored value and a soft commitment.'
      : 'Early or cooling — nurture with relevant information; avoid pushing for commitment.';

  // ── Objection handling ──
  const objections: { point: string; response: string }[] = [];
  const haystack = [i.objectionsNote, i.lastInboundText].filter(Boolean).join(' ');
  for (const o of OBJECTION_LIBRARY) if (o.match.test(haystack)) objections.push({ point: o.point, response: o.response });
  if (objections.length === 0) {
    // No explicit objection captured — surface the likeliest for the buyer type.
    if (i.buyerType === 'investor') objections.push(OBJECTION_LIBRARY[0], OBJECTION_LIBRARY[3]);
    else objections.push(OBJECTION_LIBRARY[1], OBJECTION_LIBRARY[3]);
  }

  // ── Negotiation recommendation ──
  let negotiation: string;
  if (i.agreed != null) negotiation = `Terms agreed at ${formatCurrency(i.agreed)} — move straight to reservation and lock the deposit.`;
  else if (i.counter != null && i.offered != null) {
    const mid = (i.offered + i.counter) / 2;
    negotiation = `Buyer countered at ${formatCurrency(i.counter)} against your ${formatCurrency(i.offered)}. Hold on price; concede on terms first (payment schedule, furniture pack). If closing, target a midpoint near ${formatCurrency(mid)}.`;
  } else if (i.counter != null) negotiation = `Buyer is at ${formatCurrency(i.counter)}. Anchor back to list with comparables before meeting in the middle.`;
  else if (i.offered != null) negotiation = `Your offer of ${formatCurrency(i.offered)} is on the table — follow up within 24h, justify with comparable sales, and ask for a decision date.`;
  else negotiation = 'No formal numbers yet — confirm intent, then present a clear offer with a reservation path.';

  // ── Best time to follow up ──
  const window = i.language === 'ru' ? 'early evening (their day runs late)' : i.language === 'el' ? 'business hours, late morning' : 'late afternoon';
  const bestFollowUp = i.urgency >= 60
    ? 'Now — the window is hot; call within the hour, then confirm by WhatsApp.'
    : i.urgency >= 30
      ? `Today, ${window} — a short call or a personalised WhatsApp.`
      : `Tomorrow ${window} — lead with value, not a pitch.`;

  // ── Tone adaptation ──
  const tone = [TONE_BY_TYPE[i.buyerType ?? ''], TONE_BY_LANG[i.language ?? 'en']].filter(Boolean).join(' ') || TONE_BY_LANG.en;

  return { intent: { score: intentScore, label, note: intentNote }, objections: objections.slice(0, 3), negotiation, bestFollowUp, tone };
}
