'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Αποθήκευση του Custom report ως πρότυπο (για να ξανανοίγει με ένα κλικ). */
export async function saveReportTemplate(name: string, definition: unknown): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const me = await requirePermission('financials');
  const n = (name ?? '').trim().slice(0, 80);
  if (!n) return { ok: false, error: 'Δώστε όνομα στο πρότυπο.' };
  const db = (await createSupabaseServerClient()) as any;
  const { data, error } = await db.from('report_templates').insert({ name: n, kind: 'customers', definition: definition ?? {}, created_by: me.id }).select('id').single();
  if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Λείπει το migration 0081 στη βάση.' : error.message };
  revalidatePath('/reports');
  return { ok: true, id: data.id };
}

export async function deleteReportTemplate(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requirePermission('financials');
  if (!UUID.test(id)) return { ok: false, error: 'Άκυρο πρότυπο.' };
  const db = (await createSupabaseServerClient()) as any;
  const { error } = await db.from('report_templates').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };
  revalidatePath('/reports');
  return { ok: true };
}
