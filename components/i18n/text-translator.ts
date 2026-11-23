'use client';

import { currentLocale } from '@/lib/locale-shared';
import { compile } from '@/components/i18n/DomTranslator';

const GREEK = /[Ͱ-Ͽἀ-῿]/;
const LATIN = /[A-Za-z]{2}/;

/**
 * Μεταφραστής κειμένων για αρχεία που κατεβαίνουν (CSV, Excel, PDF): ίδιο λεξικό
 * με την οθόνη, στη γλώσσα του χρήστη. Ό,τι δεν βρεθεί μένει όπως είναι.
 */
export async function loadTextTranslator(): Promise<(s: string) => string> {
  const lang = currentLocale().lang;
  const [gd, ld] = await Promise.all([
    lang === 'ru' ? import('@/lib/i18n-dict/ru').then((m) => m.RU) : lang === 'en' ? import('@/lib/i18n-dict/en').then((m) => m.EN) : Promise.resolve(null),
    lang === 'el' ? import('@/lib/i18n-dict/from-en').then((m) => m.EN_EL) : lang === 'ru' ? import('@/lib/i18n-dict/from-en').then((m) => m.EN_RU) : Promise.resolve(null),
  ]);
  const trG = gd ? compile(gd) : () => null;
  const trL = ld ? compile(ld) : () => null;
  return (v: string) => {
    if (!v) return v;
    const t = GREEK.test(v) ? trG(v) : LATIN.test(v) ? trL(v) : null;
    return t ?? v;
  };
}
