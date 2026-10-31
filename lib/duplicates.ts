import { createSupabaseServerClient } from '@/lib/supabase/server';

import type { DupContact, DupMatch, DupPair } from '@/lib/lead-automation-shared';

export type { DupContact, DupMatch, DupPair };

/** Πιθανά διπλά μίας επαφής (για το banner). Χωρίς migration 0069 → κενό. */
export async function loadContactDuplicates(contactId: string): Promise<DupMatch[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await (supabase as any).rpc('find_duplicate_contacts', { p_contact: contactId });
    if (error) return [];
    return ((data ?? []) as any[]).map((r) => ({ id: r.contact_id, full_name: r.full_name, email: r.email, phone: r.phone, reasons: r.reasons ?? [] }));
  } catch {
    return [];
  }
}

/** Όλα τα ζευγάρια πιθανών διπλών, με ό,τι χρειάζεται για να διαλέξετε ποια μένει. */
export async function loadDuplicatePairs(limit = 200): Promise<{ pairs: DupPair[]; missing: boolean }> {
  const supabase = await createSupabaseServerClient();
  const db = supabase as any;
  const { data, error } = await db.rpc('duplicate_contact_pairs', { p_limit: limit });
  if (error) return { pairs: [], missing: /does not exist|schema cache|Could not find/i.test(error.message) };
  const rows = (data ?? []) as { a: string; b: string; reasons: string[] }[];
  const ids = Array.from(new Set(rows.flatMap((r) => [r.a, r.b])));
  if (!ids.length) return { pairs: [], missing: false };
  const [{ data: contacts }, { data: leads }, { data: profiles }] = await Promise.all([
    supabase.from('contacts').select('id, full_name, email, phone, created_at, is_buyer').in('id', ids),
    supabase.from('leads').select('contact_id').in('contact_id', ids),
    supabase.from('profiles').select('contact_id').in('contact_id', ids),
  ]);
  const leadCount: Record<string, number> = {};
  for (const l of (leads ?? []) as any[]) leadCount[l.contact_id] = (leadCount[l.contact_id] ?? 0) + 1;
  const portal = new Set(((profiles ?? []) as any[]).map((p) => p.contact_id));
  const byId = new globalThis.Map<string, DupContact>(((contacts ?? []) as any[]).map((c) => [c.id, {
    id: c.id, full_name: c.full_name, email: c.email, phone: c.phone, created_at: c.created_at,
    leads: leadCount[c.id] ?? 0, isBuyer: !!c.is_buyer, hasPortal: portal.has(c.id),
  }]));
  const pairs = rows.flatMap((r) => {
    const a = byId.get(r.a); const b = byId.get(r.b);
    return a && b ? [{ a, b, reasons: r.reasons ?? [] }] : [];
  });
  return { pairs, missing: false };
}
