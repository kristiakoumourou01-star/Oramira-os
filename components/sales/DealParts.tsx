'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trophy, ThumbsDown, MoreHorizontal, Archive, Trash2, Users, Check, X, Pencil, Phone, Mail, MessageCircle, StickyNote, CalendarPlus,
  CheckSquare, Flag, Utensils, Home, Paperclip, Clock, ChevronDown, ArchiveRestore,
} from 'lucide-react';
import { updateLeadStatus, reassignLead, addNote, logCommunication } from '@/app/actions/leads';
import { addFollowUp, completeAndNext } from '@/app/actions/follow-ups';
import { updateDeal, setDealsArchived, setLeadsInbox } from '@/app/actions/sales-deals';
import { DeleteLeadDialog } from '@/components/crm/DeleteLeadDialog';
import { ACTIVITY_TYPES, activityLabel } from '@/lib/activity-types';
import { LABEL_CLASS, daysSince, lateBy, stageIndex, type DealLabel, type LostReason, type PipelineDef } from '@/lib/pipeline-shared';
import { formatCurrency } from '@/lib/format';

const ICON: Record<string, any> = { call: Phone, meeting: Users, task: CheckSquare, deadline: Flag, email: Mail, lunch: Utensils, viewing: Home };
export interface Person { id: string; full_name: string | null }
const fmtDT = (iso: string) => new Date(iso).toLocaleString('el-GR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtD = (iso: string) => new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: 'short', year: 'numeric' });

/* ---------------------------------------------------------------- Header */

export function DealHeader({ leadId, title, fallbackTitle, status, ownerId, agents, followers, archived, lostReasons, wonStageKey, contactName, inInbox = false }: {
  leadId: string; title: string | null; fallbackTitle: string; status: string; ownerId: string | null; agents: Person[]; followers: string[]; archived: boolean; inInbox?: boolean;
  lostReasons: LostReason[]; wonStageKey: string | null; contactName: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [t, setT] = useState(title ?? '');
  const [lost, setLost] = useState(false);
  const [note, setNote] = useState('');
  const [menu, setMenu] = useState(false);
  const [fol, setFol] = useState(false);
  const [del, setDel] = useState(false);
  const closed = status === 'won' || ['lost', 'nurture', 'no_response', 'retargeting', 'reactivation'].includes(status);
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-charcoal-600/70"><Link href="/sales/deals" className="hover:text-forest">Deals</Link> ›</p>
          {editing ? (
            <div className="flex items-center gap-2">
              <input className="input text-2xl font-semibold" autoFocus value={t} placeholder={fallbackTitle} onChange={(e) => setT(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { setEditing(false); run(() => updateDeal(leadId, { title: t })); } if (e.key === 'Escape') setEditing(false); }} />
              <button type="button" className="btn-primary px-2" onClick={() => { setEditing(false); run(() => updateDeal(leadId, { title: t })); }} aria-label="Αποθήκευση"><Check size={16} /></button>
            </div>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="group flex items-center gap-2 text-left">
              <h1 className="truncate text-3xl" data-no-tr>{title || fallbackTitle}</h1>
              <Pencil size={15} className="shrink-0 text-charcoal-600/40 opacity-0 group-hover:opacity-100" />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-stone-line bg-white px-2 py-1">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone text-xs font-semibold text-charcoal-600">{(agents.find((a) => a.id === ownerId)?.full_name ?? '?').slice(0, 1)}</span>
            <span className="leading-tight">
              <select className="block max-w-[150px] bg-transparent text-sm font-medium text-charcoal outline-none" value={ownerId ?? ''} disabled={pending}
                onChange={(e) => e.target.value && run(() => reassignLead(leadId, e.target.value))}>
                {!ownerId && <option value="">Χωρίς υπεύθυνο</option>}
                {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? '—'}</option>)}
              </select>
              <span className="block text-[11px] text-charcoal-600/60">Υπεύθυνος</span>
            </span>
          </label>
          <div className="relative">
            <button type="button" className="btn-secondary text-sm" onClick={() => setFol((x) => !x)}><Users size={14} /> {followers.length} {followers.length === 1 ? 'follower' : 'followers'} <ChevronDown size={13} /></button>
            {fol && (
              <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-xl border border-stone-line bg-white p-2 shadow-overlay">
                <p className="px-2 pb-1 text-xs text-charcoal-600/70">Ειδοποιούνται για αλλαγές του deal</p>
                {agents.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-stone">
                    <input type="checkbox" checked={followers.includes(a.id)} onChange={(e) => run(() => updateDeal(leadId, { followers: e.target.checked ? [...followers, a.id] : followers.filter((x) => x !== a.id) }))} /> {a.full_name}
                  </label>
                ))}
              </div>
            )}
          </div>
          {!closed && (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => updateLeadStatus(leadId, 'won', undefined, undefined, wonStageKey))} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700">Won</button>
              <button type="button" disabled={pending} onClick={() => setLost(true)} className="rounded-lg bg-signal-danger px-4 py-2 text-sm font-semibold text-white hover:opacity-90">Lost</button>
            </>
          )}
          <div className="relative">
            <button type="button" className="btn-secondary px-2" onClick={() => setMenu((x) => !x)} aria-label="Περισσότερα"><MoreHorizontal size={16} /></button>
            {menu && (
              <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded-xl border border-stone-line bg-white p-1 shadow-overlay">
                <button type="button" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-stone" onClick={() => { setMenu(false); run(() => setDealsArchived([leadId], !archived)); }}>
                  {archived ? <><ArchiveRestore size={14} /> Επαναφορά από αρχείο</> : <><Archive size={14} /> Αρχειοθέτηση</>}
                </button>
                {!inInbox && <button type="button" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm hover:bg-stone" onClick={() => { setMenu(false); run(() => setLeadsInbox([leadId], true)); }}><ArchiveRestore size={14} /> Πίσω στο Leads Inbox</button>}
                <button type="button" className="flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-signal-danger hover:bg-stone" onClick={() => { setMenu(false); setDel(true); }}><Trash2 size={14} /> Διαγραφή</button>
              </div>
            )}
          </div>
        </div>
      </div>
      {archived && <p className="rounded-lg bg-stone px-3 py-2 text-sm text-charcoal-600"><Archive size={13} className="mr-1 inline" /> Αυτό το deal είναι στο αρχείο.</p>}
      {inInbox && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm">
          <span className="text-charcoal">Αυτό είναι lead στο <Link href="/sales/leads" className="font-medium text-forest hover:underline">Leads Inbox</Link> — δεν εμφανίζεται ακόμη στο pipeline.</span>
          <button type="button" disabled={pending} className="btn-primary text-sm" onClick={() => run(() => setLeadsInbox([leadId], false))}>Μετατροπή σε deal</button>
        </div>
      )}
      {lost && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
          <div className="mb-2 flex items-center justify-between"><p className="text-sm font-semibold text-charcoal">Γιατί χάθηκε;</p><button type="button" onClick={() => setLost(false)} aria-label="Κλείσιμο"><X size={16} /></button></div>
          <div className="flex flex-wrap gap-1.5">
            {lostReasons.map((r) => <button key={r.key} type="button" disabled={pending} className="rounded-full border border-stone-line bg-white px-3 py-1 text-sm hover:border-rose-300" data-no-tr onClick={() => { setLost(false); run(() => updateLeadStatus(leadId, r.status, note || undefined, r.key, null)); }}>{r.label}</button>)}
          </div>
          <input className="input mt-2 text-sm" placeholder="Σημείωση (προαιρετικό)" value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      )}
      {del && <DeleteLeadDialog ids={[leadId]} names={[title || contactName]} onClose={() => setDel(false)} onDeleted={() => router.push('/sales/deals')} />}
    </div>
  );
}

/* ------------------------------------------------------------- Stage bar */

export function StageBar({ leadId, pipeline, status, stage, enteredAt }: { leadId: string; pipeline: PipelineDef; status: string; stage: string | null; enteredAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const stages = pipeline.stages.filter((s) => s.status !== 'won');
  const idx = stageIndex(pipeline, status, stage);
  const days = daysSince(enteredAt) ?? 0;
  const late = lateBy(pipeline, status, enteredAt, Date.now(), stage);
  return (
    <div className="space-y-1">
      <div className="flex overflow-x-auto rounded-lg">
        {stages.map((s, i) => {
          const done = idx >= 0 && i < idx, cur = i === idx;
          return (
            <button key={s.key} type="button" disabled={pending || cur} title={`${s.label} · ${s.probability}%`} data-no-tr
              onClick={() => start(async () => { await updateLeadStatus(leadId, s.status, undefined, undefined, s.key); router.refresh(); })}
              className={`relative -ml-2 min-w-[110px] flex-1 truncate py-2 pl-6 pr-4 text-center text-sm first:ml-0 first:pl-3 ${cur ? 'bg-emerald-600 font-semibold text-white' : done ? 'bg-emerald-100 text-emerald-800' : 'bg-stone text-charcoal-600 hover:bg-stone-200'}`}
              style={{ clipPath: i === 0 ? 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)' : 'polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)' }}>
              {s.label}{cur ? ` · ${days}μ.` : ''}
            </button>
          );
        })}
      </div>
      {late ? <p className="flex items-center gap-1 text-xs font-medium text-rose-700"><Clock size={12} /> {late} μέρες πάνω από το όριο του σταδίου — «σάπιο» deal.</p> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Summary */

export function DealSummary({ leadId, value, budgetFallback, currency, expectedClose, labels, allLabels, probability, weighted }: {
  leadId: string; value: number | null; budgetFallback: number | null; currency: string; expectedClose: string | null; labels: string[]; allLabels: DealLabel[]; probability: number; weighted: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [v, setV] = useState(value != null ? String(value) : '');
  const [d, setD] = useState(expectedClose ?? '');
  const [labOpen, setLabOpen] = useState(false);
  const save = (p: Parameters<typeof updateDeal>[1]) => start(async () => { await updateDeal(leadId, p); router.refresh(); });
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-center gap-2">
        <span className="w-28 shrink-0 text-charcoal-600/70">Αξία</span>
        <span className="relative flex-1"><span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60">€</span>
          <input className="input py-1 pl-6 font-semibold" inputMode="decimal" value={v} placeholder={budgetFallback ? String(budgetFallback) : '0'} disabled={pending}
            onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} onBlur={() => { const n = v === '' ? null : Number(v); if (n !== value) save({ value: n }); }} /></span>
      </div>
      {value == null && budgetFallback ? <p className="-mt-2 pl-[120px] text-xs text-charcoal-600/60">Από τον προϋπολογισμό: {formatCurrency(budgetFallback)}</p> : null}
      <div className="flex items-center gap-2"><span className="w-28 shrink-0 text-charcoal-600/70">Σταθμισμένη</span><span className="text-charcoal">{formatCurrency(Math.round(weighted))} <span className="text-charcoal-600/60">({probability}%)</span></span></div>
      <div className="flex items-center gap-2">
        <span className="w-28 shrink-0 text-charcoal-600/70">Αναμ. κλείσιμο</span>
        <input type="date" className="input flex-1 py-1" value={d} disabled={pending} onChange={(e) => { setD(e.target.value); save({ expectedCloseDate: e.target.value || null }); }} />
      </div>
      <div className="flex items-start gap-2">
        <span className="w-28 shrink-0 pt-1 text-charcoal-600/70">Labels</span>
        <div className="relative flex flex-1 flex-wrap gap-1">
          {labels.map((k) => { const l = allLabels.find((x) => x.key === k); return l ? <span key={k} className={`rounded border px-2 py-0.5 text-xs font-medium ${LABEL_CLASS[l.color]}`}>{l.name}</span> : null; })}
          <button type="button" className="rounded border border-dashed border-stone-line px-2 py-0.5 text-xs text-charcoal-600 hover:border-forest" onClick={() => setLabOpen((x) => !x)}>+ Label</button>
          {labOpen && (
            <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border border-stone-line bg-white p-2 shadow-overlay">
              {allLabels.map((l) => (
                <label key={l.key} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-stone">
                  <input type="checkbox" checked={labels.includes(l.key)} onChange={(e) => save({ labels: e.target.checked ? [...labels, l.key] : labels.filter((x) => x !== l.key) })} />
                  <span className={`rounded border px-2 text-xs ${LABEL_CLASS[l.color]}`}>{l.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------- Composer */

type Tab = 'activity' | 'note' | 'call' | 'whatsapp' | 'email';
export function DealComposer({ leadId, contactId, phone, email, agents, ownerId, filesHref }: { leadId: string; contactId: string; phone: string | null; email: string | null; agents: Person[]; ownerId: string | null; filesHref: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('activity');
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [type, setType] = useState('call');
  const tmr = new Date(Date.now() + 86400000);
  const [date, setDate] = useState(`${tmr.getFullYear()}-${String(tmr.getMonth() + 1).padStart(2, '0')}-${String(tmr.getDate()).padStart(2, '0')}`);
  const [time, setTime] = useState('10:00');
  const [dur, setDur] = useState('30');
  const [prio, setPrio] = useState('normal');
  const [who, setWho] = useState(ownerId ?? '');
  const [dir, setDir] = useState<'outbound' | 'inbound'>('outbound');
  const done = (m: string) => { setText(''); setMsg(m); router.refresh(); };
  const tabs: { k: Tab; label: string; icon: any }[] = [
    { k: 'activity', label: 'Activity', icon: CalendarPlus }, { k: 'note', label: 'Σημείωση', icon: StickyNote }, { k: 'call', label: 'Κλήση', icon: Phone },
    { k: 'whatsapp', label: 'WhatsApp', icon: MessageCircle }, { k: 'email', label: 'Email', icon: Mail },
  ];
  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap border-b border-stone-line">
        {tabs.map((t) => (
          <button key={t.k} type="button" onClick={() => { setTab(t.k); setMsg(null); }} aria-pressed={tab === t.k}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm ${tab === t.k ? 'border-b-2 border-forest font-medium text-forest' : 'text-charcoal-600 hover:text-charcoal'}`}><t.icon size={15} /> {t.label}</button>
        ))}
        <Link href={filesHref} className="flex items-center gap-1.5 px-4 py-2.5 text-sm text-charcoal-600 hover:text-charcoal"><Paperclip size={15} /> Αρχεία</Link>
      </div>
      <div className="space-y-3 p-4">
        {tab === 'activity' && (
          <>
            <div className="flex flex-wrap gap-1">
              {ACTIVITY_TYPES.map((a) => { const I = ICON[a.key]; return (
                <button key={a.key} type="button" title={a.label} aria-label={a.label} aria-pressed={type === a.key} onClick={() => setType(a.key)}
                  className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs ${type === a.key ? 'border-forest bg-forest/10 text-forest' : 'border-stone-line text-charcoal-600 hover:bg-stone'}`}><I size={14} /> <span className="hidden sm:inline">{a.label}</span></button>
              ); })}
            </div>
            <input className="input" placeholder={activityLabel(type)} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="grid gap-2 sm:grid-cols-5">
              <input type="date" className="input sm:col-span-2" value={date} onChange={(e) => setDate(e.target.value)} />
              <input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} />
              <select className="input" value={dur} onChange={(e) => setDur(e.target.value)} aria-label="Διάρκεια">{['15', '30', '45', '60', '90', '120'].map((m) => <option key={m} value={m}>{m}′</option>)}</select>
              <select className="input" value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Προτεραιότητα"><option value="low">Χαμηλή</option><option value="normal">Κανονική</option><option value="high">Υψηλή</option></select>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <select className="input w-auto py-1.5 text-sm" value={who} onChange={(e) => setWho(e.target.value)} aria-label="Ανάθεση σε">{agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}</select>
              <button type="button" className="btn-primary" disabled={pending} onClick={() => start(async () => {
                const r = await addFollowUp(leadId, new Date(`${date}T${time || '10:00'}`).toISOString(), text || activityLabel(type), who || null, { type, priority: prio, durationMin: Number(dur) });
                if (r.ok) done('Η activity αποθηκεύτηκε.'); else setMsg(r.error);
              })}>Αποθήκευση</button>
            </div>
          </>
        )}
        {tab === 'note' && (
          <>
            <textarea className="input min-h-[90px]" placeholder="Γράψτε σημείωση…" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-end"><button type="button" className="btn-primary" disabled={pending || !text.trim()} onClick={() => start(async () => { await addNote('lead', leadId, text.trim()); done('Η σημείωση αποθηκεύτηκε.'); })}>Αποθήκευση</button></div>
          </>
        )}
        {(tab === 'call' || tab === 'whatsapp' || tab === 'email') && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {tab === 'call' && phone && <a href={`tel:${phone}`} className="btn-secondary text-sm"><Phone size={14} /> {phone}</a>}
              {tab === 'whatsapp' && phone && <a href={`https://wa.me/${phone.replace(/\D/g, '')}${text ? `?text=${encodeURIComponent(text)}` : ''}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm"><MessageCircle size={14} /> Άνοιγμα WhatsApp</a>}
              {tab === 'email' && email && <a href={`mailto:${email}${text ? `?body=${encodeURIComponent(text)}` : ''}`} className="btn-secondary text-sm"><Mail size={14} /> {email}</a>}
              {((tab !== 'email' && !phone) || (tab === 'email' && !email)) && <span className="text-charcoal-600/70">Η επαφή δεν έχει {tab === 'email' ? 'email' : 'τηλέφωνο'}.</span>}
              <select className="input ml-auto w-auto py-1 text-sm" value={dir} onChange={(e) => setDir(e.target.value as 'outbound' | 'inbound')}><option value="outbound">Εξερχόμενο</option><option value="inbound">Εισερχόμενο</option></select>
            </div>
            <textarea className="input min-h-[80px]" placeholder={tab === 'call' ? 'Τι συζητήσατε;' : 'Μήνυμα / περίληψη…'} value={text} onChange={(e) => setText(e.target.value)} />
            <div className="flex justify-end"><button type="button" className="btn-primary" disabled={pending || !text.trim()} onClick={() => start(async () => {
              await logCommunication({ contactId, leadId, channel: tab === 'call' ? 'phone' : (tab as 'whatsapp' | 'email'), direction: dir, summary: text.trim() });
              done('Καταγράφηκε στο ιστορικό.');
            })}>Καταγραφή</button></div>
          </>
        )}
        {msg && <p className="text-sm text-forest">{msg}</p>}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- Focus */

export interface OpenActivity { id: string; due_at: string; note: string | null; type: string | null; priority: string | null; duration_min: number | null; owner: string | null }
export function FocusList({ items }: { items: OpenActivity[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<string[]>([]);
  const list = items.filter((x) => !gone.includes(x.id));
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 font-semibold text-charcoal">Focus <span className="text-xs font-normal text-charcoal-600/60">— ανοιχτές activities</span></p>
      {list.length === 0 && <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">Δεν υπάρχει προγραμματισμένη activity — προγραμματίστε την επόμενη κίνηση.</p>}
      {list.map((a) => {
        const I = ICON[a.type ?? 'task'] ?? CheckSquare;
        const late = new Date(a.due_at).getTime() < Date.now();
        return (
          <div key={a.id} className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${late ? 'border-rose-200' : 'border-stone-line'}`}>
            <button type="button" disabled={pending} title="Ολοκλήρωση" aria-label="Ολοκλήρωση" onClick={() => { setGone((g) => [...g, a.id]); start(async () => { await completeAndNext(a.id); router.refresh(); }); }}
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-stone-300 hover:border-emerald-600 hover:bg-emerald-50"><Check size={11} className="text-emerald-700 opacity-0 hover:opacity-100" /></button>
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-stone text-charcoal-600"><I size={14} /></span>
            <div className="min-w-0 flex-1">
              <p className="font-medium text-charcoal" data-no-tr>{a.note || activityLabel(a.type)}</p>
              <p className={`text-xs ${late ? 'font-medium text-signal-danger' : 'text-charcoal-600/70'}`}>{fmtDT(a.due_at)}{a.duration_min ? ` · ${a.duration_min}′` : ''}{a.owner ? ` · ${a.owner}` : ''}{a.priority === 'high' ? ' · ⚑ υψηλή' : ''}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- History */

export interface HistoryItem { id: string; kind: 'note' | 'activity' | 'comm' | 'change'; at: string; who: string | null; title: string; body?: string | null; icon?: string }
type HTab = 'all' | 'activity' | 'note' | 'comm' | 'change';
export function DealHistory({ items }: { items: HistoryItem[] }) {
  const [tab, setTab] = useState<HTab>('all');
  const counts = useMemo(() => ({ activity: items.filter((i) => i.kind === 'activity').length, note: items.filter((i) => i.kind === 'note').length, comm: items.filter((i) => i.kind === 'comm').length, change: items.filter((i) => i.kind === 'change').length }), [items]);
  const list = items.filter((i) => tab === 'all' || i.kind === tab);
  const tabs: [HTab, string][] = [['all', 'Όλα'], ['activity', `Activities (${counts.activity})`], ['note', `Σημειώσεις (${counts.note})`], ['comm', `Επικοινωνίες (${counts.comm})`], ['change', `Changelog (${counts.change})`]];
  const KIND_ICON: Record<HistoryItem['kind'], any> = { note: StickyNote, activity: Check, comm: MessageCircle, change: Clock };
  return (
    <div className="space-y-3">
      <p className="font-semibold text-charcoal">Ιστορικό</p>
      <div className="flex flex-wrap gap-1">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`rounded-full px-3 py-1 text-xs ${tab === k ? 'bg-forest text-white' : 'bg-stone text-charcoal-600 hover:bg-stone-200'}`}>{l}</button>)}
      </div>
      <ol className="relative space-y-3 border-l border-stone-line pl-5">
        {list.length === 0 && <li className="text-sm text-charcoal-600/70">Τίποτα ακόμη.</li>}
        {list.map((i) => {
          const I = i.kind === 'activity' ? (ICON[i.icon ?? ''] ?? Check) : KIND_ICON[i.kind];
          return (
            <li key={`${i.kind}-${i.id}`} className="relative">
              <span className="absolute -left-[31px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-stone-line bg-white text-charcoal-600"><I size={11} /></span>
              <div className={`rounded-xl border p-3 ${i.kind === 'note' ? 'border-amber-200 bg-amber-50/60' : 'border-stone-line bg-white'}`}>
                <p className="text-sm text-charcoal" data-no-tr={i.kind === 'note' || i.kind === 'comm' ? true : undefined}>{i.title}</p>
                {i.body && <p className="mt-1 whitespace-pre-wrap text-sm text-charcoal-600" data-no-tr>{i.body}</p>}
                <p className="mt-1 text-xs text-charcoal-600/60">{fmtD(i.at)} {new Date(i.at).toLocaleTimeString('el-GR', { hour: '2-digit', minute: '2-digit' })}{i.who ? ` · ${i.who}` : ''}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
