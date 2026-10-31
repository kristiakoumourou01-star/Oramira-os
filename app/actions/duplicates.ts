'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';

type Result = { ok: true; moved?: number } | { ok: false; error: string };
const UUID = /^[0-9a-f-]{36}$/i;

/** Ενοποίηση δύο επαφών: όλα του «drop» (leads, μηνύματα, έγγραφα, KYC…) πάνε στο «keep». */
export async function mergeContacts(keepId: string, dropId: string): Promise<Result> {
  await requireRole(['admin', 'management', 'sales']);
  try {
    if (!UUID.test(keepId) || !UUID.test(dropId) || keepId === dropId) return { ok: false, error: 'Διαλέξτε δύο διαφορετικές επαφές.' };
    const supabase = await createSupabaseServerClient();
    const { data, error } = await (supabase as any).rpc('merge_contacts', { p_keep: keepId, p_drop: dropId });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/crm/duplicates');
    revalidatePath(`/crm/${keepId}`);
    revalidatePath('/crm/leads');
    return { ok: true, moved: (data as any)?.moved ?? 0 };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Η ενοποίηση απέτυχε.' };
  }
}

/** «Δεν είναι ο ίδιος άνθρωπος» — το ζευγάρι δεν ξαναπροτείνεται. */
export async function dismissDuplicate(aId: string, bId: string): Promise<Result> {
  const profile = await requireRole(['admin', 'management', 'sales']);
  try {
    if (!UUID.test(aId) || !UUID.test(bId) || aId === bId) return { ok: false, error: 'Μη έγκυρο ζευγάρι.' };
    const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
    const supabase = await createSupabaseServerClient();
    const { error } = await (supabase as any).from('contact_duplicate_dismissals').upsert({ a, b, dismissed_by: profile.id }, { onConflict: 'a,b' });
    if (error) return { ok: false, error: error.message };
    revalidatePath('/crm/duplicates');
    revalidatePath(`/crm/${aId}`); revalidatePath(`/crm/${bId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία.' };
  }
}
