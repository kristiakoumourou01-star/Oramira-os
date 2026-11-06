/**
 * Single source of truth for locale-sensitive date / time / number formatting.
 *
 * NOTHING in the app should format a date independently — not `.toLocale*()`,
 * not `Intl.*Format` inline, not `date-fns`, not hand-built `getDate()` /
 * weekday-array strings. Every date, time, relative date, calendar label and
 * number goes through a helper here.
 *
 * Why: server and client MUST produce byte-identical output or React throws a
 * hydration mismatch (e.g. server renders US "6/16/2026", browser hydrates
 * en-GB "16/06/2026"). A single fixed locale guarantees determinism.
 *
 * Naming: `format<Shape>` — pick by what you want to SHOW, not by page.
 *   formatDate            16 Jun 2026
 *   formatLongDate        16 June 2026
 *   formatDayMonth        16 Jun            (short, no year)
 *   formatDateTime        16 Jun 2026, 14:30
 *   formatDayMonthTime    16 Jun, 14:30
 *   formatTime            14:30
 *   formatWeekday         Mon
 *   formatWeekdayMini     Mo                (calendar column heads)
 *   formatWeekdayTime     Mon, 14:30
 *   formatWeekdayDate     Monday, 16 Jun
 *   formatWeekdayLongDate Monday, 16 July
 *   formatMonthYear       July 2026         (calendar / planner titles)
 *   formatDayNum          16                (calendar day cell)
 *   formatRelative        3 days ago / in 2 hours / just now
 *   formatNumber          1,234,567
 *   formatDecimal         1,234.50
 *   isoDate               2026-07-16        (form <input type=date> values / keys)
 */

import { APP_TIMEZONE } from '@/lib/config';
import { currentLocale, DATE_TAG, NUM_TAG, type LocalePrefs } from '@/lib/locale-shared';

export type DateInput = string | number | Date | null | undefined;

function toDate(input: DateInput): Date | null {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Every date formatter pins the app timezone (from config) so the server (UTC)
// and the client (visitor's local zone) render identical output — an unpinned
// time-of-day is a hydration mismatch. `tz` is spread into each date format.
const tz = { timeZone: APP_TIMEZONE } as const;

/**
 * Formatters for the CURRENT user's language (dates) and number format
 * (1.250.000 or 1,250,000) — see lib/locale-shared. Built once per locale.
 */
function build(p: LocalePrefs) {
  const L = DATE_TAG[p.lang];
  const N = NUM_TAG[p.num];
  return {
    date: new Intl.DateTimeFormat(L, { day: '2-digit', month: 'short', year: 'numeric', ...tz }),
    longDate: new Intl.DateTimeFormat(L, { day: 'numeric', month: 'long', year: 'numeric', ...tz }),
    dayMonth: new Intl.DateTimeFormat(L, { day: 'numeric', month: 'short', ...tz }),
    dateTime: new Intl.DateTimeFormat(L, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
    dayMonthTime: new Intl.DateTimeFormat(L, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
    time: new Intl.DateTimeFormat(L, { hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
    weekday: new Intl.DateTimeFormat(L, { weekday: 'short', ...tz }),
    weekdayTime: new Intl.DateTimeFormat(L, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
    weekdayDate: new Intl.DateTimeFormat(L, { weekday: 'long', day: 'numeric', month: 'short', ...tz }),
    weekdayLongDate: new Intl.DateTimeFormat(L, { weekday: 'long', day: 'numeric', month: 'long', ...tz }),
    monthYear: new Intl.DateTimeFormat(L, { month: 'long', year: 'numeric', ...tz }),
    dayNum: new Intl.DateTimeFormat(L, { day: 'numeric', ...tz }),
    number: new Intl.NumberFormat(N, { maximumFractionDigits: 3 }),
    whole: new Intl.NumberFormat(N, { maximumFractionDigits: 0 }),
    relative: new Intl.RelativeTimeFormat(L, { numeric: 'auto' }),
    decimals: new Map<number, Intl.NumberFormat>(),
    decimalSep: p.num === 'dot' ? ',' : '.',
    justNow: p.lang === 'el' ? 'μόλις τώρα' : p.lang === 'ru' ? 'только что' : 'just now',
  };
}
const CACHE = new Map<string, ReturnType<typeof build>>();
function fm() {
  const p = currentLocale();
  const k = `${p.lang}.${p.num}`;
  let f = CACHE.get(k);
  if (!f) { f = build(p); CACHE.set(k, f); }
  return f;
}

function d(fmt: Intl.DateTimeFormat, input: DateInput, fallback: string): string {
  const date = toDate(input);
  return date ? fmt.format(date) : fallback;
}

/** "16 Jun 2026". */
export const formatDate = (i: DateInput, fallback = '—') => d(fm().date, i, fallback);
/** "16 June 2026". */
export const formatLongDate = (i: DateInput, fallback = '—') => d(fm().longDate, i, fallback);
/** "16 Jun" — short, no year. */
export const formatDayMonth = (i: DateInput, fallback = '—') => d(fm().dayMonth, i, fallback);
/** "16 Jun 2026, 14:30". */
export const formatDateTime = (i: DateInput, fallback = '—') => d(fm().dateTime, i, fallback);
/** "16 Jun, 14:30" — short date + time, no year. */
export const formatDayMonthTime = (i: DateInput, fallback = '—') => d(fm().dayMonthTime, i, fallback);
/** "14:30" (24h). */
export const formatTime = (i: DateInput, fallback = '—') => d(fm().time, i, fallback);
/** "Mon". */
export const formatWeekday = (i: DateInput, fallback = '—') => d(fm().weekday, i, fallback);
/** "Mon, 14:30". */
export const formatWeekdayTime = (i: DateInput, fallback = '—') => d(fm().weekdayTime, i, fallback);
/** "Monday, 16 Jun". */
export const formatWeekdayDate = (i: DateInput, fallback = '—') => d(fm().weekdayDate, i, fallback);
/** "Monday, 16 July". */
export const formatWeekdayLongDate = (i: DateInput, fallback = '—') => d(fm().weekdayLongDate, i, fallback);
/** "July 2026" — calendar / planner month titles. */
export const formatMonthYear = (i: DateInput, fallback = '—') => d(fm().monthYear, i, fallback);
/** "16" — calendar day-cell number. */
export const formatDayNum = (i: DateInput, fallback = '—') => d(fm().dayNum, i, fallback);

/** "Mo" / "Tu" — two-letter calendar column head. */
export const formatWeekdayMini = (i: DateInput, fallback = '—') => {
  const w = d(fm().weekday, i, '');
  return w ? w.slice(0, 2) : fallback;
};

/** "3 days ago" / "in 2 hours" / "just now". Coarse (>= minutes) so it stays
 *  stable across the SSR→hydration gap. */
export function formatRelative(input: DateInput, fallback = '—'): string {
  const date = toDate(input);
  if (!date) return fallback;
  const diffMs = date.getTime() - Date.now();
  const abs = Math.abs(diffMs);
  const min = 60_000, hour = 60 * min, day = 24 * hour, week = 7 * day, month = 30 * day, year = 365 * day;
  if (abs < min) return fm().justNow;
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    abs < hour ? [Math.round(diffMs / min), 'minute']
    : abs < day ? [Math.round(diffMs / hour), 'hour']
    : abs < week ? [Math.round(diffMs / day), 'day']
    : abs < month ? [Math.round(diffMs / week), 'week']
    : abs < year ? [Math.round(diffMs / month), 'month']
    : [Math.round(diffMs / year), 'year'];
  return fm().relative.format(value, unit);
}

/** "1,234,567" — locale-safe integer grouping (drop-in for `.toLocaleString()`). */
export function formatNumber(input: number | null | undefined, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  return fm().number.format(input);
}

/** "1,234.50" — fixed-decimal (money-style) grouping. */
export function formatDecimal(input: number | null | undefined, digits = 2, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  const f = fm();
  let n = f.decimals.get(digits);
  if (!n) { n = new Intl.NumberFormat(NUM_TAG[currentLocale().num], { minimumFractionDigits: digits, maximumFractionDigits: digits }); f.decimals.set(digits, n); }
  return n.format(input);
}

/** "€1.234.567" or "€1,234,567" (the user's number format) — whole units. The single currency formatter — replaces every per-file
 *  `eur()` helper. Rounds to whole units (use formatDecimal for cents). */
export function formatCurrency(input: number | null | undefined, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  return (input < 0 ? '−€' : '€') + fm().whole.format(Math.abs(Math.round(input)));
}

/** "€1.2M" / "€300K" — compact currency for dense KPI / map contexts. */
export function formatCurrencyCompact(input: number | null | undefined, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  const f = fm();
  const a = Math.abs(input);
  const [v, unit] = a >= 1e9 ? [a / 1e9, 'B'] : a >= 1e6 ? [a / 1e6, 'M'] : a >= 1e3 ? [a / 1e3, 'K'] : [a, ''];
  const r = Math.round(v * 10) / 10;
  const txt = (Number.isInteger(r) ? String(r) : r.toFixed(1).replace('.', f.decimalSep)) + unit;
  return (input < 0 ? '−€' : '€') + txt;
}

/** "2026-07-16" — for `<input type="date">` values and date keys (UTC, stable).
 *  This is NOT display formatting; use formatDate for anything user-facing. */
export function isoDate(input?: DateInput): string {
  const date = toDate(input ?? new Date());
  return (date ?? new Date()).toISOString().slice(0, 10);
}
