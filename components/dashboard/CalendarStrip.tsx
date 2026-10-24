'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Video, CalendarDays } from 'lucide-react';
import { formatTime, formatWeekdayDate, formatMonthYear, formatWeekdayMini } from '@/lib/format';

export type EventType = 'viewing' | 'followup' | 'task' | 'meeting' | 'external';
export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  type: EventType;
  href?: string | null;
  meetingLink?: string | null;
  durationMin?: number;
  color?: string | null;
  priority?: string | null;
  attendees?: { email: string; name?: string | null; avatar_url?: string | null }[];
  status?: string | null;        // scheduled | in_progress | completed | cancelled
  eventId?: string | null;       // raw calendar_events id (drag/resize persistence)
  recurring?: boolean;           // part of a recurring series (read-only occurrence)
  occurrenceISO?: string | null; // this occurrence's start (for recurring edit scope)
}

const DOT: Record<EventType, string> = {
  viewing: 'bg-champagne-600',
  followup: 'bg-forest',
  task: 'bg-sky-500',
  meeting: 'bg-violet-500',
  external: 'bg-stone-400',
};

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); // Monday
  x.setHours(0, 0, 0, 0);
  return x;
}
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const fmtTime = (iso: string) => formatTime(new Date(iso));

/** Compact horizontal week strip with meeting dots + a side agenda for the
 *  selected day. Light, premium, operational. */
export function CalendarStrip({ events }: { events: CalendarEvent[] }) {
  const [anchor, setAnchor] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const today = new Date();

  const weekStart = startOfWeek(anchor);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const eventsByDay = (d: Date) => events.filter((e) => sameDay(new Date(e.start), d)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  const agenda = eventsByDay(selected);

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {/* Strip */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-medium text-charcoal">{formatMonthYear(weekStart)}</span>
          <div className="flex items-center gap-1">
            <button onClick={() => setAnchor(addDays(weekStart, -7))} className="rounded-lg border border-stone-line p-1 text-charcoal-600 hover:bg-sand-100"><ChevronLeft size={15} /></button>
            <button onClick={() => { setAnchor(new Date()); setSelected(new Date()); }} className="rounded-lg border border-stone-line px-2 py-1 text-xs text-charcoal-600 hover:bg-sand-100">Today</button>
            <button onClick={() => setAnchor(addDays(weekStart, 7))} className="rounded-lg border border-stone-line p-1 text-charcoal-600 hover:bg-sand-100"><ChevronRight size={15} /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const dayEvents = eventsByDay(d);
            const isSel = sameDay(d, selected);
            const isToday = sameDay(d, today);
            return (
              <button
                key={d.toISOString()}
                onClick={() => setSelected(d)}
                className={`flex flex-col items-center rounded-xl border px-1 py-2 transition-colors ${isSel ? 'border-forest bg-forest text-white' : isToday ? 'border-champagne/50 bg-champagne-50' : 'border-stone-line bg-white hover:bg-champagne-50'}`}
              >
                <span className={`text-[10px] uppercase tracking-wide ${isSel ? 'text-white/70' : 'text-charcoal-600/60'}`}>{formatWeekdayMini(d)}</span>
                <span className={`figure mt-0.5 text-sm font-medium ${isSel ? 'text-white' : isToday ? 'text-champagne-600' : 'text-charcoal'}`}>{d.getDate()}</span>
                <span className="mt-1.5 flex h-1.5 items-center gap-0.5">
                  {dayEvents.slice(0, 4).map((e) => (
                    <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${isSel ? 'bg-white/80' : DOT[e.type]}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Side agenda */}
      <div className="rounded-xl bg-sand-100/60 p-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium text-charcoal">
          <CalendarDays size={14} className="text-forest" strokeWidth={1.75} />
          {sameDay(selected, today) ? 'Today' : formatWeekdayDate(selected)}
        </p>
        {agenda.length === 0 ? (
          <p className="text-sm text-charcoal-600/60">Nothing scheduled.</p>
        ) : (
          <ul className="max-h-44 space-y-2 overflow-y-auto pr-1">
            {agenda.map((e) => {
              const inner = (
                <span className="flex items-center gap-2 overflow-hidden">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${DOT[e.type]}`} />
                  <span className="figure shrink-0 text-xs text-charcoal-600/70">{fmtTime(e.start)}</span>
                  <span className="truncate text-charcoal">{e.title}</span>
                </span>
              );
              return (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  {e.href ? <Link href={e.href} className="overflow-hidden hover:text-forest">{inner}</Link> : inner}
                  {e.meetingLink && <a href={e.meetingLink} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700 hover:bg-violet-500/20"><Video size={10} /> Join</a>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
