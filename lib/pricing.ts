import { logActivity } from '@/lib/activity';
import { cleanPlan, planProblem, scheduleFromPlan } from '@/lib/pricing-shared';

/**
 * Server half of pricing (βήμα 11β): payment plan → contract installments.
 * Used by «Δημιουργία δόσεων» and when a reservation becomes a contract.
 */
export async function buildSchedule(supabase: any, contractId: string): Promise<{ ok: true; count: number; projectId: string; unitId: string } | { ok: false; error: string }> {
  const { data: c } = await supabase.from('contracts').select('id, unit_id, total_price, created_at, reservation_id').eq('id', contractId).maybeSingle();
  if (!c) return { ok: false, error: 'Το συμβόλαιο δεν βρέθηκε.' };
  const { count } = await supabase.from('payment_schedules').select('id', { count: 'exact', head: true }).eq('contract_id', contractId);
  if (count) return { ok: false, error: 'Το συμβόλαιο έχει ήδη δόσεις.' };
  const { data: u } = await supabase.from('units').select('id, project_id, price, payment_plan').eq('id', c.unit_id).maybeSingle();
  if (!u) return { ok: false, error: 'Η μονάδα δεν βρέθηκε.' };
  const { data: p } = await supabase.from('projects').select('payment_plan').eq('id', u.project_id).maybeSingle();
  const plan = cleanPlan(u.payment_plan ?? p?.payment_plan ?? []);
  if (!plan.length || planProblem(plan)) return { ok: false, error: 'Δεν υπάρχει έγκυρο πρόγραμμα πληρωμών (Τιμοκατάλογος → Πρόγραμμα πληρωμών).' };
  const total = Number(c.total_price ?? u.price);
  if (!Number.isFinite(total) || total <= 0) return { ok: false, error: 'Το συμβόλαιο δεν έχει τιμή.' };
  let reservedDate: string | null = null;
  if (c.reservation_id) {
    const { data: r } = await supabase.from('reservations').select('reserved_at').eq('id', c.reservation_id).maybeSingle();
    reservedDate = r?.reserved_at ? String(r.reserved_at).slice(0, 10) : null;
  }
  const rows = scheduleFromPlan(plan, total, { contractDate: String(c.created_at ?? new Date().toISOString()).slice(0, 10), reservedDate })
    .map((s) => ({ ...s, contract_id: contractId }));
  const { error } = await supabase.from('payment_schedules').insert(rows);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'contract', entityId: contractId, action: 'schedule_created', metadata: { installments: rows.length } });
  return { ok: true, count: rows.length, projectId: u.project_id, unitId: u.id };
}
