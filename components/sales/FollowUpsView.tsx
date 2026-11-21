'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Phone, Users, CheckSquare, Flag, Mail, Utensils, Home, AlarmClock, Search, MessageCircle, ListPlus, AlertTriangle, CalendarClock, Sun } from 'lucide-react';
import { completeAndNext, updateFollowUp } from '@/app/actions/follow-ups';
import { snoozeTo, toLocalInput } from '@/lib/follow-ups-shared';
import { activityLabel } from '@/lib/activity-types';
import { STATUS_EL } from '@/lib/pipeline-shared';
import type { FollowUpItem } from '@/lib/sales-hub-shared';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { PopSelect } from '@/components/ui/PopSelect';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { CompletePanel } from '@/components/crm/CompletePanel';

interface Agent { id: string; full_name: string | null }
const ICON: Record<string, any> = { call: Phone, meeting: Users, task: CheckSquare, deadline: Flag, email: Mail, lunch: Utensils, viewing: Home };
type Sec = 'overdue' | 'today' | 'upcoming';
const STEP = 15;

/**
 * Διαχείριση leads → Follow-ups: τι πρέπει να γίνει, σε τρεις ενότητες
 * (Καθυστερημένα · Σήμερα · Επόμενα), φίλτρο ανά συνεργάτη και ενέργειες με
 * ένα κλικ: κλήση, «Έγινε», αναβολή.
 */
export function FollowUpsView({ rows, agents, currentUserId }: { rows: FollowUpItem[]; agents: Agent[]; currentUserId: string }) {
  const [who, setWho] = useState<string>(rows.some((r) => r.ownerId === currentUserId) ? currentUserId : 'everyone');
  const [q, setQ] = useState('');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [moved, setMoved] = useState<Record<string, string>>({});
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [limit, setLimit] = useState<Record<Sec, number>>({ overdue: STEP, today: 50, upcoming: STEP });

  const now = new Date();
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).getTime();
  const secOf = (iso: string): Sec => { const t = Date.parse(iso); return t < now.getTime() ? 'overdue' : t < endToday ? 'today' : 'upcoming'; };

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => !done.has(r.id))
      .map((r) => (moved[r.id] ? { ...r, dueAt: moved[r.id] } : r))
      .filter((r) => who === 'everyone' || (who === 'none' ? !r.ownerId : r.ownerId === who))
      .filter((r) => !s || `${r.name} ${r.note ?? ''} ${r.phone ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  }, [rows, done, moved, who, q]);
  const by: Record<Sec, FollowUpItem[]> = { overdue: [], today: [], upcoming: [] };
  for (const r of list) by[secOf(r.dueAt)].push(r);

  const sections: { key: Sec; label: string; icon: any; empty: string; tone: string }[] = [
    { key: 'overdue', label: 'Καθυστερημένα', icon: AlertTriangle, empty: 'Τίποτα καθυστερημένο.', tone: 'text-signal-danger' },
    { key: 'today', label: 'Σήμερα', icon: Sun, empty: 'Τίποτα για σήμερα.', tone: 'text-forest' },
    { key: 'upcoming', label: 'Επόμενα', icon: CalendarClock, empty: 'Τίποτα προγραμματισμένο.', tone: 'text-charcoal' },
  ];
  const ownerOpts: [string, string][] = [[currentUserId, 'Τα δικά μου'], ['everyone', 'Όλοι'], ['none', 'Χωρίς υπεύθυνο'], ...agents.filter((a) => a.id !== currentUserId).map((a) => [a.id, a.full_name ?? '—'] as [string, string])];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-stone-100 p-0.5">
          {sections.map((s) => (
            <a key={s.key} href={`#fu-${s.key}`} className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-charcoal-600 hover:text-charcoal">
              <span>{s.label}</span><span className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${s.key === 'overdue' && by.overdue.length ? 'bg-signal-danger text-white' : 'bg-white text-charcoal-600'}`}>{by[s.key].length}</span>
            </a>
          ))}
        </div>
        <PopSelect searchable width="min-w-[160px]" ariaLabel="Συνεργάτης" value={who} onChange={setWho} options={ownerOpts} />
        <label className="relative w-full sm:ml-auto sm:w-[240px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Πελάτης, τηλέφωνο…" className="input h-8 py-1 pl-8 text-[13px]" />
        </label>
      </div>

      {sections.map((s) => {
        const items = by[s.key];
        const show = items.slice(0, limit[s.key]);
        return (
          <section key={s.key} id={`fu-${s.key}`} className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <header className="flex items-center gap-2 border-b border-stone-line px-4 py-3">
              <s.icon size={16} className={s.tone} />
              <h2 className={`text-[15px] font-semibold ${s.tone}`}>{s.label}</h2>
              <span className="rounded-full bg-stone-100 px-2 py-px text-[11px] font-semibold tabular-nums text-charcoal-600">{items.length}</span>
            </header>
            {items.length === 0 ? <p className="px-4 py-6 text-center text-sm text-charcoal-600/70">{s.empty}</p> : (
              <ul className="divide-y divide-stone-line">
                {show.map((r) => <Row key={r.id} r={r} sec={s.key} agents={agents} onOpen={() => r.leadId && setOpenLead(r.leadId)}
                  onDone={() => setDone((x) => new Set(x).add(r.id))} onMoved={(iso) => setMoved((m) => ({ ...m, [r.id]: iso }))} />)}
              </ul>
            )}
            {items.length > show.length && <button type="button" onClick={() => setLimit((l) => ({ ...l, [s.key]: l[s.key] + STEP }))} className="w-full border-t border-stone-line px-4 py-2.5 text-[13px] font-medium text-forest hover:bg-stone-50">Περισσότερα ({items.length - show.length})</button>}
          </section>
        );
      })}

      {openLead && <LeadDrawer leadId={openLead} agents={agents} onClose={() => setOpenLead(null)} />}
    </div>
  );
}

function Row({ r, sec, agents, onOpen, onDone, onMoved }: { r: FollowUpItem; sec: Sec; agents: Agent[]; onOpen: () => void; onDone: () => void; onMoved: (iso: string) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [snooze, setSnooze] = useState(false);
  const [more, setMore] = useState(false);
  const [custom, setCustom] = useState(toLocalInput(r.dueAt));
  const [err, setErr] = useState<string | null>(null);
  const I = ICON[r.type] ?? CheckSquare;
  const tel = (r.phone ?? '').replace(/[^\d+]/g, '');
  const tag = DATE_TAG[currentLocale().lang];
  const d = new Date(r.dueAt);
  const when = sec === 'today' ? d.toLocaleTimeString(tag, { hour: '2-digit', minute: '2-digit' }) : d.toLocaleString(tag, { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const markDone = () => start(async () => { const res = await completeAndNext(r.id); if (!res.ok) { setErr(res.error); return; } onDone(); router.refresh(); });
  const postpone = (iso: string) => start(async () => { const res = await updateFollowUp(r.id, { dueAt: iso }); if (!res.ok) { setErr(res.error); return; } setSnooze(false); onMoved(iso); router.refresh(); });

  return (
    <li className="group">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" disabled={pending} onClick={markDone} title="Έγινε" aria-label="Έγινε"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-stone-300 text-transparent transition hover:border-forest hover:bg-forest hover:text-white"><Check size={14} /></button>
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Άνοιγμα καρτέλας">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${sec === 'overdue' ? 'bg-rose-100 text-signal-danger' : 'bg-forest/10 text-forest'}`}><I size={14} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-charcoal" data-no-tr>{r.name}</span>
            <span className="block truncate text-xs text-charcoal-600/80">
              <span className={sec === 'overdue' ? 'font-medium text-signal-danger' : ''}>{when}</span>
              <span> · </span>{r.note ? <span data-no-tr>{r.note}</span> : <span>{activityLabel(r.type)}</span>}
              {r.leadStatus && <><span> · </span><span>{STATUS_EL[r.leadStatus] ?? r.leadStatus}</span></>}
              {r.ownerName && <><span> · </span><span data-no-tr>{r.ownerName}</span></>}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {tel && <a href={`tel:${tel}`} className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-forest px-2.5 text-[12px] font-medium text-white hover:bg-forest/90" title="Κλήση"><Phone size={13} /><span className="hidden sm:inline">Κλήση</span></a>}
          {tel && <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noreferrer" className="hidden h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-forest md:flex" title="WhatsApp" aria-label="WhatsApp"><MessageCircle size={15} /></a>}
          <div className="relative">
            <button type="button" onClick={() => setSnooze((v) => !v)} className={`flex h-8 w-8 items-center justify-center rounded-full ${snooze ? 'bg-forest text-white' : 'text-charcoal-600 hover:bg-stone-100 hover:text-charcoal'}`} title="Αναβολή" aria-label="Αναβολή"><AlarmClock size={15} /></button>
            {snooze && (
              <div className="anim-pop absolute right-0 top-full z-30 mt-1 w-56 space-y-1 rounded-xl border border-stone-line bg-white p-2 text-sm shadow-overlay">
                {([['in1h', 'Σε 1 ώρα'], ['tomorrow', 'Αύριο 09:30'], ['in3d', 'Σε 3 μέρες'], ['nextweek', 'Επόμενη Δευτέρα']] as const).map(([k, l]) => (
                  <button key={k} type="button" disabled={pending} onClick={() => postpone(snoozeTo(k))} className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-stone">{l}</button>
                ))}
                <div className="flex gap-1 border-t border-stone-line pt-1.5">
                  <input type="datetime-local" className="input py-1 text-xs" value={custom} onChange={(e) => setCustom(e.target.value)} aria-label="Νέα ημερομηνία" />
                  <button type="button" disabled={pending || !custom} onClick={() => postpone(new Date(custom).toISOString())} className="btn-secondary px-2 text-xs">OK</button>
                </div>
              </div>
            )}
          </div>
          <button type="button" onClick={() => setMore((v) => !v)} className={`hidden h-8 w-8 items-center justify-center rounded-full sm:flex ${more ? 'bg-forest text-white' : 'text-charcoal-600 hover:bg-stone-100 hover:text-charcoal'}`} title="Έγινε + αποτέλεσμα και επόμενη κίνηση" aria-label="Έγινε + αποτέλεσμα και επόμενη κίνηση"><ListPlus size={15} /></button>
        </div>
      </div>
      {err && <p className="px-4 pb-2 text-xs text-signal-danger">{err}</p>}
      {more && <CompletePanel r={r} agents={agents} onCancel={() => setMore(false)} onDone={() => { setMore(false); onDone(); }} />}
    </li>
  );
}
