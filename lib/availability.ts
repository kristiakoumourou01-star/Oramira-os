import { overlaps, type BusyBlock } from '@/lib/scheduling';

/**
 * Availability engine — the pure computational core of Oramira's native booking
 * system (the Calendly replacement). Given an agent's busy blocks + working
 * hours, it enumerates every bookable slot across a horizon, grouped by day.
 * Deterministic and side-effect-free: the public booking page, agent booking
 * pages, self-service reschedule and AI suggestions all consume this one engine.
 */

export interface DaySlots { date: string; slots: string[] } // date = YYYY-MM-DD, slots = ISO

export interface AvailabilityOptions {
  busy: BusyBlock[];
  durationMin?: number;      // slot length (default 45)
  horizonDays?: number;      // how far ahead to scan (default 21)
  maxDays?: number;          // cap of days *with* availability to return (default 10)
  now?: Date;
  minLeadMinutes?: number;   // don't offer slots sooner than this (default 120 = 2h notice)
  workStartHour?: number;    // default 09:00
  workEndHour?: number;      // default 19:00
  slotStepMin?: number;      // granularity of slot starts (default 30)
  workDays?: number[];       // JS getDay() values that are bookable (default Mon–Fri)
}

const DEFAULTS = { durationMin: 45, horizonDays: 21, maxDays: 10, minLeadMinutes: 120, workStartHour: 9, workEndHour: 19, slotStepMin: 30 };
const WEEKDAYS = [1, 2, 3, 4, 5];

/** All bookable slots across the horizon, grouped by day (empty days omitted). */
export function computeAvailability(opts: AvailabilityOptions): DaySlots[] {
  const o = { ...DEFAULTS, ...opts };
  const workDays = opts.workDays ?? WEEKDAYS;
  const now = opts.now ?? new Date();
  const earliest = now.getTime() + o.minLeadMinutes * 60000;

  const days: DaySlots[] = [];
  const base = new Date(now); base.setHours(0, 0, 0, 0);

  for (let d = 0; d < o.horizonDays && days.length < o.maxDays; d++) {
    const day = new Date(base); day.setDate(base.getDate() + d);
    if (!workDays.includes(day.getDay())) continue;

    const slots: string[] = [];
    for (let min = o.workStartHour * 60; min + o.durationMin <= o.workEndHour * 60; min += o.slotStepMin) {
      const start = new Date(day); start.setHours(0, min, 0, 0);
      const startMs = start.getTime();
      const endMs = startMs + o.durationMin * 60000;
      if (startMs < earliest) continue;
      if (!overlaps(startMs, endMs, o.busy)) slots.push(start.toISOString());
    }
    if (slots.length) days.push({ date: `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`, slots });
  }
  return days;
}

/** Total bookable slot count — for "12 times available this week" style copy. */
export function countSlots(days: DaySlots[]): number {
  return days.reduce((n, d) => n + d.slots.length, 0);
}
