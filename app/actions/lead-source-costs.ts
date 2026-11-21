'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

type R = { ok: true } | { ok: false; error: string };

/** Κόστος πηγής για έναν μήνα (Admin / Manager). Ποσό 0 ή κενό = διαγραφή. */
export async function saveSourceCost(source: string, month: string, amount: number | null): Promise<R> {
  const me = await requireRole(['admin', 'management']);
  const src = (source ?? '').trim().slice(0, 40);
  if (!src) return { ok: false, error: 'Διαλέξτε πηγή.' };
  if (!/^\d{4}-\d{2}$/.test(month ?? '')) return { ok: false, error: 'Διαλέξτε μήνα.' };
  const supabase = (await createSupabaseServerClient()) as any;
  const m = `${month}-01`;
  if (amount === null || !Number.isFinite(amount) || amount <= 0) {
    const { error } = await supabase.from('lead_source_costs').delete().eq('source', src).eq('month', m);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from('lead_source_costs').upsert({ source: src, month: m, amount: Math.round(amount * 100) / 100, created_by: me.id }, { onConflict: 'source,month' });
    if (error) return { ok: false, error: /lead_source_costs/.test(error.message) ? 'Ο πίνακας κόστους δεν είναι ακόμη έτοιμος στη βάση.' : error.message };
  }
  revalidatePath('/sales/agents');
  return { ok: true };
}
