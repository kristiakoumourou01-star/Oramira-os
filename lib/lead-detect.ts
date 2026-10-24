/**
 * Inbound lead auto-detection — pure heuristics (no AI, no network) used at
 * capture time to enrich a new contact/lead: language, buyer type, and which
 * project they're asking about. Keeps the intake chokepoint smart without
 * blocking on an API call. Server- and client-safe.
 */

import type { BuyerType } from '@/lib/sales-doctrine';

const CYRILLIC = /[Ѐ-ӿ]/;
const GREEK = /[Ͱ-Ͽ]/;

/** Detect message language from script. Returns null when undetermined. */
export function detectLanguage(text?: string | null): 'ru' | 'el' | 'en' | null {
  if (!text) return null;
  if (CYRILLIC.test(text)) return 'ru';
  if (GREEK.test(text)) return 'el';
  return null; // default English is applied downstream, not asserted here
}

// Calling-code prefixes for the CIS bloc (Russia/Kazakhstan share +7).
const CIS_PREFIXES = ['+7', '+375', '+380', '+374', '+994', '+995', '+996', '+998', '+992', '+993'];

/** Buyer type from phone country code. */
export function buyerTypeFromPhone(phone?: string | null): BuyerType | null {
  if (!phone) return null;
  const p = phone.replace(/[\s()-]/g, '');
  if (p.startsWith('+357') || p.startsWith('00357')) return 'local_cypriot';
  if (CIS_PREFIXES.some((c) => p.startsWith(c))) return 'russian_cis';
  if (p.startsWith('+')) return 'international';
  return null;
}

/**
 * Combine phone + message signals into a buyer type. Language is the strongest
 * signal (a Russian-script enquiry is a CIS buyer wherever the number is from),
 * then phone country code, defaulting to international.
 */
export function detectBuyerType(args: { phone?: string | null; message?: string | null }): BuyerType {
  const lang = detectLanguage(args.message);
  if (lang === 'ru') return 'russian_cis';
  const byPhone = buyerTypeFromPhone(args.phone);
  if (lang === 'el' && (!byPhone || byPhone === 'international')) return 'local_cypriot';
  return byPhone ?? 'international';
}

/** The preferred language implied by a buyer type, for template selection. */
export function languageForBuyerType(bt: BuyerType): 'ru' | 'el' | 'en' {
  if (bt === 'russian_cis') return 'ru';
  if (bt === 'local_cypriot') return 'el';
  return 'en';
}

/** Match a free-text enquiry to a known project by name. */
export function detectProjectInterest(text: string | null | undefined, projects: { id: string; name: string }[]): string | null {
  if (!text) return null;
  const t = text.toLowerCase();
  for (const p of projects) {
    if (p.name && t.includes(p.name.toLowerCase())) return p.id;
  }
  return null;
}
