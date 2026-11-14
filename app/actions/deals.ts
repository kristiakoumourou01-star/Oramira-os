'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { analyzeDeal, DEFAULT_DEAL_INPUTS, type DealInputs, type DealOutputs } from '@/lib/deal-analyzer';
import { runDealAdvisory } from '@/lib/ai';
import { revalidatePath } from 'next/cache';
import { notifyUser } from '@/lib/notifications';

/**
 * Deal Analyzer — Server Actions. Internal-only: deals/deal_scenarios are
 * staff-only under RLS (migration 0007), and requireRole is the matching
 * defense-in-depth. The server always RE-COMPUTES outputs from the inputs via
 * the shared engine — the client's computed numbers are never trusted or
 * persisted directly.
 */

const STAFF: ['admin', 'sales', 'management'] = ['admin', 'sales', 'management'];

/** Maps a freshly-computed model onto the deals row (jsonb state + mirrored figures). */
function dealColumns(inputs: DealInputs, outputs: DealOutputs) {
  return {
    inputs: inputs as any,
    outputs: outputs as any,
    unit_mix: inputs.unitMix as any,
    risk_breakdown: outputs.risk as any,
    total_buildable_sqm: outputs.buildableSqm,
    sellable_sqm: outputs.sellableSqm,
    estimated_units: outputs.estimatedUnits,
    gdv: outputs.grossRevenueInclVat,
    total_project_cost: outputs.totalDevelopmentCost,
    gross_profit: outputs.grossProfit,
    net_profit: outputs.netProfit,
    roi: outputs.roi,
    profit_margin: outputs.profitMargin,
    break_even_price_per_sqm: outputs.breakEvenPricePerSqm,
    risk_score: Math.round(outputs.risk.overall),
  };
}

export async function createDeal(params: { name: string; projectId?: string }) {
  const profile = await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const inputs = DEFAULT_DEAL_INPUTS;
  const outputs = analyzeDeal(inputs);

  const { data, error } = await supabase
    .from('deals')
    .insert({
      name: params.name,
      project_id: params.projectId ?? null,
      created_by: profile.id,
      status: 'draft',
      ...dealColumns(inputs, outputs),
    } as any)
    .select('id')
    .single();
  if (error) throw error;

  await logActivity({ entityType: 'deal', entityId: data.id, action: 'created' });
  revalidatePath('/deal-analyzer');
  return data.id as string;
}

export async function saveDeal(dealId: string, inputs: DealInputs) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const outputs = analyzeDeal(inputs); // recompute server-side — never trust client outputs

  await supabase
    .from('deals')
    .update({ ...dealColumns(inputs, outputs), updated_at: new Date().toISOString() } as any)
    .eq('id', dealId);

  await logActivity({ entityType: 'deal', entityId: dealId, action: 'updated' });
  revalidatePath(`/deal-analyzer/${dealId}`);
  revalidatePath('/deal-analyzer');
}

export async function updateDealStatus(dealId: string, status: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await supabase.from('deals').update({ status }).eq('id', dealId);
  await logActivity({ entityType: 'deal', entityId: dealId, action: 'status_changed', metadata: { to: status } });
  revalidatePath(`/deal-analyzer/${dealId}`);
  revalidatePath('/deal-analyzer');
}

export async function saveScenario(dealId: string, name: string, inputs: DealInputs) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const outputs = analyzeDeal(inputs);
  const { error } = await supabase.from('deal_scenarios').insert({
    deal_id: dealId,
    name,
    overrides: inputs as any,
    computed_outputs: outputs as any,
  });
  if (error) throw error;
  revalidatePath(`/deal-analyzer/${dealId}`);
}

export async function deleteScenario(scenarioId: string, dealId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await supabase.from('deal_scenarios').delete().eq('id', scenarioId);
  revalidatePath(`/deal-analyzer/${dealId}`);
}

export async function deleteDeal(dealId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  await (supabase as any).from('deal_scenarios').delete().eq('deal_id', dealId); // τα σενάρια του deal
  const { error } = await supabase.from('deals').delete().eq('id', dealId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'deal', entityId: dealId, action: 'deleted' });
  revalidatePath('/deal-analyzer');
  return { ok: true };
}

/** Μετονομασία ανάλυσης. */
export async function renameDeal(dealId: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(STAFF);
  const n = name.trim().slice(0, 120);
  if (!n) return { ok: false, error: 'Δώστε όνομα.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('deals').update({ name: n } as any).eq('id', dealId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/deal-analyzer'); revalidatePath(`/deal-analyzer/${dealId}`);
  return { ok: true };
}

/** Αντίγραφο ανάλυσης (ίδια δεδομένα, νέο όνομα, ως Draft, χωρίς σύνδεση με έργο). */
export async function duplicateDeal(dealId: string): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const profile = await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  const { data: d, error } = await (supabase as any).from('deals').select('*').eq('id', dealId).single();
  if (error || !d) return { ok: false, error: 'Η ανάλυση δεν βρέθηκε.' };
  const { id: _id, created_at: _c, updated_at: _u, project_id: _p, ...rest } = d;
  const { data: ins, error: e2 } = await (supabase as any).from('deals').insert({ ...rest, name: `${d.name} (αντίγραφο)`.slice(0, 120), status: 'draft', created_by: profile.id }).select('id').single();
  if (e2) return { ok: false, error: e2.message };
  revalidatePath('/deal-analyzer');
  return { ok: true, id: ins.id };
}

/**
 * Convert an analysed deal into a live project — the acquisitions → delivery
 * handoff. Seeds a project from the deal, links them both ways, and marks the
 * deal acquired. Idempotent: if already linked, returns the existing project.
 */
export async function convertDealToProject(dealId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: deal, error } = await supabase
    .from('deals')
    .select('id, name, project_id, inputs')
    .eq('id', dealId)
    .single();
  if (error || !deal) throw new Error('Deal not found');
  if (deal.project_id) return deal.project_id as string;

  const zone = (deal.inputs as any)?.zone as string | undefined;
  const slug = `${deal.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}-${Math.random().toString(36).slice(2, 6)}`;

  const { data: project, error: pErr } = await supabase
    .from('projects')
    .insert({ name: deal.name, slug, status: 'planning', description: zone ? `Acquired via Deal Analyzer · zone ${zone}` : 'Acquired via Deal Analyzer' } as any)
    .select('id')
    .single();
  if (pErr) throw pErr;

  // Μονάδες από το unit mix της ανάλυσης (τιμή χωρίς ΦΠΑ = m² × €/m²).
  const inp = (deal.inputs ?? {}) as any;
  const mix: any[] = Array.isArray(inp.unitMix) ? inp.unitMix : [];
  const houseLike = Number(inp.efficiencyRatio ?? 0.82) >= 0.95;
  const rows: any[] = []; let n = 0;
  for (const m of mix) for (let i = 0; i < Math.min(200, Number(m.count ?? 0)); i++) {
    n++;
    const sqm = Number(m.avgSqm ?? 0) || null; const ppm = Number(m.pricePerSqm ?? inp.salePricePerSqm ?? 0) || null;
    const beds = Number.parseInt(String(m.type ?? ''), 10);
    rows.push({ project_id: project.id, unit_number: `${houseLike ? 'Κατοικία' : 'Μονάδα'} ${n}`, type: houseLike ? 'house' : 'apartment', sqm, price: sqm && ppm ? Math.round(sqm * ppm) : null, bedrooms: Number.isFinite(beds) ? beds : null, status: 'available' });
  }
  if (rows.length) await (supabase as any).from('units').insert(rows);

  await supabase.from('deals').update({ project_id: project.id, status: 'acquired' }).eq('id', dealId);
  await logActivity({ entityType: 'deal', entityId: dealId, action: 'converted_to_project', metadata: { projectId: project.id } });
  await logActivity({ entityType: 'project', entityId: project.id, action: 'created_from_deal', metadata: { dealId } });

  revalidatePath(`/deal-analyzer/${dealId}`);
  revalidatePath('/projects');
  return project.id as string;
}

/** Generate (or refresh) the AI advisory for a deal. */
export async function runDealAI(dealId: string) {
  await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();

  const { data: deal } = await supabase.from('deals').select('name, inputs').eq('id', dealId).single();
  if (!deal) throw new Error('Deal not found');

  const inputs = (deal.inputs ?? DEFAULT_DEAL_INPUTS) as unknown as DealInputs;
  const outputs = analyzeDeal(inputs);
  const advisory = await runDealAdvisory({ name: deal.name, inputs, outputs });

  await supabase
    .from('deals')
    .update({
      ai_summary: advisory.summary,
      ai_strengths: advisory.strengths as any,
      ai_weaknesses: advisory.weaknesses as any,
      ai_red_flags: advisory.red_flags as any,
      ai_recommended_strategy: advisory.recommended_strategy,
      ai_suggested_pricing: advisory.suggested_pricing,
      ai_generated_at: new Date().toISOString(),
    })
    .eq('id', dealId);

  await logActivity({ entityType: 'deal', entityId: dealId, action: 'ai_advisory_generated' });
  revalidatePath(`/deal-analyzer/${dealId}`);
  return advisory;
}

/**
 * «Αποστολή για έγκριση»: τρέχει την ανάλυση (AI advisory) και βάζει την ανάλυση
 * σε «Σε αναμονή έγκρισης»· ειδοποιεί admin / management.
 */
export async function submitDealForApproval(dealId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireRole(STAFF);
  const supabase = await createSupabaseServerClient();
  try { await runDealAI(dealId); } catch { /* η ανάλυση αριθμών υπάρχει ήδη· το AI είναι προαιρετικό */ }
  const { data: d, error } = await supabase.from('deals').update({ status: 'reviewing' }).eq('id', dealId).select('name').single();
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'deal', entityId: dealId, action: 'submitted_for_approval' });
  const { data: approvers } = await supabase.from('profiles').select('id').in('role', ['admin', 'management']);
  for (const a of approvers ?? []) if (a.id !== me.id) await notifyUser({ userId: a.id, title: 'Deal για έγκριση', body: `«${d?.name ?? ''}» περιμένει έγκριση στο Deal Analyzer.`, link: `/deal-analyzer/${dealId}`, event: 'deal_approval' }).catch(() => {});
  revalidatePath(`/deal-analyzer/${dealId}`); revalidatePath('/deal-analyzer');
  return { ok: true };
}

/** Απόφαση admin / management. Η έγκριση δημιουργεί αυτόματα το έργο (με τις μονάδες του unit mix). */
export async function decideDeal(dealId: string, decision: 'approved' | 'rejected' | 'on_hold'): Promise<{ ok: true; projectId?: string } | { ok: false; error: string }> {
  await requireRole(['admin', 'management']);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('deals').update({ status: decision }).eq('id', dealId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'deal', entityId: dealId, action: `decision_${decision}` });
  let projectId: string | undefined;
  if (decision === 'approved') {
    try { projectId = await convertDealToProject(dealId); } catch (e) { return { ok: false, error: e instanceof Error ? e.message : 'Το έργο δεν δημιουργήθηκε.' }; }
  }
  revalidatePath(`/deal-analyzer/${dealId}`); revalidatePath('/deal-analyzer');
  return { ok: true, projectId };
}
