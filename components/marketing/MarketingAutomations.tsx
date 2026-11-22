'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserPlus, Handshake, CalendarCheck, Home, CreditCard, Gift, Plus, Pencil, Trash2, X, Lock, Sparkles, Send, Zap, Clock, History, Play } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';
import { Switch } from '@/components/admin/settings-ui';
import { AudiencePicker, type PickContact, type AudienceCount } from '@/components/marketing/AudiencePicker';
import { saveAutomation, setAutomationActive, deleteAutomation, testAutomation, automationHistory, runAutomationsNow } from '@/app/actions/marketing-automations';
import { CHANNEL_NAME, audienceLabel, senderDefaultFor, type CampaignAudience, type CampaignChannel, type SenderDefaults } from '@/lib/campaigns-shared';
import { MessageComposer, type MessageValue } from '@/components/marketing/MessageComposer';
import { reasonText, type AutomationStats, type SendHistoryRow, type RunHistoryRow } from '@/lib/marketing-automations-shared';
import type { MsgLang, SignatureInfo } from '@/lib/message-format-shared';
import { ROLE_EL } from '@/lib/contacts-hub-shared';
import { formatDateTime } from '@/lib/format';
import {
  CATEGORIES, EVENTS, EVENT_BY_KEY, IDEAS, VARIABLES, SAMPLE_VARS, WEEKDAY_SHORT, categoryOf, nextRun, cleanSchedule, cleanTrigger,
  renderAutomation, scheduleSegments, triggerSegments,
  type AutomationInput, type AutomationRow, type AutoSchedule, type AutoTrigger, type CategoryKey, type DelayUnit, type EventKey, type ScheduleKind, type Seg,
} from '@/lib/marketing-automations-shared';

/** Αυτοματισμός του συστήματος (καλωσόρισμα, follow-up, ραντεβού, γενέθλια): φαίνεται εδώ, αλλάζει εκεί που ορίζεται. */
export interface BuiltinAutomation { id: string; category: CategoryKey; name: string; channel: string; when: Seg[]; active: boolean; href: string }

const ICON: Record<CategoryKey, any> = { leads: UserPlus, sales: Handshake, viewings: CalendarCheck, clients: Home, payments: CreditCard, special: Gift };
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[13px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/40'}`;

export function Segs({ segs }: { segs: Seg[] }) {
  return <span className="inline-flex flex-wrap gap-x-1">{segs.map((s, i) => <span key={i} {...(s.data ? { 'data-no-tr': true, className: 'tabular-nums' } : {})}>{s.t}</span>)}</span>;
}

/** Marketing → Δικοί μου αυτοματισμοί: κατηγορίες, λίστα, έτοιμες ιδέες και ο οδηγός σε 3 βήματα. */
export interface LastCheck { at: string; status: string; summary: string | null }

export function MarketingAutomations({ rows, builtins, groups, contacts, tags, stages, sources, canEdit, initialCat, stats = {}, lastCheck = null, isAdmin = false, senderDefaults, signature }: {
  rows: AutomationRow[]; builtins: BuiltinAutomation[]; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[];
  stages: { key: string; label: string }[]; sources: [string, string][]; canEdit: boolean; initialCat?: string;
  stats?: Record<string, AutomationStats>; lastCheck?: LastCheck | null; isAdmin?: boolean; senderDefaults: SenderDefaults; signature: SignatureInfo | null;
}) {
  const router = useRouter();
  const [cat, setCat] = useState<CategoryKey>(CATEGORIES.some((c) => c.key === initialCat) ? (initialCat as CategoryKey) : 'leads');
  const [dlg, setDlg] = useState<{ row?: AutomationRow; init?: AutomationInput } | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [per, setPer] = useState(10);
  const [pg, setPg] = useState(0);
  const [pending, start] = useTransition();
  const [hist, setHist] = useState<AutomationRow | null>(null);
  const [running, startRun] = useTransition();
  const runNow = () => startRun(async () => { const r = await runAutomationsNow(); setMsg(r.ok ? { ok: true, text: r.summary } : { ok: false, text: r.error }); router.refresh(); });
  const stageLabel = (k: string) => stages.find((s) => s.key === k)?.label ?? k;
  const sourceLabel = (k: string) => sources.find(([s]) => s === k)?.[1] ?? k;

  const mine = rows.filter((r) => categoryOf(r) === cat);
  const built = builtins.filter((b) => b.category === cat);
  const pages = Math.max(1, Math.ceil(mine.length / per));
  const p = Math.min(pg, pages - 1);
  const list = mine.slice(p * per, p * per + per);
  const ideas = IDEAS.filter((i) => i.category === cat);

  const toggle = (r: AutomationRow) => start(async () => { const x = await setAutomationActive(r.id, !r.active); setMsg(x.ok ? null : { ok: false, text: x.error }); router.refresh(); });
  const del = (r: AutomationRow) => { if (!confirm(`Διαγραφή του αυτοματισμού «${r.name}»;`)) return; start(async () => { const x = await deleteAutomation(r.id); setMsg(x.ok ? { ok: true, text: 'Ο αυτοματισμός διαγράφηκε.' } : { ok: false, text: x.error }); router.refresh(); }); };
  const when = (r: AutomationRow) => (r.kind === 'schedule' && r.schedule ? scheduleSegments(r.schedule) : r.trigger ? triggerSegments(r.trigger, stageLabel, sourceLabel) : []);
  const who = (r: AutomationRow) => (r.kind === 'schedule' && r.audience ? audienceLabel(r.audience, (x) => `Όλοι: ${ROLE_EL[x] ?? x}`) : null);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl text-charcoal">Δικοί μου αυτοματισμοί</h2>
          <p className="text-[14px] text-charcoal-600">Μηνύματα που φεύγουν μόνα τους: όταν συμβεί κάτι (νέο lead, ραντεβού, δόση…) ή κάθε μέρα / εβδομάδα / μήνα. Για ένα μήνυμα μία φορά χρησιμοποιήστε τις Καμπάνιες.</p>
        </div>
        {canEdit && <button type="button" onClick={() => setDlg({ init: blank(cat) })} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-3.5 text-[14px] font-medium text-white hover:bg-forest/90"><Plus size={15} /> Νέος αυτοματισμός</button>}
      </div>

      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-stone-line bg-white px-4 py-2.5 text-[13px] text-charcoal-600">
        <span className={`h-2 w-2 rounded-full ${lastCheck?.status === 'failed' ? 'bg-signal-danger' : 'bg-forest'}`} />
        <span>Ο έλεγχος τρέχει αυτόματα κάθε 15 λεπτά</span>
        <span>·</span>
        <span>τελευταίος έλεγχος:</span>
        <span className="tabular-nums text-charcoal">{lastCheck ? formatDateTime(lastCheck.at) : '—'}</span>
        {lastCheck?.status === 'failed' && <span className="text-signal-danger">Απέτυχε</span>}
        {isAdmin && <button type="button" onClick={runNow} disabled={running} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] font-medium text-charcoal hover:border-forest/40 disabled:opacity-50"><Play size={13} /> {running ? 'Εκτέλεση…' : 'Εκτέλεση τώρα'}</button>}
      </div>

      <HubCards cols={3} active={cat} onSelect={(k) => { setCat(k as CategoryKey); setPg(0); window.history.replaceState(null, '', `?tab=automations&cat=${k}`); }}
        cards={CATEGORIES.map((c) => ({ key: c.key, icon: ICON[c.key], title: c.title, value: rows.filter((r) => categoryOf(r) === c.key).length, sub: c.sub }))} />

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      <div className="min-w-0 rounded-2xl border border-stone-line bg-white">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 text-[14px] text-charcoal-600 sm:px-5">
          <span className="font-semibold text-charcoal">{CATEGORIES.find((c) => c.key === cat)?.title}</span>
          <span className="ml-auto flex items-center gap-2"><span>Εμφάνιση</span>
            <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPg(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          </span>
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Αυτοματισμός</th><th>Πότε</th><th>Κανάλι</th><th>Αποστολές</th><th>Επόμενη</th><th>Τελευταία</th><th>Ενεργό</th><th className="w-28" /></tr></thead>
            <tbody>
              {built.map((b) => (
                <tr key={b.id} className="bg-stone-50/60">
                  <td className="o-strong"><span className="flex items-center gap-1.5"><Lock size={12} className="shrink-0 text-charcoal-600/60" /><span>{b.name}</span></span><span className="block text-[11px] font-normal text-charcoal-600">Αυτοματισμός συστήματος</span></td>
                  <td><Segs segs={b.when} /></td>
                  <td><span data-no-tr>{b.channel}</span></td>
                  <td>—</td><td>—</td><td>—</td>
                  <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${b.active ? 'bg-forest/[0.09] text-forest' : 'bg-stone-100 text-charcoal-600'}`}>{b.active ? 'Ενεργό' : 'Ανενεργό'}</span></td>
                  <td className="text-right"><a href={b.href} className="text-[13px] font-medium text-forest hover:underline">Αλλαγή</a></td>
                </tr>
              ))}
              {list.map((r) => (
                <tr key={r.id} className={`cursor-pointer ${r.active ? '' : 'opacity-60'}`} onClick={() => setHist(r)}>
                  <td className="o-strong"><span className="block max-w-[240px] truncate" data-no-tr>{r.name}</span><span className="block text-[11px] font-normal text-charcoal-600">{who(r) ? <span data-no-tr>{who(r)}</span> : <span>Ο πελάτης του γεγονότος</span>}</span></td>
                  <td><Segs segs={when(r)} /></td>
                  <td><span data-no-tr>{CHANNEL_NAME[r.channel]}</span></td>
                  <td className="whitespace-nowrap">{(() => { const st = stats[r.id] ?? { sent: 0, failed: 0, skipped: 0 }; return <span className="inline-flex gap-1"><span className="tabular-nums">{st.sent}</span><span>στάλθηκαν</span><span>·</span><span className={`tabular-nums ${st.failed ? 'text-signal-danger' : ''}`}>{st.failed}</span><span>απέτυχαν</span></span>; })()}</td>
                  <td className="whitespace-nowrap tabular-nums">{r.kind === 'schedule' ? (r.active && r.nextRunAt ? formatDateTime(r.nextRunAt) : '—') : <span className="text-charcoal-600">Με το γεγονός</span>}</td>
                  <td className="whitespace-nowrap tabular-nums">{r.lastRunAt ? formatDateTime(r.lastRunAt) : '—'}</td>
                  <td onClick={(e) => e.stopPropagation()}><Switch checked={r.active} onChange={() => toggle(r)} disabled={!canEdit || pending} label={r.active ? 'Ενεργό' : 'Σε παύση'} /></td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <span className="flex justify-end gap-1">
                      <button type="button" onClick={() => setHist(r)} title="Ιστορικό" aria-label="Ιστορικό" className={iconBtn}><History size={15} /></button>
                    {canEdit && <>
                      <button type="button" onClick={() => setDlg({ row: r })} title="Επεξεργασία" aria-label="Επεξεργασία" className={iconBtn}><Pencil size={15} /></button>
                      <button type="button" onClick={() => del(r)} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-signal-danger transition hover:bg-rose-50"><Trash2 size={15} /></button>
                    </>}
                    </span>
                  </td>
                </tr>
              ))}
              {!list.length && !built.length && <tr><td colSpan={8} className="!py-8 text-center">Δεν έχετε ακόμη αυτοματισμούς εδώ. Ξεκινήστε από μια έτοιμη ιδέα παρακάτω.</td></tr>}
            </tbody>
          </table>
        </div>
        {mine.length ? <Pager from={p * per + 1} to={Math.min(mine.length, p * per + per)} total={mine.length} page={p} pages={pages} onPage={setPg} /> : null}
      </div>

      {ideas.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-[13px] font-semibold uppercase tracking-wide text-charcoal-600"><Sparkles size={14} className="text-forest" /> Έτοιμες ιδέες</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ideas.map((i) => (
              <div key={i.title} className="flex flex-col gap-3 rounded-2xl border border-stone-line bg-white p-4">
                <p className="flex-1 text-[14px] text-charcoal">{i.title}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-charcoal-600" data-no-tr>{CHANNEL_NAME[i.input.channel]}</span>
                  {canEdit && <button type="button" onClick={() => setDlg({ init: i.input })} className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-stone-line px-3 text-[13px] font-medium text-charcoal hover:border-forest/40">Χρήση</button>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hist && <HistoryDrawer row={hist} onClose={() => setHist(null)} />}
      {dlg && <AutomationDialog row={dlg.row} init={dlg.init} groups={groups} contacts={contacts} tags={tags} stages={stages} sources={sources} defaults={senderDefaults} signature={signature}
        onClose={() => setDlg(null)} onDone={(t) => { setDlg(null); setMsg({ ok: true, text: t }); router.refresh(); }} />}
    </section>
  );
}

function blank(cat: CategoryKey): AutomationInput {
  const ev = EVENTS.find((e) => e.category === cat);
  if (cat === 'special' || !ev) return { name: '', kind: 'schedule', channel: 'email', schedule: { kind: 'weekly', weekdays: [1], time: '10:00' }, body: '' };
  return { name: '', kind: 'event', channel: 'email', trigger: { event: ev.key, params: {}, delay: { amount: 0, unit: 'hours', dir: 'after' }, filter: {} }, body: '' };
}

const DELAY_UNITS: [DelayUnit, string][] = [['minutes', 'λεπτά'], ['hours', 'ώρες'], ['days', 'μέρες']];
const SCHED: [ScheduleKind, string][] = [['daily', 'Κάθε μέρα'], ['weekly', 'Κάθε εβδομάδα'], ['monthly', 'Κάθε μήνα']];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function AutomationDialog({ row, init, groups, contacts, tags, stages, sources, defaults, signature, onClose, onDone }: {
  row?: AutomationRow; init?: AutomationInput; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[];
  stages: { key: string; label: string }[]; sources: [string, string][]; defaults: SenderDefaults; signature: SignatureInfo | null; onClose: () => void; onDone: (t: string) => void;
}) {
  const src: AutomationInput = row
    ? { id: row.id, name: row.name, kind: row.kind, channel: row.channel, audience: row.audience, trigger: row.trigger, schedule: row.schedule, subject: row.subject ?? '', body: row.body, subjectEn: row.subjectEn ?? '', bodyEn: row.bodyEn ?? '', senderName: row.senderName ?? '' }
    : init ?? blank('leads');
  const t0 = (src.kind === 'event' ? cleanTrigger(src.trigger) : null) ?? { event: 'new_lead' as EventKey, params: {}, delay: { amount: 0, unit: 'hours' as DelayUnit, dir: 'after' as const }, filter: {} };
  const s1 = src.schedule as AutoSchedule | undefined;
  const s0: AutoSchedule = s1 && s1.kind !== 'once' ? s1 : { kind: 'weekly', weekdays: [1], time: '10:00' };
  const [name, setName] = useState(src.name);
  const [kind, setKind] = useState(src.kind);
  const [cat, setCat] = useState<CategoryKey>(src.kind === 'schedule' ? 'special' : EVENT_BY_KEY[t0.event].category);
  const [event, setEvent] = useState<EventKey>(t0.event);
  const [params, setParams] = useState<AutoTrigger['params']>(t0.params);
  const [mode, setMode] = useState<'now' | 'after' | 'before'>(t0.delay.amount ? t0.delay.dir : 'now');
  const [amount, setAmount] = useState(t0.delay.amount || 1);
  const [unit, setUnit] = useState<DelayUnit>(t0.delay.unit);
  const [filter, setFilter] = useState<AutoTrigger['filter']>(t0.filter);
  const [sched, setSched] = useState<AutoSchedule>({ ...s0, weekdays: s0.weekdays ?? [1], day: s0.day ?? 1 });
  const [audience, setAudience] = useState<CampaignAudience | null>((src.audience as CampaignAudience) ?? null);
  const [count, setCount] = useState<AudienceCount | null>(null);
  const [channel, setChannel] = useState<CampaignChannel>(src.channel);
  const [msg, setMsg] = useState<MessageValue>({ senderName: src.senderName ?? senderDefaultFor(src.channel, defaults), subject: src.subject ?? '', subjectEn: src.subjectEn ?? '', body: src.body ?? '', bodyEn: src.bodyEn ?? '' });
  const [lang, setLang] = useState<MsgLang>('el');
  const body = `${msg.body}${msg.bodyEn}`;
  const [err, setErr] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const def = EVENT_BY_KEY[event];
  const trigger: AutoTrigger = { event, params: { ...params, ...(def.dateOnly ? { time: params.time ?? '10:00' } : {}) }, delay: { amount: mode === 'now' ? 0 : amount, unit, dir: mode === 'before' ? 'before' : 'after' }, filter };
  const input: AutomationInput = { id: row?.id, name, kind, channel, subject: msg.subject, subjectEn: msg.subjectEn, body: msg.body, bodyEn: msg.bodyEn, senderName: msg.senderName === senderDefaultFor(channel, defaults) ? '' : msg.senderName, ...(kind === 'event' ? { trigger } : { schedule: sched, audience }) };
  const segs = kind === 'event' ? (cleanTrigger(trigger) ? triggerSegments(cleanTrigger(trigger)!, (k) => stages.find((s) => s.key === k)?.label ?? k, (k) => sources.find(([s]) => s === k)?.[1] ?? k) : []) : (cleanSchedule(sched) ? scheduleSegments(cleanSchedule(sched)!) : []);
  const next = kind === 'schedule' && cleanSchedule(sched) ? nextRun(cleanSchedule(sched)!, new Date()) : null;
  const vars = useMemo(() => ['first_name', 'name', ...(kind === 'event' ? def.vars : [])], [kind, def]);

  const pickCat = (c: CategoryKey) => {
    setCat(c);
    const first = EVENTS.find((e) => e.category === c);
    if (c === 'special') { setKind('schedule'); return; }
    if (first) { setKind('event'); setEvent(first.key); setParams({}); setMode('now'); }
  };
  const pickEvent = (e: EventKey) => { setKind('event'); setEvent(e); setParams(e === 'no_contact' ? { days: 30 } : {}); if (!EVENT_BY_KEY[e].before && mode === 'before') setMode('after'); };
  const save = () => start(async () => { setErr(null); const r = await saveAutomation(input); if (!r.ok) { setErr(r.error); return; } onDone(row ? `Ο αυτοματισμός «${name}» αποθηκεύτηκε.` : `Ο αυτοματισμός «${name}» δημιουργήθηκε και είναι ενεργός.`); });
  const test = () => start(async () => { setErr(null); setNote(null); const r = await testAutomation(input, lang); if (!r.ok) { setErr(r.error); return; } setNote(r.logged ? 'Η δοκιμή καταγράφηκε, αλλά δεν έχει συνδεθεί πάροχος για αυτό το κανάλι — δεν στάλθηκε πραγματικά.' : `Η δοκιμή στάλθηκε σε ${r.to}.`); });

  const Step = ({ n, title, children }: { n: number; title: string; children: React.ReactNode }) => (
    <section className="space-y-3 rounded-2xl border border-stone-line p-4">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-charcoal"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-[12px] text-white">{n}</span><span>{title}</span></p>
      {children}
    </section>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-4 sm:px-6"><h3 className="text-xl">{row ? 'Επεξεργασία αυτοματισμού' : 'Νέος αυτοματισμός'}</h3><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button></div>
        <div className="space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
          <label className="block"><span className={lbl}>Όνομα αυτοματισμού *</span><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Ευχαριστώ μετά την ξενάγηση" /></label>

          {/* 1. Πότε */}
          {Step({ n: 1, title: 'Πότε στέλνεται', children: <>
            <div className="flex flex-wrap gap-1.5">{CATEGORIES.map((c) => <button key={c.key} type="button" onClick={() => pickCat(c.key)} className={chip(cat === c.key)}>{c.title}</button>)}</div>
            <div className="grid gap-2 sm:grid-cols-2">
              {EVENTS.filter((e) => e.category === cat).map((e) => (
                <button key={e.key} type="button" onClick={() => pickEvent(e.key)} className={`rounded-xl border p-3 text-left transition-colors ${kind === 'event' && event === e.key ? 'border-forest bg-forest/[0.06]' : 'border-stone-line hover:border-forest/40'}`}>
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-charcoal"><Zap size={13} className="text-forest" /><span>{e.label}</span></span>
                  <span className="block text-[12px] text-charcoal-600">{e.hint}</span>
                </button>
              ))}
              {cat === 'special' && (
                <button type="button" onClick={() => setKind('schedule')} className={`rounded-xl border p-3 text-left transition-colors ${kind === 'schedule' ? 'border-forest bg-forest/[0.06]' : 'border-stone-line hover:border-forest/40'}`}>
                  <span className="flex items-center gap-1.5 text-[14px] font-semibold text-charcoal"><Clock size={13} className="text-forest" /><span>Σε συγκεκριμένη ώρα</span></span>
                  <span className="block text-[12px] text-charcoal-600">Κάθε μέρα / εβδομάδα / μήνα, σε ομάδα πελατών. Για μία φορά: Καμπάνιες.</span>
                </button>
              )}
            </div>

            {kind === 'event' && <>
              {event === 'new_lead' && <label className="block"><span className={lbl}>Πηγή</span><select className="input text-sm" value={params.source ?? ''} onChange={(e) => setParams({ ...params, source: e.target.value || undefined })}><option value="">Όλες οι πηγές</option>{sources.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>}
              {event === 'lead_stage' && <label className="block"><span className={lbl}>Στάδιο</span><select className="input text-sm" value={params.stage ?? ''} onChange={(e) => setParams({ ...params, stage: e.target.value })}><option value="">Διαλέξτε στάδιο…</option>{stages.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select></label>}
              {event === 'no_contact' && <label className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal"><span>Χωρίς επικοινωνία για</span><input type="number" min={1} max={365} className="input h-9 w-20 text-center" value={params.days ?? 30} onChange={(e) => setParams({ ...params, days: Number(e.target.value) || 1 })} /><span>μέρες</span></label>}
              {event !== 'no_contact' && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-[10px] border border-stone-line p-0.5">
                    {([['now', 'Αμέσως'], ['after', 'Μετά'], ...(def.before ? [['before', 'Πριν']] : [])] as [typeof mode, string][]).map(([m, l]) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg px-3 py-1 text-[13px] font-medium ${mode === m ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>{l}</button>)}
                  </span>
                  {mode !== 'now' && <>
                    <input type="number" min={1} className="input h-9 w-20 text-center" value={amount} onChange={(e) => setAmount(Math.max(1, Number(e.target.value) || 1))} />
                    <select className="input h-9 w-auto text-sm" value={unit} onChange={(e) => setUnit(e.target.value as DelayUnit)}>{DELAY_UNITS.map(([u, l]) => <option key={u} value={u}>{l}</option>)}</select>
                  </>}
                </div>
              )}
              {def.dateOnly && <label className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal"><span>Ώρα αποστολής</span><input type="time" className="input h-9 w-28" value={params.time ?? '10:00'} onChange={(e) => setParams({ ...params, time: e.target.value })} /></label>}
            </>}

            {kind === 'schedule' && <>
              <span className="inline-flex flex-wrap rounded-[10px] border border-stone-line p-0.5">
                {SCHED.map(([k, l]) => <button key={k} type="button" onClick={() => setSched({ ...sched, kind: k })} className={`rounded-lg px-3 py-1 text-[13px] font-medium ${sched.kind === k ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>{l}</button>)}
              </span>
              <div className="flex flex-wrap items-end gap-3">
                {sched.kind === 'monthly' && <label className="block"><span className={lbl}>Μέρα του μήνα</span><select className="input h-9 w-24 text-sm" value={sched.day ?? 1} onChange={(e) => setSched({ ...sched, day: Number(e.target.value) })}>{Array.from({ length: 28 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}</select></label>}
                <label className="block"><span className={lbl}>Ώρα (Κύπρου)</span><input type="time" className="input h-9 w-28" value={sched.time} onChange={(e) => setSched({ ...sched, time: e.target.value })} /></label>
                {<label className="block"><span className={lbl}>Μέχρι (προαιρετικό)</span><input type="date" className="input h-9" value={sched.until ?? ''} onChange={(e) => setSched({ ...sched, until: e.target.value || null })} /></label>}
              </div>
              {sched.kind === 'weekly' && (
                <div className="flex flex-wrap gap-1.5">{WEEK_ORDER.map((d) => { const on = (sched.weekdays ?? []).includes(d); return <button key={d} type="button" onClick={() => setSched({ ...sched, weekdays: on ? (sched.weekdays ?? []).filter((x) => x !== d) : [...(sched.weekdays ?? []), d] })} className={chip(on)}>{WEEKDAY_SHORT[d]}</button>; })}</div>
              )}
            </>}

            <p className="rounded-lg bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600">
              <span className="font-medium text-charcoal">Πότε:</span> {segs.length ? <Segs segs={segs} /> : <span>Συμπληρώστε τα παραπάνω.</span>}
              {kind === 'schedule' && next && <span className="block"><span>Επόμενη αποστολή:</span> <span className="tabular-nums">{formatDateTime(next.toISOString())}</span></span>}
            </p>
          </> })}

          {/* 2. Σε ποιους */}
          {Step({ n: 2, title: 'Σε ποιους', children: kind === 'event' ? <>
            <p className="text-[14px] text-charcoal">Στον πελάτη του γεγονότος (π.χ. στο νέο lead, σε αυτόν που έκλεισε ραντεβού).</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block"><span className={lbl}>Μόνο σε ομάδα (προαιρετικό)</span><select className="input text-sm" value={filter.group ?? ''} onChange={(e) => setFilter({ ...filter, group: e.target.value || undefined })}><option value="">Όλοι</option>{groups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}</select></label>
              <label className="block"><span className={lbl}>Μόνο με tag (προαιρετικό)</span><select className="input text-sm" value={filter.tag ?? ''} onChange={(e) => setFilter({ ...filter, tag: e.target.value || undefined })}><option value="">Όλοι</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
            </div>
            <p className="text-[12px] text-charcoal-600">Στέλνεται μόνο σε όσους δέχονται το κανάλι (Δέχεται email / Δέχεται SMS στην καρτέλα του πελάτη).</p>
          </> : <AudiencePicker channel={channel} initial={audience} groups={groups} contacts={contacts} tags={tags} onChange={setAudience} onCount={setCount} label="Παραλήπτες *" /> })}

          {/* 3. Τι λέει */}
          {Step({ n: 3, title: 'Τι λέει', children: (
            <MessageComposer channel={channel} onChannel={setChannel} value={msg} onChange={setMsg} lang={lang} onLang={setLang}
              vars={VARIABLES.filter((v) => vars.includes(v.key))} defaults={defaults} signature={signature} render={(t) => renderAutomation(t, SAMPLE_VARS)} />
          ) })}
          {kind === 'schedule' && count && !count.reachable && <p className="text-[13px] text-charcoal-600">Προς το παρόν κανείς από αυτούς δεν μπορεί να το λάβει.</p>}
          {note && <p className="text-sm text-forest">{note}</p>}
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-line px-5 py-4 sm:px-6">
          <button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button>
          <button type="button" className="inline-flex items-center gap-1.5 rounded-full border border-stone-line px-4 py-2 text-sm font-medium text-charcoal hover:border-forest/40 disabled:opacity-40" disabled={pending || !body.trim()} onClick={test}><Send size={14} /> Δοκιμή σε εμένα</button>
          <button type="button" className="btn-primary" disabled={pending || !name.trim() || !body.trim()} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
        </div>
      </div>
    </div>
  );
}

const STATUS: Record<string, [string, string]> = {
  sent: ['Στάλθηκε', 'bg-forest/[0.09] text-forest'],
  queued: ['Σε αναμονή', 'bg-stone-100 text-charcoal-600'],
  pending: ['Σε αναμονή', 'bg-stone-100 text-charcoal-600'],
  failed: ['Απέτυχε', 'bg-rose-50 text-signal-danger'],
  skipped: ['Δεν στάλθηκε', 'bg-stone-100 text-charcoal-600'],
};

/** «Ιστορικό αποστολών»: ποιος το πήρε (γεγονότα) ή κάθε εκτέλεση (επαναλαμβανόμενα). */
function HistoryDrawer({ row, onClose }: { row: AutomationRow; onClose: () => void }) {
  const [data, setData] = useState<{ sends: SendHistoryRow[]; runs: RunHistoryRow[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void automationHistory(row.id).then((r) => { if (r.ok) setData({ sends: r.sends, runs: r.runs }); else setErr(r.error); }); }, [row.id]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-charcoal/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-lg flex-col bg-white shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-stone-line px-5 py-4">
          <div className="min-w-0"><h3 className="text-xl">Ιστορικό αποστολών</h3><p className="truncate text-[13px] text-charcoal-600" data-no-tr>{row.name}</p></div>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {err && <p className="text-sm text-signal-danger">{err}</p>}
          {!data && !err && <p className="text-sm text-charcoal-600">Φόρτωση…</p>}
          {data && row.kind === 'event' && (data.sends.length ? (
            <ul className="divide-y divide-stone-line">
              {data.sends.map((s, i) => {
                const [label, tone] = STATUS[s.status] ?? [s.status, 'bg-stone-100 text-charcoal-600'];
                const why = reasonText(s.reason, s.channel);
                return (
                  <li key={i} className="flex items-start gap-3 py-2.5">
                    <span className="min-w-0 flex-1">
                      {s.contactId ? <Link href={`/crm/${s.contactId}`} className="block truncate text-[14px] font-medium text-forest hover:underline" data-no-tr>{s.contactName ?? '—'}</Link> : <span className="block text-[14px]">—</span>}
                      <span className="flex flex-wrap gap-x-1.5 text-[12px] text-charcoal-600"><span className="tabular-nums">{formatDateTime(s.at)}</span>{s.channel && <span data-no-tr>{CHANNEL_NAME[s.channel as CampaignChannel] ?? s.channel}</span>}</span>
                      {why && <span className="block text-[12px] text-charcoal-600">{why}</span>}
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-charcoal-600">Δεν έχει σταλεί ακόμη σε κανέναν.</p>)}
          {data && row.kind === 'schedule' && (data.runs.length ? (
            <div className="overflow-x-auto">
              <table className="o-table">
                <thead><tr><th>Ημερομηνία</th><th className="text-right">Παραλήπτες</th><th className="text-right">Στάλθηκαν</th><th className="text-right">Απέτυχαν</th></tr></thead>
                <tbody>
                  {data.runs.map((r) => (
                    <tr key={r.id}>
                      <td><a href={`/marketing?tab=campaigns&open=${r.id}`} className="tabular-nums text-forest hover:underline">{formatDateTime(r.at)}</a></td>
                      <td className="text-right tabular-nums">{r.recipients}</td>
                      <td className="text-right tabular-nums">{r.sent}</td>
                      <td className="text-right tabular-nums">{r.failed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-sm text-charcoal-600">Δεν έχει τρέξει ακόμη.</p>)}
        </div>
      </aside>
    </div>
  );
}
