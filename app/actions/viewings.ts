'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/auth';
import { sendTemplate } from '@/lib/communications';
import { notifyUser } from '@/lib/notifications';
import { templateAudience } from '@/lib/sales-doctrine';
import { pushEventToGoogle, updateGoogleEvent } from '@/lib/calendar-sync';
import { isOnLeave } from '@/lib/leave-availability';
import { revalidatePath } from 'next/cache';
import { formatDateTime } from '@/lib/format';

/**
 * Schedule a property viewing. Sends an audience-aware confirmation to the
 * buyer, notifies the assigned agent, and records it for the reminder cron.
 */
export async function scheduleViewing(params: {
  leadId?: string | null;
  contactId: string;
  unitId?: string | null;
  projectId?: string | null;
  agentId?: string | null;
  scheduledAt: string;
  notes?: string;
}) {
  const profile = await requirePermission('leads', 'edit');
  const supabase = await createSupabaseServerClient();

  // Approved leave blocks the day for everyone, including the admin booking it.
  if (await isOnLeave(params.agentId ?? profile.id, params.scheduledAt)) {
    throw new Error('Ο υπάλληλος είναι σε εγκεκριμένη άδεια εκείνη την ημέρα — δεν μπορεί να προγραμματιστεί viewing.');
  }

  const { data: viewing } = await supabase
    .from('viewings')
    .insert({
      lead_id: params.leadId ?? null,
      contact_id: params.contactId,
      unit_id: params.unitId ?? null,
      project_id: params.projectId ?? null,
      agent_id: params.agentId ?? profile.id,
      scheduled_at: params.scheduledAt,
      notes: params.notes ?? null,
      created_by: profile.id,
    })
    .select('id')
    .single();

  // Confirmation to the buyer (audience-aware).
  const { data: contact } = await supabase.from('contacts').select('full_name, email, phone, buyer_type, preferred_language').eq('id', params.contactId).maybeSingle();
  let projectName = 'Oramira';
  if (params.projectId) {
    const { data: proj } = await supabase.from('projects').select('name').eq('id', params.projectId).maybeSingle();
    projectName = proj?.name ?? projectName;
  }
  const audience = templateAudience(contact?.buyer_type, contact?.preferred_language);
  const vars = { name: contact?.full_name ?? 'there', project: projectName, agent: profile.fullName ?? 'the Oramira team', date: formatDateTime(params.scheduledAt) };
  await sendTemplate({ contactId: params.contactId, leadId: params.leadId, channel: 'whatsapp', templateKey: 'viewing_confirmation', to: contact?.phone ?? null, vars, audience });
  await sendTemplate({ contactId: params.contactId, leadId: params.leadId, channel: 'email', templateKey: 'viewing_confirmation', to: contact?.email ?? null, vars, audience });

  if (params.agentId && params.agentId !== profile.id) {
    await notifyUser({ userId: params.agentId, title: 'Viewing assigned to you', body: `${vars.name} · ${vars.date}`, link: params.leadId ? `/crm/leads/${params.leadId}` : '/crm/leads', event: 'viewing_assigned' });
  }

  // Auto-sync to the agent's Google Calendar with a Google Meet link (viewings
  // are meetings). Best-effort — no-op when Google isn't connected.
  const agentId = params.agentId ?? profile.id;
  const sync = await pushEventToGoogle(agentId, {
    summary: `Viewing — ${vars.name}${projectName !== 'Oramira' ? ` · ${projectName}` : ''}`,
    description: params.notes ?? undefined,
    start: params.scheduledAt,
    durationMin: 60,
    withMeet: true,
  });
  if (viewing && sync) {
    await supabase.from('viewings').update({ google_event_id: sync.googleEventId, calendar_synced_at: new Date().toISOString(), meeting_link: sync.meetLink }).eq('id', viewing.id);
  }

  if (params.leadId) revalidatePath(`/crm/leads/${params.leadId}`);
  revalidatePath('/crm/leads');
  return viewing;
}

/**
 * Reschedule a viewing — updates the time internally and patches the mirrored
 * Google event (two-way sync on internal change).
 */
export async function rescheduleViewing(id: string, scheduledAt: string) {
  const profile = await requirePermission('leads', 'edit');
  const supabase = await createSupabaseServerClient();

  // Guard against rescheduling onto the assigned agent's approved leave day.
  const { data: existing } = await supabase.from('viewings').select('agent_id').eq('id', id).maybeSingle();
  if (await isOnLeave(existing?.agent_id ?? profile.id, scheduledAt)) {
    throw new Error('Ο υπάλληλος είναι σε εγκεκριμένη άδεια εκείνη την ημέρα — δεν μπορεί να γίνει reschedule.');
  }

  const { data: v } = await supabase
    .from('viewings')
    .update({ scheduled_at: scheduledAt })
    .eq('id', id)
    .select('lead_id, agent_id, google_event_id, contacts(full_name)')
    .single();
  if (v?.google_event_id) {
    await updateGoogleEvent(v.agent_id ?? profile.id, v.google_event_id, { summary: `Viewing — ${(v as any).contacts?.full_name ?? 'Lead'}`, start: scheduledAt, durationMin: 60 });
  }
  if (v?.lead_id) revalidatePath(`/crm/leads/${v.lead_id}`);
  revalidatePath('/crm/leads');
}

/**
 * Mark a viewing's outcome. On "attended" this fires the post-viewing follow-up
 * automatically (a follow-up message + a same-day task for the agent).
 */
export async function setViewingStatus(id: string, status: 'attended' | 'no_show' | 'cancelled') {
  const profile = await requirePermission('leads', 'edit');
  const supabase = await createSupabaseServerClient();

  const { data: v } = await supabase
    .from('viewings')
    .update({ status })
    .eq('id', id)
    .select('lead_id, contact_id, agent_id, project_id, follow_up_sent_at')
    .single();

  if (v && status === 'attended' && !v.follow_up_sent_at) {
    const { data: contact } = await supabase.from('contacts').select('full_name, email, phone, buyer_type, preferred_language').eq('id', v.contact_id).maybeSingle();
    let projectName = 'Oramira';
    if (v.project_id) {
      const { data: proj } = await supabase.from('projects').select('name').eq('id', v.project_id).maybeSingle();
      projectName = proj?.name ?? projectName;
    }
    const audience = templateAudience(contact?.buyer_type, contact?.preferred_language);
    const vars = { name: contact?.full_name ?? 'there', project: projectName, agent: profile.fullName ?? 'the Oramira team' };
    await sendTemplate({ contactId: v.contact_id, leadId: v.lead_id, channel: 'whatsapp', templateKey: 'follow_up', to: contact?.phone ?? null, vars, audience });
    await supabase.from('viewings').update({ follow_up_sent_at: new Date().toISOString() }).eq('id', id);
    if (v.lead_id) {
      await supabase.from('follow_up_tasks').insert({ lead_id: v.lead_id, contact_id: v.contact_id, assigned_to: v.agent_id ?? profile.id, due_at: new Date().toISOString(), note: 'Post-viewing follow-up' });
    }
  }

  if (v?.lead_id) revalidatePath(`/crm/leads/${v.lead_id}`);
  revalidatePath('/crm/leads');
}
