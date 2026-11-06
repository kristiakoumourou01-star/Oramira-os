'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarPlus, CheckSquare, UserPlus, Phone, ChevronLeft, ChevronRight, Video, Radio, Plus, CalendarClock, Repeat, Users, MoreVertical, Pencil, Copy, PlayCircle, CheckCircle2, XCircle, Trash2, Sparkles, Clock } from 'lucide-react';
import { LeaveRequestForm } from '@/components/hr/LeaveRequestForm';
import { CreateEventModal, type ModalPreset, type LeadOption, type ProjectOption, type TeamOption } from '@/components/dashboard/CreateEventModal';
import { RoutePlan } from '@/components/dashboard/RoutePlan';
import type { RoutePlan as RoutePlanData } from '@/lib/route-planner';
import { AvatarStack } from '@/components/dashboard/AvatarStack';
import { rescheduleCalendarEvent, setEventStatus, deleteCalendarEvent, cancelRecurringEvent, type RecurScope } from '@/app/actions/calendar';
import { getTeamBusy, type BusyEntry } from '@/app/actions/scheduling';
import type { CalendarEvent, EventType } from '@/components/dashboard/CalendarStrip';
import { formatDayMonth, formatTime, formatWeekday, formatWeekdayDate, formatDayNum } from '@/lib/format';

const GUTTER_PX = 50;

const START_HOUR = 7;
const END_HOUR = 22;
const HOUR_PX = 28; // compact timeline; canvas scrolls inside a capped box
const SNAP_PX = HOUR_PX / 4; // 15-minute snap
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => i + START_HOUR);

/** Naive natural-language quick-add → { title, startISO }. */
function parseQuickAdd(text: string, base: Date): { title: string; startISO: string } {
  let t = text.trim();
  const d = new Date(base);
  if (/\btomorrow\b/i.test(t)) { d.setDate(d.getDate() + 1); t = t.replace(/\btomorrow\b/i, ''); }
  else if (/\btoday\b/i.test(t)) { t = t.replace(/\btoday\b/i, ''); }
  const tm = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i) || t.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (tm) {
    let h = parseInt(tm[1], 10); const m = tm[2] ? parseInt(tm[2], 10) : 0; const ap = tm[3]?.toLowerCase();
    if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0;
    d.setHours(h, m, 0, 0);
    t = t.replace(tm[0], '');
  } else {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  }
  const title = t.replace(/\bat\b/i, '').replace(/\s+/g, ' ').trim();
  return { title: title ? title.charAt(0).toUpperCase() + title.slice(1) : 'New event', startISO: d.toISOString() };
}

function countdown(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60000));
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const BLOCK: Record<EventType, string> = {
  meeting: 'border-l-forest bg-forest/10 text-charcoal',
  viewing: 'border-l-champagne-600 bg-champagne-50 text-charcoal',
  followup: 'border-l-[#8A8560] bg-[#8A8560]/12 text-charcoal',
  task: 'border-l-champagne-600 bg-champagne-50 text-charcoal',
  external: 'border-l-[#C8A96B]/60 bg-[#F7F4EE] text-charcoal',
};
const DOT: Record<EventType, string> = {
  meeting: 'bg-forest', viewing: 'bg-champagne-600', followup: 'bg-[#8A8560]', task: 'bg-champagne-600', external: 'bg-[#C8A96B]',
};

const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const fmtTime = (iso: string) => formatTime(new Date(iso));
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const Card = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <div className={`ws-card ${className}`}>{children}</div>
);
const MenuItem = ({ icon: Icon, label, onClick, danger }: { icon: any; label: string; onClick: () => void; danger?: boolean }) => (
  <button onClick={onClick} className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors ${danger ? 'text-signal-danger hover:bg-signal-danger/5' : 'text-charcoal hover:bg-[#F5F1E8]'}`}><Icon size={13} strokeWidth={1.9} /> {label}</button>
);

export function PlannerBoard({ events: propEvents, leads = [], projects = [], team = [], routePlan }: { events: CalendarEvent[]; leads?: LeadOption[]; projects?: ProjectOption[]; team?: TeamOption[]; routePlan?: RoutePlanData }) {
  const today = new Date();
  const router = useRouter();
  const [plannerTab, setPlannerTab] = useState<'timeline' | 'route'>('timeline');
  // Optimistic events appear instantly on create; cleared when the server
  // refresh brings the real rows back through props.
  const [optimistic, setOptimistic] = useState<CalendarEvent[]>([]);
  useEffect(() => { setOptimistic([]); }, [propEvents]);
  const events = useMemo(() => (optimistic.length ? [...propEvents, ...optimistic] : propEvents), [propEvents, optimistic]);
  const [selected, setSelected] = useState(today);
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [preset, setPreset] = useState<ModalPreset | null>(null);
  const [quickAdd, setQuickAdd] = useState('');
  const [view, setView] = useState<'day' | '3day' | 'week'>('day');
  const [drag, setDrag] = useState<{ id: string; eventId: string; startY: number; offset: number; origTop: number; durationMin: number } | null>(null);
  const [resize, setResize] = useState<{ id: string; eventId: string; startY: number; offset: number; origHeight: number; startISO: string } | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [overlayIds, setOverlayIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<BusyEntry[]>([]);
  const [menu, setMenu] = useState<{ eventId: string; x: number; y: number; e: CalendarEvent } | null>(null);
  const [scopeDialog, setScopeDialog] = useState<{ action: 'edit' | 'cancel'; eventId: string; occurrenceISO: string; e: CalendarEvent } | null>(null);
  const [, setTick] = useState(0);
  // Gate current-time-dependent UI (now-line, countdowns) until after mount so
  // SSR and the first client render match — a minute ticking over between server
  // render and hydration is otherwise a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  const teamById = useMemo(() => new Map(team.map((m) => [m.id, m])), [team]);

  function runStatus(fn: Promise<void>) { fn.then(() => router.refresh()); setMenu(null); }

  // Live current-time line + countdowns (re-render each minute).
  useEffect(() => { setMounted(true); const id = setInterval(() => setTick((t) => t + 1), 60000); return () => clearInterval(id); }, []);
  const now = new Date();

  // Live-now: current + next event today.
  const todays = useMemo(() => events.filter((e) => sameDay(new Date(e.start), today)).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()), [events, today]);
  const nowMs = now.getTime();
  const currentEvent = todays.find((e) => { const s = new Date(e.start).getTime(); return nowMs >= s && nowMs < s + (e.durationMin ?? 45) * 60000; });
  const nextEvent = todays.find((e) => new Date(e.start).getTime() > nowMs);

  // System recommendations for empty/quiet days: overdue tasks & follow-ups
  // that still need a slot, plus a suggested next free hour.
  const overdueItems = useMemo(() => events
    .filter((e) => (e.type === 'task' || e.type === 'followup') && new Date(e.start).getTime() < nowMs && e.status !== 'completed' && e.status !== 'cancelled')
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()).slice(0, 4), [events, nowMs]);
  const suggestedSlotISO = useMemo(() => { const d = new Date(selected); const base = sameDay(selected, today) ? now : new Date(selected.setHours(9, 0, 0, 0)); const h = sameDay(selected, today) ? Math.min(END_HOUR - 1, base.getHours() + 1) : 9; d.setHours(h, 0, 0, 0); return d.toISOString(); }, [selected, today, nowMs]);

  function submitQuickAdd() {
    if (!quickAdd.trim()) return;
    const parsed = parseQuickAdd(quickAdd, selected);
    setPreset({ type: 'meeting', title: parsed.title, startISO: parsed.startISO });
    setQuickAdd('');
  }

  // Drag-to-move: keep the event's own date, change only its time.
  function endDrag(item: { e: CalendarEvent; top: number; height: number }) {
    const d = drag;
    setDrag(null);
    if (!d || d.id !== item.e.id) return;
    if (Math.abs(d.offset) < 4) { if (item.e.href) router.push(item.e.href); return; } // treated as a click
    const newTop = Math.max(0, d.origTop + d.offset);
    const snappedMin = Math.round(((newTop / HOUR_PX) * 60) / 15) * 15;
    const day = new Date(item.e.start); day.setHours(START_HOUR, 0, 0, 0);
    const newStart = new Date(day.getTime() + snappedMin * 60000);
    rescheduleCalendarEvent(d.eventId, newStart.toISOString(), d.durationMin).then(() => router.refresh());
  }

  // Resize: keep the start, change duration (min 15 min, 15-min snap).
  function endResize(item: { e: CalendarEvent; height: number }) {
    const r = resize;
    setResize(null);
    if (!r || r.id !== item.e.id) return;
    const newHeight = Math.max(SNAP_PX, r.origHeight + r.offset);
    const durationMin = Math.max(15, Math.round(((newHeight / HOUR_PX) * 60) / 15) * 15);
    rescheduleCalendarEvent(r.eventId, r.startISO, durationMin).then(() => router.refresh());
  }

  const eventDays = useMemo(() => new Set(events.map((e) => new Date(e.start).toDateString())), [events]);

  // Columns shown by view mode (Day / 3-Day / Week).
  const columns = useMemo(() => {
    if (view === 'day') return [selected];
    if (view === '3day') return [0, 1, 2].map((i) => addDays(selected, i));
    const ws = addDays(selected, -((selected.getDay() + 6) % 7)); // Monday
    return Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  }, [view, selected]);

  // Fetch team free/busy for the visible window when the overlay selection changes.
  const rangeKey = `${columns[0].toDateString()}_${columns[columns.length - 1].toDateString()}`;
  useEffect(() => {
    if (overlayIds.length === 0) { setBusy([]); return; }
    const tMin = new Date(columns[0]); tMin.setHours(0, 0, 0, 0);
    const tMax = new Date(columns[columns.length - 1]); tMax.setHours(23, 59, 59, 0);
    let cancelled = false;
    getTeamBusy({ memberIds: overlayIds, timeMin: tMin.toISOString(), timeMax: tMax.toISOString() }).then((r) => { if (!cancelled) setBusy(r); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overlayIds, rangeKey]);

  // Absolute layout (top/height + overlap columns) for one date.
  function layoutFor(date: Date) {
    const items = events
      .filter((e) => sameDay(new Date(e.start), date))
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .map((e) => { const s = new Date(e.start).getTime(); return { e, s, en: s + (e.durationMin ?? 45) * 60000 }; });
    return items.map((it) => {
      const group = items.filter((o) => it.s < o.en && o.s < it.en);
      const concurrency = Math.max(1, group.length);
      const index = Math.max(0, group.findIndex((o) => o.e.id === it.e.id));
      const startMin = new Date(it.s).getHours() * 60 + new Date(it.s).getMinutes();
      const top = Math.max(0, ((startMin - START_HOUR * 60) / 60) * HOUR_PX);
      const height = Math.max(26, ((it.en - it.s) / 3600000) * HOUR_PX - 2);
      return { e: it.e, top, height, widthPct: 100 / concurrency, leftPct: (index * 100) / concurrency };
    });
  }
  const VIEW_STEP = view === 'day' ? 1 : view === '3day' ? 3 : 7;

  // Suggested "ghost" placements for overdue tasks/follow-ups: drop each into the
  // next free hour of today's timeline so they can be rescheduled with one click.
  const HOUR_SPAN = END_HOUR - START_HOUR;
  function ghostPlacements(date: Date) {
    if (view !== 'day' || !sameDay(date, today) || overdueItems.length === 0) return [] as { item: CalendarEvent; top: number; height: number; hourIdx: number }[];
    const occupied = new Set(layoutFor(date).map((l) => Math.round(l.top / HOUR_PX)));
    const out: { item: CalendarEvent; top: number; height: number; hourIdx: number }[] = [];
    let hi = Math.max(0, Math.min(HOUR_SPAN - 1, now.getHours() - START_HOUR + 1));
    for (const item of overdueItems.slice(0, 3)) {
      while (hi < HOUR_SPAN && occupied.has(hi)) hi += 1;
      if (hi >= HOUR_SPAN) break;
      out.push({ item, top: hi * HOUR_PX + 2, height: HOUR_PX * 0.72, hourIdx: hi });
      occupied.add(hi); hi += 1;
    }
    return out;
  }

  const monthCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const start = addDays(first, -((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, i) => addDays(start, i));
  }, [month]);
  const years = Array.from({ length: 9 }, (_, i) => today.getFullYear() - 2 + i);

  const nowTop = ((now.getHours() * 60 + now.getMinutes() - START_HOUR * 60) / 60) * HOUR_PX;
  const nowInRange = mounted && now.getHours() >= START_HOUR && now.getHours() < END_HOUR;

  const quickActions = [
    { label: 'Schedule meeting', icon: CalendarPlus, onClick: () => setPreset({ type: 'meeting' }) },
    { label: 'Create task', icon: CheckSquare, onClick: () => setPreset({ type: 'task' }) },
    { label: 'Log call', icon: Phone, onClick: () => setPreset({ type: 'followup' }) },
  ];

  /** One absolutely-positioned event block (drag-to-move + bottom resize). */
  const renderEvent = (item: ReturnType<typeof layoutFor>[number]) => {
    const { e, top, height, widthPct, leftPct } = item;
    const dragging = drag?.id === e.id;
    const resizing = resize?.id === e.id;
    const topPx = top + (dragging ? drag!.offset : 0);
    const heightPx = Math.max(SNAP_PX, height + (resizing ? resize!.offset : 0));
    const colorStyle: React.CSSProperties = e.color
      ? { top: topPx, height: heightPx, left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)`, borderLeftColor: e.color, backgroundColor: `${e.color}14` }
      : { top: topPx, height: heightPx, left: `${leftPct}%`, width: `calc(${widthPct}% - 4px)` };
    const startMs = new Date(e.start).getTime();
    const live = e.status === 'in_progress' || (nowMs >= startMs && nowMs < startMs + (e.durationMin ?? 45) * 60000);
    const completed = e.status === 'completed';
    const highPriority = e.priority === 'high' || e.priority === 'critical';
    const draggable = !!e.eventId && !e.recurring; // recurring occurrences are not draggable
    return (
      <div
        key={e.id}
        onPointerDown={draggable ? (ev) => { ev.currentTarget.setPointerCapture?.(ev.pointerId); setDrag({ id: e.id, eventId: e.eventId!, startY: ev.clientY, offset: 0, origTop: top, durationMin: e.durationMin ?? 45 }); } : undefined}
        onPointerMove={dragging ? (ev) => setDrag((d) => (d && d.id === e.id ? { ...d, offset: Math.round((ev.clientY - d.startY) / SNAP_PX) * SNAP_PX } : d)) : undefined}
        onPointerUp={dragging ? () => endDrag(item) : undefined}
        onClick={!draggable && e.href ? () => router.push(e.href!) : undefined}
        className={`group absolute flex flex-col overflow-hidden rounded-lg border-l-[3px] px-2 py-0.5 text-charcoal shadow-[0_1px_4px_rgba(31,77,58,0.05)] transition-all duration-200 ease-out hover:z-30 hover:-translate-y-px hover:shadow-[0_10px_24px_rgba(31,77,58,0.15)] ${e.color ? '' : BLOCK[e.type]} ${draggable ? 'cursor-grab' : 'cursor-pointer'} ${dragging ? 'z-50 cursor-grabbing opacity-90 shadow-[0_12px_30px_rgba(31,77,58,0.18)]' : ''} ${resizing ? 'z-50 shadow-[0_12px_30px_rgba(31,77,58,0.18)]' : ''} ${completed ? 'opacity-55 saturate-50' : ''} ${live && !dragging && !resizing ? 'ring-2 ring-forest/40 shadow-[0_0_0_3px_rgba(31,77,58,0.06)]' : ''}`}
        style={colorStyle}
      >
        <div className="flex items-center justify-between gap-1">
          <span className={`truncate text-[11px] font-semibold leading-tight tracking-tight ${completed ? 'line-through' : ''}`}>{e.title}</span>
          <span className="flex shrink-0 items-center gap-1">
            {live && <span className="flex items-center gap-1 rounded-full bg-forest/15 px-1.5 text-[9px] font-semibold text-forest"><span className="ws-pulse-live h-1.5 w-1.5 rounded-full bg-forest" /> Live</span>}
            {completed && <span className="rounded-full bg-[#F5F1E8] px-1.5 text-[9px] font-semibold text-charcoal-600">✓</span>}
            {!live && !completed && highPriority && <span className={`rounded px-1 text-[9px] font-semibold ${e.priority === 'critical' ? 'bg-signal-danger text-white' : 'bg-signal-danger/15 text-signal-danger'}`}>{e.priority === 'critical' ? '!!' : '!'}</span>}
            {e.recurring && <Repeat size={10} className="text-charcoal-600/40" />}
            {e.meetingLink && <a href={e.meetingLink} target="_blank" rel="noopener noreferrer" onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => ev.stopPropagation()} className="text-violet-700"><Video size={11} /></a>}
            {e.eventId && <button onPointerDown={(ev) => ev.stopPropagation()} onClick={(ev) => { ev.stopPropagation(); setMenu({ eventId: e.eventId!, x: ev.clientX, y: ev.clientY, e }); }} className="text-charcoal-600/40 opacity-0 transition-opacity hover:text-charcoal group-hover:opacity-100"><MoreVertical size={12} /></button>}
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between gap-1 pt-0.5">
          <p className="figure text-[10px] text-charcoal-600/60">{fmtTime(e.start)}</p>
          {e.attendees && e.attendees.length > 0 && <AvatarStack attendees={e.attendees} size={16} />}
        </div>
        {/* bottom resize handle */}
        {draggable && (
          <div
            onPointerDown={(ev) => { ev.stopPropagation(); ev.currentTarget.setPointerCapture?.(ev.pointerId); setResize({ id: e.id, eventId: e.eventId!, startY: ev.clientY, offset: 0, origHeight: height, startISO: e.start }); }}
            onPointerMove={resizing ? (ev) => setResize((r) => (r && r.id === e.id ? { ...r, offset: Math.round((ev.clientY - r.startY) / SNAP_PX) * SNAP_PX } : r)) : undefined}
            onPointerUp={resizing ? (ev) => { ev.stopPropagation(); endResize(item); } : undefined}
            className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize items-end justify-center"
          >
            <span className="mb-0.5 h-1 w-8 rounded-full bg-forest/30 opacity-40 transition-all group-hover:bg-forest/60 group-hover:opacity-100" />
          </div>
        )}
      </div>
    );
  };

  /** A single day's canvas: gridlines (click-to-create), now-line (today), events. */
  const renderColumn = (date: Date) => {
    const isToday = sameDay(date, today);
    const dayLaid = layoutFor(date);
    return (
      <div key={date.toISOString()} className={`relative flex-1 border-l border-[#F0EADF] first:border-l-0 ${isToday ? 'bg-forest/[0.03]' : ''}`}>
        {HOURS.map((h, i) => (
          <button key={h} onClick={() => { const d = new Date(date); d.setHours(h, 0, 0, 0); setPreset({ type: 'meeting', startISO: d.toISOString() }); }} className="group/slot absolute left-0 right-0 flex items-center justify-center border-t border-[#F6F2E9] transition-colors hover:bg-forest/[0.04]" style={{ top: i * HOUR_PX, height: HOUR_PX }} aria-label={`Add at ${h}:00`}>
            <span className="flex items-center gap-1 rounded-full bg-forest px-2 py-0.5 text-[10px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover/slot:opacity-100"><Plus size={10} /> {String(h).padStart(2, '0')}:00</span>
          </button>
        ))}
        {/* team availability overlay (behind events) */}
        {overlayIds.length > 0 && busy.filter((b) => sameDay(new Date(b.start), date)).map((b, idx) => {
          const s = new Date(b.start); const e2 = new Date(b.end);
          const top = Math.max(0, ((s.getHours() * 60 + s.getMinutes() - START_HOUR * 60) / 60) * HOUR_PX);
          const h = Math.max(10, ((e2.getTime() - s.getTime()) / 3600000) * HOUR_PX);
          const mem = teamById.get(b.memberId);
          return (
            <div key={`busy_${b.memberId}_${idx}`} className="pointer-events-none absolute left-0 right-0 z-0 rounded-md bg-charcoal-600/[0.07] ring-1 ring-inset ring-charcoal-600/5" style={{ top, height: h }} title={mem?.name}>
              <span className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-charcoal-600/40 text-[8px] font-medium text-white">{(mem?.name ?? '?').slice(0, 1).toUpperCase()}</span>
            </div>
          );
        })}
        {isToday && nowInRange && (
          <div className="pointer-events-none absolute left-0 right-0 z-20 flex items-center" style={{ top: nowTop }}>
            <span className="ws-pulse-live -ml-[3px] h-2.5 w-2.5 rounded-full bg-forest ring-2 ring-white" />
            <span className="h-[2px] flex-1 bg-gradient-to-r from-forest to-forest/30" />
            <span className="figure mr-0.5 rounded bg-forest px-1 py-0.5 text-[9px] font-semibold leading-none text-white shadow-sm">{formatTime(now)}</span>
          </div>
        )}
        {dayLaid.map(renderEvent)}

        {/* Ghost / suggested-schedule blocks for overdue work (click to reschedule) */}
        {ghostPlacements(date).map((g) => {
          const slotISO = (() => { const d = new Date(date); d.setHours(START_HOUR + g.hourIdx, 0, 0, 0); return d.toISOString(); })();
          return (
            <button
              key={`ghost_${g.item.id}`}
              onClick={() => setPreset({ type: g.item.type === 'followup' ? 'followup' : 'task', title: g.item.title, startISO: slotISO })}
              className="group/ghost absolute left-0 z-10 flex flex-col justify-center overflow-hidden rounded-xl border border-dashed border-signal-danger/40 bg-signal-danger/[0.05] px-2.5 py-1 text-left transition-colors hover:border-signal-danger/70 hover:bg-signal-danger/[0.10]"
              style={{ top: g.top, height: g.height, width: 'calc(100% - 4px)' }}
              title={`Overdue — suggested at ${formatTime(new Date(slotISO))}`}
            >
              <span className="flex items-center gap-1.5">
                <span className="ws-pulse-danger h-1.5 w-1.5 shrink-0 rounded-full bg-signal-danger" />
                <span className="truncate text-[11px] font-medium text-signal-danger">{g.item.title}</span>
              </span>
              <span className="text-[9px] uppercase tracking-wide text-signal-danger/60 opacity-0 transition-opacity group-hover/ghost:opacity-100">Overdue · tap to schedule</span>
            </button>
          );
        })}

        {dayLaid.length === 0 && view === 'day' && (
          <div className="pointer-events-none absolute inset-x-0 top-16 flex flex-col items-center px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/8"><CalendarClock size={22} className="text-forest" strokeWidth={1.6} /></div>
            <p className="mt-3 text-sm font-medium text-charcoal">Your day is clear</p>
            <p className="mt-0.5 text-xs text-charcoal-600/60">Click a time slot, or start from a recommendation below.</p>
            <div className="pointer-events-auto mt-3 flex gap-2">
              <button onClick={() => setPreset({ type: 'meeting', startISO: suggestedSlotISO })} className="rounded-lg bg-forest px-3 py-1.5 text-xs font-medium text-white transition-all duration-150 hover:bg-forest-deep active:scale-[0.98]">Add meeting</button>
              <button onClick={() => setPreset({ type: 'task', startISO: suggestedSlotISO })} className="rounded-lg border border-[#E8E0D2] bg-white px-3 py-1.5 text-xs font-medium text-charcoal transition-all duration-150 hover:bg-[#F5F1E8] active:scale-[0.98]">Add task</button>
            </div>

            {/* System recommendations — overdue ghost blocks + suggested slot */}
            <div className="pointer-events-auto mt-6 w-full max-w-xs space-y-2 text-left">
              <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-forest/70"><Sparkles size={11} /> System recommendations</p>
              {overdueItems.length > 0 ? overdueItems.map((o) => (
                <button key={o.id} onClick={() => setPreset({ type: o.type === 'followup' ? 'followup' : 'task', title: o.title, startISO: suggestedSlotISO })}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-signal-danger/30 bg-signal-danger/[0.04] px-3 py-2 text-left transition-colors hover:bg-signal-danger/[0.08]">
                  <Clock size={12} className="shrink-0 text-signal-danger" />
                  <span className="flex-1 truncate text-xs text-charcoal">{o.title}</span>
                  <span className="shrink-0 text-[10px] font-medium text-signal-danger">reschedule →</span>
                </button>
              )) : (
                <button onClick={() => setPreset({ type: 'task', startISO: suggestedSlotISO })}
                  className="flex w-full items-center gap-2 rounded-lg border border-dashed border-forest/25 bg-forest/[0.03] px-3 py-2 text-left transition-colors hover:bg-forest/[0.06]">
                  <CalendarClock size={12} className="shrink-0 text-forest" />
                  <span className="flex-1 text-xs text-charcoal">Block focus time at {formatTime(new Date(suggestedSlotISO))}</span>
                  <span className="shrink-0 text-[10px] font-medium text-forest">add →</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* LIVE NOW */}
      {(currentEvent || nextEvent) && (
        <div className="ws-card ws-card-primary flex flex-wrap items-center gap-x-8 gap-y-2 !py-2.5">
          {currentEvent && (
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1 rounded-full bg-forest/10 px-2 py-0.5 text-[11px] font-semibold text-forest"><Radio size={11} /> Live now</span>
              <span className="text-sm font-medium text-charcoal">{currentEvent.title}</span>
              {mounted && <span className="figure text-xs text-charcoal-600/60">ends in {countdown(new Date(currentEvent.start).getTime() + (currentEvent.durationMin ?? 45) * 60000 - nowMs)}</span>}
              {currentEvent.meetingLink && <a href={currentEvent.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-500/20"><Video size={12} /> Join</a>}
            </div>
          )}
          {nextEvent && (
            <div className="flex items-center gap-2.5">
              <span className="flex items-center gap-1 rounded-full bg-[#F5F1E8] px-2 py-0.5 text-[11px] font-medium text-charcoal-600"><CalendarClock size={11} /> Next</span>
              <span className="text-sm text-charcoal">{nextEvent.title}</span>
              {mounted && <span className="figure text-xs text-charcoal-600/60">in {countdown(new Date(nextEvent.start).getTime() - nowMs)}</span>}
              {nextEvent.meetingLink && <a href={nextEvent.meetingLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 rounded-lg bg-violet-500/10 px-2 py-1 text-[11px] text-violet-700 hover:bg-violet-500/20"><Video size={12} /> Join</a>}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-12">
      {/* LEFT — full-day planner (primary surface, ~65%) */}
      <Card className="lg:col-span-8 ws-card-primary">
        {routePlan && routePlan.stops.length > 0 && (
          <div className="mb-3 flex w-fit gap-0.5 rounded-lg bg-[#F0EADF] p-0.5">
            {([['timeline', 'Timeline'], ['route', `Route · ${routePlan.stops.length}`]] as const).map(([t, label]) => (
              <button key={t} onClick={() => setPlannerTab(t as 'timeline' | 'route')} className={`rounded-md px-3 py-1 text-xs font-medium transition-all ${plannerTab === t ? 'bg-white text-forest shadow-sm' : 'text-charcoal-600/70 hover:text-charcoal'}`}>{label}</button>
            ))}
          </div>
        )}
        {plannerTab === 'route' && routePlan ? <RoutePlan plan={routePlan} embedded /> : (<>
        {/* Quick add */}
        <div className="mb-2.5 flex items-center gap-2 rounded-xl bg-[#F5F1E8] px-3 py-1.5 shadow-[inset_0_0_0_1px_rgba(31,77,58,0.05)] transition-shadow focus-within:shadow-[inset_0_0_0_1px_rgba(200,169,107,0.55)]">
          <Plus size={14} className="text-forest" />
          <input value={quickAdd} onChange={(e) => setQuickAdd(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitQuickAdd(); } }} placeholder="Quick add — e.g. Call Michael tomorrow at 11" className="flex-1 bg-transparent text-sm text-charcoal placeholder:text-charcoal-600/50 focus:outline-none" />
        </div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <button onClick={() => setSelected(addDays(selected, -VIEW_STEP))} className="rounded-lg border border-[#E8E0D2] p-1 text-charcoal-600 hover:bg-[#F5F1E8]"><ChevronLeft size={15} /></button>
            <button onClick={() => { setSelected(today); setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); }} className="rounded-lg border border-[#E8E0D2] px-2 py-1 text-xs text-charcoal-600 hover:bg-[#F5F1E8]">Today</button>
            <button onClick={() => setSelected(addDays(selected, VIEW_STEP))} className="rounded-lg border border-[#E8E0D2] p-1 text-charcoal-600 hover:bg-[#F5F1E8]"><ChevronRight size={15} /></button>
            <span className="ml-1 text-sm font-semibold text-charcoal">{view === 'day' ? formatWeekdayDate(selected) : `${formatDayMonth(columns[0])} – ${formatDayMonth(columns[columns.length - 1])}`}</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setTeamOpen((o) => !o)} className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium transition-colors ${teamOpen || overlayIds.length ? 'border-forest/40 bg-forest/5 text-forest' : 'border-[#E8E0D2] text-charcoal-600 hover:bg-[#F5F1E8]'}`}><Users size={13} /> Team{overlayIds.length ? ` (${overlayIds.length})` : ''}</button>
            <div className="flex gap-0.5 rounded-lg border border-[#E8E0D2] p-0.5">
              {([['day', 'Day'], ['3day', '3-Day'], ['week', 'Week']] as const).map(([v, label]) => (
                <button key={v} onClick={() => setView(v)} className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${view === v ? 'bg-forest text-white' : 'text-charcoal-600 hover:bg-[#F5F1E8]'}`}>{label}</button>
              ))}
            </div>
          </div>
        </div>

        {/* team availability selector */}
        {teamOpen && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E8E0D2] bg-[#F5F1E8] p-2">
            <span className="text-[11px] text-charcoal-600/60">Compare schedules:</span>
            {team.length === 0 && <span className="text-xs text-charcoal-600/50">No team members.</span>}
            {team.map((m) => {
              const on = overlayIds.includes(m.id);
              return (
                <button key={m.id} onClick={() => setOverlayIds((s) => (on ? s.filter((x) => x !== m.id) : [...s, m.id]))} className={`flex items-center gap-1 rounded-full py-0.5 pl-0.5 pr-2 text-xs transition-colors ${on ? 'bg-forest text-white' : 'border border-[#E8E0D2] bg-white text-charcoal hover:bg-[#EFE8DA]'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-medium ${on ? 'bg-white/25 text-white' : 'bg-forest text-champagne'}`}>{m.name.slice(0, 1).toUpperCase()}</span>
                  {m.name}
                </button>
              );
            })}
          </div>
        )}

        {/* column date headers (multi-day) */}
        {view !== 'day' && (
          <div className="mb-1 flex">
            <div className="shrink-0" style={{ width: GUTTER_PX }} />
            {columns.map((d) => (
              <div key={d.toISOString()} className="flex-1 border-l border-[#F0EADF] py-1 text-center first:border-l-0">
                <p className="text-[10px] uppercase tracking-wide text-[#A59C8E]">{formatWeekday(d)}</p>
                <p className={`figure text-sm font-medium ${sameDay(d, today) ? 'text-champagne-600' : 'text-charcoal'}`}>{formatDayNum(d)}</p>
              </div>
            ))}
          </div>
        )}
        {/* Sticky hour gutter + day columns (Day / 3-Day / Week) */}
        <div className="relative max-h-[320px] overflow-y-auto rounded-xl bg-white shadow-[inset_0_0_0_1px_rgba(31,77,58,0.05)]">
          <div className="flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
            <div className="sticky left-0 z-20 shrink-0 bg-white" style={{ width: GUTTER_PX }}>
              {HOURS.map((h, i) => (
                <span key={h} className="figure absolute -translate-y-1/2 pr-3 text-right text-[11px] text-[#A59C8E]" style={{ top: i * HOUR_PX, width: GUTTER_PX }}>
                  {String(h).padStart(2, '0')}:00
                </span>
              ))}
            </div>
            {columns.map(renderColumn)}
          </div>
        </div>
        </>)}
      </Card>

      {/* RIGHT RAIL (~35%) — mini-month + quick actions stacked */}
      <div className="space-y-4 lg:col-span-4">
      {/* quick actions */}
      <Card>
        <p className="mb-2.5 text-sm font-semibold text-charcoal">Quick actions</p>
        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((a) => (
            <button key={a.label} onClick={a.onClick} title={a.label} aria-label={a.label} className="flex aspect-square items-center justify-center rounded-xl bg-forest/[0.06] text-forest shadow-[inset_0_0_0_1px_rgba(31,77,58,0.06)] transition-all hover:-translate-y-0.5 hover:bg-forest/10 hover:shadow-[0_6px_16px_rgba(31,77,58,0.14)]">
              <a.icon size={17} strokeWidth={1.85} />
            </button>
          ))}
          <Link href="/crm/leads" title="New lead" aria-label="New lead" className="flex aspect-square items-center justify-center rounded-xl bg-forest/[0.06] text-forest shadow-[inset_0_0_0_1px_rgba(31,77,58,0.06)] transition-all hover:-translate-y-0.5 hover:bg-forest/10 hover:shadow-[0_6px_16px_rgba(31,77,58,0.14)]">
            <UserPlus size={17} strokeWidth={1.85} />
          </Link>
        </div>
        <div className="mt-2 [&_button]:w-full [&_button]:justify-center [&_button]:gap-1.5 [&_button]:rounded-xl [&_button]:bg-forest/[0.06] [&_button]:px-3 [&_button]:py-2 [&_button]:text-[12px] [&_button]:font-medium [&_button]:text-forest [&_button:hover]:bg-forest/10">
          <LeaveRequestForm />
        </div>
        <div className="mt-3 flex flex-wrap gap-2 border-t border-[#F0EADF] pt-3 text-[10px] text-[#A59C8E]">
          {(Object.keys(DOT) as EventType[]).map((k) => <span key={k} className="flex items-center gap-1 capitalize"><span className={`h-1.5 w-1.5 rounded-full ${DOT[k]}`} />{k}</span>)}
        </div>
      </Card>
      </div>

      {preset && <CreateEventModal preset={preset} leads={leads} projects={projects} team={team} onClose={() => setPreset(null)} onCreated={(e) => { setOptimistic((o) => [...o, e]); setSelected(new Date(e.start)); }} />}
      </div>

      {/* event context menu */}
      {menu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setMenu(null)} />
          <div className="fixed z-50 w-44 overflow-hidden rounded-xl border border-[#E8E0D2] bg-white py-1 shadow-[0_12px_40px_rgba(31,77,58,0.16)]" style={{ left: Math.min(menu.x, (typeof window !== 'undefined' ? window.innerWidth : 9999) - 190), top: menu.y }}>
            <MenuItem icon={Pencil} label={menu.e.recurring ? 'Edit…' : 'Edit'} onClick={() => {
              if (menu.e.recurring) { setScopeDialog({ action: 'edit', eventId: menu.eventId, occurrenceISO: menu.e.occurrenceISO ?? menu.e.start, e: menu.e }); setMenu(null); return; }
              setPreset({ editId: menu.eventId, type: (menu.e.type === 'external' ? 'meeting' : menu.e.type), title: menu.e.title, startISO: menu.e.start, durationMin: menu.e.durationMin, priority: (menu.e.priority as any) ?? 'normal', color: menu.e.color }); setMenu(null);
            }} />
            <MenuItem icon={Copy} label="Duplicate" onClick={() => { setPreset({ type: (menu.e.type === 'external' ? 'meeting' : menu.e.type), title: menu.e.title, startISO: menu.e.start, durationMin: menu.e.durationMin, priority: (menu.e.priority as any) ?? 'normal', color: menu.e.color }); setMenu(null); }} />
            <div className="my-1 border-t border-[#F0EADF]" />
            <MenuItem icon={PlayCircle} label="Mark in progress" onClick={() => runStatus(setEventStatus(menu.eventId, 'in_progress'))} />
            <MenuItem icon={CheckCircle2} label="Mark completed" onClick={() => runStatus(setEventStatus(menu.eventId, 'completed'))} />
            <MenuItem icon={XCircle} label={menu.e.recurring ? 'Cancel…' : 'Cancel'} onClick={() => {
              if (menu.e.recurring) { setScopeDialog({ action: 'cancel', eventId: menu.eventId, occurrenceISO: menu.e.occurrenceISO ?? menu.e.start, e: menu.e }); setMenu(null); return; }
              runStatus(setEventStatus(menu.eventId, 'cancelled'));
            }} />
            <MenuItem icon={Trash2} label="Delete series" danger onClick={() => runStatus(deleteCalendarEvent(menu.eventId))} />
          </div>
        </>
      )}

      {/* recurring scope chooser */}
      {scopeDialog && (
        <div className="ws-fade-in fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4" onClick={() => setScopeDialog(null)}>
          <div className="ws-pop w-full max-w-xs rounded-[18px] bg-white p-5 shadow-[0_24px_60px_rgba(31,77,58,0.18)]" onClick={(ev) => ev.stopPropagation()}>
            <p className="mb-1 text-sm font-semibold text-charcoal">{scopeDialog.action === 'edit' ? 'Edit recurring event' : 'Cancel recurring event'}</p>
            <p className="mb-4 text-xs text-charcoal-600/60">Apply to which events in the series?</p>
            <div className="space-y-2">
              {([['this', 'This event'], ['future', 'This and future events'], ['series', 'Entire series']] as const).map(([scope, label]) => (
                <button
                  key={scope}
                  onClick={() => {
                    const { eventId, occurrenceISO, e } = scopeDialog;
                    if (scopeDialog.action === 'cancel') { cancelRecurringEvent(eventId, scope as RecurScope, occurrenceISO).then(() => router.refresh()); setScopeDialog(null); return; }
                    setPreset({ editId: eventId, recurScope: scope as RecurScope, occurrenceISO, type: (e.type === 'external' ? 'meeting' : e.type), title: e.title, startISO: occurrenceISO, durationMin: e.durationMin, priority: (e.priority as any) ?? 'normal', color: e.color });
                    setScopeDialog(null);
                  }}
                  className="w-full rounded-lg border border-[#E8E0D2] px-3 py-2 text-left text-sm text-charcoal transition-colors hover:border-forest/40 hover:bg-forest/5"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
