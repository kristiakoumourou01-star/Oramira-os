/**
 * Scheduling intelligence — pure slot suggestion over busy blocks. Combines
 * working hours, urgency, and free/busy to propose the best next slots for a
 * follow-up, viewing, or negotiation call. Deterministic (works offline);
 * callers feed it busy blocks from Google + internal events.
 */

export interface BusyBlock { start: string; end: string }
export type Urgency = 'critical' | 'high' | 'normal' | 'low';

const WORK_START = 9;   // 09:00
const WORK_END = 19;    // 19:00
const STEP_MIN = 30;

export function overlaps(start: number, end: number, busy: BusyBlock[]): boolean {
  return busy.some((b) => {
    const bs = new Date(b.start).getTime();
    const be = new Date(b.end).getTime();
    return start < be && end > bs;
  });
}

/**
 * Suggest up to `count` free slots. Urgency sets how soon we begin: critical/high
 * start from the next rounded half-hour today; normal/low start tomorrow morning.
 */
export function suggestSlots(args: {
  busy: BusyBlock[];
  durationMin?: number;
  urgency?: Urgency;
  count?: number;
  now?: Date;
}): string[] {
  const duration = args.durationMin ?? 45;
  const count = args.count ?? 3;
  const now = args.now ?? new Date();
  const soon = args.urgency === 'critical' || args.urgency === 'high';

  const cursor = new Date(now);
  if (soon) {
    // round up to next half hour, min 30 min lead time
    cursor.setMinutes(cursor.getMinutes() + 30, 0, 0);
    cursor.setMinutes(cursor.getMinutes() < 30 ? 0 : 30, 0, 0);
  } else {
    cursor.setDate(cursor.getDate() + 1);
    cursor.setHours(WORK_START, 0, 0, 0);
  }

  const slots: string[] = [];
  let guard = 0;
  while (slots.length < count && guard < 2000) {
    guard += 1;
    const day = cursor.getDay();
    const hour = cursor.getHours();
    // Skip weekends and out-of-hours.
    if (day === 0 || day === 6 || hour < WORK_START || hour >= WORK_END) {
      cursor.setDate(cursor.getDate() + (day === 6 ? 2 : day === 0 ? 1 : (hour >= WORK_END ? 1 : 0)));
      if (hour >= WORK_END || hour < WORK_START) cursor.setHours(WORK_START, 0, 0, 0);
      continue;
    }
    const start = cursor.getTime();
    const end = start + duration * 60000;
    if (start > now.getTime() && !overlaps(start, end, args.busy)) {
      slots.push(new Date(start).toISOString());
    }
    cursor.setMinutes(cursor.getMinutes() + STEP_MIN);
  }
  return slots;
}

/** Internal events → busy blocks (so suggestions avoid existing commitments). */
export function eventsToBusy(events: { start: string; durationMin?: number }[]): BusyBlock[] {
  return events.map((e) => ({ start: new Date(e.start).toISOString(), end: new Date(new Date(e.start).getTime() + (e.durationMin ?? 45) * 60000).toISOString() }));
}
