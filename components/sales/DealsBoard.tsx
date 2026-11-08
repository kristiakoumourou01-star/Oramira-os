'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type DragEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Columns3, List, CircleDollarSign, Archive, Filter, ChevronRight, ChevronDown, AlertTriangle, X, Trophy, ThumbsDown,
  Trash2, ArrowRightLeft, Plus, Search, Phone, Users, CheckSquare, Flag, Mail, Utensils, Home, ArchiveRestore, Clock,
} from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { dealTitle, dealValue } from '@/lib/leads-shared';
import { CLOSED, LABEL_CLASS, lateBy, pipelineOf, stageOf, type PipelineSettings, type StageDef } from '@/lib/pipeline-shared';
import { ACTIVITY_TYPES, activityState, type ActivityState } from '@/lib/activity-types';
import { formatCurrency } from '@/lib/format';
import { updateLeadStatus, setLeadPipeline } from '@/app/actions/leads';
import { addFollowUp } from '@/app/actions/follow-ups';
import { setDealsArchived, updateDeal } from '@/app/actions/sales-deals';
import { DeleteLeadDialog } from '@/components/crm/DeleteLeadDialog';
import { LeadManager } from '@/components/crm/LeadManager';

export interface Agent { id: string; full_name: string | null }
type View = 'board' | 'list' | 'forecast' | 'archive';
type Sort = 'activity' | 'value' | 'created' | 'title' | 'close' | 'owner';
interface Cond { label: string; owner: string; activity: '' | ActivityState; rotten: boolean; valueMin: string; valueMax: string; closeFrom: string; closeTo: string; source: string }
const NO_COND: Cond = { label: '', owner: '', activity: '', rotten: false, valueMin: '', valueMax: '', closeFrom: '', closeTo: '', source: '' };

const ACT_ICON: Record<string, any> = { call: Phone, meeting: Users, task: CheckSquare, deadline: Flag, email: Mail, lunch: Utensils, viewing: Home };
const STATE_STYLE: Record<ActivityState, { cls: string; title: string }> = {
  none: { cls: 'text-amber-500', title: 'Καμία προγραμματισμένη activity' },
  overdue: { cls: 'bg-signal-danger text-white', title: 'Καθυστερημένη activity' },
  today: { cls: 'bg-emerald-600 text-white', title: 'Activity σήμερα' },
  planned: { cls: 'bg-stone-300 text-white', title: 'Προγραμματισμένη activity' },
};
const initials = (n: string | null | undefined) => (n ?? '?').split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
const isClosed = (s: string) => s === 'won' || (CLOSED as readonly string[]).includes(s);
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const lastDayOf = (ym: string) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m, 0); return `${y}-${String(m).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const MONTHS = ['Ιαν', 'Φεβ', 'Μαρ', 'Απρ', 'Μάι', 'Ιούν', 'Ιούλ', 'Αύγ', 'Σεπ', 'Οκτ', 'Νοέ', 'Δεκ'];

/**
 * Sales → Deals: ο πίνακας του Pipedrive. Στήλες = στάδια (σύνολο αξίας ·
 * αριθμός), κάρτες με τίτλο, πρόσωπο, αξία, υπεύθυνο και ένδειξη επόμενης
 * activity, «σάπια» deals (πέρασαν το όριο ημερών του σταδίου), drag & drop,
 * κάτω μπάρα Διαγραφή / Lost / Won / Μετακίνηση / Αρχείο, φίλτρα, ταξινόμηση,
 * και προβολές Πίνακας · Λίστα · Forecast · Αρχείο.
 */
export function DealsBoard({ leads: initial, cfg, agents, currentUserId, initialView = 'board' }: { leads: LeadListItem[]; cfg: PipelineSettings; agents: Agent[]; currentUserId: string; initialView?: View }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [leads, setLeads] = useState(initial);
  useEffect(() => setLeads(initial), [initial]);
  const [view, setView] = useState<View>(initialView);
  const [pipeKey, setPipeKey] = useState(cfg.defaultKey);
  const [owner, setOwner] = useState<string>('everyone');
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<Sort>('activity');
  const [q, setQ] = useState('');
  const [cond, setCond] = useState<Cond>(NO_COND);
  const [filterOpen, setFilterOpen] = useState(false);
  const [preset, setPreset] = useState<'all' | 'rotten' | 'noact' | 'closepast' | 'old3m' | 'won' | 'lost'>('all');
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [lostFor, setLostFor] = useState<LeadListItem | null>(null);
  const [moveFor, setMoveFor] = useState<LeadListItem | null>(null);
  const [delFor, setDelFor] = useState<LeadListItem | null>(null);
  const [actFor, setActFor] = useState<LeadListItem | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const now = Date.now();
  useEffect(() => { try { const v = localStorage.getItem('oramira:deals'); if (v) { const x = JSON.parse(v); if (x.pipeKey && cfg.pipelines.some((p) => p.key === x.pipeKey)) setPipeKey(x.pipeKey); if (x.sort) setSort(x.sort); if (x.owner) setOwner(x.owner); } } catch { /* */ } }, [cfg.pipelines]);
  useEffect(() => { try { localStorage.setItem('oramira:deals', JSON.stringify({ pipeKey, sort, owner })); } catch { /* */ } }, [pipeKey, sort, owner]);

  const pipe = pipelineOf(cfg, pipeKey);
  const columns = pipe.stages.filter((s) => s.status !== 'won');
  const wonStage = pipe.stages.find((s) => s.status === 'won');
  const labelOf = (k: string) => cfg.dealLabels.find((l) => l.key === k);
  const nextOf = (l: LeadListItem) => l.next_follow_up ?? l.next_action_date ?? null;
  const rottenDays = (l: LeadListItem) => (isClosed(l.status) ? null : lateBy(pipe, l.status, l.stage_entered_at, now, l.stage));

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const vmin = cond.valueMin ? Number(cond.valueMin) : null, vmax = cond.valueMax ? Number(cond.valueMax) : null;
    return leads.filter((l) => {
      if (pipelineOf(cfg, l.pipeline).key !== pipe.key) return false;
      if (l.in_inbox) return false;
      const own = owner === 'me' ? currentUserId : owner;
      if (own !== 'everyone' && (own === 'none' ? l.owner_id : l.owner_id !== own)) return false;
      if (t && ![dealTitle(l), l.full_name, l.email, l.phone].some((x) => (x ?? '').toLowerCase().includes(t))) return false;
      if (cond.label && !(l.labels ?? []).includes(cond.label)) return false;
      if (cond.owner && l.owner_id !== cond.owner) return false;
      if (cond.source && l.source !== cond.source) return false;
      if (cond.activity && activityState(nextOf(l)) !== cond.activity) return false;
      if (cond.rotten && !(rottenDays(l) ?? 0)) return false;
      const v = dealValue(l);
      if (vmin !== null && v < vmin) return false;
      if (vmax !== null && v > vmax) return false;
      if (cond.closeFrom && (!l.expected_close_date || l.expected_close_date < cond.closeFrom)) return false;
      if (cond.closeTo && (!l.expected_close_date || l.expected_close_date > cond.closeTo)) return false;
      if (preset === 'rotten' && !(rottenDays(l) ?? 0)) return false;
      if (preset === 'noact' && (isClosed(l.status) || activityState(nextOf(l)) !== 'none')) return false;
      if (preset === 'closepast' && (isClosed(l.status) || !l.expected_close_date || l.expected_close_date >= new Date().toISOString().slice(0, 10))) return false;
      if (preset === 'old3m' && (isClosed(l.status) || Date.now() - Date.parse(l.created_at) < 90 * 86400000)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, pipe.key, owner, q, cond, currentUserId, preset]);

  const sorter = (a: LeadListItem, b: LeadListItem) => {
    switch (sort) {
      case 'value': return dealValue(b) - dealValue(a);
      case 'created': return b.created_at.localeCompare(a.created_at);
      case 'title': return dealTitle(a).localeCompare(dealTitle(b), 'el');
      case 'close': return (a.expected_close_date ?? '9999').localeCompare(b.expected_close_date ?? '9999');
      case 'owner': return (a.owner_name ?? '~').localeCompare(b.owner_name ?? '~', 'el');
      default: return (nextOf(a) ?? '9999').localeCompare(nextOf(b) ?? '9999');
    }
  };
  const live = filtered.filter((l) => !l.archived_at);
  const open = live.filter((l) => !isClosed(l.status));
  const byStage = (st: StageDef) => open.filter((l) => stageOf(pipe, l.status, l.stage)?.key === st.key).sort(sorter);
  const won = live.filter((l) => l.status === 'won').sort(sorter);
  const lost = live.filter((l) => isClosed(l.status) && l.status !== 'won').sort(sorter);
  const total = open.reduce((s, l) => s + dealValue(l), 0);
  const weighted = open.reduce((s, l) => s + dealValue(l) * ((stageOf(pipe, l.status, l.stage)?.probability ?? 0) / 100), 0);
  const condCount = Object.entries(cond).filter(([, v]) => v !== '' && v !== false).length;

  const patchLocal = (id: string, p: Partial<LeadListItem>) => setLeads((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const moveTo = (l: LeadListItem, st: StageDef) => {
    if (stageOf(pipe, l.status, l.stage)?.key === st.key && !isClosed(l.status)) return;
    patchLocal(l.id, { status: st.status, stage: st.key, stage_entered_at: new Date().toISOString() });
    start(async () => { await updateLeadStatus(l.id, st.status, undefined, undefined, st.key); router.refresh(); });
  };
  const markWon = (l: LeadListItem) => { patchLocal(l.id, { status: 'won', stage: wonStage?.key ?? 'won', won_at: new Date().toISOString() }); start(async () => { await updateLeadStatus(l.id, 'won', undefined, undefined, wonStage?.key ?? null); setMsg(`«${dealTitle(l)}» → Won 🎉`); router.refresh(); }); };
  const archive = (ids: string[], on: boolean) => { ids.forEach((id) => patchLocal(id, { archived_at: on ? new Date().toISOString() : null })); start(async () => { const r = await setDealsArchived(ids, on); setMsg(r.ok ? (on ? 'Μεταφέρθηκε στο αρχείο.' : 'Επανήλθε από το αρχείο.') : r.error); router.refresh(); }); };
  const dealOf = (id: string | null) => leads.find((x) => x.id === id) ?? null;

  const onCardDragStart = (e: DragEvent, id: string) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setDrag(id); };
  const dropZone = (key: string, onDrop: (l: LeadListItem) => void) => ({
    onDragOver: (e: DragEvent) => { if (drag) { e.preventDefault(); setOver(key); } },
    onDragLeave: () => setOver((o) => (o === key ? null : o)),
    onDrop: (e: DragEvent) => { e.preventDefault(); const l = dealOf(drag); setDrag(null); setOver(null); if (l) onDrop(l); },
  });

  // Συνάρτηση (όχι component), για να μη ξαναφτιάχνεται η κάρτα όσο τη σέρνετε.
  const card = (l: LeadListItem) => {
    const st = activityState(nextOf(l));
    const rot = rottenDays(l);
    const Ic = ACT_ICON[l.next_activity_type ?? ''] ?? ChevronRight;
    return (
      <div key={l.id} draggable={!pending} onDragStart={(e) => onCardDragStart(e, l.id)} onDragEnd={() => { setDrag(null); setOver(null); }}
        className={`group relative rounded-lg border bg-white p-2.5 text-sm shadow-sm transition hover:shadow-md ${rot ? 'border-rose-300 bg-rose-50/60' : 'border-stone-line'} ${drag === l.id ? 'opacity-40' : ''} cursor-grab active:cursor-grabbing`}>
        <Link href={`/crm/leads/${l.id}`} className="block pr-6 font-semibold leading-snug text-charcoal hover:text-forest" data-no-tr>{dealTitle(l)}</Link>
        {l.title && l.full_name && <p className="truncate text-xs text-charcoal-600/70" data-no-tr>{l.full_name}</p>}
        {(l.labels ?? []).length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">{(l.labels ?? []).map((k) => { const lb = labelOf(k); return lb ? <span key={k} className={`rounded border px-1.5 text-[10px] font-medium ${LABEL_CLASS[lb.color]}`}>{lb.name}</span> : null; })}</div>
        )}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-stone text-[9px] font-semibold text-charcoal-600" title={l.owner_name ?? 'Χωρίς υπεύθυνο'}>{initials(l.owner_name)}</span>
            <span className="truncate text-xs font-medium text-charcoal-600">{dealValue(l) ? formatCurrency(dealValue(l)) : '€0'}</span>
          </span>
          {l.status === 'won' ? <span className="rounded bg-emerald-600 px-1.5 text-[10px] font-semibold uppercase text-white">Won</span>
            : isClosed(l.status) ? <span className="rounded bg-signal-danger px-1.5 text-[10px] font-semibold uppercase text-white">Lost</span>
            : (
              <button type="button" onClick={() => setActFor(l)} title={STATE_STYLE[st].title} aria-label={STATE_STYLE[st].title}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${st === 'none' ? '' : STATE_STYLE[st].cls}`}>
                {st === 'none' ? <AlertTriangle size={15} className={STATE_STYLE.none.cls} /> : <Ic size={11} strokeWidth={2.5} />}
              </button>
            )}
        </div>
        {rot ? <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-700"><Clock size={11} /> {rot} μ. πάνω από το όριο</p> : null}
      </div>
    );
  };

  const ViewBtn = ({ v, icon: I, label }: { v: View; icon: any; label: string }) => (
    <button type="button" onClick={() => setView(v)} title={label} aria-label={label} aria-pressed={view === v}
      className={`flex h-9 w-10 items-center justify-center border-r border-stone-line last:border-r-0 ${view === v ? 'bg-forest/10 text-forest' : 'bg-white text-charcoal-600 hover:bg-stone'}`}><I size={17} /></button>
  );

  return (
    <div className="space-y-3">
      {/* Μπάρα εργαλείων — όπως στο Pipedrive */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-stone-line">
          <ViewBtn v="board" icon={Columns3} label="Πίνακας" />
          <ViewBtn v="list" icon={List} label="Λίστα" />
          <ViewBtn v="forecast" icon={CircleDollarSign} label="Forecast" />
          <ViewBtn v="archive" icon={Archive} label="Αρχείο" />
        </div>
        <select className="input h-9 w-auto py-1 text-sm font-medium" value={pipe.key} onChange={(e) => setPipeKey(e.target.value)} aria-label="Pipeline" data-no-tr>
          {cfg.pipelines.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}
        </select>
        <select className="input h-9 w-auto py-1 text-sm" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Υπεύθυνος">
          <option value="everyone">Όλοι</option>
          <option value="me">Τα δικά μου</option>
          <option value="none">Χωρίς υπεύθυνο</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? '—'}</option>)}
        </select>
        <label className="relative">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input className="input h-9 w-48 py-1 pl-8 text-sm" placeholder="Αναζήτηση deal…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <select className={`input h-9 w-auto py-1 text-sm ${preset !== 'all' ? 'border-forest text-forest' : ''}`} value={preset} aria-label="Αποθηκευμένα φίλτρα"
          onChange={(e) => { const v = e.target.value as typeof preset; setPreset(v); if (v === 'won' || v === 'lost') { setShowClosed(true); setView('board'); } }}>
          <option value="all">Όλα τα ανοιχτά deals</option>
          <option value="rotten">«Σάπια» deals</option>
          <option value="noact">Χωρίς προγραμματισμένη activity</option>
          <option value="closepast">Αναμ. κλείσιμο στο παρελθόν</option>
          <option value="old3m">Πάνω από 3 μήνες</option>
          <option value="won">Won deals</option>
          <option value="lost">Lost deals</option>
        </select>
        <div className="relative">
          <button type="button" onClick={() => setFilterOpen((x) => !x)} className={`btn-secondary h-9 text-sm ${condCount ? 'border-forest text-forest' : ''}`}><Filter size={14} /> Add condition{condCount ? ` (${condCount})` : ''}</button>
          {filterOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-[320px] space-y-2 rounded-xl border border-stone-line bg-white p-3 shadow-overlay">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="col-span-2"><span className="text-xs text-charcoal-600/70">Label</span>
                  <select className="input py-1" value={cond.label} onChange={(e) => setCond({ ...cond, label: e.target.value })}><option value="">Όλα</option>{cfg.dealLabels.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select></label>
                <label className="col-span-2"><span className="text-xs text-charcoal-600/70">Activity</span>
                  <select className="input py-1" value={cond.activity} onChange={(e) => setCond({ ...cond, activity: e.target.value as Cond['activity'] })}>
                    <option value="">Όλες</option><option value="none">Χωρίς activity</option><option value="overdue">Καθυστερημένη</option><option value="today">Σήμερα</option><option value="planned">Προγραμματισμένη</option>
                  </select></label>
                <label className="col-span-2"><span className="text-xs text-charcoal-600/70">Πηγή</span>
                  <select className="input py-1" value={cond.source} onChange={(e) => setCond({ ...cond, source: e.target.value })}><option value="">Όλες</option>{[...new Set(leads.map((l) => l.source).filter(Boolean))].map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                <label><span className="text-xs text-charcoal-600/70">Αξία από €</span><input className="input py-1" inputMode="numeric" value={cond.valueMin} onChange={(e) => setCond({ ...cond, valueMin: e.target.value.replace(/\D/g, '') })} /></label>
                <label><span className="text-xs text-charcoal-600/70">έως €</span><input className="input py-1" inputMode="numeric" value={cond.valueMax} onChange={(e) => setCond({ ...cond, valueMax: e.target.value.replace(/\D/g, '') })} /></label>
                <label><span className="text-xs text-charcoal-600/70">Κλείσιμο από</span><input type="date" className="input py-1" value={cond.closeFrom} onChange={(e) => setCond({ ...cond, closeFrom: e.target.value })} /></label>
                <label><span className="text-xs text-charcoal-600/70">έως</span><input type="date" className="input py-1" value={cond.closeTo} onChange={(e) => setCond({ ...cond, closeTo: e.target.value })} /></label>
                <label className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={cond.rotten} onChange={(e) => setCond({ ...cond, rotten: e.target.checked })} /> Μόνο «σάπια» (πέρασαν το όριο ημερών)</label>
              </div>
              <div className="flex justify-between">
                <button type="button" className="btn-ghost text-xs" onClick={() => setCond(NO_COND)}>Καθαρισμός</button>
                <button type="button" className="btn-primary text-xs" onClick={() => setFilterOpen(false)}>Εφαρμογή</button>
              </div>
            </div>
          )}
        </div>
        {view === 'board' && <label className="flex items-center gap-1.5 text-sm text-charcoal-600"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Κλειστά deals</label>}
        <label className="ml-auto flex items-center gap-1.5 text-sm text-charcoal-600">Ταξινόμηση:
          <select className="input h-9 w-auto py-1 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            <option value="activity">Επόμενη activity</option><option value="value">Αξία</option><option value="created">Νεότερα</option><option value="close">Ημ. κλεισίματος</option><option value="title">Τίτλος</option><option value="owner">Υπεύθυνος</option>
          </select>
        </label>
      </div>
      <p className="text-sm text-charcoal-600"><span className="font-semibold text-charcoal">{formatCurrency(total)}</span> · {open.length} deals <span className="text-charcoal-600/60">· σταθμισμένη {formatCurrency(Math.round(weighted))}</span>{msg && <span className="ml-3 text-forest">{msg}</span>}</p>

      {view === 'board' && (
        <div className="-mx-1 overflow-x-auto pb-24">
          <div className="flex min-w-max gap-2 px-1">
            {preset !== 'won' && preset !== 'lost' && columns.map((st, i) => {
              const items = byStage(st);
              const sum = items.reduce((s, l) => s + dealValue(l), 0);
              return (
                <div key={st.key} {...dropZone(st.key, (l) => moveTo(l, st))}
                  className={`flex w-[272px] shrink-0 flex-col rounded-xl bg-stone/50 transition ${over === st.key ? 'ring-2 ring-forest/40' : ''}`}>
                  <div className="relative rounded-t-xl border-b border-stone-line bg-white px-3 py-2" style={{ clipPath: i < columns.length - 1 ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)' : undefined }}>
                    <p className="truncate font-semibold text-charcoal" data-no-tr>{st.label}</p>
                    <p className="text-xs text-charcoal-600/70">{formatCurrency(sum)} · {items.length} deals · {st.probability}%</p>
                  </div>
                  <div className="flex min-h-[120px] flex-1 flex-col gap-2 p-2">
                    {items.map((l) => card(l))}
                  </div>
                </div>
              );
            })}
            {(showClosed || preset === 'won' || preset === 'lost') && (
              <>
                {preset !== 'lost' && <div className="flex w-[272px] shrink-0 flex-col rounded-xl bg-emerald-50/70">
                  <div className="rounded-t-xl border-b border-emerald-200 bg-white px-3 py-2"><p className="font-semibold text-emerald-700">Won</p><p className="text-xs text-charcoal-600/70">{formatCurrency(won.reduce((s, l) => s + dealValue(l), 0))} · {won.length} deals</p></div>
                  <div className="flex flex-col gap-2 p-2">{won.map((l) => card(l))}</div>
                </div>}
                {preset !== 'won' && <div className="flex w-[272px] shrink-0 flex-col rounded-xl bg-rose-50/60">
                  <div className="rounded-t-xl border-b border-rose-200 bg-white px-3 py-2"><p className="font-semibold text-signal-danger">Lost</p><p className="text-xs text-charcoal-600/70">{formatCurrency(lost.reduce((s, l) => s + dealValue(l), 0))} · {lost.length} deals</p></div>
                  <div className="flex flex-col gap-2 p-2">{lost.map((l) => card(l))}</div>
                </div>}
              </>
            )}
          </div>
        </div>
      )}

      {/* Κάτω μπάρα όσο σέρνετε ένα deal — όπως στο Pipedrive */}
      {drag && view === 'board' && (
        <div className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 gap-2 border-t border-stone-line bg-white/95 p-3 shadow-overlay backdrop-blur md:left-[var(--sidebar-w,0px)]">
          {[
            { k: 'del', label: 'Διαγραφή', icon: Trash2, cls: 'border-stone-line text-charcoal-600', on: (l: LeadListItem) => setDelFor(l) },
            { k: 'lost', label: 'Lost', icon: ThumbsDown, cls: 'border-rose-300 text-signal-danger', on: (l: LeadListItem) => setLostFor(l) },
            { k: 'won', label: 'Won', icon: Trophy, cls: 'border-emerald-300 text-emerald-700', on: markWon },
            { k: 'move', label: 'Άλλο pipeline', icon: ArrowRightLeft, cls: 'border-stone-line text-charcoal-600', on: (l: LeadListItem) => setMoveFor(l) },
            { k: 'arch', label: 'Αρχείο', icon: Archive, cls: 'border-stone-line text-charcoal-600', on: (l: LeadListItem) => archive([l.id], true) },
          ].map((z) => (
            <div key={z.k} {...dropZone(`zone:${z.k}`, z.on)}
              className={`flex h-16 items-center justify-center gap-2 rounded-xl border-2 border-dashed text-sm font-semibold uppercase tracking-wide transition ${z.cls} ${over === `zone:${z.k}` ? 'scale-[1.03] bg-stone' : ''}`}>
              <z.icon size={18} /> <span className="hidden sm:inline">{z.label}</span>
            </div>
          ))}
        </div>
      )}

      {view === 'list' && <LeadManager leads={filtered.filter((l) => !l.archived_at)} agents={agents} currentUserId={currentUserId} pipelines={cfg} />}

      {view === 'forecast' && <Forecast deals={live} pipeName={pipe.name} onMove={(l, ym) => { const d = ym ? lastDayOf(ym) : null; patchLocal(l.id, { expected_close_date: d }); start(async () => { await updateDeal(l.id, { expectedCloseDate: d }); router.refresh(); }); }} />}

      {view === 'archive' && (
        <div className="panel overflow-x-auto">
          <table className="table-base w-full min-w-[640px]">
            <thead><tr><th>Deal</th><th>Αξία</th><th>Στάδιο</th><th>Υπεύθυνος</th><th>Αρχειοθετήθηκε</th><th /></tr></thead>
            <tbody>
              {filtered.filter((l) => l.archived_at).length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-charcoal-600/70">Το αρχείο είναι άδειο.</td></tr>}
              {filtered.filter((l) => l.archived_at).map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/crm/leads/${l.id}`} className="font-medium text-charcoal hover:text-forest" data-no-tr>{dealTitle(l)}</Link></td>
                  <td>{formatCurrency(dealValue(l))}</td>
                  <td data-no-tr>{l.status === 'won' ? 'Won' : isClosed(l.status) ? 'Lost' : stageOf(pipe, l.status, l.stage)?.label ?? '—'}</td>
                  <td>{l.owner_name ?? '—'}</td>
                  <td>{l.archived_at ? new Date(l.archived_at).toLocaleDateString('el-GR') : ''}</td>
                  <td className="text-right"><button type="button" className="btn-ghost text-xs" onClick={() => archive([l.id], false)}><ArchiveRestore size={14} /> Επαναφορά</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lostFor && (
        <Modal title={`Lost: ${dealTitle(lostFor)}`} onClose={() => setLostFor(null)}>
          <LostPicker cfg={cfg} onPick={(r, note) => { const l = lostFor; setLostFor(null); patchLocal(l.id, { status: r.status, lost_reason: r.key }); start(async () => { await updateLeadStatus(l.id, r.status, note || undefined, r.key, null); setMsg(`«${dealTitle(l)}» → ${r.label}`); router.refresh(); }); }} />
        </Modal>
      )}
      {moveFor && (
        <Modal title={`Μετακίνηση: ${dealTitle(moveFor)}`} onClose={() => setMoveFor(null)}>
          <div className="space-y-2">
            {cfg.pipelines.filter((p) => p.key !== pipe.key).map((p) => (
              <button key={p.key} type="button" className="flex w-full items-center justify-between rounded-lg border border-stone-line px-3 py-2 text-left hover:bg-stone" data-no-tr
                onClick={() => { const l = moveFor; setMoveFor(null); patchLocal(l.id, { pipeline: p.key }); start(async () => { await setLeadPipeline(l.id, p.key); router.refresh(); }); }}>
                <span>{p.name}</span><ChevronRight size={15} />
              </button>
            ))}
            {cfg.pipelines.length < 2 && <p className="text-sm text-charcoal-600/70">Υπάρχει μόνο ένα pipeline.</p>}
          </div>
        </Modal>
      )}
      {delFor && <DeleteLeadDialog ids={[delFor.id]} names={[dealTitle(delFor)]} onClose={() => setDelFor(null)} onDeleted={() => { setLeads((xs) => xs.filter((x) => x.id !== delFor.id)); setDelFor(null); }} />}
      {actFor && <QuickActivity deal={actFor} onClose={() => setActFor(null)} onSaved={(due, type) => { patchLocal(actFor.id, { next_follow_up: due, next_activity_type: type }); setActFor(null); router.refresh(); }} />}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3"><p className="truncate font-semibold text-charcoal" data-no-tr>{title}</p><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600/60 hover:text-charcoal"><X size={18} /></button></div>
        {children}
      </div>
    </div>
  );
}

function LostPicker({ cfg, onPick }: { cfg: PipelineSettings; onPick: (r: PipelineSettings['lostReasons'][number], note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <div className="space-y-3">
      <div className="grid gap-1.5">
        {cfg.lostReasons.map((r) => (
          <button key={r.key} type="button" onClick={() => onPick(r, note)} className="rounded-lg border border-stone-line px-3 py-2 text-left text-sm hover:border-rose-300 hover:bg-rose-50" data-no-tr>{r.label}</button>
        ))}
      </div>
      <input className="input text-sm" placeholder="Σημείωση (προαιρετικό)" value={note} onChange={(e) => setNote(e.target.value)} />
    </div>
  );
}

function QuickActivity({ deal, onClose, onSaved }: { deal: LeadListItem; onClose: () => void; onSaved: (dueIso: string, type: string) => void }) {
  const [type, setType] = useState<string>('call');
  const tomorrow = new Date(Date.now() + 86400000);
  const [date, setDate] = useState(`${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`);
  const [time, setTime] = useState('10:00');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const label = ACTIVITY_TYPES.find((a) => a.key === type)?.label ?? '';
  return (
    <Modal title={`Activity: ${dealTitle(deal)}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {ACTIVITY_TYPES.map((a) => { const I = ACT_ICON[a.key]; return (
            <button key={a.key} type="button" onClick={() => setType(a.key)} title={a.label} aria-label={a.label} aria-pressed={type === a.key}
              className={`flex h-9 w-9 items-center justify-center rounded-lg border ${type === a.key ? 'border-forest bg-forest/10 text-forest' : 'border-stone-line text-charcoal-600 hover:bg-stone'}`}><I size={16} /></button>
          ); })}
        </div>
        <input ref={ref} className="input" placeholder={label} value={note} onChange={(e) => setNote(e.target.value)} />
        <div className="grid grid-cols-2 gap-2"><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        {err && <p className="text-sm text-signal-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Άκυρο</button>
          <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => {
            const due = new Date(`${date}T${time || '10:00'}`).toISOString();
            const r = await addFollowUp(deal.id, due, note || label, null, { type });
            if (r.ok) onSaved(due, type); else setErr(r.error);
          })}><Plus size={14} /> Αποθήκευση</button>
        </div>
      </div>
    </Modal>
  );
}

function Forecast({ deals, pipeName, onMove }: { deals: LeadListItem[]; pipeName: string; onMove: (l: LeadListItem, ym: string | null) => void }) {
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [start, setStart] = useState(0);
  const base = new Date(); base.setDate(1);
  const months = Array.from({ length: 4 }, (_, i) => { const d = new Date(base.getFullYear(), base.getMonth() + start + i, 1); return { key: monthKey(d), label: `${MONTHS[d.getMonth()]} ${d.getFullYear()}` }; });
  const keyOf = (l: LeadListItem) => (l.status === 'won' && l.won_at ? monthKey(new Date(l.won_at)) : l.expected_close_date ? l.expected_close_date.slice(0, 7) : null);
  const openDeals = deals.filter((l) => l.status === 'won' || !isClosed(l.status));
  const col = (key: string | null) => openDeals.filter((l) => keyOf(l) === key);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <button type="button" className="btn-secondary px-2 py-1" onClick={() => setStart((s) => s - 1)} aria-label="Προηγούμενος μήνας">‹</button>
        <button type="button" className="btn-secondary px-2 py-1" onClick={() => setStart(0)}>Σήμερα</button>
        <button type="button" className="btn-secondary px-2 py-1" onClick={() => setStart((s) => s + 1)} aria-label="Επόμενος μήνας">›</button>
        <span className="text-charcoal-600/70" data-no-tr>{pipeName} · με βάση την αναμενόμενη ημερομηνία κλεισίματος (σύρετε για αλλαγή μήνα)</span>
      </div>
      <div className="-mx-1 overflow-x-auto pb-4">
        <div className="flex min-w-max gap-2 px-1">
          {[{ key: null as string | null, label: 'Χωρίς ημερομηνία' }, ...months].map((m) => {
            const items = col(m.key);
            const openSum = items.filter((l) => l.status !== 'won').reduce((s, l) => s + dealValue(l), 0);
            const wonSum = items.filter((l) => l.status === 'won').reduce((s, l) => s + dealValue(l), 0);
            const k = m.key ?? 'none';
            return (
              <div key={k} onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(k); } }} onDrop={(e) => { e.preventDefault(); const l = deals.find((x) => x.id === drag); setDrag(null); setOver(null); if (l && l.status !== 'won') onMove(l, m.key); }}
                className={`flex w-[260px] shrink-0 flex-col rounded-xl bg-stone/50 ${over === k ? 'ring-2 ring-forest/40' : ''}`}>
                <div className="rounded-t-xl border-b border-stone-line bg-white px-3 py-2">
                  <p className="font-semibold text-charcoal">{m.label}</p>
                  <p className="text-xs text-charcoal-600/70">{formatCurrency(openSum)} ανοιχτά{wonSum ? <> · <span className="text-emerald-700">{formatCurrency(wonSum)} won</span></> : null}</p>
                </div>
                <div className="flex min-h-[100px] flex-col gap-2 p-2">
                  {items.map((l) => (
                    <div key={l.id} draggable={l.status !== 'won'} onDragStart={(e) => { e.dataTransfer.setData('text/plain', l.id); setDrag(l.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                      className={`rounded-lg border bg-white p-2.5 text-sm shadow-sm ${l.status === 'won' ? 'border-emerald-300' : 'border-stone-line cursor-grab'}`}>
                      <Link href={`/crm/leads/${l.id}`} className="block font-semibold text-charcoal hover:text-forest" data-no-tr>{dealTitle(l)}</Link>
                      <p className="text-xs text-charcoal-600/70">{formatCurrency(dealValue(l))}{l.owner_name ? ` · ${l.owner_name}` : ''}</p>
                      {l.status === 'won' && <span className="mt-1 inline-block rounded bg-emerald-600 px-1.5 text-[10px] font-semibold uppercase text-white">Won</span>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
