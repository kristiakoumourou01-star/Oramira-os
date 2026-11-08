'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { ACTIVITY_KEYS } from '@/lib/activity-types';

type Result = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const refresh = (leadId?: string | null) => { revalidatePath('/crm/leads'); if (leadId) revalidatePath(`/crm/leads/${leadId}`); };

/** Αλλαγή ημερομηνίας/σημείωσης/υπεύθυνου ενός follow-up (αναβολή κ.λπ.). */
export async function updateFollowUp(id: string, p: { dueAt?: string; note?: string; assignedTo?: string | null }): Promise<Result> {
  await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(id ?? '')) return { ok: false, error: 'Άγνωστο follow-up.' };
  const patch: Record<string, unknown> = {};
  if (p.dueAt) { const t = Date.parse(p.dueAt); if (!Number.isFinite(t)) return { ok: false, error: 'Μη έγκυρη ημερομηνία.' }; patch.due_at = new Date(t).toISOString(); patch.reminder_sent_at = null; }
  if (p.note !== undefined) patch.note = p.note.trim().slice(0, 300) || 'Follow-up';
  if (p.assignedTo !== undefined) patch.assigned_to = p.assignedTo && UUID.test(p.assignedTo) ? p.assignedTo : null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.from('follow_up_tasks').update(patch as any).eq('id', id).select('lead_id').single();
  if (error) return { ok: false, error: error.message };
  if (p.dueAt && data?.lead_id) await logActivity({ entityType: 'lead', entityId: data.lead_id, action: 'follow_up_rescheduled', metadata: { due_at: patch.due_at } });
  refresh(data?.lead_id);
  return { ok: true };
}

/** Ολοκλήρωση, με προαιρετικά την επόμενη κίνηση (νέο follow-up) και σημείωση αποτελέσματος. */
export async function completeAndNext(id: string, next?: { dueAt: string; note: string } | null, outcome?: string): Promise<Result> {
  const me = await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(id ?? '')) return { ok: false, error: 'Άγνωστο follow-up.' };
  const supabase = await createSupabaseServerClient();
  let { data: ft, error } = await (supabase as any).from('follow_up_tasks').update({ is_done: true, done_at: new Date().toISOString() }).eq('id', id).select('lead_id, contact_id, assigned_to, note').single();
  if (error) ({ data: ft, error } = await supabase.from('follow_up_tasks').update({ is_done: true }).eq('id', id).select('lead_id, contact_id, assigned_to, note').single()); // πριν το 0075
  if (error) return { ok: false, error: error.message };
  if (outcome?.trim() && ft?.lead_id) {
    await supabase.from('notes').insert({ entity_type: 'lead', entity_id: ft.lead_id, author_id: me.id, body: `✓ ${ft.note ?? 'Follow-up'}: ${outcome.trim().slice(0, 1000)}` });
  }
  if (ft?.lead_id) await supabase.from('leads').update({ last_contacted_at: new Date().toISOString() } as any).eq('id', ft.lead_id);
  if (next?.dueAt && ft) {
    const t = Date.parse(next.dueAt);
    if (Number.isFinite(t)) {
      await supabase.from('follow_up_tasks').insert({ lead_id: ft.lead_id, contact_id: ft.contact_id, assigned_to: ft.assigned_to ?? me.id, due_at: new Date(t).toISOString(), note: next.note.trim().slice(0, 300) || 'Follow-up' });
    }
  }
  if (ft?.lead_id) await logActivity({ entityType: 'lead', entityId: ft.lead_id, action: 'follow_up_done', metadata: { next: next?.dueAt ?? null } });
  refresh(ft?.lead_id);
  return { ok: true };
}

/** Νέα κίνηση για ένα lead (από το πλαϊνό παράθυρο ή τη λίστα). */
export async function addFollowUp(leadId: string, dueAt: string, note: string, assignedTo?: string | null, opts?: { type?: string; priority?: string | null; durationMin?: number | null; location?: string | null }): Promise<Result> {
  const me = await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(leadId ?? '')) return { ok: false, error: 'Άγνωστο lead.' };
  const t = Date.parse(dueAt);
  if (!Number.isFinite(t)) return { ok: false, error: 'Διαλέξτε ημερομηνία.' };
  const supabase = await createSupabaseServerClient();
  const { data: lead } = await supabase.from('leads').select('contact_id, assigned_to').eq('id', leadId).single();
  if (!lead) return { ok: false, error: 'Το lead δεν βρέθηκε.' };
  const row: Record<string, unknown> = { lead_id: leadId, contact_id: lead.contact_id, assigned_to: assignedTo ?? lead.assigned_to ?? me.id, due_at: new Date(t).toISOString(), note: note.trim().slice(0, 300) || 'Follow-up' };
  if (opts?.type && ACTIVITY_KEYS.includes(opts.type)) row.type = opts.type;
  if (opts?.priority && ['low', 'normal', 'high'].includes(opts.priority)) row.priority = opts.priority;
  if (opts?.durationMin && Number.isFinite(opts.durationMin)) row.duration_min = Math.min(1440, Math.max(5, Math.round(opts.durationMin)));
  if (opts?.location) row.location = opts.location.trim().slice(0, 200) || null;
  let { error } = await (supabase as any).from('follow_up_tasks').insert(row);
  if (error && opts) { // πριν το migration 0075
    delete row.type; delete row.priority; delete row.duration_min; delete row.location;
    ({ error } = await (supabase as any).from('follow_up_tasks').insert(row));
  }
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'follow_up_scheduled', metadata: { due_at: new Date(t).toISOString() } });
  refresh(leadId);
  return { ok: true };
}
