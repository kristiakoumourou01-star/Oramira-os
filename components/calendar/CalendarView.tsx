'use client';

import { HubCards } from '@/components/ui/HubCards';
import { CalendarDays, CalendarRange, RefreshCw } from 'lucide-react';

import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Video, X, CheckCircle2, Trash2, ExternalLink, Users, Pencil } from 'lucide-react';
import { CreateEventModal, type LeadOption, type ProjectOption, type TeamOption, type ModalPreset } from '@/components/dashboard/CreateEventModal';
import { GoogleCalendarConnect } from '@/components/dashboard/GoogleCalendarConnect';
import { cancelCalendarEvent, setEventStatus, updateCalendarEvent, updateGoogleCalendarItem, deleteGoogleCalendarItem } from '@/app/actions/calendar';
import { formatWeekdayLongDate, formatMonthYear, formatTime } from '@/lib/format';
import type { CalendarItem } from '@/lib/calendar-feed-shared';

type View = 'day' | 'week' | 'month';

const DAY_START = 7; // 07:00
const DAY_END = 21; // 21:00
const HOUR_PX = 48;
const GRID_PX = (DAY_END - DAY_START) * HOUR_PX;

// Ένα χρώμα (της εταιρείας) σε αποχρώσεις, όπως στο FitnessCRM.
const TYPE_STYLE: Record<string, { chip: string; dot: string; label: string }> = {
  viewing: { chip: 'border-forest bg-forest/[0.10] text-forest', dot: 'bg-forest', label: 'Προβολή' },
  meeting: { chip: 'border-forest/70 bg-forest/[0.06] text-forest', dot: 'bg-forest/70', label: 'Συνάντηση' },
  followup: { chip: 'border-forest/45 bg-white text-charcoal', dot: 'bg-forest/45', label: 'Follow-up' },
  task: { chip: 'border-charcoal-600/40 bg-stone-50 text-charcoal', dot: 'bg-charcoal-600/40', label: 'Εργασία' },
  reminder: { chip: 'border-forest/30 bg-forest/[0.03] text-charcoal', dot: 'bg-forest/30', label: 'Υπενθύμιση' },
  google: { chip: 'border-stone-400 bg-stone-100 text-charcoal-600', dot: 'bg-stone-400', label: 'Google' },
};
const styleFor = (t: string) => TYPE_STYLE[t] ?? (['call', 'email', 'deadline', 'lunch'].includes(t) ? TYPE_STYLE.followup : TYPE_STYLE.meeting);

/* ---- date helpers (local time) ---- */
const p2 = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const atMidnight = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m ?? 1) - 1, d ?? 1); };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const startOfWeek = (d: Date) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); }; // Monday
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const WEEKDAYS = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ'];

export function CalendarView({
  date,
  view,
  items,
  leads,
  projects,
  team,
  googleConnected,
  googleConfigured,
  teamMode = false,
  teamEvents = {},
}: {
  date: string; // YYYY-MM-DD anchor
  view: View;
  items: CalendarItem[];
  leads: LeadOption[];
  projects: ProjectOption[];
  team: TeamOption[];
  googleConnected: boolean;
  googleConfigured: boolean;
  teamMode?: boolean;
  teamEvents?: Record<string, CalendarItem[]>;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [preset, setPreset] = useState<ModalPreset | null>(null);
  const [detail, setDetail] = useState<CalendarItem | null>(null);
  useEffect(() => setMounted(true), []);
  // Αμφίδρομος συγχρονισμός: ό,τι αλλάζει στο Google Calendar εμφανίζεται εδώ μέσα σε λίγα δευτερόλεπτα.
  useEffect(() => {
    if (!googleConnected) return;
    const tick = () => { if (document.visibilityState === 'visible') router.refresh(); };
    const t = window.setInterval(tick, 20000);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(t); window.removeEventListener('focus', tick); };
  }, [googleConnected, router]);
  /** Μετακίνηση γεγονότος με σύρσιμο: αποθηκεύεται και περνά αμέσως στο Google Calendar. */
  const moveItem = async (it: CalendarItem, startISO: string) => {
    if (it.source === 'google') await updateGoogleCalendarItem(it.id, { title: it.title, startISO, durationMin: it.durationMin });
    else if (it.source === 'internal') await updateCalendarEvent(it.id, { startISO });
    router.refresh();
  };

  const anchor = useMemo(() => atMidnight(date), [date]);
  const go = (d: Date, v: View = view, t: boolean = teamMode) => router.push(`/calendar?date=${ymd(d)}&view=${v}${t ? '&team=1' : ''}`);
  const step = (dir: number) => {
    if (view === 'day') go(addDays(anchor, dir));
    else if (view === 'week') go(addDays(anchor, dir * 7));
    else { const m = new Date(anchor); m.setMonth(m.getMonth() + dir); go(m); }
  };
  // Team view is a day view with one column per member.
  const toggleTeam = () => go(anchor, 'day', !teamMode);
  const useTeam = teamMode && view === 'day';

  const columns: GridColumn[] = useTeam
    ? team.map((m) => ({ key: m.id, label: m.name, date: anchor, items: (teamEvents[m.id] ?? []).filter((it) => sameDay(new Date(it.start), anchor)) }))
    : (view === 'day' ? [anchor] : weekDays(anchor)).map((d) => ({ key: ymd(d), label: WEEKDAYS[(d.getDay() + 6) % 7], sublabel: String(d.getDate()), date: d, items: items.filter((it) => sameDay(new Date(it.start), d)) }));

  const title = view === 'month' ? formatMonthYear(anchor) : view === 'day' ? formatWeekdayLongDate(anchor) : (() => { const a = startOfWeek(anchor); const b = addDays(a, 6); const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString(DATE_TAG[currentLocale().lang], o); return a.getMonth() === b.getMonth() ? `${f(a, { day: 'numeric' })} – ${f(b, { day: 'numeric', month: 'long', year: 'numeric' })}` : `${f(a, { day: 'numeric', month: 'short' })} – ${f(b, { day: 'numeric', month: 'short', year: 'numeric' })}`; })();

  const today0 = atMidnight(ymd(new Date()));
  const todayN = items.filter((it) => sameDay(new Date(it.start), today0)).length;
  const viewingsN = items.filter((it) => it.type === 'viewing').length;
  return (
    <div className="space-y-4">
      {googleConfigured && <GoogleCalendarConnect big connected={googleConnected} configured={googleConfigured} />}
      <HubCards active={useTeam ? 'team' : view === 'day' && sameDay(anchor, today0) ? 'today' : 'range'} onSelect={(k) => { if (k === 'today') go(new Date(), 'day', false); else if (k === 'range') go(anchor, 'week', false); else if (k === 'team') go(anchor, 'day', true); }} cards={[
        { key: 'today', icon: CalendarDays, title: 'Σήμερα', value: todayN, sub: 'Ραντεβού και εργασίες σήμερα' },
        { key: 'range', icon: CalendarRange, title: 'Σε αυτή την προβολή', value: items.length, sub: `${viewingsN} προβολές ακινήτων` },
        { key: 'team', icon: Users, title: 'Ομάδα', value: team.length, sub: 'Μία στήλη ανά άτομο' },
        { key: 'google', icon: RefreshCw, title: 'Google Calendar', value: googleConnected ? '✓' : '—', sub: googleConnected ? 'Συνδεδεμένο' : 'Δεν έχει συνδεθεί' },
      ]} />
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-line text-charcoal-600 transition-colors hover:border-forest/30 hover:text-charcoal" aria-label="Προηγούμενο"><ChevronLeft size={16} /></button>
          <button onClick={() => go(new Date())} className="h-8 rounded-full border border-stone-line px-3 text-[13px] text-charcoal transition-colors hover:border-forest/30">Σήμερα</button>
          <button onClick={() => step(1)} className="flex h-8 w-8 items-center justify-center rounded-full border border-stone-line text-charcoal-600 transition-colors hover:border-forest/30 hover:text-charcoal" aria-label="Επόμενο"><ChevronRight size={16} /></button>
        </div>
        <h3 className="text-[18px] font-semibold capitalize text-charcoal sm:min-w-[180px]">{title}</h3>

        {/* Jump to any date (e.g. 2 months ahead) */}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(atMidnight(e.target.value))}
          className="input h-8 w-auto py-1 text-[13px]"
          aria-label="Μετάβαση σε ημερομηνία"
        />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            onClick={toggleTeam}
            className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${teamMode ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`}
            title="Προβολή ομάδας (στήλη ανά άτομο)"
          >
            <Users size={13} /> Ομάδα
          </button>
          <div className="flex rounded-lg bg-stone-100 p-0.5">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} onClick={() => go(anchor, v)} className={`inline-flex h-7 items-center rounded-md px-2.5 text-[13px] transition-colors ${view === v ? 'bg-forest font-medium text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal'}`}>
                {v === 'day' ? 'Ημέρα' : v === 'week' ? 'Εβδομάδα' : 'Μήνας'}
              </button>
            ))}
          </div>
          <button onClick={() => setPreset({ startISO: defaultSlot(anchor) })} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[14px] font-medium text-white transition hover:bg-forest/90"><Plus size={15} /> Νέο ραντεβού</button>
        </div>
      </div>

      {/* Legend + Google status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs">
        {Object.entries(TYPE_STYLE).filter(([k]) => k !== 'google').map(([k, s]) => (
          <span key={k} className="flex items-center gap-1.5 rounded-full border border-stone-line bg-white px-2.5 py-0.5 text-[12px] text-charcoal-600"><span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}</span>
        ))}
        <span className="ml-auto"><GoogleCalendarConnect connected={googleConnected} configured={googleConfigured} /></span>
      </div>

      {/* Grid */}
      {!mounted ? (
        <div className="h-[420px] animate-pulse rounded-2xl bg-white" />
      ) : view === 'month' ? (
        <MonthGrid anchor={anchor} items={items} onPick={(d) => go(d, 'day')} onNew={(iso) => setPreset({ startISO: iso })} onEvent={setDetail} />
      ) : (
        <TimeGrid columns={columns} onSlot={(iso) => setPreset({ startISO: iso })} onEvent={setDetail} onMove={useTeam ? undefined : moveItem} />
      )}

      {preset && (
        <CreateEventModal preset={preset} leads={leads} projects={projects} team={team} onClose={() => setPreset(null)} onCreated={() => { setPreset(null); router.refresh(); }} />
      )}
      {detail && <EventDetail item={detail} onClose={() => setDetail(null)} onChanged={() => { setDetail(null); router.refresh(); }} />}
    </div>
  );
}

function weekDays(anchor: Date): Date[] {
  const s = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, i) => addDays(s, i));
}
function defaultSlot(anchor: Date): string {
  const now = new Date();
  const base = sameDay(anchor, now) ? now : anchor;
  const d = new Date(base);
  d.setHours(Math.max(DAY_START, Math.min(DAY_END - 1, d.getHours() + (sameDay(anchor, now) ? 1 : 10 - d.getHours()))), 0, 0, 0);
  return d.toISOString();
}

/* ---- Time grid: columns are either days (day/week) or people (team day) ---- */
interface GridColumn { key: string; label: string; sublabel?: string; date: Date; items: CalendarItem[] }

const movable = (it: CalendarItem) => it.editable && (it.source === 'internal' || it.source === 'google');

function TimeGrid({ columns, onSlot, onEvent, onMove }: { columns: GridColumn[]; onSlot: (iso: string) => void; onEvent: (i: CalendarItem) => void; onMove?: (i: CalendarItem, startISO: string) => Promise<void> }) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const now = new Date();
  const [dragging, setDragging] = useState<CalendarItem | null>(null);
  const [moved, setMoved] = useState<Record<string, string>>({});
  const drop = (c: GridColumn, e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const it = dragging; setDragging(null);
    if (!it || !onMove) return;
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    const mins = Math.round((DAY_START * 60 + (y / HOUR_PX) * 60) / 15) * 15;
    const s = new Date(c.date); s.setHours(0, Math.max(DAY_START * 60, Math.min(DAY_END * 60 - 15, mins)), 0, 0);
    const iso = s.toISOString();
    setMoved((m) => ({ ...m, [it.id]: iso }));
    onMove(it, iso).finally(() => setMoved((m) => { const { [it.id]: _x, ...rest } = m; return rest; }));
  };
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))` }}>
        {/* header row */}
        <div className="sticky top-0 z-30 border-b border-stone-line/70 bg-white" />
        {columns.map((c) => {
          const isToday = sameDay(c.date, now);
          return (
            <div key={c.key} className="sticky top-0 z-30 border-b border-stone-line/70 bg-white px-2 py-2.5 text-center">
              <p className={`truncate text-[11px] font-semibold uppercase tracking-[0.12em] ${isToday ? 'text-forest' : 'text-charcoal-600/55'}`}>{c.label}</p>
              {c.sublabel && <p className={`mx-auto mt-1 flex h-9 w-9 items-center justify-center rounded-full text-lg font-semibold ${isToday ? 'bg-forest text-white shadow-sm' : 'text-charcoal'}`}>{c.sublabel}</p>}
            </div>
          );
        })}

        {/* hour labels column */}
        <div className="relative" style={{ height: GRID_PX }}>
          {hours.map((h) => (
            <div key={h} className="absolute left-0 right-2 text-right text-[10px] font-medium tabular-nums text-charcoal-600/45" style={{ top: (h - DAY_START) * HOUR_PX - 6 }}>{p2(h)}:00</div>
          ))}
        </div>

        {/* columns */}
        {columns.map((c) => {
          const isToday = sameDay(c.date, now);
          return (
            <div key={`col-${c.key}`} onDragOver={(e) => { if (dragging) e.preventDefault(); }} onDrop={(e) => drop(c, e)} className={`relative border-l border-stone-line/50 ${isToday ? 'bg-forest/[0.035]' : c.date.getDay() === 0 || c.date.getDay() === 6 ? 'bg-[#bfab88]/[0.06]' : ''}`} style={{ height: GRID_PX }}>
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => { const s = new Date(c.date); s.setHours(h, 0, 0, 0); onSlot(s.toISOString()); }}
                  className="absolute left-0 right-0 cursor-pointer border-b border-stone-line/35 transition-colors hover:bg-forest/[0.05]"
                  style={{ top: (h - DAY_START) * HOUR_PX, height: HOUR_PX }}
                />
              ))}
              {isToday && (
                <div className="pointer-events-none absolute left-0 right-0 z-10 border-t-2 border-signal-danger/80" style={{ top: minsToPx(now.getHours() * 60 + now.getMinutes()) }}>
                  <span className="absolute -left-1.5 -top-[5px] h-2.5 w-2.5 rounded-full bg-signal-danger ring-2 ring-white" />
                </div>
              )}
              {c.items.filter((it) => !moved[it.id]).map((it) => <EventBlock key={`${c.key}-${it.source}-${it.id}`} item={it} onClick={() => onEvent(it)} draggable={!!onMove && movable(it)} onDragStart={() => setDragging(it)} onDragEnd={() => setDragging(null)} />)}
              {columns.length > 0 && Object.entries(moved).map(([id, iso]) => {
                const all = columns.flatMap((x) => x.items); const it = all.find((x) => x.id === id);
                return it && sameDay(new Date(iso), c.date) ? <EventBlock key={`mv-${id}`} item={{ ...it, start: iso }} onClick={() => {}} /> : null;
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function minsToPx(min: number): number {
  const clamped = Math.max(DAY_START * 60, Math.min(DAY_END * 60, min));
  return ((clamped - DAY_START * 60) / 60) * HOUR_PX;
}
function EventBlock({ item, onClick, draggable, onDragStart, onDragEnd }: { item: CalendarItem; onClick: () => void; draggable?: boolean; onDragStart?: () => void; onDragEnd?: () => void }) {
  const d = new Date(item.start);
  const startMin = d.getHours() * 60 + d.getMinutes();
  const top = minsToPx(startMin);
  const height = Math.max(18, (item.durationMin / 60) * HOUR_PX - 2);
  const s = styleFor(item.type);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      draggable={draggable}
      onDragStart={draggable ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); } : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className={`absolute left-1 right-1 z-20 ${draggable ? 'cursor-grab active:cursor-grabbing' : ''} overflow-hidden rounded-lg border-0 border-l-[3px] px-2 py-1 text-left text-[11px] leading-tight shadow-[0_2px_8px_-3px_rgba(17,49,36,0.25)] transition hover:-translate-y-px hover:shadow-[0_6px_14px_-6px_rgba(17,49,36,0.35)] ${s.chip}`}
      style={{ top, height, ...(item.color ? { borderLeftColor: item.color, borderLeftWidth: 3 } : {}) }}
      title={item.title}
    >
      <span className="block truncate font-semibold">{item.title}</span>
      <span className="block truncate opacity-70">{formatTime(item.start)}{item.meetingLink ? ' · Meet' : ''}</span>
    </button>
  );
}

/* ---- Month grid ---- */
function MonthGrid({ anchor, items, onPick, onNew, onEvent }: { anchor: Date; items: CalendarItem[]; onPick: (d: Date) => void; onNew: (iso: string) => void; onEvent: (i: CalendarItem) => void }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const now = new Date();
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
      <div className="grid grid-cols-7 border-b border-stone-line/70">
        {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal-600/55">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const dayItems = items.filter((it) => sameDay(new Date(it.start), d)).slice(0, 4);
          const more = items.filter((it) => sameDay(new Date(it.start), d)).length - dayItems.length;
          const outside = d.getMonth() !== anchor.getMonth();
          return (
            <div key={ymd(d)} className={`group/day min-h-[112px] border-b border-l border-stone-line/50 p-1.5 transition-colors hover:bg-forest/[0.03] ${outside ? 'bg-stone/30' : sameDay(d, now) ? 'bg-forest/[0.04]' : ''}`}>
              <div className="mb-1 flex items-center justify-between">
                <button onClick={() => onPick(d)} className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition ${sameDay(d, now) ? 'bg-forest text-white shadow-sm' : outside ? 'text-charcoal-600/35 hover:bg-stone' : 'text-charcoal hover:bg-forest/10'}`}>{d.getDate()}</button>
                <button onClick={() => { const s = new Date(d); s.setHours(10, 0, 0, 0); onNew(s.toISOString()); }} className="flex h-6 w-6 items-center justify-center rounded-full text-charcoal-600/30 opacity-0 transition hover:bg-forest/10 hover:text-forest group-hover/day:opacity-100"><Plus size={13} /></button>
              </div>
              <div className="space-y-0.5">
                {dayItems.map((it) => {
                  const s = styleFor(it.type);
                  return (
                    <button key={`${it.source}-${it.id}`} onClick={() => onEvent(it)} className={`flex w-full items-center gap-1 truncate rounded-md border-0 px-1.5 py-0.5 text-left text-[10.5px] font-medium ${s.chip}`}>
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} />
                      <span className="truncate">{formatTime(it.start)} {it.title}</span>
                    </button>
                  );
                })}
                {more > 0 && <button onClick={() => onPick(d)} className="px-1 text-[10px] text-charcoal-600/60 hover:text-forest">+{more} ακόμη</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---- Event detail modal ---- */
const toLocalDate = (iso: string) => { const d = new Date(iso); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`; };
const toLocalTime = (iso: string) => { const d = new Date(iso); return `${p2(d.getHours())}:${p2(d.getMinutes())}`; };

function EventDetail({ item, onClose, onChanged }: { item: CalendarItem; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ title: item.title, date: toLocalDate(item.start), time: toLocalTime(item.start), dur: String(item.durationMin), location: item.location ?? '' });
  const s = styleFor(item.type);
  const canEdit = item.editable && (item.source === 'internal' || item.source === 'google');
  const run = (fn: () => Promise<unknown>) => { setBusy(true); fn().then(onChanged).finally(() => setBusy(false)); };
  const save = async () => {
    const [y, m, d] = f.date.split('-').map(Number); const [hh, mm] = f.time.split(':').map(Number);
    const start = new Date(y, (m ?? 1) - 1, d ?? 1, hh ?? 9, mm ?? 0);
    if (!f.title.trim() || isNaN(start.getTime())) { setErr('Συμπληρώστε τίτλο, ημερομηνία και ώρα.'); return; }
    const durationMin = Math.max(5, Math.min(24 * 60, Number(f.dur) || item.durationMin));
    setBusy(true); setErr(null);
    try {
      if (item.source === 'google') {
        const r = await updateGoogleCalendarItem(item.id, { title: f.title.trim(), startISO: start.toISOString(), durationMin, location: f.location.trim() || null });
        if (!r.ok) { setErr('Το Google Calendar δεν δέχτηκε την αλλαγή. Δοκιμάστε ξανά.'); return; }
      } else {
        await updateCalendarEvent(item.id, { title: f.title.trim(), startISO: start.toISOString(), durationMin, location: f.location.trim() || null });
      }
      onChanged();
    } finally { setBusy(false); }
  };
  const field = 'w-full rounded-lg border border-stone-line bg-white px-3 py-2 text-sm text-charcoal outline-none focus:border-forest';
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-forest-deep/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div className="min-w-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${s.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />{s.label}</span>
            {!edit && <h3 className="mt-2 font-display text-xl text-charcoal" data-no-tr={item.source === 'google' ? '' : undefined}>{item.title}</h3>}
            {!edit && <p className="text-sm text-charcoal-600">{formatWeekdayLongDate(item.start)} · {formatTime(item.start)}</p>}
          </div>
          <button onClick={onClose} className="text-charcoal-600/60 hover:text-charcoal"><X size={18} /></button>
        </div>
        {edit ? (
          <div className="mb-3 space-y-2.5">
            <label className="block text-xs text-charcoal-600"><span>Τίτλος</span><input className={`${field} mt-1`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-charcoal-600"><span>Ημερομηνία</span><input type="date" className={`${field} mt-1`} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
              <label className="block text-xs text-charcoal-600"><span>Ώρα</span><input type="time" step={300} className={`${field} mt-1`} value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs text-charcoal-600"><span>Διάρκεια (λεπτά)</span><input type="number" min={5} step={5} className={`${field} mt-1`} value={f.dur} onChange={(e) => setF({ ...f, dur: e.target.value })} /></label>
              <label className="block text-xs text-charcoal-600"><span>Τοποθεσία</span><input className={`${field} mt-1`} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></label>
            </div>
            {err && <p className="text-xs text-signal-danger">{err}</p>}
            <div className="flex gap-2 pt-1">
              <button disabled={busy} onClick={save} className="btn-primary px-3 py-1.5 text-xs">Αποθήκευση</button>
              <button disabled={busy} onClick={() => setEdit(false)} className="btn-ghost text-xs">Άκυρο</button>
            </div>
          </div>
        ) : (
          <>
            {item.location && <p className="mb-2 text-sm text-charcoal-600">📍 <span data-no-tr>{item.location}</span></p>}
            <div className="flex flex-wrap gap-2">
              {item.meetingLink && <a href={item.meetingLink} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs"><Video size={13} /> Join</a>}
              {item.leadId && <Link href={`/crm/leads/${item.leadId}`} className="btn-secondary px-3 py-1.5 text-xs"><ExternalLink size={13} /> Lead</Link>}
              {canEdit && <button disabled={busy} onClick={() => setEdit(true)} className="btn-secondary px-3 py-1.5 text-xs"><Pencil size={13} /> Επεξεργασία</button>}
              {item.editable && item.source === 'internal' && (
                <>
                  <button disabled={busy} onClick={() => run(() => setEventStatus(item.id, 'completed'))} className="btn-ghost text-xs"><CheckCircle2 size={14} /> Ολοκληρώθηκε</button>
                  <button disabled={busy} onClick={() => run(() => cancelCalendarEvent(item.id))} className="btn-ghost text-xs text-signal-danger"><Trash2 size={14} /> Ακύρωση</button>
                </>
              )}
              {item.editable && item.source === 'google' && (
                <button disabled={busy} onClick={() => run(() => deleteGoogleCalendarItem(item.id))} className="btn-ghost text-xs text-signal-danger"><Trash2 size={14} /> Διαγραφή</button>
              )}
            </div>
          </>
        )}
        {item.source === 'google' && <p className="mt-3 text-xs text-charcoal-600/60">Από το Google Calendar. Ό,τι αλλάζετε εδώ περνά αμέσως και εκεί.</p>}
        {item.source === 'google' && !item.editable && <p className="mt-1 text-xs text-charcoal-600/60">Ολοήμερο γεγονός· αλλάζει από το Google Calendar.</p>}
        {item.source === 'internal' && item.editable && <p className="mt-3 text-xs text-charcoal-600/60">Σύρετε το γεγονός σε άλλη ώρα ή πατήστε Επεξεργασία· αν έχετε συνδέσει Google Calendar, η αλλαγή περνά αμέσως και εκεί.</p>}
        {item.source === 'activity' && <p className="mt-3 text-xs text-charcoal-600/60">Activity από το Sales → Activities· αλλάζει ή ολοκληρώνεται από εκεί ή από το deal.</p>}
      </div>
    </div>
  );
}
