import { createSupabaseServerClient } from '@/lib/supabase/server';
import { eur, pct, type DealInputs, type DealOutputs } from '@/lib/deal-analyzer';

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
}

export async function runLeadAIAnalysis(leadId: string): Promise<LeadAnalysis | null> {
  const supabase = await createSupabaseServerClient();

  const { data: lead } = await supabase
    .from('leads')
    .select(
      `id, contact_id, status, source, budget_min, budget_max, timeline_to_buy, message,
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
    // No key configured (local dev without AI) — return a deterministic
    // placeholder so the UI flow still works end to end.
    return {
      score: 50,
      reasoning: 'AI not configured — set ANTHROPIC_API_KEY to enable scoring.',
      summary: 'AI summary unavailable in this environment.',
      next_steps: 'Follow up directly with the lead.',
    };
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
    return null;
  }

  const data = await response.json();
  const text = data.content?.map((c: any) => c.text ?? '').join('') ?? '{}';

  try {
    const cleaned = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
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

export interface DealAdvisory {
  summary: string;
  strengths: string[];
  weaknesses: string[];
  red_flags: string[];
  recommended_strategy: string;
  suggested_pricing: string;
}

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
    };
  } catch {
    return heuristicAdvisory(params);
  }
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
  };
}
