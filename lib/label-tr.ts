import { unstable_cache, revalidateTag } from 'next/cache';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { scriptLang, type LabelMap } from '@/lib/localize';
import type { Lang } from '@/lib/locale-shared';

/**
 * Αυτόματη μετάφραση των ονομάτων που γράφει η εταιρεία (στάδια, τμήματα,
 * πεδία, μενού, ρόλοι). Κάθε κείμενο μεταφράζεται μία φορά σε el/en/ru μέσω
 * της δωρεάν υπηρεσίας MyMemory και κρατιέται στον πίνακα label_translations.
 * Αν η υπηρεσία δεν απαντήσει, το όνομα εμφανίζεται όπως γράφτηκε και
 * ξαναδοκιμάζεται αργότερα.
 */
export const LABEL_TR_TAG = 'label-translations';
const LANGS: Lang[] = ['el', 'en', 'ru'];
/** Αν η υπηρεσία δεν απαντά, δεν την ξαναρωτάμε για λίγα λεπτά (να μην καθυστερούν οι σελίδες). */
let coolUntil = 0;

export const getLabelMap = unstable_cache(
  async (): Promise<LabelMap> => {
    const { data } = await (createSupabaseServiceRoleClient() as any).from('label_translations').select('src, lang, text').limit(5000);
    const map: LabelMap = {};
    for (const r of (data ?? []) as { src: string; lang: Lang; text: string }[]) (map[r.src] ??= {})[r.lang] = r.text;
    return map;
  },
  ['label-translations-v1'],
  { tags: [LABEL_TR_TAG], revalidate: 3600 },
);

async function translateOne(text: string, from: Lang, to: Lang, signal: AbortSignal): Promise<string | null> {
  const u = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
  const r = await fetch(u, { signal, cache: 'no-store' });
  if (!r.ok) return null;
  const j: any = await r.json();
  const t = String(j?.responseData?.translatedText ?? '').trim();
  if (!t || Number(j?.responseStatus) !== 200 || /MYMEMORY WARNING|QUERY LENGTH LIMIT|INVALID/i.test(t)) return null;
  // Κρατάμε τη μορφή: αν το αρχικό ξεκινά με κεφαλαίο, και η μετάφραση.
  return /^\p{Lu}/u.test(text) ? t.charAt(0).toUpperCase() + t.slice(1) : t;
}

/**
 * Μεταφράζει ό,τι λείπει (έως `budgetMs`) και το αποθηκεύει. Επιστρέφει true
 * αν προστέθηκε κάτι.
 */
export async function ensureLabelTranslations(texts: string[], map: LabelMap, budgetMs = 4000): Promise<boolean> {
  const missing = (src: string) => LANGS.filter((to) => to !== scriptLang(src) && !map[src]?.[to]);
  let todo = texts.filter((t) => missing(t).length);
  if (!todo.length) return false;
  // Ίσως τις έχει ήδη ο πίνακας (η μνήμη cache δεν έχει ανανεωθεί ακόμη).
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: have } = await svc.from('label_translations').select('src, lang, text').in('src', todo.slice(0, 300));
  for (const r of (have ?? []) as { src: string; lang: Lang; text: string }[]) (map[r.src] ??= {})[r.lang] = r.text;
  todo = todo.filter((t) => missing(t).length);
  const jobs: { src: string; from: Lang; to: Lang }[] = [];
  for (const src of todo) for (const to of missing(src)) jobs.push({ src, from: scriptLang(src), to });
  if (!jobs.length) return (have ?? []).length > 0;
  if (Date.now() < coolUntil) return false;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), budgetMs);
  const rows: { src: string; lang: Lang; text: string }[] = [];
  try {
    // Λίγα παράλληλα αιτήματα — η υπηρεσία είναι δωρεάν.
    for (let i = 0; i < jobs.length && !ctl.signal.aborted; i += 6) {
      const batch = jobs.slice(i, i + 6);
      const res = await Promise.allSettled(batch.map((j) => translateOne(j.src, j.from, j.to, ctl.signal)));
      res.forEach((r, k) => { if (r.status === 'fulfilled' && r.value) rows.push({ src: batch[k].src, lang: batch[k].to, text: r.value.slice(0, 200) }); });
    }
  } catch { /* timeout / δίκτυο */ } finally { clearTimeout(timer); }
  if (!rows.length) { coolUntil = Date.now() + 10 * 60_000; return false; }
  const { error } = await svc.from('label_translations').upsert(rows, { onConflict: 'src,lang' });
  if (error) return false;
  for (const r of rows) (map[r.src] ??= {})[r.lang] = r.text;
  try { revalidateTag(LABEL_TR_TAG); } catch { /* εκτός request */ }
  return true;
}
