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

import { APP_LOCALE, APP_TIMEZONE, APP_CURRENCY } from '@/lib/config';

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

// Pre-built formatters (constructing Intl.* is comparatively expensive).
const F = {
  date: new Intl.DateTimeFormat(APP_LOCALE, { day: '2-digit', month: 'short', year: 'numeric', ...tz }),
  longDate: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'long', year: 'numeric', ...tz }),
  dayMonth: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', ...tz }),
  dateTime: new Intl.DateTimeFormat(APP_LOCALE, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
  dayMonthTime: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
  time: new Intl.DateTimeFormat(APP_LOCALE, { hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
  weekday: new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short', ...tz }),
  weekdayTime: new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false, ...tz }),
  weekdayDate: new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'short', ...tz }),
  weekdayLongDate: new Intl.DateTimeFormat(APP_LOCALE, { weekday: 'long', day: 'numeric', month: 'long', ...tz }),
  monthYear: new Intl.DateTimeFormat(APP_LOCALE, { month: 'long', year: 'numeric', ...tz }),
  dayNum: new Intl.DateTimeFormat(APP_LOCALE, { day: 'numeric', ...tz }),
  number: new Intl.NumberFormat(APP_LOCALE),
  currency: new Intl.NumberFormat(APP_LOCALE, { style: 'currency', currency: APP_CURRENCY, maximumFractionDigits: 0 }),
  currencyCompact: new Intl.NumberFormat(APP_LOCALE, { style: 'currency', currency: APP_CURRENCY, notation: 'compact', maximumFractionDigits: 1 }),
} as const;

const relative = new Intl.RelativeTimeFormat(APP_LOCALE, { numeric: 'auto' });

function d(fmt: Intl.DateTimeFormat, input: DateInput, fallback: string): string {
  const date = toDate(input);
  return date ? fmt.format(date) : fallback;
}

/** "16 Jun 2026". */
export const formatDate = (i: DateInput, fallback = '—') => d(F.date, i, fallback);
/** "16 June 2026". */
export const formatLongDate = (i: DateInput, fallback = '—') => d(F.longDate, i, fallback);
/** "16 Jun" — short, no year. */
export const formatDayMonth = (i: DateInput, fallback = '—') => d(F.dayMonth, i, fallback);
/** "16 Jun 2026, 14:30". */
export const formatDateTime = (i: DateInput, fallback = '—') => d(F.dateTime, i, fallback);
/** "16 Jun, 14:30" — short date + time, no year. */
export const formatDayMonthTime = (i: DateInput, fallback = '—') => d(F.dayMonthTime, i, fallback);
/** "14:30" (24h). */
export const formatTime = (i: DateInput, fallback = '—') => d(F.time, i, fallback);
/** "Mon". */
export const formatWeekday = (i: DateInput, fallback = '—') => d(F.weekday, i, fallback);
/** "Mon, 14:30". */
export const formatWeekdayTime = (i: DateInput, fallback = '—') => d(F.weekdayTime, i, fallback);
/** "Monday, 16 Jun". */
export const formatWeekdayDate = (i: DateInput, fallback = '—') => d(F.weekdayDate, i, fallback);
/** "Monday, 16 July". */
export const formatWeekdayLongDate = (i: DateInput, fallback = '—') => d(F.weekdayLongDate, i, fallback);
/** "July 2026" — calendar / planner month titles. */
export const formatMonthYear = (i: DateInput, fallback = '—') => d(F.monthYear, i, fallback);
/** "16" — calendar day-cell number. */
export const formatDayNum = (i: DateInput, fallback = '—') => d(F.dayNum, i, fallback);

/** "Mo" / "Tu" — two-letter calendar column head. */
export const formatWeekdayMini = (i: DateInput, fallback = '—') => {
  const w = d(F.weekday, i, '');
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
  if (abs < min) return 'just now';
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    abs < hour ? [Math.round(diffMs / min), 'minute']
    : abs < day ? [Math.round(diffMs / hour), 'hour']
    : abs < week ? [Math.round(diffMs / day), 'day']
    : abs < month ? [Math.round(diffMs / week), 'week']
    : abs < year ? [Math.round(diffMs / month), 'month']
    : [Math.round(diffMs / year), 'year'];
  return relative.format(value, unit);
}

/** "1,234,567" — locale-safe integer grouping (drop-in for `.toLocaleString()`). */
export function formatNumber(input: number | null | undefined, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  return F.number.format(input);
}

/** "1,234.50" — fixed-decimal (money-style) grouping. */
export function formatDecimal(input: number | null | undefined, digits = 2, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  return new Intl.NumberFormat(APP_LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(input);
}

/** "€1,234,567" — whole-unit currency using APP_CURRENCY (symbol + grouping via
 *  the app locale). The single currency formatter — replaces every per-file
 *  `eur()` helper. Rounds to whole units (use formatDecimal for cents). */
export function formatCurrency(input: number | null | undefined, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  return F.currency.format(input);
}

/** "€1.2M" / "€300K" — compact currency for dense KPI / map contexts. */
export function formatCurrencyCompact(input: number | null | undefined, fallback = '—'): string {
  if (input === null || input === undefined || Number.isNaN(input)) return fallback;
  return F.currencyCompact.format(input);
}

/** "2026-07-16" — for `<input type="date">` values and date keys (UTC, stable).
 *  This is NOT display formatting; use formatDate for anything user-facing. */
export function isoDate(input?: DateInput): string {
  const date = toDate(input ?? new Date());
  return (date ?? new Date()).toISOString().slice(0, 10);
}
