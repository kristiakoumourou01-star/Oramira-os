'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, List, Columns3, Phone, MessageCircle, AlertTriangle, X, Trash2 } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { reassignLead, updateLeadStatus } from '@/app/actions/leads';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { DeleteLeadDialog } from '@/components/crm/DeleteLeadDialog';
import { closedBucket, daysSince, lateBy, pipelineOf, stageIndex, type PipelineSettings } from '@/lib/pipeline-shared';
import { formatCurrency, formatDate } from '@/lib/format';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';

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
export function LeadManager({ leads, agents, currentUserId, pipelines, fixedPipe }: { leads: LeadListItem[]; agents: Agent[]; currentUserId: string; pipelines: PipelineSettings; fixedPipe?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [view, setView] = useState<'list' | 'columns'>('list');
  const [pipeKeyState, setPipeKey] = useState(pipelines.defaultKey);
  const pipeKey = fixedPipe ?? pipeKeyState;
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
  const [askDelete, setAskDelete] = useState(false);
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);
  const [gone, setGone] = useState<Set<string>>(new Set());

  const pipe = pipelineOf(pipelines, pipeKey);
  const working = pipe.stages.filter((s) => s.status !== 'won');
  const wonStage = pipe.stages.find((s) => s.status === 'won');
  const now = Date.now();

  const rows = useMemo(() => leads.filter((l) => !gone.has(l.id)).map((l) => ({ ...l, ...over[l.id] })), [leads, over, gone]);
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

  const stageOpts = (value?: string): [string, string][] => [
    ...(!value ? [['', 'Μετακίνηση σε…'] as [string, string]] : []),
    ...(value?.startsWith('x:') ? [[value, '—'] as [string, string]] : []),
    ...working.map((st) => [enc.stage(st.key), st.label] as [string, string]),
    [enc.won, `✓ ${wonStage?.label ?? 'Won'}`],
    ...pipelines.lostReasons.map((r) => [enc.out(r.key), `✕ ${r.label}`] as [string, string]),
  ];
  const StageSelect = ({ ids, value, compact }: { ids: string[]; value?: string; compact?: boolean }) => (
    <PopSelect ariaLabel="Στάδιο" width={compact ? 'w-full' : 'min-w-[150px]'} value={value ?? ''} onChange={(v) => move(ids, v)} options={stageOpts(value)} />
  );
  const OwnerSelect = ({ ids, value }: { ids: string[]; value?: string | null }) => (
    <PopSelect searchable ariaLabel="Υπεύθυνος" width="min-w-[140px]" value={value ?? ''} onChange={(v) => assign(ids, v)}
      options={[['', value === undefined ? 'Ανάθεση σε…' : 'Χωρίς υπεύθυνο'], ...agents.map((a) => [a.id, a.full_name ?? '—'] as [string, string])]} />
  );

  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = filtered.slice(pg * per, pg * per + per);
  const allSel = page.length > 0 && page.every((l) => sel.has(l.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const chip = (on: boolean) => `inline-flex h-8 items-center rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-forest/40 bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal hover:border-forest/30'}`;
  const counts = {
    open: inPipe.filter((l) => l.status !== 'won' && !closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null)).length,
    closed: inPipe.filter((l) => !!closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null)).length,
    won: inPipe.filter((l) => l.status === 'won').length,
  };

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 flex-col rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal-600">
            {view === 'list' && <><span>Εμφάνιση</span>
              <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
              <span>εγγραφές</span></>}
            <span className="ml-auto flex rounded-lg bg-stone-100 p-0.5">
              {([['list', List, 'Λίστα'], ['columns', Columns3, 'Στήλες']] as const).map(([v, I, l]) => (
                <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors ${view === v ? 'bg-white font-medium text-charcoal shadow-sm' : 'text-charcoal-600 hover:text-charcoal'}`}><I size={14} /> {l}</button>
              ))}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {([['open', `Ανοιχτά ${counts.open}`], ['closed', `Lost ${counts.closed}`], ['won', `Won ${counts.won}`], ['all', 'Όλα']] as [Outcome, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => { setOutcome(k); setStageF(''); setPageNo(0); }} className={chip(outcome === k)}>{l}</button>
            ))}
            {lateCount > 0 && <button type="button" onClick={() => { setOnlyLate((x) => !x); setPageNo(0); }} className={chip(onlyLate)}><AlertTriangle size={12} className="mr-1" />Καθυστερούν {lateCount}</button>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!fixedPipe && pipelines.pipelines.length > 1 && <PopSelect ariaLabel="Pipeline" width="min-w-[140px]" value={pipe.key} onChange={(v) => { setPipeKey(v); setStageF(''); setPageNo(0); }} options={pipelines.pipelines.map((p) => [p.key, p.name] as [string, string])} />}
            <PopSelect searchable ariaLabel="Υπεύθυνος" width="min-w-[150px]" value={owner} onChange={(v) => { setOwner(v); setPageNo(0); }} options={[['mine', 'Τα δικά μου'], ['all', 'Όλοι οι υπεύθυνοι'], ['none', 'Χωρίς υπεύθυνο'], ...agents.map((a) => [a.id, a.full_name ?? '—'] as [string, string])]} />
            <PopSelect ariaLabel="Στάδιο" width="min-w-[140px]" value={stageF} onChange={(v) => { setStageF(v); setPageNo(0); }} options={[['', 'Όλα τα στάδια'], ...working.map((st) => [enc.stage(st.key), st.label] as [string, string]), ...pipelines.lostReasons.map((r) => [enc.out(r.key), `✕ ${r.label}`] as [string, string])]} />
            {sources.length > 1 && <PopSelect ariaLabel="Πηγή" width="min-w-[130px]" value={source} onChange={(v) => { setSource(v); setPageNo(0); }} options={[['', 'Όλες οι πηγές'], ...sources.map((x) => [String(x), String(x)] as [string, string])]} />}
            <PopSelect ariaLabel="Ταξινόμηση" width="min-w-[150px]" value={sort} onChange={(v) => setSort(v as Sort)} options={SORTS} />
            <label className="relative w-full sm:ml-auto sm:w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
              <input className="input h-8 py-1 pl-8 text-[13px]" placeholder="Όνομα, τηλέφωνο, email…" value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} />
            </label>
          </div>
          {sel.size > 0 && (
            <div className="anim-pop flex flex-wrap items-center gap-2 rounded-xl border border-forest/30 bg-forest/[0.05] px-3 py-2 text-[13px]">
              <span className="font-semibold text-forest">{sel.size} επιλεγμένα</span>
              <StageSelect ids={[...sel]} />
              <OwnerSelect ids={[...sel]} value={undefined} />
              <button type="button" onClick={() => setAskDelete(true)} className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-signal-danger/30 bg-white px-2.5 text-[12px] text-signal-danger hover:bg-rose-50"><Trash2 size={13} /> Διαγραφή</button>
              <button type="button" onClick={() => setSel(new Set())} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-white" aria-label="Καθαρισμός επιλογής"><X size={14} /></button>
            </div>
          )}
          {msg && <p className="text-[13px] text-forest">{msg}</p>}
        </div>

      {view === 'list' ? (
        <>
          <div className="overflow-x-auto border-t border-stone-line">
            <table className="o-table">
              <thead><tr>
                <th className="w-8"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(page.map((l) => l.id)))} aria-label="Επιλογή όλων" /></th>
                <th>Πελάτης</th><th>Τηλέφωνο</th><th>Πηγή</th><th>Budget</th><th>Στάδιο</th><th>Υπεύθυνος</th><th>Επόμενη ενέργεια</th><th className="text-right">Ενέργειες</th>
              </tr></thead>
              <tbody>
                {page.map((l) => {
                  const late = lateOf(l); const days = daysSince(l.stage_entered_at ?? null, now);
                  const next = l.next_action_date ?? l.next_follow_up?.slice(0, 10) ?? null;
                  const overdue = !!next && next < new Date().toISOString().slice(0, 10);
                  const tel = (l.phone ?? '').replace(/[^\d+]/g, '');
                  const closed = !!closedBucket(pipelines.lostReasons, l.status, l.lost_reason ?? null) || l.status === 'won';
                  return (
                    <tr key={l.id} onClick={() => setOpenId(l.id)} className={`cursor-pointer ${sel.has(l.id) ? 'bg-forest/[0.05]' : ''}`}>
                      <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} aria-label="Επιλογή" /></td>
                      <td className="o-strong" data-no-tr><span className="block max-w-[190px] truncate" title={l.full_name ?? l.email ?? ''}>{l.full_name ?? l.email ?? 'Χωρίς όνομα'}</span>{l.is_returning && <span className="text-[11px] font-normal text-forest">επιστρέφων</span>}</td>
                      <td data-no-tr>{l.phone || '—'}</td>
                      <td>{l.source || '—'}</td>
                      <td>{money(l.budget_min, l.budget_max) || '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <StageSelect ids={[l.id]} value={valueOf(l)} />
                        {days !== null && !closed && <span className={`mt-0.5 block text-[11px] ${late ? 'text-signal-danger' : 'text-charcoal-600/70'}`}>{late ? `καθυστέρηση ${late} μ.` : `${days} μ. στο στάδιο`}</span>}
                      </td>
                      <td onClick={(e) => e.stopPropagation()}><OwnerSelect ids={[l.id]} value={l.owner_id} /></td>
                      <td className={overdue ? 'font-medium text-signal-danger' : ''}>{next ? formatDate(next) : '—'}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className="flex justify-end gap-1">
                          {tel && <a href={`tel:${tel}`} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-forest" title="Κλήση" aria-label="Κλήση"><Phone size={15} /></a>}
                          {tel && <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noreferrer" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-forest" title="WhatsApp" aria-label="WhatsApp"><MessageCircle size={15} /></a>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-sm text-charcoal-600">Κανένα deal με αυτά τα φίλτρα.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager from={filtered.length ? pg * per + 1 : 0} to={Math.min(filtered.length, pg * per + per)} total={filtered.length} page={pg} pages={pages} onPage={setPageNo} />
        </>
      ) : (
        <div className="border-t border-stone-line p-3">
        <Columns pipe={pipe} leads={filtered} outcome={outcome} lostReasons={pipelines.lostReasons} valueOf={valueOf} lateOf={lateOf} onOpen={setOpenId} onMove={(id, v) => move([id], v)} />
        </div>
      )}
      </div>
      {askDelete && <DeleteLeadDialog ids={[...sel]} names={rows.filter((l) => sel.has(l.id)).map((l) => l.full_name ?? l.email ?? '—')} onClose={() => setAskDelete(false)} onDeleted={() => { setGone((g) => new Set([...g, ...sel])); setSel(new Set()); }} />}
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
