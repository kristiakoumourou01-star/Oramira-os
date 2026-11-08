'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

type R = { ok: true } | { ok: false; error: string };
const STAFF = ['admin', 'sales', 'management'] as const;

/** Στοιχεία deal (όπως Pipedrive): τίτλος, αξία, αναμενόμενη ημ. κλεισίματος, labels, followers. */
export async function updateDeal(leadId: string, p: { title?: string | null; value?: number | null; currency?: string; expectedCloseDate?: string | null; labels?: string[]; followers?: string[] }): Promise<R> {
  await requireRole([...STAFF]);
  const patch: Record<string, unknown> = {};
  if (p.title !== undefined) patch.title = (p.title ?? '').trim().slice(0, 160) || null;
  if (p.value !== undefined) patch.value = p.value === null || !Number.isFinite(Number(p.value)) ? null : Math.max(0, Math.round(Number(p.value) * 100) / 100);
  if (p.currency !== undefined) patch.currency = /^[A-Z]{3}$/.test(p.currency) ? p.currency : 'EUR';
  if (p.expectedCloseDate !== undefined) patch.expected_close_date = p.expectedCloseDate && /^\d{4}-\d{2}-\d{2}$/.test(p.expectedCloseDate) ? p.expectedCloseDate : null;
  if (p.labels !== undefined) patch.labels = [...new Set(p.labels.map((x) => String(x).trim()).filter(Boolean))].slice(0, 10);
  if (p.followers !== undefined) patch.followers = [...new Set(p.followers.filter((x) => /^[0-9a-f-]{36}$/.test(x)))].slice(0, 30);
  if (!Object.keys(patch).length) return { ok: true };
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('leads').update(patch).eq('id', leadId);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/sales/deals'); revalidatePath(`/crm/leads/${leadId}`); revalidatePath('/crm/leads');
  return { ok: true };
}

/** Αρχειοθέτηση deals (κρύβονται από τον πίνακα, μένουν στο «Αρχείο»). */
export async function setDealsArchived(ids: string[], archived: boolean): Promise<R> {
  await requireRole([...STAFF]);
  const clean = ids.filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  if (!clean.length) return { ok: false, error: 'Δεν επιλέξατε deals.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('leads').update({ archived_at: archived ? new Date().toISOString() : null }).in('id', clean);
  if (error) return { ok: false, error: error.message };
  for (const id of clean) await logActivity({ entityType: 'lead', entityId: id, action: archived ? 'archived' : 'unarchived' });
  revalidatePath('/sales/deals'); revalidatePath('/crm/leads');
  return { ok: true };
}

/** Leads Inbox → pipeline («Μετατροπή σε deal»), ή πίσω στο Inbox. */
export async function setLeadsInbox(ids: string[], inInbox: boolean, pipelineKey?: string | null): Promise<R> {
  await requireRole([...STAFF]);
  const clean = ids.filter((x) => /^[0-9a-f-]{36}$/.test(x)).slice(0, 500);
  if (!clean.length) return { ok: false, error: 'Δεν επιλέξατε leads.' };
  const patch: Record<string, unknown> = { in_inbox: inInbox };
  if (!inInbox && pipelineKey && /^[a-z0-9_]{1,30}$/.test(pipelineKey)) patch.pipeline = pipelineKey;
  if (!inInbox) patch.stage_entered_at = new Date().toISOString();
  const supabase = await createSupabaseServerClient();
  const { error } = await (supabase as any).from('leads').update(patch).in('id', clean);
  if (error) return { ok: false, error: error.message };
  for (const id of clean) await logActivity({ entityType: 'lead', entityId: id, action: inInbox ? 'moved_to_inbox' : 'converted_to_deal' });
  revalidatePath('/sales/leads'); revalidatePath('/sales/deals'); revalidatePath('/crm/leads');
  return { ok: true };
}
