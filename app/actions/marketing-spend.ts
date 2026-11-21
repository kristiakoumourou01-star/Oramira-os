'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LEAD_SOURCES } from '@/lib/reports-shared';

type R = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MISSING = (m: string) => (/does not exist|schema cache/i.test(m) ? 'Λείπει το migration 0106 στη βάση.' : m);

/** Κόστος marketing ανά μήνα και πηγή (για «κόστος ανά lead»). Ίδιος μήνας + πηγή = αντικατάσταση. */
export async function saveMarketingSpend(input: { month: string; source: string; amount: number; note?: string }): Promise<R> {
  const me = await requirePermission('financials');
  if (!/^\d{4}-\d{2}$/.test(input.month ?? '')) return { ok: false, error: 'Διαλέξτε μήνα.' };
  if (!LEAD_SOURCES.some(([k]) => k === input.source)) return { ok: false, error: 'Διαλέξτε πηγή.' };
  const amount = Number(input.amount);
  if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'Γράψτε ποσό.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('lead_source_costs').upsert({ month: `${input.month}-01`, source: input.source, amount, note: (input.note ?? '').trim().slice(0, 200) || null, created_by: me.id }, { onConflict: 'source,month' });
  if (error) return { ok: false, error: MISSING(error.message) };
  revalidatePath('/reports');
  return { ok: true };
}

export async function deleteMarketingSpend(id: string): Promise<R> {
  await requirePermission('financials');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρη καταχώριση.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('lead_source_costs').delete().eq('id', id);
  if (error) return { ok: false, error: MISSING(error.message) };
  revalidatePath('/reports');
  return { ok: true };
}
