'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, List, Columns3, Phone, MessageCircle, AlertTriangle, X, Users, ArrowUpDown } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { reassignLead, updateLeadStatus } from '@/app/actions/leads';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { closedBucket, daysSince, lateBy, pipelineOf, stageIndex, type PipelineSettings } from '@/lib/pipeline-shared';
import { formatCurrency, formatDate } from '@/lib/format';

interface Agent { id: string; full_name: string | null }
type Outcome = 'open' | 'closed' | 'won' | 'all';
type Sort = 'new' | 'old' | 'action' | 'late' | 'name' | 'budget';

const SORTS: [Sort, string][] = [['new', 'Νεότερα'], ['old', 'Παλαιότερα'], ['action', 'Επόμενη ενέργεια'], ['late', 'Καθυστέρηση'], ['name', 'Όνομα'], ['budget', 'Budget']];

/** Τιμή του «Στάδιο» select: στάδιο, αποτέλεσμα κλεισίματος ή Won. */
const enc = { stage: (k: string) => `s:${k}`, out: (k: string) => `o:${k}`, won: 'won' };

function money(min: number | null, max: number | null) {
  if (!min && !max) return '';
  if (min && max) return `${formatCurrency(min)}–${formatCurrency(max)}`;
  return min ? `${formatCurrency(min)}+` : `έως ${formatCurrency(max!)}`;
}

/**
 * Lead Management: όλα τα leads σε ένα σημείο — λίστα ή στήλες ανά στάδιο,
 * αναζήτηση και φίλτρα, αλλαγή σταδίου/υπευθύνου από τη γραμμή, μαζικές
 * αλλαγές, και άνοιγμα της καρτέλας στη μισή οθόνη.
 */
export function LeadManager({ leads, agents, currentUserId, pipelines }: { leads: LeadListItem[]; agents: Agent[]; currentUserId: string; pipelines: PipelineSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<'list' | 'columns'>('list');
  const [pipeKey, setPipeKey] = useState(pipelines.defaultKey);
  const [q, setQ] = useState('');
  const [owner, setOwner] = useState<string>(leads.some((l) => l.owner_id === currentUserId) ? 'mine' : 'all');
  const [outcome, setOutcome] = useState<Outcome>('open');
  const [stageF, setStageF] = useState<string>('');
  const [source, setSource] = useState('');
  const [onlyLate, setOnlyLate] = useState(false);
  const [sort, setSort] = useState<Sort>('new');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [over, setOver] = useState<Record<string, Partial<LeadListItem>>>({}); // αλλαγές πριν το refresh
  const [msg, setMsg] = useState<string | null>(null);

  const pipe = pipelineOf(pipelines, pipeKey);
  const working = pipe.stages.filter((s) => s.status !== 'won');
  const wonStage = pipe.stages.find((s) => s.status === 'won');
  const now = Date.now();

  const rows = useMemo(() => leads.map((l) => ({ ...l, ...over[l.id] })), [leads, over]);
  const inPipe = useMemo(() => rows.filter((l) => pipelineOf(pipelines, l.pipeline ?? null).key === pipe.key), [rows, pipelines, pipe.key]);
  const sources = useMemo(() => [...new Set(inPipe.map((l) => l.source).filter(Boolean))].sort(), [inPipe]);

  const stageKeyOf = (l: LeadListItem) => { const i = stageIndex(pipe, l.status, l.stage ?? null); return i >= 0 ? pipe.stages[i].key : null; };
  const lateOf = (l: LeadListItem) => lateBy(pipe, l.status, l.stage_entered_at ?? null, now, l.stage ?? null);
  const valueOf = (l: LeadListItem): string => {
    if (l.status === 'won') return enc.won;
    const c = closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null);
    if (c) return c.key.startsWith('closed:') && pipelines.lostReasons.some((r) => `closed:${r.key}` === c.key) ? enc.out(c.key.slice(7)) : `x:${l.status}`;
    const k = stageKeyOf(l); return k ? enc.stage(k) : `x:${l.status}`;
  };

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = inPipe.filter((l) => {
      const closed = !!closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null);
      if (outcome === 'open' && (closed || l.status === 'won')) return false;
      if (outcome === 'closed' && !closed) return false;
      if (outcome === 'won' && l.status !== 'won') return false;
      if (owner === 'mine' && l.owner_id !== currentUserId) return false;
      if (owner === 'none' && l.owner_id) return false;
      if (owner !== 'all' && owner !== 'mine' && owner !== 'none' && l.owner_id !== owner) return false;
      if (stageF && valueOf(l) !== stageF) return false;
      if (source && l.source !== source) return false;
      if (onlyLate && !((lateOf(l) ?? 0) > 0)) return false;
      if (s && !`${l.full_name ?? ''} ${l.email ?? ''} ${l.phone ?? ''}`.toLowerCase().includes(s)) return false;
      return true;
    });
    const by: Record<Sort, (a: LeadListItem, b: LeadListItem) => number> = {
      new: (a, b) => b.created_at.localeCompare(a.created_at),
      old: (a, b) => a.created_at.localeCompare(b.created_at),
      action: (a, b) => (a.next_action_date ?? a.next_follow_up ?? '9999').localeCompare(b.next_action_date ?? b.next_follow_up ?? '9999'),
      late: (a, b) => (lateOf(b) ?? -1) - (lateOf(a) ?? -1),
      name: (a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el'),
      budget: (a, b) => (b.budget_max ?? b.budget_min ?? 0) - (a.budget_max ?? a.budget_min ?? 0),
    };
    return list.sort(by[sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPipe, q, owner, outcome, stageF, source, onlyLate, sort, currentUserId, pipelines.lostReasons]);

  const lateCount = inPipe.filter((l) => (lateOf(l) ?? 0) > 0 && !closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null)).length;

  /** Αλλαγή σταδίου/αποτελέσματος από το select (μία ή πολλές γραμμές). */
  const move = (ids: string[], v: string) => start(async () => {
    if (!v) return;
    let status = ''; let stage: string | null = null; let reason: string | undefined; let key: string | undefined;
    if (v === enc.won) { status = 'won'; stage = wonStage?.key ?? null; }
    else if (v.startsWith('s:')) { const st = pipe.stages.find((x) => x.key === v.slice(2)); if (!st) return; status = st.status; stage = st.key; }
    else if (v.startsWith('o:')) { const r = pipelines.lostReasons.find((x) => x.key === v.slice(2)); if (!r) return; status = r.status; reason = r.label; key = r.key; }
    else return;
    setOver((o) => { const n = { ...o }; for (const id of ids) n[id] = { ...n[id], status, stage, lost_reason: key ?? null, stage_entered_at: new Date().toISOString() }; return n; });
    const res = await Promise.all(ids.map((id) => updateLeadStatus(id, status, reason, key, stage).then(() => true, () => false)));
    const bad = res.filter((x) => !x).length;
    setMsg(bad ? `${bad} δεν άλλαξαν — δοκιμάστε ξανά.` : ids.length > 1 ? `Άλλαξαν ${ids.length} leads.` : null);
    setSel(new Set()); router.refresh();
  });
  const assign = (ids: string[], agentId: string) => start(async () => {
    if (!agentId) return;
    const name = agents.find((a) => a.id === agentId)?.full_name ?? null;
    setOver((o) => { const n = { ...o }; for (const id of ids) n[id] = { ...n[id], owner_id: agentId, owner_name: name }; return n; });
    await Promise.all(ids.map((id) => reassignLead(id, agentId).catch(() => null)));
    setMsg(ids.length > 1 ? `Ανατέθηκαν ${ids.length} leads.` : null);
    setSel(new Set()); router.refresh();
  });

  const StageSelect = ({ ids, value, compact }: { ids: string[]; value?: string; compact?: boolean }) => (
    <select className={`input py-1 text-xs ${compact ? 'w-full' : 'w-44'}`} disabled={pending} value={value ?? ''} aria-label="Στάδιο"
      onClick={(e) => e.stopPropagation()} onChange={(e) => move(ids, e.target.value)}>
      {!value && <option value="">Μετακίνηση σε…</option>}
      {value?.startsWith('x:') && <option value={value}>—</option>}
      <optgroup label="Στάδια">{working.map((s) => <option key={s.key} value={enc.stage(s.key)}>{s.label}</option>)}</optgroup>
      <optgroup label="Κλείσιμο">
        <option value={enc.won}>✓ {wonStage?.label ?? 'Won'}</option>
        {pipelines.lostReasons.map((r) => <option key={r.key} value={enc.out(r.key)}>✕ {r.label}</option>)}
      </optgroup>
    </select>
  );
  const OwnerSelect = ({ ids, value }: { ids: string[]; value?: string | null }) => (
    <select className="input w-36 py-1 text-xs" disabled={pending} value={value ?? ''} aria-label="Υπεύθυνος" onClick={(e) => e.stopPropagation()} onChange={(e) => assign(ids, e.target.value)}>
      <option value="">{value === undefined ? 'Ανάθεση σε…' : 'Χωρίς υπεύθυνο'}</option>
      {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? '—'}</option>)}
    </select>
  );

  const allSel = filtered.length > 0 && filtered.every((l) => sel.has(l.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-xs ${on ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal-600 hover:border-forest/40'}`;
  const counts = {
    open: inPipe.filter((l) => l.status !== 'won' && !closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null)).length,
    closed: inPipe.filter((l) => !!closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null)).length,
    won: inPipe.filter((l) => l.status === 'won').length,
  };

  return (
    <div className="space-y-4">
      {pipelines.pipelines.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {pipelines.pipelines.map((p) => <button key={p.key} type="button" onClick={() => { setPipeKey(p.key); setStageF(''); }} className={chip(p.key === pipe.key)}>{p.name}</button>)}
        </div>
      )}

      {/* Φίλτρα */}
      <div className="panel space-y-3 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] flex-1">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
            <input className="input py-1.5 pl-8 text-sm" placeholder="Αναζήτηση: όνομα, τηλέφωνο, email…" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="flex rounded-lg border border-stone-line bg-white p-0.5">
            <button type="button" onClick={() => setView('list')} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${view === 'list' ? 'bg-forest text-white' : 'text-charcoal-600'}`}><List size={13} /> Λίστα</button>
            <button type="button" onClick={() => setView('columns')} className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs ${view === 'columns' ? 'bg-forest text-white' : 'text-charcoal-600'}`}><Columns3 size={13} /> Στήλες</button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {([['open', `Ανοιχτά ${counts.open}`], ['closed', `Lost / κλεισμένα ${counts.closed}`], ['won', `Won ${counts.won}`], ['all', 'Όλα']] as [Outcome, string][]).map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setOutcome(k); setStageF(''); }} className={chip(outcome === k)}>{l}</button>
          ))}
          {lateCount > 0 && <button type="button" onClick={() => setOnlyLate((x) => !x)} className={`${chip(onlyLate)} ${onlyLate ? '' : 'border-signal-danger/30 text-signal-danger'}`}><AlertTriangle size={11} className="mr-1 inline" />Καθυστερούν {lateCount}</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select className="input w-auto py-1 text-xs" value={owner} onChange={(e) => setOwner(e.target.value)} aria-label="Υπεύθυνος">
            <option value="mine">Τα δικά μου</option><option value="all">Όλοι οι υπεύθυνοι</option><option value="none">Χωρίς υπεύθυνο</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? '—'}</option>)}
          </select>
          <select className="input w-auto py-1 text-xs" value={stageF} onChange={(e) => setStageF(e.target.value)} aria-label="Στάδιο">
            <option value="">Όλα τα στάδια</option>
            {working.map((s) => <option key={s.key} value={enc.stage(s.key)}>{s.label}</option>)}
            {pipelines.lostReasons.map((r) => <option key={r.key} value={enc.out(r.key)}>✕ {r.label}</option>)}
          </select>
          {sources.length > 1 && (
            <select className="input w-auto py-1 text-xs" value={source} onChange={(e) => setSource(e.target.value)} aria-label="Πηγή">
              <option value="">Όλες οι πηγές</option>{sources.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
          <label className="ml-auto flex items-center gap-1 text-xs text-charcoal-600"><ArrowUpDown size={12} />
            <select className="input w-auto py-1 text-xs" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Ταξινόμηση">
              {SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </label>
        </div>
      </div>

      {/* Μαζικές αλλαγές */}
      {sel.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-forest/30 bg-forest/[0.06] px-3 py-2 text-sm shadow-sm">
          <span className="font-medium text-forest">{sel.size} επιλεγμένα</span>
          <div><StageSelect ids={[...sel]} /></div>
          <div><OwnerSelect ids={[...sel]} value={undefined} /></div>
          <button type="button" onClick={() => setSel(new Set())} className="btn-ghost ml-auto p-1" aria-label="Καθαρισμός επιλογής"><X size={14} /></button>
        </div>
      )}
      {msg && <p className="text-xs text-forest">{msg}</p>}

      {filtered.length === 0 ? (
        <div className="panel p-10 text-center text-sm text-charcoal-600/70">Κανένα lead με αυτά τα φίλτρα.</div>
      ) : view === 'list' ? (
        <div className="panel overflow-hidden">
          <div className="hidden items-center gap-3 border-b border-stone-line bg-stone/40 px-3 py-2 text-[11px] uppercase tracking-wide text-charcoal-600/70 lg:flex">
            <input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(filtered.map((l) => l.id)))} aria-label="Επιλογή όλων" />
            <span className="flex-1">Πελάτης</span><span className="w-44">Στάδιο</span><span className="w-36">Υπεύθυνος</span><span className="w-28">Επόμενη ενέργεια</span><span className="w-16" />
          </div>
          <ul className="divide-y divide-stone-line">
            {filtered.map((l) => {
              const late = lateOf(l); const days = daysSince(l.stage_entered_at ?? null, now);
              const next = l.next_action_date ?? l.next_follow_up?.slice(0, 10) ?? null;
              const overdue = !!next && next < new Date().toISOString().slice(0, 10);
              const tel = (l.phone ?? '').replace(/[^\d+]/g, '');
              return (
                <li key={l.id} onClick={() => setOpenId(l.id)} className={`flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 hover:bg-stone/40 ${sel.has(l.id) ? 'bg-forest/[0.04]' : ''}`}>
                  <input type="checkbox" checked={sel.has(l.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(l.id)} aria-label="Επιλογή" />
                  <div className="min-w-[12rem] flex-1">
                    <p className="truncate text-sm font-medium text-charcoal">{l.full_name ?? l.email ?? 'Χωρίς όνομα'}{l.is_returning && <span className="ml-1.5 text-[10px] font-normal text-champagne-600">επιστρέφων</span>}</p>
                    <p className="truncate text-xs text-charcoal-600/70">
                      {[l.phone, l.source, money(l.budget_min, l.budget_max), `από ${formatDate(l.created_at)}`].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                    <StageSelect ids={[l.id]} value={valueOf(l)} />
                    {days !== null && !closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null) && l.status !== 'won' && (
                      <span className={`text-[10px] ${late ? 'text-signal-danger' : 'text-charcoal-600/60'}`}>{late ? `καθυστέρηση ${late} μ.` : `${days} μ. στο στάδιο`}</span>
                    )}
                  </div>
                  <div onClick={(e) => e.stopPropagation()}><OwnerSelect ids={[l.id]} value={l.owner_id} /></div>
                  <span className={`w-28 text-xs ${overdue ? 'text-signal-danger' : 'text-charcoal-600/80'}`}>{next ? formatDate(next) : '—'}</span>
                  <span className="flex w-16 justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
                    {tel && <a href={`tel:${tel}`} className="btn-ghost p-1.5" title="Κλήση"><Phone size={13} /></a>}
                    {tel && <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noreferrer" className="btn-ghost p-1.5" title="WhatsApp"><MessageCircle size={13} /></a>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <Columns pipe={pipe} leads={filtered} outcome={outcome} lostReasons={pipelines.lostReasons} valueOf={valueOf} lateOf={lateOf} onOpen={setOpenId} onMove={(id, v) => move([id], v)} />
      )}

      <p className="flex items-center gap-1 text-xs text-charcoal-600/60"><Users size={12} /> {filtered.length} από {inPipe.length} leads · κλικ σε ένα lead για να ανοίξει η καρτέλα του δίπλα.</p>
      {openId && <LeadDrawer leadId={openId} agents={agents} onClose={() => { setOpenId(null); router.refresh(); }} />}
    </div>
  );
}

/** Στήλες ανά στάδιο· σύρετε μια κάρτα σε άλλη στήλη για να αλλάξει στάδιο. */
function Columns({ pipe, leads, outcome, lostReasons, valueOf, lateOf, onOpen, onMove }: {
  pipe: ReturnType<typeof pipelineOf>; leads: LeadListItem[]; outcome: Outcome; lostReasons: PipelineSettings['lostReasons'];
  valueOf: (l: LeadListItem) => string; lateOf: (l: LeadListItem) => number | null; onOpen: (id: string) => void; onMove: (id: string, v: string) => void;
}) {
  const [drag, setDrag] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const cols: { v: string; label: string; tone?: string }[] = [
    ...(outcome === 'closed' || outcome === 'won' ? [] : pipe.stages.filter((s) => s.status !== 'won').map((s) => ({ v: `s:${s.key}`, label: s.label }))),
    ...(outcome === 'open' ? [] : [{ v: 'won', label: pipe.stages.find((s) => s.status === 'won')?.label ?? 'Won', tone: 'text-forest' }]),
    ...(outcome === 'open' || outcome === 'won' ? [] : lostReasons.map((r) => ({ v: `o:${r.key}`, label: r.label, tone: 'text-signal-danger' }))),
  ];
  return (
    <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-3">
      {cols.map((c) => {
        const list = leads.filter((l) => valueOf(l) === c.v);
        return (
          <div key={c.v} onDragOver={(e) => { e.preventDefault(); setHover(c.v); }} onDragLeave={() => setHover((h) => (h === c.v ? null : h))}
            onDrop={(e) => { e.preventDefault(); setHover(null); if (drag) onMove(drag, c.v); setDrag(null); }}
            className={`flex w-64 shrink-0 flex-col rounded-xl border bg-stone/40 ${hover === c.v ? 'border-forest bg-forest/[0.05]' : 'border-stone-line'}`}>
            <div className="flex items-center justify-between px-3 py-2">
              <span className={`truncate text-sm font-medium ${c.tone ?? 'text-charcoal'}`}>{c.label}</span>
              <span className="text-xs text-charcoal-600/60">{list.length}</span>
            </div>
            <div className="min-h-[4rem] flex-1 space-y-2 px-2 pb-2">
              {list.map((l) => {
                const late = lateOf(l);
                return (
                  <div key={l.id} draggable onDragStart={() => setDrag(l.id)} onDragEnd={() => setDrag(null)} onClick={() => onOpen(l.id)}
                    className={`cursor-pointer rounded-lg border bg-white p-2.5 shadow-sm hover:shadow-overlay ${drag === l.id ? 'opacity-50' : ''} ${late ? 'border-signal-danger/40' : 'border-stone-line'}`}>
                    <p className="truncate text-sm font-medium text-charcoal">{l.full_name ?? l.email ?? 'Χωρίς όνομα'}</p>
                    <p className="truncate text-[11px] text-charcoal-600/70">{[l.owner_name, money(l.budget_min, l.budget_max)].filter(Boolean).join(' · ') || l.source}</p>
                    {late ? <p className="mt-1 text-[10px] text-signal-danger">καθυστέρηση {late} μ.</p> : null}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
