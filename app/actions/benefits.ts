'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type R = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const AUD = ['buyer', 'homeowner', 'investor', 'lead'];
const t = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '') || null;

export interface BenefitInput { partner: string; title: string; description?: string; discount?: string; category?: string; code?: string; link?: string; audience?: string[]; active?: boolean; validUntil?: string }

/** Νέα ή αλλαγή παροχής συνεργάτη (έκπτωση για αγοραστές / ιδιοκτήτες). */
export async function saveBenefit(id: string | null, input: BenefitInput): Promise<R> {
  const me = await requirePermission('marketing', 'edit');
  const partner = t(input.partner, 120), title = t(input.title, 160);
  if (!partner || !title) return { ok: false, error: 'Γράψτε συνεργάτη και τίτλο.' };
  const link = t(input.link, 400);
  if (link && !/^https?:\/\//i.test(link)) return { ok: false, error: 'Ο σύνδεσμος πρέπει να ξεκινά με https://' };
  const row = {
    partner, title, description: t(input.description, 2000), discount: t(input.discount, 60), category: t(input.category, 60), code: t(input.code, 60), link,
    audience: (input.audience ?? []).filter((a) => AUD.includes(a)), active: input.active !== false, valid_until: input.validUntil || null,
  };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = id && UUID.test(id) ? await db.from('partner_benefits').update(row).eq('id', id) : await db.from('partner_benefits').insert({ ...row, created_by: me.id });
  if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Λείπει το migration 0083 στη βάση.' : error.message };
  revalidatePath('/benefits');
  return { ok: true };
}

export async function deleteBenefit(id: string): Promise<R> {
  await requirePermission('marketing', 'edit');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη παροχή.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('partner_benefits').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/benefits');
  return { ok: true };
}
