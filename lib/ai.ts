import { createSupabaseServerClient } from '@/lib/supabase/server';
import { eur, pct, type DealInputs, type DealOutputs } from '@/lib/deal-analyzer';
import { computePriority } from '@/lib/priority';
import type { DealAdvisory, DraftedMessage, DraftIntent, AiSource } from '@/lib/ai-shared';

// Client-safe AI types live in lib/ai-shared.ts; re-exported for existing importers.
export type { DealAdvisory, DraftedMessage, DraftIntent, AiSource } from '@/lib/ai-shared';

/**
 * The one place AI calls happen in the system. Never call the model
 * directly from a Server Action or component — route through here so
 * prompts, parsing, and failure handling stay consistent as the CRM grows.
 */

interface LeadAnalysis {
  score: number;
  reasoning: string;
  summary: string;
  next_steps: string;
  source: AiSource;   // 'claude' when the model produced it, 'heuristic' otherwise
  confidence: number; // 0–1
}

export async function runLeadAIAnalysis(leadId: string): Promise<LeadAnalysis | null> {
  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase
    .from('leads')
    .select(
      `id, contact_id, status, source, budget_min, budget_max, timeline_to_buy, message,
       ai_score, last_contacted_at, created_at,
       contacts(full_name, email, nationality),
       projects:preferred_project_id(name)`
    )
    .eq('id', leadId)
    .single();

  if (!lead) return null;

  const { data: notes } = await supabase
    .from('notes')
    .select('body, created_at')
    .eq('entity_type', 'lead')
    .eq('entity_id', leadId)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: comms } = await supabase
    .from('contact_communications')
    .select('channel, direction, summary, occurred_at')
    .eq('contact_id', lead.contact_id ?? '')
    .order('occurred_at', { ascending: false })
    .limit(10);

  const context = buildContext(lead, notes ?? [], comms ?? []);

  if (!process.env.ANTHROPIC_API_KEY) {
    // No key configured — degrade gracefully to a genuine heuristic analysis
    // (like runDealAdvisory does) so the CRM stays useful before AI is enabled,
    // rather than a flat placeholder score.
    return heuristicLeadAnalysis(lead);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `You are a real estate sales analyst for a Cyprus property developer. Given this lead context, respond ONLY with JSON (no markdown, no preamble) matching this shape:
{"score": <0-100 integer, likelihood to convert>, "reasoning": "<1-2 sentences justifying the score>", "summary": "<3-4 sentence neutral summary of who this lead is and where things stand>", "next_steps": "<1-3 concrete, specific recommended next actions for the sales rep>"}

Lead context:
${context}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    // Claude unavailable (rate limit, outage, bad key) — degrade to the
    // deterministic read so the CRM stays intelligent, never blank.
    return heuristicLeadAnalysis(lead);
  }

  const data = await response.json();
  const text = data.content?.map((c: any) => c.text ?? '').join('') ?? '{}';

  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return { score: parsed.score, reasoning: parsed.reasoning, summary: parsed.summary, next_steps: parsed.next_steps, source: 'claude', confidence: 0.9 };
  } catch {
    // Model returned unparseable output — fall back to the heuristic rather than
    // nothing, so the agent still gets a useful read.
    return heuristicLeadAnalysis(lead);
  }
}

const NEXT_BY_STATUS: Record<string, string> = {
  new: 'Respond within 5 minutes on WhatsApp — speed-to-lead is the single biggest conversion lever. Qualify budget + timeline, then offer two viewing slots.',
  contacted: 'Book a viewing while interest is warm. Send the project brochure and propose two specific dates.',
  engaged: 'Move to a viewing or a call. Address open questions and confirm budget fit.',
  qualified: 'Schedule a viewing and prepare 2–3 matching units within their budget.',
  viewing: 'Confirm the viewing, send directions + brochure, and prepare tailored unit options.',
  offer: 'Follow up on the offer — reinforce the value and propose a call to resolve open points.',
  negotiating: 'Keep momentum: acknowledge their position, reinforce value, and propose a constructive next step.',
  reserved: 'Progress to contract — confirm the deposit and coordinate the paperwork.',
};

/** Deterministic lead read from the signals — used when no AI key is set, so the
 *  CRM still produces a useful score, summary and next step. Reuses the shared
 *  priority scorer (no duplicated heuristics). */
function heuristicLeadAnalysis(lead: any): LeadAnalysis {
  const { score: prio, reasons } = computePriority({
    status: lead.status, budget_min: lead.budget_min, budget_max: lead.budget_max,
    ai_score: lead.ai_score ?? null, last_contacted_at: lead.last_contacted_at ?? null, created_at: lead.created_at,
  });
  // Priority (0–130ish) → likelihood-to-convert (0–100), floored so a fresh lead isn't "0".
  const score = Math.max(20, Math.min(95, 35 + prio));

  const name = lead.contacts?.full_name ?? 'This lead';
  const nat = lead.contacts?.nationality ? `${lead.contacts.nationality}, ` : '';
  const budget = (lead.budget_min || lead.budget_max)
    ? `${eur(lead.budget_min ?? 0, { compact: true })}–${eur(lead.budget_max ?? 0, { compact: true })}`
    : 'budget not stated';
  const project = lead.projects?.name ? ` interested in ${lead.projects.name},` : '';
  const summary = `${name} (${nat}${lead.source})${project} at the "${lead.status}" stage. Budget ${budget}; timeline ${lead.timeline_to_buy ?? 'unspecified'}.` +
    (reasons.length ? ` Signals: ${reasons.map((r) => r.replace(/\s*\(\+\d+\)/, '')).join('; ')}.` : '');

  return {
    score,
    reasoning: reasons.length ? `Scored on ${reasons.length} signal(s): ${reasons.join(', ')}.` : 'Baseline score — limited signal so far; more activity will sharpen it.',
    summary,
    next_steps: NEXT_BY_STATUS[lead.status] ?? 'Follow up with a warm, specific message and propose a clear next step (a call or a viewing).',
    source: 'heuristic',
    // Confidence grows with the number of concrete signals we could score on.
    confidence: Math.min(0.8, 0.4 + reasons.length * 0.12),
  };
}

function buildContext(lead: any, notes: any[], comms: any[]): string {
  const lines = [
    `Contact: ${lead.contacts?.full_name ?? 'Unknown'} (${lead.contacts?.email ?? ''})`,
    `Nationality: ${lead.contacts?.nationality ?? 'unknown'}`,
    `Status: ${lead.status} | Source: ${lead.source}`,
    `Budget: ${lead.budget_min ?? '?'} - ${lead.budget_max ?? '?'}`,
    `Timeline to buy: ${lead.timeline_to_buy ?? 'unspecified'}`,
    `Interested project: ${lead.projects?.name ?? 'unspecified'}`,
    `Original message: ${lead.message ?? 'none'}`,
    '',
    'Recent notes:',
    ...notes.map((n) => `- ${n.body}`),
    '',
    'Recent communications:',
    ...comms.map((c) => `- [${c.channel}/${c.direction}] ${c.summary ?? ''}`),
  ];
  return lines.join('\n');
}

// ===== Deal Analyzer — acquisitions advisory =====

/**
 * Strategic advisory on a development deal. Routed through the same single AI
 * chokepoint as lead scoring. Falls back to a deterministic, numbers-driven
 * read when no key is configured, so the acquisitions workflow still produces
 * a useful verdict offline.
 */
export async function runDealAdvisory(params: {
  name: string;
  inputs: DealInputs;
  outputs: DealOutputs;
}): Promise<DealAdvisory> {
  const { name, inputs, outputs } = params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicAdvisory(params);
  }

  const context = [
    `Deal: ${name}`,
    `Zone: ${inputs.zone} | Plot: ${inputs.plotSizeSqm} m² | Density: ${inputs.buildingDensity} | Floors: ${inputs.floorsAllowed} | Road: ${inputs.roadAccess}`,
    `Planning restrictions: ${inputs.planningRestrictions || 'none noted'}`,
    `Buildable: ${Math.round(outputs.buildableSqm)} m² | Sellable: ${Math.round(outputs.sellableSqm)} m² | Units: ${outputs.estimatedUnits}`,
    `Effective price: ${eur(outputs.effectivePricePerSqm)}/m² (incl VAT) | Break-even price: ${eur(outputs.breakEvenPricePerSqm)}/m²`,
    `Net revenue: ${eur(outputs.netRevenue)} | Total dev cost: ${eur(outputs.totalDevelopmentCost)}`,
    `Net profit: ${eur(outputs.netProfit)} | ROI: ${pct(outputs.roi)} | Margin: ${pct(outputs.profitMargin)}`,
    `Risk — overall ${outputs.risk.band} (${Math.round(outputs.risk.overall)}/100): market ${Math.round(outputs.risk.market)}, permit ${Math.round(outputs.risk.permit)}, construction ${Math.round(outputs.risk.construction)}, liquidity ${Math.round(outputs.risk.liquidity)}`,
  ].join('\n');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 900,
      messages: [
        {
          role: 'user',
          content: `You are the acquisitions analyst for Oramira, a Cyprus luxury property developer, advising the investment committee on whether to buy a plot of land. Respond ONLY with JSON (no markdown, no preamble) matching this shape:
{"summary": "<3-4 sentence verdict on the opportunity>", "strengths": ["<short point>", ...], "weaknesses": ["<short point>", ...], "red_flags": ["<deal-breaker or thing to verify before purchase>", ...], "recommended_strategy": "<1-3 sentences: how to approach this deal>", "suggested_pricing": "<1-2 sentences: pricing/sales strategy and any price per m² guidance>"}

Be specific and quantitative, reference the figures, and be willing to advise against the deal if the numbers are weak.

Deal analysis:
${context}`,
        },
      ],
    }),
  });

  if (!response.ok) return heuristicAdvisory(params);

  const data = await response.json();
  const text = data.content?.map((c: any) => c.text ?? '').join('') ?? '{}';
  try {
    const parsed = JSON.parse(text.replace(/```json|```/g, '').trim());
    return {
      summary: parsed.summary ?? '',
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      red_flags: parsed.red_flags ?? [],
      recommended_strategy: parsed.recommended_strategy ?? '',
      suggested_pricing: parsed.suggested_pricing ?? '',
      source: 'claude',
    };
  } catch {
    return heuristicAdvisory(params);
  }
}


const INTENT_BRIEF: Record<DraftIntent, string> = {
  follow_up: 'Write a warm, non-pushy follow-up that re-opens the conversation and offers a clear next step (a call or a viewing).',
  objection: 'Handle the buyer’s likely objections (price, financing, process, timing, distance) with empathy and concrete reassurance. Address concerns visible in the history.',
  viewing_reminder: 'Send a friendly reminder/confirmation for an upcoming property viewing, including a gentle prompt to confirm the time.',
  negotiation: 'Support the negotiation: acknowledge their position, reinforce the value, and propose a constructive path forward (without giving away discounts the agent hasn’t approved).',
  nurture: 'Share value about the project and the Cyprus market to keep a cooling lead engaged, with no sales pressure.',
};

const INTENT_LANG = (language?: string | null) =>
  language === 'ru' ? ' Write the message in Russian.' : language === 'el' ? ' Write the message in Greek.' : '';

/**
 * Drafts a context-aware message for a lead on a given channel and intent
 * (follow-up, objection handling, viewing reminder, negotiation, nurture).
 * Falls back to a sensible template when no AI key is configured, so the
 * assistant always returns something usable.
 */
export async function draftLeadMessage(params: {
  name: string;
  project: string;
  status: string;
  channel: 'whatsapp' | 'email';
  intent?: DraftIntent;
  agent?: string;
  language?: string | null;
  buyerType?: string | null;
  budget?: string | null;
  context?: string;
}): Promise<DraftedMessage> {
  const { name, project, status, channel, agent = 'the Oramira team', context } = params;
  const intent: DraftIntent = params.intent ?? 'follow_up';

  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicDraft(params, intent);
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [
        {
          role: 'user',
          content: `You are ${agent}, a sales agent for Oramira, a Cyprus luxury property developer. Draft a ${channel} message to a lead. Goal: ${INTENT_BRIEF[intent]}${INTENT_LANG(params.language)}
Respond ONLY with JSON: {"subject": "<email subject, omit for whatsapp>", "message": "<the message; HTML for email, plain text for whatsapp>"}.

Lead: ${name}
Interested in: ${project}
Pipeline stage: ${status}${params.buyerType ? `\nBuyer type: ${params.buyerType}` : ''}${params.budget ? `\nBudget: ${params.budget}` : ''}${context ? `\n\nRecent history (newest first):\n${context}` : ''}

Be specific to this lead's history and stage. Keep it natural and human — never robotic or pushy.`,
        },
      ],
    }),
  });
  if (!response.ok) return heuristicDraft(params, intent);
  try {
    const data = await response.json();
    const text = (data.content?.map((c: any) => c.text ?? '').join('') ?? '{}').replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(text);
    if (!parsed.message) return heuristicDraft(params, intent);
    return { subject: parsed.subject, message: parsed.message, source: 'claude' };
  } catch {
    return heuristicDraft(params, intent);
  }
}

/**
 * Intent-aware deterministic draft — the safety net when Claude is unavailable.
 * Each intent gets a genuinely different, on-brand message per channel (not one
 * generic follow-up), so an agent can send it as-is and never feel the AI is
 * down. Claude, when available, tailors to the full history + language; this
 * keeps the workflow moving otherwise.
 */
function heuristicDraft(params: { name: string; project: string; channel: 'whatsapp' | 'email'; agent?: string }, intent: DraftIntent): DraftedMessage {
  const { name, project, channel, agent = 'the Oramira team' } = params;
  const T: Record<DraftIntent, { wa: string; subject: string; email: string }> = {
    follow_up: {
      wa: `Hi ${name}, just following up on ${project} — would you like me to arrange a viewing or answer any questions? Happy to find a time that suits you.`,
      subject: `Following up on ${project}`,
      email: `Dear ${name},<p>I wanted to follow up on your interest in ${project}. I'd be glad to arrange a viewing or answer any questions — simply reply here and we'll find a time that suits you.</p><p>Warm regards,<br/>${agent}</p>`,
    },
    objection: {
      wa: `Hi ${name}, I completely understand wanting to be sure about ${project}. Whether it's the price, financing or the process, I'm happy to walk you through the details — would a short call help?`,
      subject: `Happy to answer your questions on ${project}`,
      email: `Dear ${name},<p>It's only natural to want clarity before a decision on ${project}. Whether your questions are about pricing, financing, the buying process or timing, I'd be glad to talk them through — often a short call clears everything up.</p><p>When would suit you?</p><p>Best,<br/>${agent}</p>`,
    },
    viewing_reminder: {
      wa: `Hi ${name}, looking forward to your viewing at ${project}. Could you confirm the time still works for you? I'll send directions beforehand.`,
      subject: `Your upcoming viewing at ${project}`,
      email: `Dear ${name},<p>A friendly reminder about your upcoming viewing at ${project}. Could you confirm the time still works? I'll send directions and everything you need ahead of time.</p><p>Looking forward to meeting you,<br/>${agent}</p>`,
    },
    negotiation: {
      wa: `Hi ${name}, thank you for your offer on ${project}. I want to find a way forward that works for you — let me review the details and propose the best next step. Could we speak later today?`,
      subject: `Your offer on ${project}`,
      email: `Dear ${name},<p>Thank you for your offer on ${project}. I appreciate your position and genuinely want to find a path that works for you while reflecting the value of the home. Let me review the details and come back with a constructive next step — could we speak later today?</p><p>Best,<br/>${agent}</p>`,
    },
    nurture: {
      wa: `Hi ${name}, thought you might like a quick update on ${project} and the Cyprus market — no rush at all, just keeping you in the loop. Let me know if anything catches your eye.`,
      subject: `A quick update on ${project}`,
      email: `Dear ${name},<p>I thought you might appreciate a brief update on ${project} and the Cyprus market. There's no rush at all — I simply wanted to keep you in the loop as things develop. If anything catches your eye, I'm here.</p><p>Warm regards,<br/>${agent}</p>`,
    },
  };
  const t = T[intent];
  return channel === 'email'
    ? { message: t.email, subject: t.subject, source: 'heuristic' }
    : { message: t.wa, source: 'heuristic' };
}

/** Deterministic advisory from the numbers — used when no AI key is set. */
function heuristicAdvisory({ inputs, outputs }: { name: string; inputs: DealInputs; outputs: DealOutputs }): DealAdvisory {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const red_flags: string[] = [];

  if (outputs.profitMargin >= 0.2) strengths.push(`Healthy net margin of ${pct(outputs.profitMargin)}.`);
  else if (outputs.profitMargin >= 0.12) weaknesses.push(`Modest margin of ${pct(outputs.profitMargin)} — limited buffer for cost overruns.`);
  else red_flags.push(`Thin margin of ${pct(outputs.profitMargin)} — the deal is fragile to any price or cost slippage.`);

  if (outputs.roi >= 0.25) strengths.push(`Strong ROI of ${pct(outputs.roi)} on total development cost.`);
  else if (outputs.roi < 0.15) weaknesses.push(`ROI of ${pct(outputs.roi)} is below a typical development hurdle.`);

  if (outputs.risk.permit >= 55) red_flags.push('Elevated permitting risk — confirm zoning and restrictions before committing.');
  if (outputs.risk.liquidity >= 55) weaknesses.push(`Absorption risk on ${outputs.estimatedUnits} units — phase the release.`);
  if (outputs.risk.construction >= 55) weaknesses.push('Construction risk is elevated — stress-test the build cost and contingency.');
  if (inputs.contingencyRate < 0.07) red_flags.push(`Contingency of only ${pct(inputs.contingencyRate)} is light for this scope.`);
  if (strengths.length === 0) strengths.push(`Buildable area of ${Math.round(outputs.buildableSqm)} m² across ~${outputs.estimatedUnits} units.`);

  const verdict = outputs.netProfit > 0 && outputs.roi >= 0.18 ? 'broadly attractive' : outputs.netProfit > 0 ? 'marginal' : 'unviable as modelled';
  return {
    summary: `This ${inputs.zone} opportunity looks ${verdict}: ${eur(outputs.netProfit)} net profit on ${eur(outputs.totalDevelopmentCost)} of cost (ROI ${pct(outputs.roi)}, margin ${pct(outputs.profitMargin)}), at ${outputs.risk.band.toLowerCase()} overall risk. Break-even price is ${eur(outputs.breakEvenPricePerSqm)}/m² against an effective ${eur(outputs.effectivePricePerSqm)}/m².`,
    strengths,
    weaknesses,
    red_flags,
    recommended_strategy:
      outputs.roi >= 0.18
        ? 'Proceed to due diligence: lock the land price, verify the building coefficient with the planning authority, and firm up construction quotes before exchange.'
        : 'Renegotiate the land price or revisit the unit mix and pricing before proceeding — the current basis does not clear a comfortable return.',
    suggested_pricing: `Hold sale pricing at or above ${eur(outputs.breakEvenPricePerSqm * 1.2)}/m² to protect the margin; lead with off-plan reservations to de-risk absorption.`,
    source: 'heuristic',
  };
}
