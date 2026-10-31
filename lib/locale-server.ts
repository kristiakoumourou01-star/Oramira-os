import { cookies } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type LocalePrefs } from '@/lib/locale-shared';

/**
 * Server half of the locale: teaches lib/locale-shared's currentLocale() to read
 * the request cookie. Imported (for this side effect) by the root layout and
 * lib/auth, so it is registered before any page formats a date or a number.
 * Outside a request (cron, emails) it falls back to the default.
 */
export function requestLocale(): LocalePrefs {
  try {
    return parseLocale(cookies().get(LOCALE_COOKIE)?.value);
  } catch {
    return DEFAULT_LOCALE;
  }
}

(globalThis as any).__oramiraLocale = requestLocale;
