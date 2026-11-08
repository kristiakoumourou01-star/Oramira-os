/**
 * Language and number format — per user (Settings → «Η δική μου προβολή» /
 * the language switch in the top bar), with a company default.
 *
 * The choice travels in the `oramira_locale` cookie ("el.dot"), so the server
 * and the browser format identically (no hydration mismatch):
 *  - server: lib/locale-server registers a getter that reads the cookie;
 *  - browser: the root layout writes it on <html data-lang data-num>.
 * Client-safe: no server imports here.
 */

export type Lang = 'el' | 'en' | 'ru';
export type NumFmt = 'dot' | 'comma';
export interface LocalePrefs { lang: Lang; num: NumFmt }

export const LOCALE_COOKIE = 'oramira_locale';
export const DEFAULT_LOCALE: LocalePrefs = { lang: 'el', num: 'dot' };

export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: 'el', label: 'Ελληνικά', short: 'EL' },
  { value: 'en', label: 'English', short: 'EN' },
  { value: 'ru', label: 'Русский', short: 'RU' },
];
export const NUM_FORMATS: { value: NumFmt; label: string }[] = [
  { value: 'dot', label: '€1.250.000,50' },
  { value: 'comma', label: '€1,250,000.50' },
];

/** BCP-47 tags: dates follow the language, numbers follow the chosen format. */
export const DATE_TAG: Record<Lang, string> = { el: 'el-GR', en: 'en-GB', ru: 'ru-RU' };
export const NUM_TAG: Record<NumFmt, string> = { dot: 'de-DE', comma: 'en-GB' };

export function parseLocale(raw: string | null | undefined, fallback: LocalePrefs = DEFAULT_LOCALE): LocalePrefs {
  const [l, n] = String(raw ?? '').split('.');
  return {
    lang: (['el', 'en', 'ru'] as const).find((x) => x === l) ?? fallback.lang,
    num: (['dot', 'comma'] as const).find((x) => x === n) ?? fallback.num,
  };
}
export const serializeLocale = (p: LocalePrefs) => `${p.lang}.${p.num}`;

/** The locale in effect right now (browser: <html> attributes; server: the request cookie). */
export function currentLocale(): LocalePrefs {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    const d = document.documentElement.dataset;
    return parseLocale(`${d.lang ?? ''}.${d.num ?? ''}`);
  }
  try {
    const get = (globalThis as any).__oramiraLocale as (() => LocalePrefs) | undefined;
    return get ? get() : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Μικρή μετάφραση κειμένου μέσα σε component: `tx('Αποθήκευση', 'Save')`.
 * Τα ρωσικά, όπου δεν δίνονται, πέφτουν στα αγγλικά.
 */
export function tx(el: string, en: string, ru?: string, lang: Lang = currentLocale().lang): string {
  return lang === 'el' ? el : lang === 'ru' ? (ru ?? en) : en;
}
