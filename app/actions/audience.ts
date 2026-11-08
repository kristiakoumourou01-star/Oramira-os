'use server';

import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cell = (v: unknown) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

/**
 * Κοινό από επαφές (π.χ. «Αγοραστές που ταιριάζουν» σε μια μονάδα).
 * kind 'list' → πλήρης λίστα για Excel· kind 'ads' → αρχείο για Meta / Google Ads
 * Custom Audience (email, phone, fn, ln, country), ΜΟΝΟ όσοι έχουν δώσει
 * συγκατάθεση marketing (GDPR).
 */
export async function audienceCsv(contactIds: string[], kind: 'list' | 'ads'): Promise<{ ok: true; csv: string; included: number; excluded: number } | { ok: false; error: string }> {
  await requirePermission('marketing');
  const ids = [...new Set(contactIds.filter((x) => UUID.test(x)))].slice(0, 5000);
  if (!ids.length) return { ok: false, error: 'Δεν υπάρχουν επαφές.' };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any).from('contacts').select('id, full_name, email, phone, marketing_opt_in, preferred_language, tags').in('id', ids);
  if (error) return { ok: false, error: error.message };
  const rows = (data ?? []) as any[];
  if (kind === 'list') {
    const lines = ['Name,Email,Phone,Language,Marketing consent,Tags'];
    for (const r of rows) lines.push([r.full_name, r.email, r.phone, r.preferred_language, r.marketing_opt_in ? 'yes' : 'no', (r.tags ?? []).join(' | ')].map(cell).join(','));
    return { ok: true, csv: lines.join('\n'), included: rows.length, excluded: 0 };
  }
  const ok = rows.filter((r) => r.marketing_opt_in && (r.email || r.phone));
  const lines = ['email,phone,fn,ln,country'];
  for (const r of ok) {
    const [fn, ...ln] = String(r.full_name ?? '').trim().split(/\s+/);
    const phone = String(r.phone ?? '').replace(/[^\d+]/g, '');
    lines.push([String(r.email ?? '').trim().toLowerCase(), phone, fn ?? '', ln.join(' '), phone.startsWith('+357') || phone.startsWith('357') ? 'cy' : ''].map(cell).join(','));
  }
  return { ok: true, csv: lines.join('\n'), included: ok.length, excluded: rows.length - ok.length };
}

/** Βάζει ένα tag (π.χ. «Campaign: ORA HOMES UNIT A») στις επαφές — για φίλτρο, export και campaigns. */
export async function tagContacts(contactIds: string[], tag: string): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  await requirePermission('marketing');
  const t = tag.trim().slice(0, 60);
  if (!t) return { ok: false, error: 'Δώστε όνομα tag.' };
  const ids = [...new Set(contactIds.filter((x) => UUID.test(x)))].slice(0, 5000);
  const supabase = await createSupabaseServerClient();
  const { data } = await (supabase as any).from('contacts').select('id, tags').in('id', ids);
  let n = 0;
  for (const r of (data ?? []) as any[]) {
    const tags: string[] = Array.isArray(r.tags) ? r.tags : [];
    if (tags.includes(t)) continue;
    const { error } = await (supabase as any).from('contacts').update({ tags: [...tags, t] }).eq('id', r.id);
    if (!error) n++;
  }
  revalidatePath('/crm/customers');
  return { ok: true, count: n };
}
