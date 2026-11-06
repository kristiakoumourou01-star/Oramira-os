'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Phone, MessageCircle, Mail, PanelRightOpen, Search, AlarmClock, CalendarPlus } from 'lucide-react';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { updateFollowUp } from '@/app/actions/follow-ups';
import { CompletePanel } from '@/components/crm/CompletePanel';
import { BUCKETS, bucketOf, kindOf, snoozeTo, toLocalInput, type FollowUpRow } from '@/lib/follow-ups-shared';
import { STATUS_EL } from '@/lib/pipeline-shared';
import { formatDayMonthTime, formatTime } from '@/lib/format';

interface Agent { id: string; full_name: string | null }

const KIND_ICON = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: CalendarPlus, viewing: CalendarPlus, other: Clock } as const;

/**
 * Follow-ups ως «λίστα εργασιών»: ομάδες κατά προθεσμία, φίλτρα, και για κάθε
 * κίνηση γρήγορα κουμπιά (έγινε + επόμενη κίνηση, αναβολή, κλήση). Κλικ στη
 * γραμμή → ανοίγει η καρτέλα του πελάτη στο μισό της οθόνης.
 */
export function FollowUpsBoard({ rows, agents, currentUserId }: { rows: FollowUpRow[]; agents: Agent[]; currentUserId: string }) {
  const [who, setWho] = useState<string>('mine');
  const [q, setQ] = useState('');
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const mineCount = rows.filter((r) => r.ownerId === currentUserId).length;
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return rows.filter((r) => !doneIds.has(r.id)
      && (who === 'all' || (who === 'mine' ? r.ownerId === currentUserId : who === 'none' ? !r.ownerId : r.ownerId === who))
      && (!s || `${r.name} ${r.note} ${r.phone ?? ''} ${r.email ?? ''}`.toLowerCase().includes(s)));
  }, [rows, who, q, currentUserId, doneIds]);
  const groups = useMemo(() => {
    const g = new globalThis.Map<string, FollowUpRow[]>();
    for (const r of filtered) { const k = bucketOf(r.dueAt); g.set(k, [...(g.get(k) ?? []), r]); }
    return g;
  }, [filtered]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-stone-line bg-white p-0.5 text-sm">
          {[['mine', `Τα δικά μου (${mineCount})`], ['all', `Όλα (${rows.length})`]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setWho(k)} className={`rounded-md px-3 py-1 ${who === k ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>{l}</button>
          ))}
        </div>
        <select className="input w-auto py-1.5 text-sm" value={who === 'mine' || who === 'all' ? '' : who} onChange={(e) => setWho(e.target.value || 'all')} aria-label="Υπεύθυνος">
          <option value="">Ανά συνεργάτη…</option>
          <option value="none">Χωρίς υπεύθυνο</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? '—'}</option>)}
        </select>
        <label className="relative ml-auto">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input className="input w-56 py-1.5 pl-8 text-sm" placeholder="Αναζήτηση πελάτη…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      {filtered.length === 0 && <div className="panel p-8 text-center text-sm text-charcoal-600/70">Καμία ανοιχτή κίνηση εδώ. 🎉</div>}

      {BUCKETS.map((b) => {
        const list = groups.get(b.key) ?? [];
        if (!list.length) return null;
        return (
          <section key={b.key} className="panel overflow-hidden">
            <header className={`flex items-center justify-between border-b border-stone-line px-4 py-2.5 ${'danger' in b ? 'bg-signal-danger/5' : 'bg-stone/40'}`}>
              <h3 className={`text-sm font-medium ${'danger' in b ? 'text-signal-danger' : 'text-charcoal'}`}>{b.label}</h3>
              <span className="text-xs text-charcoal-600/70">{list.length}</span>
            </header>
            <ul className="divide-y divide-stone-line">
              {list.map((r) => (
                <Row key={r.id} r={r} overdue={b.key === 'overdue'} showDay={b.key !== 'today' && b.key !== 'overdue'} active={activeId === r.id}
                  onActivate={() => setActiveId(activeId === r.id ? null : r.id)} onOpen={() => r.leadId && setOpenLead(r.leadId)}
                  onDone={() => { setDoneIds((s) => new Set(s).add(r.id)); setActiveId(null); }} agents={agents} />
              ))}
            </ul>
          </section>
        );
      })}

      {openLead && <LeadDrawer leadId={openLead} agents={agents} onClose={() => setOpenLead(null)} />}
    </div>
  );
}

function Row({ r, overdue, showDay, active, onActivate, onOpen, onDone, agents }: {
  r: FollowUpRow; overdue: boolean; showDay: boolean; active: boolean; agents: Agent[];
  onActivate: () => void; onOpen: () => void; onDone: () => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [snooze, setSnooze] = useState(false);
  const [custom, setCustom] = useState(toLocalInput(r.dueAt));
  const tel = (r.phone ?? '').replace(/[^\d+]/g, '');
  const Icon = KIND_ICON[kindOf(r.note)];

  const postpone = (iso: string) => start(async () => {
    const res = await updateFollowUp(r.id, { dueAt: iso });
    if (!res.ok) { setErr(res.error); return; }
    setSnooze(false); router.refresh();
  });

  return (
    <li className={`group ${active ? 'bg-forest/5' : 'hover:bg-stone/40'}`}>
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button type="button" disabled={pending} onClick={onActivate} title="Έγινε"
          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border transition ${active ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-transparent hover:border-forest hover:text-forest'}`}>
          <Check size={13} />
        </button>
        <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Άνοιγμα καρτέλας">
          <Icon size={15} strokeWidth={1.75} className={overdue ? 'text-signal-danger' : 'text-olive'} />
          <span className="min-w-0 flex-1">
            <span className="block text-sm text-charcoal"><span className="font-medium">{r.name}</span> <span className="text-charcoal-600">· {r.note}</span></span>
            <span className="block truncate text-xs text-charcoal-600/70">
              <span className={overdue ? 'text-signal-danger' : ''}>{showDay || overdue ? formatDayMonthTime(r.dueAt) : formatTime(r.dueAt)}</span>
              {r.leadStatus ? ` · ${STATUS_EL[r.leadStatus] ?? r.leadStatus}` : ''}{r.budget ? ` · ${r.budget}` : ''}{r.ownerName ? ` · ${r.ownerName}` : ''}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5">
          {tel && <a href={`tel:${tel}`} className="btn-ghost p-1.5" title="Κλήση"><Phone size={14} /></a>}
          {tel && <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noreferrer" className="btn-ghost hidden p-1.5 md:inline-flex" title="WhatsApp"><MessageCircle size={14} /></a>}
          {r.email && <a href={`mailto:${r.email}`} className="btn-ghost hidden p-1.5 md:inline-flex" title="Email"><Mail size={14} /></a>}
          <div className="relative">
            <button type="button" onClick={() => setSnooze((v) => !v)} className="btn-ghost p-1.5" title="Αναβολή"><AlarmClock size={14} /></button>
            {snooze && (
              <div className="absolute right-0 top-full z-20 mt-1 w-56 space-y-1 rounded-xl border border-stone-line bg-white p-2 text-sm shadow-overlay">
                {([['in1h', 'Σε 1 ώρα'], ['tomorrow', 'Αύριο 09:30'], ['in3d', 'Σε 3 μέρες'], ['nextweek', 'Επόμενη Δευτέρα']] as const).map(([k, l]) => (
                  <button key={k} type="button" disabled={pending} onClick={() => postpone(snoozeTo(k))} className="block w-full rounded-md px-2 py-1 text-left hover:bg-stone">{l}</button>
                ))}
                <div className="flex gap-1 border-t border-stone-line pt-1.5">
                  <input type="datetime-local" className="input py-1 text-xs" value={custom} onChange={(e) => setCustom(e.target.value)} />
                  <button type="button" disabled={pending || !custom} onClick={() => postpone(new Date(custom).toISOString())} className="btn-secondary px-2 text-xs">OK</button>
                </div>
              </div>
            )}
          </div>
          {r.leadId && <button type="button" onClick={onOpen} className="btn-ghost p-1.5" title="Καρτέλα πελάτη (μισή σελίδα)"><PanelRightOpen size={14} /></button>}
        </div>
      </div>
      {err && <p className="px-4 pb-2 text-xs text-signal-danger">{err}</p>}
      {active && <CompletePanel r={r} onCancel={onActivate} onDone={onDone} agents={agents} />}
    </li>
  );
}
