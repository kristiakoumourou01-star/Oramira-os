'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, Users, CheckSquare, Flag, Mail, Utensils, Home, List, CalendarDays, Check, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { ACTIVITY_TYPES, activityLabel } from '@/lib/activity-types';
import { completeAndNext, updateFollowUp } from '@/app/actions/follow-ups';

const ICON: Record<string, any> = { call: Phone, meeting: Users, task: CheckSquare, deadline: Flag, email: Mail, lunch: Utensils, viewing: Home };
export interface ActivityRow {
  id: string; dueAt: string; doneAt: string | null; done: boolean; note: string | null; type: string; priority: string | null; durationMin: number | null;
  leadId: string | null; dealTitle: string | null; contactName: string | null; phone: string | null; ownerId: string | null; ownerName: string | null;
  /** Προβολή ακινήτου (πίνακας viewings) — ολοκληρώνεται από την καρτέλα της. */
  readOnly?: boolean; statusLabel?: string | null;
}
type Period = 'todo' | 'overdue' | 'today' | 'tomorrow' | 'week' | 'next' | 'done' | 'all';
const PERIODS: [Period, string][] = [['todo', 'Για να γίνουν'], ['overdue', 'Καθυστερημένες'], ['today', 'Σήμερα'], ['tomorrow', 'Αύριο'], ['week', 'Αυτή την εβδομάδα'], ['next', 'Επόμενη εβδομάδα'], ['done', 'Ολοκληρωμένες'], ['all', 'Όλες']];
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const weekStart = (d: Date) => addDays(dayStart(d), -((d.getDay() + 6) % 7));
const WD = ['Δευ', 'Τρί', 'Τετ', 'Πέμ', 'Παρ', 'Σάβ', 'Κυρ'];

/** Sales → Activities: όλες οι κινήσεις (όπως Pipedrive) σε λίστα ή εβδομαδιαίο ημερολόγιο. */
export function ActivitiesView({ rows: initial, agents, currentUserId, initialTypes = [] }: { rows: ActivityRow[]; agents: { id: string; full_name: string | null }[]; currentUserId: string; initialTypes?: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [rows, setRows] = useState(initial);
  const [view, setView] = useState<'list' | 'calendar'>('list');
  const [period, setPeriod] = useState<Period>('todo');
  const [types, setTypes] = useState<string[]>(initialTypes);
  const [owner, setOwner] = useState<string>(currentUserId);
  const [week, setWeek] = useState(() => weekStart(new Date()));
  const now = new Date();
  const t0 = dayStart(now), t1 = addDays(t0, 1), t2 = addDays(t0, 2), w0 = weekStart(now), w1 = addDays(w0, 7), w2 = addDays(w0, 14);

  const inPeriod = (r: ActivityRow) => {
    const d = new Date(r.dueAt);
    switch (period) {
      case 'todo': return !r.done;
      case 'overdue': return !r.done && d < now;
      case 'today': return d >= t0 && d < t1;
      case 'tomorrow': return d >= t1 && d < t2;
      case 'week': return d >= w0 && d < w1;
      case 'next': return d >= w1 && d < w2;
      case 'done': return r.done;
      default: return true;
    }
  };
  const base = useMemo(() => rows.filter((r) => (owner === 'everyone' || r.ownerId === owner) && (types.length === 0 || types.includes(r.type))), [rows, owner, types]);
  const list = base.filter(inPeriod).sort((a, b) => (period === 'done' ? b.dueAt.localeCompare(a.dueAt) : a.dueAt.localeCompare(b.dueAt)));
  const overdueCount = base.filter((r) => !r.done && new Date(r.dueAt) < now).length;

  const toggleDone = (r: ActivityRow) => {
    if (r.done || r.readOnly) return;
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, done: true, doneAt: new Date().toISOString() } : x)));
    start(async () => { await completeAndNext(r.id); router.refresh(); });
  };
  const move = (r: ActivityRow, day: Date) => {
    const old = new Date(r.dueAt);
    const d = new Date(day.getFullYear(), day.getMonth(), day.getDate(), old.getHours(), old.getMinutes());
    setRows((xs) => xs.map((x) => (x.id === r.id ? { ...x, dueAt: d.toISOString() } : x)));
    start(async () => { await updateFollowUp(r.id, { dueAt: d.toISOString() }); router.refresh(); });
  };
  const time = (iso: string) => new Date(iso).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' });
  const date = (iso: string) => new Date(iso).toLocaleDateString('el-GR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-stone-line">
          {([['list', List, 'Λίστα'], ['calendar', CalendarDays, 'Ημερολόγιο']] as const).map(([v, I, l]) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} title={l} aria-label={l} className={`flex h-9 w-10 items-center justify-center ${view === v ? 'bg-forest/10 text-forest' : 'bg-white text-charcoal-600 hover:bg-stone'}`}><I size={17} /></button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1">
          <button type="button" onClick={() => setTypes([])} className={`rounded-full px-3 py-1 text-xs ${types.length === 0 ? 'bg-forest text-white' : 'bg-stone text-charcoal-600'}`}>Όλοι οι τύποι</button>
          {ACTIVITY_TYPES.map((a) => { const I = ICON[a.key]; const on = types.includes(a.key); return (
            <button key={a.key} type="button" title={a.label} onClick={() => setTypes((t) => (on ? t.filter((x) => x !== a.key) : [...t, a.key]))}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${on ? 'bg-forest text-white' : 'bg-stone text-charcoal-600 hover:bg-stone-200'}`}><I size={12} /> {a.label}</button>
          ); })}
        </div>
        <select className="input ml-auto h-9 w-auto py-1 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Υπεύθυνος">
          <option value={currentUserId}>Οι δικές μου</option>
          <option value="everyone">Όλοι</option>
          {agents.filter((a) => a.id !== currentUserId).map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
        </select>
      </div>

      {view === 'list' && (
        <>
          <div className="flex flex-wrap gap-1 border-b border-stone-line">
            {PERIODS.map(([k, l]) => (
              <button key={k} type="button" onClick={() => setPeriod(k)} className={`px-3 py-2 text-sm ${period === k ? 'border-b-2 border-forest font-medium text-forest' : 'text-charcoal-600 hover:text-charcoal'}`}>
                {l}{k === 'overdue' && overdueCount ? <span className="ml-1 rounded-full bg-signal-danger px-1.5 text-[10px] text-white">{overdueCount}</span> : null}
              </button>
            ))}
          </div>
          <div className="panel overflow-x-auto">
            <table className="table-base w-full min-w-[760px]">
              <thead><tr><th className="w-10">Έγινε</th><th>Θέμα</th><th>Deal</th><th>Πρόσωπο</th><th>Τηλέφωνο</th><th>Ημερομηνία</th><th>Διάρκεια</th><th>Υπεύθυνος</th></tr></thead>
              <tbody>
                {list.length === 0 && <tr><td colSpan={8} className="py-8 text-center text-sm text-charcoal-600/70">Καμία activity εδώ. 🎉</td></tr>}
                {list.map((r) => {
                  const I = ICON[r.type] ?? CheckSquare;
                  const late = !r.done && new Date(r.dueAt) < now;
                  return (
                    <tr key={r.id} className={r.done ? 'opacity-60' : ''}>
                      <td><button type="button" disabled={pending || r.done || r.readOnly} title={r.readOnly ? 'Ολοκληρώνεται από την καρτέλα του deal' : undefined} onClick={() => toggleDone(r)} aria-label="Ολοκλήρωση" className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${r.done ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-300 hover:border-emerald-600'}`}>{r.done && <Check size={11} />}</button></td>
                      <td><span className="flex items-center gap-2"><I size={14} className="shrink-0 text-charcoal-600" /><span className={r.done ? 'line-through' : 'font-medium text-charcoal'} data-no-tr>{r.note || activityLabel(r.type)}</span>{r.priority === 'high' && <span className="text-xs text-signal-danger">⚑</span>}{r.statusLabel && <span className="badge-neutral text-[10px]">{r.statusLabel}</span>}</span></td>
                      <td>{r.leadId ? <Link href={`/crm/leads/${r.leadId}`} className="text-forest hover:underline" data-no-tr>{r.dealTitle ?? 'Deal'}</Link> : '—'}</td>
                      <td data-no-tr>{r.contactName ?? '—'}</td>
                      <td>{r.phone ? <a href={`tel:${r.phone}`} className="text-forest hover:underline">{r.phone}</a> : '—'}</td>
                      <td className={late ? 'font-medium text-signal-danger' : ''}>{date(r.dueAt)} · {time(r.dueAt)}</td>
                      <td>{r.durationMin ? `${r.durationMin}′` : '—'}</td>
                      <td>{r.ownerName ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {view === 'calendar' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <button type="button" className="btn-secondary px-2 py-1" onClick={() => setWeek((w) => addDays(w, -7))} aria-label="Προηγούμενη εβδομάδα"><ChevronLeft size={15} /></button>
            <button type="button" className="btn-secondary px-2 py-1" onClick={() => setWeek(weekStart(new Date()))}><RotateCcw size={13} /> Σήμερα</button>
            <button type="button" className="btn-secondary px-2 py-1" onClick={() => setWeek((w) => addDays(w, 7))} aria-label="Επόμενη εβδομάδα"><ChevronRight size={15} /></button>
            <span className="font-medium text-charcoal">{week.toLocaleDateString('el-GR', { day: '2-digit', month: 'short' })} – {addDays(week, 6).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
            <span className="text-xs text-charcoal-600/60">Σύρετε μια activity σε άλλη μέρα για να τη μεταφέρετε.</span>
          </div>
          <div className="-mx-1 overflow-x-auto pb-2">
            <div className="grid min-w-[840px] grid-cols-7 gap-2 px-1">
              {Array.from({ length: 7 }, (_, i) => addDays(week, i)).map((d, i) => {
                const items = base.filter((r) => { const x = new Date(r.dueAt); return x >= d && x < addDays(d, 1); }).sort((a, b) => a.dueAt.localeCompare(b.dueAt));
                const today = d.getTime() === t0.getTime();
                return (
                  <div key={i} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { const id = e.dataTransfer.getData('text/plain'); const r = rows.find((x) => x.id === id); if (r && !r.done && !r.readOnly) move(r, d); }}
                    className={`min-h-[260px] rounded-xl p-2 ${today ? 'bg-forest/[0.06] ring-1 ring-forest/30' : 'bg-stone/50'}`}>
                    <p className={`mb-2 text-xs font-semibold ${today ? 'text-forest' : 'text-charcoal-600'}`}>{WD[i]} {d.getDate()}</p>
                    <div className="space-y-1.5">
                      {items.map((r) => { const I = ICON[r.type] ?? CheckSquare; const late = !r.done && new Date(r.dueAt) < now; return (
                        <div key={r.id} draggable={!r.done && !r.readOnly} onDragStart={(e) => e.dataTransfer.setData('text/plain', r.id)}
                          className={`rounded-lg border bg-white p-1.5 text-xs shadow-sm ${r.done ? 'border-stone-line opacity-50' : late ? 'border-rose-300' : 'border-stone-line'} ${r.done ? '' : 'cursor-grab'}`}>
                          <p className="flex items-center gap-1 font-medium text-charcoal"><I size={11} /> {time(r.dueAt)}</p>
                          <p className="truncate text-charcoal" data-no-tr>{r.note || activityLabel(r.type)}</p>
                          {r.leadId && <Link href={`/crm/leads/${r.leadId}`} className="block truncate text-forest hover:underline" data-no-tr>{r.dealTitle ?? r.contactName}</Link>}
                        </div>
                      ); })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
