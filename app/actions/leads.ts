'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { runLeadAIAnalysis } from '@/lib/ai';
import { createReservation } from '@/app/actions/reservations';
import { onNewLead, onLeadAssigned, onViewingScheduled } from '@/lib/automation-events';
import { buyerProfile } from '@/lib/sales-doctrine';
import { ensureFirstFollowUp } from '@/lib/lead-followup';
import { pushEventToGoogle } from '@/lib/calendar-sync';
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
  buyerType?: string;
  language?: string;
  communicationPreference?: string;
  assignedTo?: string;
}) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: contactId, error: contactError } = await supabase.rpc('find_or_create_contact', {
    p_email: params.email,
    p_name: params.fullName,
    p_phone: params.phone ?? null,
  });
  if (contactError) throw contactError;

  // Tag as lead + set audience/communication profile (drives the doctrine).
  const profileDef = buyerProfile(params.buyerType);
  await supabase.from('contacts').update({
    is_lead: true,
    buyer_type: params.buyerType ?? null,
    preferred_language: params.language ?? profileDef.language,
    communication_preference: params.communicationPreference ?? profileDef.preferredChannel,
    nurture_style: profileDef.nurtureStyle,
  }).eq('id', contactId);

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
      // Leads start UNASSIGNED — assigned manually later (no auto-assign).
      assigned_to: params.assignedTo ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  // Postgres trigger (on_lead_created) logs the activity + a default follow-up.
  // Turn that into a clear, assigned, urgent first to-do (see migration 0006).
  await onNewLead(lead.id); // welcome automation (best-effort)
  await ensureFirstFollowUp(supabase, { leadId: lead.id, contactId, assignedTo: params.assignedTo ?? null, source: params.source });

  revalidatePath('/crm/leads');
  return lead;
}

/**
 * Updates a lead's status. When the lead is being closed/parked, an optional
 * `reason` explains WHY — recorded both in the activity log metadata and as a
 * visible timeline note, so lost-reason intelligence is captured without a
 * schema change (queryable later from activity_log / notes).
 */
export async function updateLeadStatus(leadId: string, status: string, reason?: string) {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: current } = await supabase.from('leads').select('status, contact_id').eq('id', leadId).single();

  await supabase.from('leads').update({ status }).eq('id', leadId);
  await logActivity({
    entityType: 'lead',
    entityId: leadId,
    action: 'status_changed',
    metadata: { from: current?.status, to: status, ...(reason ? { reason } : {}) },
  });

  // A close/park reason is business intelligence — persist it as a timeline note.
  if (reason?.trim()) {
    await supabase.from('notes').insert({
      entity_type: 'lead',
      entity_id: leadId,
      author_id: profile.id,
      body: `Marked as ${status.replace('_', ' ')}: ${reason.trim()}`,
    });
  }

  // Closing a lead clears its open work so a dead lead stops surfacing in
  // employees' follow-up / task lists. Resilient (best-effort) — a failure here
  // must never block the status change itself.
  const CLOSING = ['lost', 'no_response', 'nurture', 'retargeting'];
  if (CLOSING.includes(status)) {
    try {
      await Promise.all([
        supabase.from('follow_up_tasks').update({ is_done: true }).eq('lead_id', leadId).eq('is_done', false),
        supabase.from('tasks').update({ is_done: true }).eq('related_entity_type', 'lead').eq('related_entity_id', leadId).eq('is_done', false),
      ]);
    } catch { /* non-fatal */ }
  }

  if (status === 'viewing') await onViewingScheduled(leadId);

  revalidatePath(`/crm/${leadId}`);
  revalidatePath(`/crm/leads/${leadId}`);
  revalidatePath('/crm/leads');
}

export async function assignLead(leadId: string, assignedTo: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('leads').update({ assigned_to: assignedTo }).eq('id', leadId);
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'reassigned' });
  revalidatePath('/crm/leads');
}

/** Assign or reassign a lead — updates owner metadata and records assignment history.
 *  Resilient to schema drift: the assigned_by/assigned_at columns and the
 *  lead_assignments table (migration 0020) may be absent on the live DB, so the
 *  core assignment (assigned_to) must still succeed even when they are. */
export async function reassignLead(leadId: string, assignedTo: string, note?: string) {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  // Try the full update; fall back to just the owner if the audit columns are missing.
  const full = await supabase
    .from('leads')
    .update({ assigned_to: assignedTo, assigned_by: profile.id, assigned_at: new Date().toISOString() })
    .eq('id', leadId);
  if (full.error) {
    await supabase.from('leads').update({ assigned_to: assignedTo }).eq('id', leadId);
  }

  // Assignment history + to-do hand-off are best-effort — never block the assign.
  try { await supabase.from('lead_assignments').insert({ lead_id: leadId, assigned_to: assignedTo, assigned_by: profile.id, note: note ?? 'Reassigned' }); } catch { /* table may be absent */ }
  // Move the lead's open to-dos to the new owner so they land on the right
  // person's list (an unassigned lead's first-touch task follows the assignment).
  await supabase.from('follow_up_tasks').update({ assigned_to: assignedTo }).eq('lead_id', leadId).eq('is_done', false);

  await logActivity({ entityType: 'lead', entityId: leadId, action: 'reassigned', metadata: { to: assignedTo } });
  await onLeadAssigned(leadId, assignedTo);
  revalidatePath('/crm/leads');
  revalidatePath(`/crm/leads/${leadId}`);
}

/** Set the lead's next action (date + type) — this is what the priority board groups on. */
export async function setNextAction(leadId: string, date: string, type: string) {
  await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('leads').update({ next_action_date: date, next_action_type: type }).eq('id', leadId);
  await logActivity({ entityType: 'lead', entityId: leadId, action: 'next_action_set', metadata: { date, type } });
  revalidatePath('/crm/leads');
  revalidatePath(`/crm/leads/${leadId}`);
}

/** Set the org-wide default owner that ownerless inbound leads route to. */
export async function setDefaultLeadOwner(profileId: string) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  const { data: org } = await supabase.from('organizations').select('id').order('created_at').limit(1).maybeSingle();
  if (org) {
    await supabase.from('organizations').update({ default_lead_owner_id: profileId }).eq('id', org.id);
  } else {
    await supabase.from('organizations').insert({ name: 'Oramira', default_lead_owner_id: profileId });
  }
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
  const { data: ft } = await supabase.from('follow_up_tasks').insert({
    lead_id: params.leadId,
    contact_id: params.contactId,
    assigned_to: profile.id,
    due_at: params.dueAt,
    note: params.note ?? 'Follow up',
  }).select('id').single();

  // Auto-sync to the owner's Google Calendar (best-effort).
  const sync = await pushEventToGoogle(profile.id, { summary: params.note ?? 'Lead follow-up', start: params.dueAt, durationMin: 30 });
  if (ft && sync) {
    await supabase.from('follow_up_tasks').update({ google_event_id: sync.googleEventId, calendar_synced_at: new Date().toISOString() }).eq('id', ft.id);
  }

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

  // Accrue a sales commission for the owning agent (if they have a rate set).
  // Deal value = unit price; the commission stays 'pending' until HR marks it paid.
  const { data: lead } = await supabase.from('leads').select('assigned_to').eq('id', params.leadId).maybeSingle();
  if (lead?.assigned_to) {
    const [{ data: agent }, { data: unit }] = await Promise.all([
      supabase.from('profiles').select('commission_pct').eq('id', lead.assigned_to).maybeSingle(),
      supabase.from('units').select('price').eq('id', params.unitId).maybeSingle(),
    ]);
    const pct = Number(agent?.commission_pct ?? 0);
    const baseValue = Number(unit?.price ?? 0);
    if (pct > 0 && baseValue > 0) {
      await supabase.from('commissions').insert({
        profile_id: lead.assigned_to,
        lead_id: params.leadId,
        unit_id: params.unitId,
        reservation_id: reservation.id,
        base_value: baseValue,
        commission_pct: pct,
        amount: Math.round(baseValue * (pct / 100) * 100) / 100,
        status: 'pending',
      });
    }
  }

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
