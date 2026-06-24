'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { runLeadAIAnalysis } from '@/lib/ai';
import { createReservation } from '@/app/actions/reservations';
import { revalidatePath } from 'next/cache';

/**
 * Creates a lead from the internal CRM. Goes through the SAME
 * find_or_create_contact() chokepoint as the public website intake route —
 * this is what guarantees a person created manually by a sales rep and a
 * person who later fills out the website form resolve to one contact.
 */
export async function createLead(params: {
  fullName: string;
  email: string;
  phone?: string;
  source: string;
  budgetMin?: number;
  budgetMax?: number;
  preferredProjectId?: string;
  timelineToBuy?: string;
  message?: string;
}) {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: contactId, error: contactError } = await supabase.rpc('find_or_create_contact', {
    p_email: params.email,
    p_name: params.fullName,
    p_phone: params.phone ?? null,
  });
  if (contactError) throw contactError;

  await supabase.from('contacts').update({ is_lead: true }).eq('id', contactId);

  const { data: lead, error } = await supabase
    .from('leads')
    .insert({
      contact_id: contactId,
      source: params.source,
      budget_min: params.budgetMin ?? null,
      budget_max: params.budgetMax ?? null,
      preferred_project_id: params.preferredProjectId ?? null,
      timeline_to_buy: params.timelineToBuy ?? null,
      message: params.message ?? null,
      assigned_to: profile.id,
    })
    .select()
    .single();

  if (error) throw error;
  // Postgres trigger (on_lead_created) handles the activity log entry and
  // the default follow-up task — see migration 0006.

  revalidatePath('/crm/leads');
  return lead;
}

export async function updateLeadStatus(leadId: string, status: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: current } = await supabase.from('leads').select('status').eq('id', leadId).single();

  await supabase.from('leads').update({ status }).eq('id', leadId);
  await logActivity({
    entityType: 'lead',
    entityId: leadId,
    action: 'status_changed',
    metadata: { from: current?.status, to: status },
  });

  revalidatePath(`/crm/${leadId}`);
  revalidatePath('/crm/leads');
}

export async function assignLead(leadId: string, assignedTo: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('leads').update({ assigned_to: assignedTo }).eq('id', leadId);
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'reassigned' });
  revalidatePath('/crm/leads');
}

export async function addNote(entityType: string, entityId: string, body: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();

  await supabase.from('notes').insert({
    entity_type: entityType,
    entity_id: entityId,
    author_id: auth.user?.id,
    body,
  });
  await logActivity({ entityType, entityId, action: 'note_added' });
  revalidatePath(`/crm/${entityId}`);
}

/** Logs a call or email — the CRM's call log / email log requirement. */
export async function logCommunication(params: {
  contactId: string;
  channel: 'phone' | 'email' | 'whatsapp' | 'meeting';
  direction: 'inbound' | 'outbound';
  summary: string;
  leadId?: string;
}) {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  await supabase.from('contact_communications').insert({
    contact_id: params.contactId,
    channel: params.channel,
    direction: params.direction,
    summary: params.summary,
    logged_by: profile.id,
  });

  if (params.leadId) {
    await supabase.from('leads').update({ last_contacted_at: new Date().toISOString() }).eq('id', params.leadId);
  }

  await logActivity({
    entityType: 'contact',
    entityId: params.contactId,
    action: 'communication_logged',
    metadata: { channel: params.channel, direction: params.direction },
  });

  revalidatePath(`/crm/${params.contactId}`);
}

/** Schedules a follow-up for a lead (the next_follow_up the workflow tracks). */
export async function scheduleFollowUp(params: { leadId: string; contactId: string; dueAt: string; note?: string }) {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('follow_up_tasks').insert({
    lead_id: params.leadId,
    contact_id: params.contactId,
    assigned_to: profile.id,
    due_at: params.dueAt,
    note: params.note ?? 'Follow up',
  });
  await logActivity({ entityType: 'lead', entityId: params.leadId, action: 'follow_up_scheduled', metadata: { due_at: params.dueAt } });
  revalidatePath(`/crm/leads/${params.leadId}`);
  revalidatePath('/crm/leads');
}

/** Marks a follow-up done (from the lead detail / needs-action list). */
export async function completeFollowUp(followUpId: string, leadId: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('follow_up_tasks').update({ is_done: true }).eq('id', followUpId);
  revalidatePath(`/crm/leads/${leadId}`);
  revalidatePath('/crm/leads');
}

/**
 * Convert a lead into a reservation — the CRM → inventory hand-off. Reuses the
 * reservation engine (which reserves the unit, promotes the contact to a buyer,
 * and creates the buyers row), then advances the lead to 'reserved'.
 */
export async function convertLeadToReservation(params: { leadId: string; contactId: string; unitId: string; depositAmount?: number }) {
  await requireRole(['admin', 'sales', 'management']);
  const reservation = await createReservation({
    unitId: params.unitId,
    buyerContactId: params.contactId,
    depositAmount: params.depositAmount,
  });
  const supabase = await createSupabaseServerClient();
  await supabase.from('leads').update({ status: 'reserved' }).eq('id', params.leadId);
  await logActivity({ entityType: 'lead', entityId: params.leadId, action: 'converted_to_reservation', metadata: { unitId: params.unitId } });
  revalidatePath(`/crm/leads/${params.leadId}`);
  revalidatePath('/crm/leads');
  return reservation;
}

/** Re-runs AI scoring + summary + next-step recommendation for a lead. */
export async function runAIAnalysis(leadId: string) {
  await requireRole(['admin', 'sales', 'management']);
  const analysis = await runLeadAIAnalysis(leadId);
  if (!analysis) return null;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from('leads')
    .update({
      ai_score: analysis.score,
      ai_score_reasoning: analysis.reasoning,
      ai_summary: analysis.summary,
      ai_next_steps: analysis.next_steps,
      ai_summary_generated_at: new Date().toISOString(),
    })
    .eq('id', leadId);

  await logActivity({ entityType: 'lead', entityId: leadId, action: 'ai_analysis_refreshed' });
  revalidatePath(`/crm/${leadId}`);
  return analysis;
}
