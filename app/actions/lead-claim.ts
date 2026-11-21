'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { onLeadAssigned } from '@/lib/automation-events';
import { syncAssignedLead } from '@/lib/lead-assign';
import { canAssignOthers, canClaimLeads } from '@/lib/sales-hub-shared';

type R = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function refresh(leadId: string) {
  revalidatePath('/sales/new'); revalidatePath('/sales/deals'); revalidatePath('/sales/follow-ups');
  revalidatePath('/crm/leads'); revalidatePath(`/crm/leads/${leadId}`);
}

/**
 * Ανάθεση ενός lead χωρίς υπεύθυνο. Γίνεται μόνο αν είναι ακόμη χωρίς υπεύθυνο
 * (δύο agents που πατούν μαζί «Ανάληψη» δεν το παίρνουν και οι δύο).
 */
async function take(leadId: string, to: string, by: string, note: string): Promise<R> {
  const supabase = (await createSupabaseServerClient()) as any;
  const now = new Date().toISOString();
  let res = await supabase.from('leads').update({ assigned_to: to, assigned_by: by, assigned_at: now }).eq('id', leadId).is('assigned_to', null).select('id');
  if (res.error) res = await supabase.from('leads').update({ assigned_to: to }).eq('id', leadId).is('assigned_to', null).select('id'); // πριν το 0020
  if (res.error) return { ok: false, error: res.error.message };
  if (!(res.data ?? []).length) return { ok: false, error: 'Το lead έχει ήδη υπεύθυνο.' };
  await syncAssignedLead(supabase, leadId, { to, by, note });
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'reassigned', metadata: { to, claimed: to === by } });
  if (to !== by) await onLeadAssigned(leadId, to);
  refresh(leadId);
  return { ok: true };
}

/** «Ανάληψη»: ο χρήστης γίνεται υπεύθυνος ενός νέου lead. */
export async function claimLead(leadId: string): Promise<R> {
  const me = await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(leadId ?? '')) return { ok: false, error: 'Άγνωστο lead.' };
  if (!canClaimLeads(me)) return { ok: false, error: 'Δεν έχετε δικαίωμα ανάληψης leads.' };
  return take(leadId, me.id, me.id, 'Ανάληψη');
}

/** Admin / Manager: ανάθεση νέου lead σε συνεργάτη. */
export async function assignNewLead(leadId: string, agentId: string): Promise<R> {
  const me = await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(leadId ?? '') || !UUID.test(agentId ?? '')) return { ok: false, error: 'Άγνωστο lead ή συνεργάτης.' };
  if (agentId === me.id) return claimLead(leadId);
  if (!canAssignOthers(me)) return { ok: false, error: 'Μόνο Admin ή Manager αναθέτει σε άλλον.' };
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: agent } = await supabase.from('profiles').select('id, role, is_active').eq('id', agentId).maybeSingle();
  if (!agent || agent.is_active === false || !['admin', 'sales', 'management'].includes(agent.role)) return { ok: false, error: 'Ο συνεργάτης δεν είναι ενεργός στις πωλήσεις.' };
  return take(leadId, agentId, me.id, 'Ανάθεση από Νέα leads');
}
