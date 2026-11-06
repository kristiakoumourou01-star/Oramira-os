'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-settings';
import { pipelineOf, type LostReason, type PipelineDef } from '@/lib/pipeline-shared';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface LeadQuick {
  id: string; status: string; stage: string | null; stageEnteredAt: string | null; source: string | null;
  budgetMin: number | null; budgetMax: number | null; timeline: string | null; message: string | null;
  nextActionDate: string | null; nextActionType: string | null; ownerId: string | null;
  lostReason: string | null; lostNote: string | null; commissionInvoiceId: string | null; createdAt: string;
  contact: { id: string; name: string; email: string | null; phone: string | null; language: string | null };
  project: string | null;
  pipeline: PipelineDef; lostReasons: LostReason[];
  notes: { id: string; body: string; at: string; author: string | null }[];
  comms: { id: string; channel: string; direction: string; summary: string | null; at: string }[];
  followUps: { id: string; dueAt: string; note: string | null }[];
}

/** Τα στοιχεία ενός lead για το πλαϊνό παράθυρο (μισή σελίδα) στο Pipeline. */
export async function getLeadQuick(leadId: string): Promise<{ ok: true; lead: LeadQuick } | { ok: false; error: string }> {
  await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(leadId ?? '')) return { ok: false, error: 'Άγνωστο lead.' };
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const [{ data: l, error }, { data: extra }, { data: st }, settings] = await Promise.all([
    db.from('leads').select('id, status, source, budget_min, budget_max, timeline_to_buy, message, next_action_date, next_action_type, assigned_to, created_at, contact_id, contacts(id, full_name, email, phone, preferred_language), projects:preferred_project_id(name)').eq('id', leadId).maybeSingle(),
    db.from('leads').select('pipeline, stage_entered_at, lost_reason, lost_note, commission_invoice_id').eq('id', leadId).maybeSingle(),
    db.from('leads').select('stage').eq('id', leadId).maybeSingle(),
    getOrgSettings(),
  ]);
  if (error || !l) return { ok: false, error: error?.message ?? 'Το lead δεν βρέθηκε.' };
  const [{ data: notes }, { data: comms }, { data: fus }] = await Promise.all([
    db.from('notes').select('id, body, created_at, author:author_id(full_name)').eq('entity_type', 'lead').eq('entity_id', leadId).order('created_at', { ascending: false }).limit(6),
    db.from('contact_communications').select('id, channel, direction, summary, occurred_at').eq('contact_id', l.contact_id).order('occurred_at', { ascending: false }).limit(6),
    db.from('follow_up_tasks').select('id, due_at, note').eq('lead_id', leadId).eq('is_done', false).order('due_at').limit(5),
  ]);
  const c = l.contacts ?? {};
  return {
    ok: true,
    lead: {
      id: l.id, status: l.status, stage: st?.stage ?? null, stageEnteredAt: extra?.stage_entered_at ?? null, source: l.source,
      budgetMin: l.budget_min, budgetMax: l.budget_max, timeline: l.timeline_to_buy, message: l.message,
      nextActionDate: l.next_action_date, nextActionType: l.next_action_type, ownerId: l.assigned_to,
      lostReason: extra?.lost_reason ?? null, lostNote: extra?.lost_note ?? null, commissionInvoiceId: extra?.commission_invoice_id ?? null, createdAt: l.created_at,
      contact: { id: c.id ?? l.contact_id, name: c.full_name ?? c.email ?? 'Χωρίς όνομα', email: c.email ?? null, phone: c.phone ?? null, language: c.preferred_language ?? null },
      project: l.projects?.name ?? null,
      pipeline: pipelineOf(settings.pipelines, extra?.pipeline ?? null), lostReasons: settings.pipelines.lostReasons,
      notes: ((notes ?? []) as any[]).map((n) => ({ id: n.id, body: n.body, at: n.created_at, author: n.author?.full_name ?? null })),
      comms: ((comms ?? []) as any[]).map((m) => ({ id: m.id, channel: m.channel, direction: m.direction, summary: m.summary, at: m.occurred_at })),
      followUps: ((fus ?? []) as any[]).map((f) => ({ id: f.id, dueAt: f.due_at, note: f.note })),
    },
  };
}

/** Γρήγορη επεξεργασία από το πλαϊνό παράθυρο. */
export async function saveLeadQuick(leadId: string, p: {
  name?: string; email?: string; phone?: string; budgetMin?: number | null; budgetMax?: number | null;
  timeline?: string | null; nextActionDate?: string | null; nextActionType?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole(['admin', 'sales', 'management']);
  if (!UUID.test(leadId ?? '')) return { ok: false, error: 'Άγνωστο lead.' };
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const num = (x: unknown) => (x === null || x === undefined || x === '' ? null : Number.isFinite(Number(x)) ? Math.max(0, Number(x)) : null);
  const date = (x: unknown) => (typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x) ? x : null);
  const leadPatch: Record<string, unknown> = {
    budget_min: num(p.budgetMin), budget_max: num(p.budgetMax),
    timeline_to_buy: (p.timeline ?? '').trim().slice(0, 80) || null,
    next_action_date: date(p.nextActionDate), next_action_type: (p.nextActionType ?? '').trim().slice(0, 40) || null,
    updated_at: new Date().toISOString(),
  };
  const { data: lead, error } = await db.from('leads').update(leadPatch).eq('id', leadId).select('contact_id').single();
  if (error) return { ok: false, error: error.message };
  const cp: Record<string, unknown> = {};
  if (p.name !== undefined && p.name.trim()) cp.full_name = p.name.trim().slice(0, 160);
  if (p.email !== undefined) {
    const e = p.email.trim().toLowerCase();
    if (e && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Το email δεν φαίνεται σωστό.' };
    cp.email = e || null;
  }
  if (p.phone !== undefined) cp.phone = p.phone.trim().slice(0, 40) || null;
  if (Object.keys(cp).length && lead?.contact_id) {
    const { error: ce } = await db.from('contacts').update({ ...cp, updated_at: new Date().toISOString() }).eq('id', lead.contact_id);
    if (ce) return { ok: false, error: /duplicate|unique/i.test(ce.message) ? 'Αυτό το email το έχει ήδη άλλη επαφή.' : ce.message };
  }
  revalidatePath('/crm/leads');
  revalidatePath(`/crm/leads/${leadId}`);
  return { ok: true };
}
