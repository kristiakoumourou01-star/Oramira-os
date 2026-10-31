'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Plus, Video, X, CheckCircle2, Trash2, ExternalLink, Users } from 'lucide-react';
import { CreateEventModal, type LeadOption, type ProjectOption, type TeamOption, type ModalPreset } from '@/components/dashboard/CreateEventModal';
import { GoogleCalendarConnect } from '@/components/dashboard/GoogleCalendarConnect';
import { cancelCalendarEvent, setEventStatus } from '@/app/actions/calendar';
import { formatWeekdayLongDate, formatMonthYear, formatTime } from '@/lib/format';
import type { CalendarItem } from '@/lib/calendar-feed-shared';

type View = 'day' | 'week' | 'month';

const DAY_START = 7; // 07:00
const DAY_END = 21; // 21:00
const HOUR_PX = 48;
const GRID_PX = (DAY_END - DAY_START) * HOUR_PX;

const TYPE_STYLE: Record<string, { chip: string; dot: string; label: string }> = {
  viewing: { chip: 'border-teal-300 bg-teal-50 text-teal-800', dot: 'bg-teal-500', label: 'Viewing' },
  meeting: { chip: 'border-sky-300 bg-sky-50 text-sky-800', dot: 'bg-sky-500', label: 'Meeting' },
  followup: { chip: 'border-violet-300 bg-violet-50 text-violet-800', dot: 'bg-violet-500', label: 'Follow-up' },
  task: { chip: 'border-amber-300 bg-amber-50 text-amber-800', dot: 'bg-amber-500', label: 'Task' },
  reminder: { chip: 'border-rose-300 bg-rose-50 text-rose-800', dot: 'bg-rose-500', label: 'Reminder' },
  google: { chip: 'border-stone-300 bg-stone-100 text-charcoal-600', dot: 'bg-stone-400', label: 'Google' },
};
const styleFor = (t: string) => TYPE_STYLE[t] ?? TYPE_STYLE.meeting;

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

  const title = view === 'month' ? formatMonthYear(anchor) : view === 'day' ? formatWeekdayLongDate(anchor) : `${ymd(startOfWeek(anchor))} → ${ymd(addDays(startOfWeek(anchor), 6))}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="panel flex flex-wrap items-center gap-3 p-3">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className="btn-ghost p-2" aria-label="Προηγούμενο"><ChevronLeft size={16} /></button>
          <button onClick={() => go(new Date())} className="btn-secondary px-3 py-1.5 text-xs">Σήμερα</button>
          <button onClick={() => step(1)} className="btn-ghost p-2" aria-label="Επόμενο"><ChevronRight size={16} /></button>
        </div>
        <h3 className="min-w-[180px] text-lg capitalize">{title}</h3>

        {/* Jump to any date (e.g. 2 months ahead) */}
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go(atMidnight(e.target.value))}
          className="input w-auto"
          aria-label="Μετάβαση σε ημερομηνία"
        />

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={toggleTeam}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${teamMode ? 'border-forest bg-forest text-stone-100' : 'border-stone-line text-charcoal-600 hover:text-forest'}`}
            title="Προβολή ομάδας (στήλη ανά άτομο)"
          >
            <Users size={13} /> Ομάδα
          </button>
          <div className="flex rounded-lg border border-stone-line p-0.5">
            {(['day', 'week', 'month'] as View[]).map((v) => (
              <button key={v} onClick={() => go(anchor, v)} className={`rounded-md px-3 py-1 text-xs font-medium capitalize ${view === v ? 'bg-forest text-stone-100' : 'text-charcoal-600 hover:text-forest'}`}>
                {v === 'day' ? 'Ημέρα' : v === 'week' ? 'Εβδομάδα' : 'Μήνας'}
              </button>
            ))}
          </div>
          <button onClick={() => setPreset({ startISO: defaultSlot(anchor) })} className="btn-primary px-3 py-1.5 text-xs"><Plus size={14} /> Νέο ραντεβού</button>
        </div>
      </div>

      {/* Legend + Google status */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-xs">
        {Object.entries(TYPE_STYLE).filter(([k]) => k !== 'google').map(([k, s]) => (
          <span key={k} className="flex items-center gap-1.5 text-charcoal-600/70"><span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}</span>
        ))}
        <span className="ml-auto"><GoogleCalendarConnect connected={googleConnected} configured={googleConfigured} /></span>
      </div>

      {/* Grid */}
      {!mounted ? (
        <div className="panel h-[420px] animate-pulse" />
      ) : view === 'month' ? (
        <MonthGrid anchor={anchor} items={items} onPick={(d) => go(d, 'day')} onNew={(iso) => setPreset({ startISO: iso })} onEvent={setDetail} />
      ) : (
        <TimeGrid columns={columns} onSlot={(iso) => setPreset({ startISO: iso })} onEvent={setDetail} />
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

function TimeGrid({ columns, onSlot, onEvent }: { columns: GridColumn[]; onSlot: (iso: string) => void; onEvent: (i: CalendarItem) => void }) {
  const hours = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
  const now = new Date();
  return (
    <div className="panel overflow-x-auto p-0">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${columns.length}, minmax(0,1fr))` }}>
        {/* header row */}
        <div className="border-b border-stone-line" />
        {columns.map((c) => {
          const isToday = sameDay(c.date, now);
          return (
            <div key={c.key} className={`border-b border-l border-stone-line px-2 py-2 text-center ${isToday ? 'bg-forest-50' : ''}`}>
              <p className={`truncate text-[11px] uppercase tracking-wide ${isToday ? 'text-forest' : 'text-charcoal-600/60'}`}>{c.label}</p>
              {c.sublabel && <p className={`text-sm font-medium ${isToday ? 'text-forest' : 'text-charcoal'}`}>{c.sublabel}</p>}
            </div>
          );
        })}

        {/* hour labels column */}
        <div className="relative" style={{ height: GRID_PX }}>
          {hours.map((h) => (
            <div key={h} className="absolute left-0 right-1 text-right text-[10px] text-charcoal-600/50" style={{ top: (h - DAY_START) * HOUR_PX - 6 }}>{p2(h)}:00</div>
          ))}
        </div>

        {/* columns */}
        {columns.map((c) => {
          const isToday = sameDay(c.date, now);
          return (
            <div key={`col-${c.key}`} className="relative border-l border-stone-line" style={{ height: GRID_PX }}>
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => { const s = new Date(c.date); s.setHours(h, 0, 0, 0); onSlot(s.toISOString()); }}
                  className="absolute left-0 right-0 cursor-pointer border-b border-stone-line/60 hover:bg-forest/[0.03]"
                  style={{ top: (h - DAY_START) * HOUR_PX, height: HOUR_PX }}
                />
              ))}
              {isToday && (
                <div className="pointer-events-none absolute left-0 right-0 z-10 border-t border-signal-danger" style={{ top: minsToPx(now.getHours() * 60 + now.getMinutes()) }}>
                  <span className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-signal-danger" />
                </div>
              )}
              {c.items.map((it) => <EventBlock key={`${c.key}-${it.source}-${it.id}`} item={it} onClick={() => onEvent(it)} />)}
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
function EventBlock({ item, onClick }: { item: CalendarItem; onClick: () => void }) {
  const d = new Date(item.start);
  const startMin = d.getHours() * 60 + d.getMinutes();
  const top = minsToPx(startMin);
  const height = Math.max(18, (item.durationMin / 60) * HOUR_PX - 2);
  const s = styleFor(item.type);
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`absolute left-1 right-1 z-20 overflow-hidden rounded-md border px-1.5 py-0.5 text-left text-[11px] leading-tight shadow-sm ${s.chip}`}
      style={{ top, height, ...(item.color ? { borderLeftColor: item.color, borderLeftWidth: 3 } : {}) }}
      title={item.title}
    >
      <span className="block truncate font-medium">{item.title}</span>
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
    <div className="panel overflow-hidden p-0">
      <div className="grid grid-cols-7 border-b border-stone-line">
        {WEEKDAYS.map((w) => <div key={w} className="px-2 py-2 text-center text-[11px] uppercase tracking-wide text-charcoal-600/60">{w}</div>)}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const dayItems = items.filter((it) => sameDay(new Date(it.start), d)).slice(0, 4);
          const more = items.filter((it) => sameDay(new Date(it.start), d)).length - dayItems.length;
          const outside = d.getMonth() !== anchor.getMonth();
          return (
            <div key={ymd(d)} className={`min-h-[104px] border-b border-l border-stone-line p-1.5 ${outside ? 'bg-stone/40' : ''}`}>
              <div className="mb-1 flex items-center justify-between">
                <button onClick={() => onPick(d)} className={`text-xs font-medium ${sameDay(d, now) ? 'flex h-5 w-5 items-center justify-center rounded-full bg-forest text-stone-100' : outside ? 'text-charcoal-600/40' : 'text-charcoal'}`}>{d.getDate()}</button>
                <button onClick={() => { const s = new Date(d); s.setHours(10, 0, 0, 0); onNew(s.toISOString()); }} className="text-charcoal-600/30 hover:text-forest"><Plus size={12} /></button>
              </div>
              <div className="space-y-0.5">
                {dayItems.map((it) => {
                  const s = styleFor(it.type);
                  return (
                    <button key={`${it.source}-${it.id}`} onClick={() => onEvent(it)} className={`flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] ${s.chip}`}>
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
function EventDetail({ item, onClose, onChanged }: { item: CalendarItem; onClose: () => void; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const s = styleFor(item.type);
  const run = (fn: () => Promise<unknown>) => { setBusy(true); fn().then(onChanged).finally(() => setBusy(false)); };
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-forest-deep/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-lg bg-white p-5 shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <span className={`badge ${s.chip}`}>{s.label}</span>
            <h3 className="mt-2 text-lg">{item.title}</h3>
            <p className="text-sm text-charcoal-600">{formatWeekdayLongDate(item.start)} · {formatTime(item.start)}</p>
          </div>
          <button onClick={onClose} className="text-charcoal-600/60 hover:text-charcoal"><X size={18} /></button>
        </div>
        {item.location && <p className="mb-2 text-sm text-charcoal-600">📍 {item.location}</p>}
        <div className="flex flex-wrap gap-2">
          {item.meetingLink && <a href={item.meetingLink} target="_blank" rel="noreferrer" className="btn-secondary px-3 py-1.5 text-xs"><Video size={13} /> Join</a>}
          {item.leadId && <Link href={`/crm/leads/${item.leadId}`} className="btn-secondary px-3 py-1.5 text-xs"><ExternalLink size={13} /> Lead</Link>}
          {item.editable && (
            <>
              <button disabled={busy} onClick={() => run(() => setEventStatus(item.id, 'completed'))} className="btn-ghost text-xs"><CheckCircle2 size={14} /> Ολοκληρώθηκε</button>
              <button disabled={busy} onClick={() => run(() => cancelCalendarEvent(item.id))} className="btn-ghost text-xs text-signal-danger"><Trash2 size={14} /> Ακύρωση</button>
            </>
          )}
        </div>
        {!item.editable && item.source === 'google' && <p className="mt-3 text-xs text-charcoal-600/60">Συγχρονισμένο από Google Calendar (read-only εδώ).</p>}
      </div>
    </div>
  );
}
