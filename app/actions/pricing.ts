'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { cleanPlan, planProblem, type PlanStep } from '@/lib/pricing-shared';
import { buildSchedule } from '@/lib/pricing';

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const missing = (msg: string) => /does not exist|schema cache|Could not find/i.test(msg);
const MIG = 'Λείπει το migration 0065 στη βάση (supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql).';

export interface PriceHistoryRow { id: string; oldPrice: number | null; newPrice: number | null; reason: string | null; source: string; by: string | null; at: string }

/** Change prices (one or many) with an optional reason. History is written by the DB trigger. */
export async function setPrices(projectId: string, changes: { id: string; price: number }[], reason?: string): Promise<{ ok: true; changed: number } | { ok: false; error: string }> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(projectId ?? '')) return { ok: false, error: 'Άγνωστο έργο.' };
  const clean = (Array.isArray(changes) ? changes : [])
    .filter((c) => UUID.test(c?.id ?? '') && Number.isFinite(Number(c?.price)) && Number(c.price) >= 0 && Number(c.price) < 1e12)
    .map((c) => ({ id: c.id, price: Math.round(Number(c.price) * 100) / 100 }));
  if (!clean.length) return { ok: false, error: 'Δεν υπάρχουν αλλαγές τιμών.' };
  if (clean.length > 3000) return { ok: false, error: 'Πολλές αλλαγές μαζί (έως 3.000).' };
  const supabase = await createSupabaseServerClient();
  // Only units of this project (RLS does the rest).
  const { data: own } = await supabase.from('units').select('id').eq('project_id', projectId).in('id', clean.map((c) => c.id));
  const ok = new Set(((own ?? []) as { id: string }[]).map((u) => u.id));
  const mine = clean.filter((c) => ok.has(c.id));
  const { data, error } = await (supabase as any).rpc('set_unit_prices', { p_changes: mine, p_reason: (reason ?? '').trim().slice(0, 200) || null, p_source: mine.length > 1 ? 'bulk' : 'manual' });
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  await logActivity({ entityType: 'project', entityId: projectId, action: 'prices_changed', metadata: { count: Number(data ?? 0), reason: reason ?? null } });
  revalidatePath(`/projects/${projectId}/prices`);
  revalidatePath(`/projects/${projectId}`);
  return { ok: true, changed: Number(data ?? 0) };
}

/** Price changes of one unit, newest first. */
export async function getPriceHistory(unitId: string): Promise<PriceHistoryRow[]> {
  await requirePermission('projects', 'view');
  if (!UUID.test(unitId ?? '')) return [];
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any).from('unit_price_history')
    .select('id, old_price, new_price, reason, source, changed_at, profiles:changed_by(full_name)')
    .eq('unit_id', unitId).order('changed_at', { ascending: false }).limit(50);
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => ({
    id: r.id, oldPrice: r.old_price == null ? null : Number(r.old_price), newPrice: r.new_price == null ? null : Number(r.new_price),
    reason: r.reason, source: r.source, by: r.profiles?.full_name ?? null, at: r.changed_at,
  }));
}

/** Save the current prices as a named version (to send or keep on file). */
export async function savePriceList(projectId: string, name: string, note?: string): Promise<Result> {
  const profile = await requirePermission('projects', 'edit');
  if (!UUID.test(projectId ?? '')) return { ok: false, error: 'Άγνωστο έργο.' };
  const n = (name ?? '').trim().slice(0, 120);
  if (!n) return { ok: false, error: 'Δώστε όνομα στην έκδοση (π.χ. «Τιμοκατάλογος Νοεμβρίου»).' };
  const supabase = await createSupabaseServerClient();
  const { data: units } = await supabase.from('units')
    .select('id, unit_number, floor, type, sqm, bedrooms, price, status, buildings(name)').eq('project_id', projectId).order('unit_number');
  const items = ((units ?? []) as any[]).map((u) => ({
    unit_id: u.id, unit_number: u.unit_number, building: u.buildings?.name ?? null, floor: u.floor, type: u.type,
    sqm: u.sqm, bedrooms: u.bedrooms, price: u.price, status: u.status,
  }));
  const { error } = await (supabase as any).from('price_lists').insert({ project_id: projectId, name: n, note: (note ?? '').trim().slice(0, 500) || null, items, created_by: profile.id });
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  await logActivity({ entityType: 'project', entityId: projectId, action: 'price_list_saved', metadata: { name: n, units: items.length } });
  revalidatePath(`/projects/${projectId}/prices`);
  return { ok: true };
}

/** The project's default payment plan (must add up to 100%). */
export async function saveProjectPlan(projectId: string, plan: PlanStep[]): Promise<Result> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(projectId ?? '')) return { ok: false, error: 'Άγνωστο έργο.' };
  const p = cleanPlan(plan);
  const problem = planProblem(p);
  if (problem) return { ok: false, error: problem };
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('projects').update({ payment_plan: p }).eq('id', projectId);
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  await logActivity({ entityType: 'project', entityId: projectId, action: 'payment_plan_saved' });
  revalidatePath(`/projects/${projectId}/prices`);
  revalidatePath(`/projects/${projectId}`, 'layout');
  return { ok: true };
}

/** A unit's own plan; null = follow the project's plan again. */
export async function saveUnitPlan(unitId: string, projectId: string, plan: PlanStep[] | null): Promise<Result> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(unitId ?? '')) return { ok: false, error: 'Άγνωστη μονάδα.' };
  let value: PlanStep[] | null = null;
  if (plan) { value = cleanPlan(plan); const problem = planProblem(value); if (problem) return { ok: false, error: problem }; }
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('units').update({ payment_plan: value }).eq('id', unitId);
  if (error) return { ok: false, error: missing(error.message) ? MIG : error.message };
  await logActivity({ entityType: 'unit', entityId: unitId, action: value ? 'payment_plan_custom' : 'payment_plan_reset' });
  revalidatePath(`/projects/${projectId}/units/${unitId}`);
  return { ok: true };
}

/**
 * Turn the unit's plan into the contract's installments. Only when the contract
 * has none yet (never overwrites what was agreed).
 */
export async function createScheduleFromPlan(contractId: string): Promise<Result & { count?: number }> {
  await requirePermission('projects', 'edit');
  if (!UUID.test(contractId ?? '')) return { ok: false, error: 'Άγνωστο συμβόλαιο.' };
  const supabase = await createSupabaseServerClient();
  const r = await buildSchedule(supabase, contractId);
  if (!r.ok) return r;
  revalidatePath(`/projects/${r.projectId}/units/${r.unitId}`);
  return { ok: true, count: r.count };
}
