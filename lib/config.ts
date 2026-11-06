/**
 * Application-wide locale & timezone configuration — the single place these are
 * defined. Formatting helpers (lib/format.ts) and anything else locale/tz aware
 * MUST read from here rather than hardcoding a locale or timezone, so the whole
 * app can be re-pointed to a different region by changing one value (or one env
 * var) without touching any formatter implementation.
 *
 * A FIXED timezone (not the runtime default) is what keeps server and client
 * rendering byte-identical — the server runs in UTC, a browser runs in the
 * visitor's local zone, so an unpinned `Intl.*Format` would hydrate-mismatch on
 * any time-of-day. Pinning to the business timezone (Cyprus) makes every user
 * see the same, correct local time deterministically.
 *
 * Overridable at build/deploy time via NEXT_PUBLIC_* env (must be NEXT_PUBLIC_
 * so the value is identical on server and client).
 */

/** BCP-47 locale, e.g. "en-GB". */
export const APP_LOCALE = process.env.NEXT_PUBLIC_APP_LOCALE || 'en-GB';

/** IANA timezone, e.g. "Asia/Nicosia" (Cyprus, EET/EEST). */
export const APP_TIMEZONE = process.env.NEXT_PUBLIC_APP_TIMEZONE || 'Asia/Nicosia';

/** ISO 4217 currency code for the region. */
export const APP_CURRENCY = process.env.NEXT_PUBLIC_APP_CURRENCY || 'EUR';
