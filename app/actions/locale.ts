'use server';

import { cookies } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LOCALE_COOKIE, parseLocale, serializeLocale, type Lang, type NumFmt } from '@/lib/locale-shared';

/**
 * My language and number format. Saved on my account (so it follows me to
 * other devices at the next sign-in) and in the cookie the pages read.
 */
export async function setMyLocale(lang: Lang, num: NumFmt): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = parseLocale(`${lang}.${num}`);
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    const { error } = await supabase.auth.updateUser({ data: { locale: serializeLocale(p) } });
    if (error) return { ok: false, error: error.message };
  }
  (await cookies()).set(LOCALE_COOKIE, serializeLocale(p), { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return { ok: true };
}
