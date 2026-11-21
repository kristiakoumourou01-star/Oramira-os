/**
 * Settings → Κωδικός σύνδεσης, Πληρωμές, Atlas AI (όπως στο FitnessCRM).
 * Αποθηκεύονται στο org_settings.data.extra. Client-safe.
 */
export interface ExtraSettings {
  /** Πώς παίρνουν οι πελάτες τον κωδικό μίας χρήσης στην εφαρμογή. */
  signInCode: 'sms' | 'email';
  /** Νόμισμα τιμών, πωλήσεων και αποδείξεων. */
  currency: 'EUR' | 'GBP';
  /** Ποιος πάροχος δέχεται πληρωμές καρτών στην εφαρμογή πελάτη. */
  paymentProvider: 'none' | 'viva' | 'jcc' | 'stripe';
  /** Αποδείξεις: αυτόματη αποστολή με email μετά από κάθε πληρωμή. */
  receipts: { issue: boolean; emailAutomatically: boolean; language: 'el' | 'en' | 'ru'; footer: string; showCustomer: boolean; showBreakdown: boolean; showTax: boolean };
  /** Atlas AI: ο βοηθός της πλατφόρμας. */
  atlas: { enabled: boolean; dailyBriefing: boolean; language: 'el' | 'en' | 'ru'; tone: 'concise' | 'detailed' };
}

export const DEFAULT_EXTRA: ExtraSettings = {
  signInCode: 'sms',
  currency: 'EUR',
  paymentProvider: 'none',
  receipts: { issue: true, emailAutomatically: true, language: 'el', footer: '', showCustomer: true, showBreakdown: true, showTax: true },
  atlas: { enabled: true, dailyBriefing: true, language: 'el', tone: 'concise' },
};

const pick = <T extends string>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);

export function mergeExtra(v: unknown): ExtraSettings {
  const x = (v && typeof v === 'object' ? v : {}) as Record<string, any>;
  const r = (x.receipts && typeof x.receipts === 'object' ? x.receipts : {}) as Record<string, unknown>;
  const a = (x.atlas && typeof x.atlas === 'object' ? x.atlas : {}) as Record<string, unknown>;
  const d = DEFAULT_EXTRA;
  return {
    signInCode: pick(x.signInCode, ['sms', 'email'] as const, d.signInCode),
    currency: pick(x.currency, ['EUR', 'GBP'] as const, d.currency),
    paymentProvider: pick(x.paymentProvider, ['none', 'viva', 'jcc', 'stripe'] as const, d.paymentProvider),
    receipts: {
      issue: bool(r.issue, d.receipts.issue),
      emailAutomatically: bool(r.emailAutomatically, d.receipts.emailAutomatically),
      language: pick(r.language, ['el', 'en', 'ru'] as const, d.receipts.language),
      footer: typeof r.footer === 'string' ? r.footer.slice(0, 500) : '',
      showCustomer: bool(r.showCustomer, d.receipts.showCustomer),
      showBreakdown: bool(r.showBreakdown, d.receipts.showBreakdown),
      showTax: bool(r.showTax, d.receipts.showTax),
    },
    atlas: {
      enabled: bool(a.enabled, d.atlas.enabled),
      dailyBriefing: bool(a.dailyBriefing, d.atlas.dailyBriefing),
      language: pick(a.language, ['el', 'en', 'ru'] as const, d.atlas.language),
      tone: pick(a.tone, ['concise', 'detailed'] as const, d.atlas.tone),
    },
  };
}
