'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole, requirePermission } from '@/lib/auth';
import { draftLeadMessage, type DraftedMessage, type DraftIntent } from '@/lib/ai';
import { sendMessage } from '@/lib/communications';
import { retargetCategory, RETARGET_LABELS, type RetargetCategory } from '@/lib/sales-doctrine';
import { revalidatePath } from 'next/cache';
import { formatNumber, formatCurrency } from '@/lib/format';

/**
 * AI-draft a message for a lead (review-before-send). Context-aware: pulls the
 * lead's stage, buyer type, budget, and recent communication/note history so
 * the model writes something specific to this relationship. `intent` selects
 * follow-up / objection handling / viewing reminder / negotiation / nurture.
 */
export async function draftLeadMessageAction(
  leadId: string,
  channel: 'whatsapp' | 'email',
  intent: DraftIntent = 'follow_up',
): Promise<DraftedMessage> {
  const profile = await requirePermission('leads', 'view');
  const supabase = await createSupabaseServerClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('contact_id, status, budget_min, budget_max, contacts(full_name, buyer_type, preferred_language), projects:preferred_project_id(name)')
    .eq('id', leadId)
    .maybeSingle();
  const c = (lead as any)?.contacts;

  // Assemble recent history (newest first) so the draft is grounded in context.
  const [{ data: comms }, { data: notes }] = await Promise.all([
    supabase.from('contact_communications').select('channel, direction, summary, occurred_at').eq('contact_id', lead?.contact_id ?? '').order('occurred_at', { ascending: false }).limit(8),
    supabase.from('notes').select('body, created_at').eq('entity_type', 'lead').eq('entity_id', leadId).order('created_at', { ascending: false }).limit(5),
  ]);
  const context = [
    ...(comms ?? []).map((x: any) => `- [${x.channel}/${x.direction}] ${x.summary ?? ''}`),
    ...(notes ?? []).map((n: any) => `- [note] ${n.body}`),
  ].join('\n') || undefined;

  const budget = lead?.budget_min || lead?.budget_max ? `${formatCurrency(Number(lead?.budget_min ?? 0))}–${formatNumber(Number(lead?.budget_max ?? 0))}` : null;

  return draftLeadMessage({
    name: c?.full_name ?? 'there',
    project: (lead as any)?.projects?.name ?? 'Oramira',
    status: lead?.status ?? 'new',
    channel,
    intent,
    agent: profile.fullName ?? 'the Oramira team',
    language: c?.preferred_language ?? null,
    buyerType: c?.buyer_type ?? null,
    budget,
    context,
  });
}

/** Agent sends a (reviewed) message on a channel — routed through the provider
 *  abstraction and recorded on the timeline. */
export async function sendLeadMessageAction(params: { leadId: string; channel: 'whatsapp' | 'email'; body: string; subject?: string }) {
  await requirePermission('leads', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: lead } = await supabase.from('leads').select('contact_id, contacts(email, phone)').eq('id', params.leadId).maybeSingle();
  if (!lead) throw new Error('Lead not found');
  const c = (lead as any).contacts;
  const to = params.channel === 'email' ? c?.email ?? null : c?.phone ?? null;

  const result = await sendMessage({
    contactId: lead.contact_id,
    leadId: params.leadId,
    channel: params.channel,
    to,
    subject: params.subject ?? null,
    body: params.body,
    aiGenerated: false,
  });
  revalidatePath(`/crm/leads/${params.leadId}`);
  return result;
}

export interface RetargetLead {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  buyer_type: string | null;
  status: string;
  last_contacted_at: string | null;
  category: RetargetCategory;
}

/**
 * Build the retargeting audiences: inactive (7+ days) or pooled leads, bucketed
 * into warm-no-response / viewed-inactive / negotiation-stalled. The commercial
 * intelligence layer that feeds ad-platform custom audiences.
 */
export async function getRetargetingAudiences(): Promise<RetargetLead[]> {
  await requirePermission('leads', 'view');
  const supabase = await createSupabaseServerClient();
  const { data: leads } = await supabase
    .from('leads')
    .select('id, status, last_contacted_at, created_at, contacts(full_name, email, phone, buyer_type)')
    .not('status', 'in', '("won","lost")')
    .order('last_contacted_at', { ascending: true, nullsFirst: true });

  const out: RetargetLead[] = [];
  for (const l of leads ?? []) {
    const category = retargetCategory({ status: l.status, lastContactedAt: l.last_contacted_at, createdAt: (l as any).created_at });
    if (!category) continue;
    const c = (l as any).contacts;
    out.push({ id: l.id, full_name: c?.full_name ?? null, email: c?.email ?? null, phone: c?.phone ?? null, buyer_type: c?.buyer_type ?? null, status: l.status, last_contacted_at: l.last_contacted_at, category });
  }
  return out;
}

function csvCell(v: string | null | undefined): string {
  const s = (v ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Export one retargeting audience (or all) as CSV text for upload to ad platforms. */
export async function exportRetargetingCsv(category?: RetargetCategory): Promise<string> {
  const rows = await getRetargetingAudiences();
  const filtered = category ? rows.filter((r) => r.category === category) : rows;
  const header = ['Name', 'Email', 'Phone', 'Buyer type', 'Stage', 'Audience', 'Last contacted'];
  const lines = [header.join(',')];
  for (const r of filtered) {
    lines.push([
      csvCell(r.full_name), csvCell(r.email), csvCell(r.phone), csvCell(r.buyer_type),
      csvCell(r.status), csvCell(RETARGET_LABELS[r.category]),
      csvCell(r.last_contacted_at ? new Date(r.last_contacted_at).toISOString().slice(0, 10) : ''),
    ].join(','));
  }
  return lines.join('\n');
}

/** Admin/manager edits a message template. */
export async function updateTemplate(id: string, patch: { subject?: string | null; body?: string; isActive?: boolean }) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.subject !== undefined) update.subject = patch.subject;
  if (patch.body !== undefined) update.body = patch.body;
  if (patch.isActive !== undefined) update.is_active = patch.isActive;
  await supabase.from('message_templates').update(update).eq('id', id);
  revalidatePath('/settings/templates');
}
