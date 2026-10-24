'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { notifyTicketHomeowner } from '@/lib/notifications';
import { revalidatePath } from 'next/cache';
import { formatDateTime } from '@/lib/format';

/**
 * Contractor Portal — Server Actions. Every write is gated by contractor-scoped
 * RLS (migrations 0007/0012/0013): a contractor can only touch tickets, visits,
 * photos, notes, material requests, and invoices tied to their own
 * contractor_id. We re-read the contractor_id from the session profile rather
 * than trusting the client. Homeowner-facing events fan out a notification via
 * the service-role helper (a contractor can't write another user's row directly).
 */

async function contractorCtx() {
  const profile = await requireRole(['contractor']);
  if (!profile.contractorId) throw new Error('No contractor profile linked.');
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  return { profile, supabase, userId: auth.user?.id ?? null, contractorId: profile.contractorId };
}

async function addTicketUpdate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  ticketId: string,
  userId: string | null,
  note: string,
  statusChange?: string
) {
  await supabase.from('ticket_updates').insert({
    ticket_id: ticketId,
    author_id: userId,
    note,
    status_change: statusChange ?? null,
  });
}

export async function acceptJob(ticketId: string) {
  const { supabase, userId } = await contractorCtx();
  await supabase.from('maintenance_tickets').update({ status: 'acknowledged' }).eq('id', ticketId);
  await addTicketUpdate(supabase, ticketId, userId, 'Contractor accepted the job.', 'acknowledged');
  await logActivity({ entityType: 'ticket', entityId: ticketId, action: 'job_accepted' });
  await notifyTicketHomeowner(ticketId, {
    title: 'Your contractor accepted the job',
    body: 'A contractor has accepted your maintenance request and will be in touch.',
    link: `/homeowner/maintenance/${ticketId}`,
  });
  revalidatePath(`/contractor/jobs/${ticketId}`);
  revalidatePath('/contractor');
}

export async function setJobStatus(
  ticketId: string,
  status: 'in_progress' | 'awaiting_parts' | 'resolved',
  note?: string
) {
  const { supabase, userId } = await contractorCtx();
  await supabase
    .from('maintenance_tickets')
    .update({ status, ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}) })
    .eq('id', ticketId);

  const labels: Record<string, string> = { in_progress: 'Work in progress', awaiting_parts: 'Awaiting parts/materials', resolved: 'Marked as completed' };
  await addTicketUpdate(supabase, ticketId, userId, note ?? labels[status], status);
  await logActivity({ entityType: 'ticket', entityId: ticketId, action: `status_${status}` });
  await notifyTicketHomeowner(ticketId, {
    title: status === 'resolved' ? 'Your repair is complete' : `Update on your repair: ${labels[status]}`,
    body: note ?? labels[status],
    link: `/homeowner/maintenance/${ticketId}`,
  });
  revalidatePath(`/contractor/jobs/${ticketId}`);
  revalidatePath('/contractor');
}

export async function scheduleVisit(params: {
  ticketId: string;
  unitId: string;
  scheduledFor: string;
  notes?: string;
}) {
  const { supabase, contractorId, userId } = await contractorCtx();
  await supabase.from('contractor_visits').insert({
    ticket_id: params.ticketId,
    unit_id: params.unitId,
    contractor_id: contractorId,
    scheduled_for: params.scheduledFor,
    status: 'scheduled',
    notes: params.notes ?? null,
    created_by: userId,
  });
  await addTicketUpdate(supabase, params.ticketId, userId, `Visit scheduled for ${formatDateTime(params.scheduledFor)}.`);
  await notifyTicketHomeowner(params.ticketId, {
    title: 'A visit has been scheduled',
    body: `Your contractor will visit on ${formatDateTime(params.scheduledFor)}.`,
    link: `/homeowner/maintenance/${params.ticketId}`,
  });
  revalidatePath(`/contractor/jobs/${params.ticketId}`);
  revalidatePath('/contractor/schedule');
}

export async function updateVisit(
  visitId: string,
  ticketId: string,
  patch: { status?: 'scheduled' | 'en_route' | 'completed' | 'cancelled' | 'rescheduled'; scheduledFor?: string; notes?: string }
) {
  const { supabase } = await contractorCtx();
  const update: Record<string, unknown> = {};
  if (patch.status) update.status = patch.status;
  if (patch.status === 'completed') update.completed_at = new Date().toISOString();
  if (patch.scheduledFor) update.scheduled_for = patch.scheduledFor;
  if (patch.notes !== undefined) update.notes = patch.notes;
  await supabase.from('contractor_visits').update(update).eq('id', visitId);

  if (patch.status === 'en_route') {
    await notifyTicketHomeowner(ticketId, {
      title: 'Your contractor is on the way',
      link: `/homeowner/maintenance/${ticketId}`,
    });
  }
  revalidatePath(`/contractor/jobs/${ticketId}`);
  revalidatePath('/contractor/schedule');
}

export async function requestMaterials(params: {
  ticketId: string;
  items: { name: string; qty: number; unit_cost: number }[];
  estimatedCost?: number;
  note?: string;
}) {
  const { supabase, contractorId } = await contractorCtx();
  const estimated =
    params.estimatedCost ?? params.items.reduce((s, i) => s + Number(i.qty) * Number(i.unit_cost), 0);
  await supabase.from('material_requests').insert({
    ticket_id: params.ticketId,
    contractor_id: contractorId,
    items: params.items as any,
    estimated_cost: estimated,
    note: params.note ?? null,
  });
  await logActivity({ entityType: 'ticket', entityId: params.ticketId, action: 'materials_requested', metadata: { estimated } });
  revalidatePath(`/contractor/jobs/${params.ticketId}`);
}

export async function addInternalNote(ticketId: string, body: string) {
  const { supabase, contractorId } = await contractorCtx();
  const trimmed = body.trim();
  if (!trimmed) return;
  await supabase.from('contractor_job_notes').insert({ ticket_id: ticketId, contractor_id: contractorId, body: trimmed });
  revalidatePath(`/contractor/jobs/${ticketId}`);
}

/** Record completion photos already uploaded to the defect-reports bucket. */
export async function recordCompletionPhotos(ticketId: string, paths: string[]) {
  const { supabase, userId } = await contractorCtx();
  if (paths.length === 0) return;
  await supabase.from('ticket_photos').insert(paths.map((path) => ({ ticket_id: ticketId, storage_path: path, uploaded_by: userId })));
  await addTicketUpdate(supabase, ticketId, userId, `${paths.length} completion photo(s) uploaded.`);
  revalidatePath(`/contractor/jobs/${ticketId}`);
}

/** Record an invoice already uploaded to the contractor-invoices bucket. */
export async function recordInvoice(params: {
  ticketId: string;
  projectId: string | null;
  amount: number;
  storagePath: string;
  title?: string;
}) {
  const { supabase, contractorId, userId } = await contractorCtx();

  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({
      category: 'invoice',
      storage_path: params.storagePath,
      bucket: 'contractor-invoices',
      entity_type: 'contractor',
      entity_id: contractorId,
      title: params.title ?? 'Invoice',
      uploaded_by: userId,
    })
    .select()
    .single();
  if (docError) throw docError;

  await supabase.from('contractor_invoices').insert({
    contractor_id: contractorId,
    project_id: params.projectId,
    ticket_id: params.ticketId,
    amount: params.amount,
    document_id: doc.id,
    status: 'submitted',
  });
  await logActivity({ entityType: 'ticket', entityId: params.ticketId, action: 'invoice_submitted', metadata: { amount: params.amount } });
  revalidatePath('/contractor/invoices');
  revalidatePath(`/contractor/jobs/${params.ticketId}`);
}

// ===== Staff-side material approval (the other half of the workflow) =====
export async function decideMaterialRequest(requestId: string, decision: 'approved' | 'rejected') {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('material_requests')
    .update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', requestId);
  revalidatePath('/projects');
}
