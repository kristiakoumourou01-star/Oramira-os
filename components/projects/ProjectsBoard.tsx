'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { BoardLane, laneTone, laneRow } from '@/components/ui/BoardLane';
import { ColorPick } from '@/components/sales/StageEditor';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, LayoutGrid, Columns3, X, ArrowUpRight, Tags, Map as MapIcon, Pencil, Plus, Trash2, GripVertical, List, Search, Home, TrendingUp } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { PopSelect } from '@/components/ui/PopSelect';
import { StatusPill } from '@/components/ui/StatusPill';
import { toneFor } from '@/lib/status-tone-shared';
import { Pager } from '@/components/ui/SidePanel';
import { deleteProject } from '@/app/actions/project-flow';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { useDragSort, moveItem } from '@/components/ui/useDragSort';
import { updateProjectStatus } from '@/app/actions/projects';
import { BOARD_STATUSES, STATUS_STYLE, type BoardStatus } from '@/lib/unit-board-shared';
import { useBoardScroll } from '@/components/ui/useBoardScroll';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface ProjectCard {
  id: string; name: string; location: string | null; status: string | null; description: string | null; delivery_date: string | null;
  lat: number | null; lng: number | null; total: number; available: number; by: Partial<Record<BoardStatus, number>>;
}


function UnitsBar({ p }: { p: ProjectCard }) {
  if (!p.total) return null;
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-stone" title={BOARD_STATUSES.filter((st) => p.by[st]).map((st) => `${STATUS_STYLE[st].label}: ${p.by[st]}`).join(' · ')}>
      {BOARD_STATUSES.filter((st) => p.by[st]).map((st) => <span key={st} style={{ width: `${((p.by[st] ?? 0) / p.total) * 100}%`, background: STATUS_STYLE[st].border }} />)}
    </div>
  );
}

/** Έργα: πλέγμα ή στήλες ανά κατάσταση (σύρσιμο = αλλαγή κατάστασης)· κλικ → μισή σελίδα με «Πλήρες προφίλ». */
export function ProjectsBoard({ projects: initial, canEdit, stages, rawStages, canEditStages = false }: { projects: ProjectCard[]; canEdit: boolean; stages: { key: string; label: string }[]; rawStages: { key: string; label: string }[]; canEditStages?: boolean }) {
  const STATUSES: [string, string][] = stages.map((x) => [x.key, x.label]);
  const statusLabel = (st: string | null) => STATUSES.find(([k]) => k === st)?.[1] ?? (st ?? '—').replace(/_/g, ' ');
  const colOf = (st: string | null) => (STATUSES.some(([k]) => k === st) ? st : STATUSES[0]?.[0]);
  const [editCols, setEditCols] = useState(false);
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  useEffect(() => setProjects(initial), [initial]);
  const [view, setView] = useState<'list' | 'grid' | 'board'>('list');
  useEffect(() => { try { const v = localStorage.getItem('projects:view'); if (v === 'board' || v === 'grid' || v === 'list') setView(v); } catch { /* */ } }, []);
  const pick = (v: 'list' | 'grid' | 'board') => { setView(v); try { localStorage.setItem('projects:view', v); } catch { /* */ } };
  const [openId, setOpenId] = useState<string | null>(null);
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [, start] = useTransition();
  const scroller = useBoardScroll();
  const open = projects.find((p) => p.id === openId) ?? null;
  const move = (id: string, status: string) => {
    setProjects((xs) => xs.map((x) => (x.id === id ? { ...x, status } : x)));
    start(async () => { await updateProjectStatus(id, status); router.refresh(); });
  };

  const [unitF, setUnitF] = useState<'' | 'available' | 'reserved' | 'sold'>('');
  const pickCard = (k: string) => { const v = (k === 'all' || k === unitF ? '' : k) as typeof unitF; setUnitF(v); setPageNo(0); };
  const unitMatch = (p: ProjectCard) => !unitF || (unitF === 'available' ? p.available > 0 : unitF === 'reserved' ? (p.by.reserved ?? 0) > 0 : (p.by.sold ?? 0) + (p.by.handed_over ?? 0) > 0);
  const remove = (p: ProjectCard) => {
    if (!confirm(`Να διαγραφεί οριστικά το έργο «${p.name}» με όλες τις μονάδες του;`)) return;
    start(async () => {
      const r = await deleteProject(p.id);
      if (!r.ok) { alert(r.error); return; }
      setProjects((xs) => xs.filter((x) => x.id !== p.id)); setOpenId(null); router.refresh();
    });
  };
  const [q, setQ] = useState('');
  const [stF, setStF] = useState('');
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);
  const list = projects.filter((p) => unitMatch(p) && (!stF || colOf(p.status) === stF) && (!q.trim() || [p.name, p.location].some((x) => (x ?? '').toLowerCase().includes(q.trim().toLowerCase()))));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = list.slice(pg * per, pg * per + per);
  const totals = projects.reduce((t, p) => ({ units: t.units + p.total, avail: t.avail + p.available, reserved: t.reserved + (p.by.reserved ?? 0), sold: t.sold + (p.by.sold ?? 0) + (p.by.handed_over ?? 0) }), { units: 0, avail: 0, reserved: 0, sold: 0 });
  const soldPct = totals.units ? Math.round((totals.sold / totals.units) * 100) : 0;
  const delivering = projects.filter((p) => p.delivery_date && p.delivery_date >= new Date().toISOString().slice(0, 10));
  const fmtDate = (d: string | null) => (d ? new Date(d).toLocaleDateString(DATE_TAG[currentLocale().lang], { month: 'short', year: 'numeric' }) : '—');
  const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-stone-100 hover:text-charcoal';

  const card = (p: ProjectCard, compact = false) => (
    <div key={p.id} role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(p.id); }}
      draggable={compact && canEdit} onDragStart={(e) => { setDrag(p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }}
      className={compact ? `${laneRow} cursor-pointer ${drag === p.id ? 'opacity-40' : ''}` : 'cursor-pointer rounded-[14px] border border-stone-line bg-white p-4 shadow-sm transition-colors duration-150 hover:border-forest/40'}>
      {!compact && <div className="mb-3 flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest/[0.09] text-forest"><Building2 size={18} /></span><StatusPill tone={toneFor(p.status)} dot>{statusLabel(p.status)}</StatusPill></div>}
      <p className={compact ? 'font-semibold text-charcoal' : 'text-[17px] font-semibold text-charcoal'} data-no-tr>{p.name}</p>
      {p.location && <p className="mt-0.5 flex items-center gap-1 text-[13px] text-charcoal-600" data-no-tr><MapPin size={12} strokeWidth={1.75} /> {p.location}</p>}
      <div className={`${compact ? 'mt-1.5' : 'mt-3 border-t border-stone-line pt-3'} flex items-center justify-between text-[13px]`}>
        <span className="text-charcoal-600">Μονάδες</span>
        <span className="font-medium tabular-nums text-charcoal">{p.available}<span className="font-normal text-charcoal-600"> / {p.total} διαθέσιμες</span></span>
      </div>
      <UnitsBar p={p} />
    </div>
  );

  return (
    <div className="space-y-5">
      <HubCards active={unitF || 'all'} onSelect={pickCard} cards={[
        { key: 'all', icon: Building2, title: 'Όλα τα έργα', value: projects.length, sub: `${delivering.length} με προγραμματισμένη παράδοση` },
        { key: 'available', icon: Home, title: 'Διαθέσιμες μονάδες', value: totals.avail, sub: `από ${totals.units} μονάδες` },
        { key: 'reserved', icon: Tags, title: 'Κρατημένες', value: totals.reserved, sub: 'Με κράτηση, πριν την πώληση' },
        { key: 'sold', icon: TrendingUp, title: 'Πωλημένες', value: totals.sold, sub: `${soldPct}% του συνόλου` },
      ]} />

      <div className="flex min-w-0 flex-col rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal-600">
            {view === 'list' && <><span>Εμφάνιση</span>
              <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
              <span>εγγραφές</span></>}
            <span className="ml-auto flex items-center gap-2">
              {canEditStages && view === 'board' && <button type="button" onClick={() => setEditCols(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 text-[13px] font-medium text-charcoal hover:bg-stone-200"><Pencil size={13} /> Στήλες</button>}
              <span className="flex rounded-lg bg-stone-100 p-0.5">
                {([['list', List, 'Λίστα'], ['grid', LayoutGrid, 'Κάρτες'], ['board', Columns3, 'Στήλες']] as const).map(([v, I, l]) => (
                  <button key={v} type="button" onClick={() => pick(v)} aria-pressed={view === v} className={`inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors ${view === v ? 'bg-forest font-medium text-white shadow-sm' : 'text-charcoal-600 hover:text-charcoal'}`}><I size={14} /><span className="hidden sm:inline">{l}</span></button>
                ))}
              </span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PopSelect width="min-w-[160px]" ariaLabel="Κατάσταση" value={stF} onChange={(v) => { setStF(v); setPageNo(0); }} options={[['', 'Όλες οι καταστάσεις'], ...STATUSES]} />
            <label className="relative w-full sm:ml-auto sm:w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} placeholder="Έργο ή τοποθεσία…" className="input h-8 py-1 pl-8 text-[13px]" />
            </label>
          </div>
        </div>

      {editCols && <StagesEditor raw={rawStages} projects={projects} onClose={() => setEditCols(false)} />}

      {view === 'list' ? (
        <>
          <div className="overflow-x-auto border-t border-stone-line">
            <table className="o-table">
              <thead><tr><th>Έργο</th><th>Τοποθεσία</th><th>Κατάσταση</th><th>Παράδοση</th><th>Μονάδες</th><th>Διαθέσιμες</th><th>Κρατημένες</th><th>Πωλημένες</th><th>Πληρότητα</th><th className="text-right">Ενέργειες</th></tr></thead>
              <tbody>
                {page.map((p) => {
                  const sold = (p.by.sold ?? 0) + (p.by.handed_over ?? 0);
                  return (
                    <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer">
                      <td className="o-strong" data-no-tr><span className="block max-w-[200px] truncate" title={p.name}>{p.name}</span></td>
                      <td data-no-tr><span className="block max-w-[160px] truncate">{p.location || '—'}</span></td>
                      <td><StatusPill tone={toneFor(p.status)} dot>{statusLabel(p.status)}</StatusPill></td>
                      <td>{fmtDate(p.delivery_date)}</td>
                      <td className="tabular-nums">{p.total}</td>
                      <td className="tabular-nums">{p.available}</td>
                      <td className="tabular-nums">{p.by.reserved ?? 0}</td>
                      <td className="tabular-nums">{sold}</td>
                      <td><span className="flex items-center gap-2"><span className="block w-20"><UnitsBar p={p} /></span><span className="tabular-nums">{p.total ? Math.round((sold / p.total) * 100) : 0}%</span></span></td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className="flex justify-end gap-0.5">
                          <Link href={`/projects/${p.id}`} title="Πλήρες προφίλ" aria-label="Πλήρες προφίλ" className={iconBtn}><ArrowUpRight size={15} /></Link>
                          {canEdit && <Link href={`/projects/${p.id}?edit=1`} title="Επεξεργασία" aria-label="Επεξεργασία" className={iconBtn}><Pencil size={15} /></Link>}
                          <Link href={`/projects/${p.id}/prices`} title="Τιμοκατάλογος" aria-label="Τιμοκατάλογος" className={iconBtn}><Tags size={15} /></Link>
                          <Link href={`/projects/${p.id}/map`} title="Διαδραστικός χάρτης" aria-label="Διαδραστικός χάρτης" className={iconBtn}><MapIcon size={15} /></Link>
                          {canEdit && <button type="button" onClick={() => remove(p)} title="Διαγραφή" aria-label="Διαγραφή" className={`${iconBtn} hover:bg-rose-50 hover:text-signal-danger`}><Trash2 size={15} /></button>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-sm text-charcoal-600">Κανένα έργο με αυτά τα φίλτρα.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager from={list.length ? pg * per + 1 : 0} to={Math.min(list.length, pg * per + per)} total={list.length} page={pg} pages={pages} onPage={setPageNo} />
        </>
      ) : view === 'grid' ? (
        <div className="anim-fade grid grid-cols-1 gap-4 border-t border-stone-line p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">{list.map((p) => card(p))}{list.length === 0 && <p className="text-sm text-charcoal-600">Κανένα έργο με αυτά τα φίλτρα.</p>}</div>
      ) : (
        <div {...scroller} className="anim-fade overflow-x-auto border-t border-stone-line p-3 pb-4">
          <div className="flex min-h-[calc(100vh-360px)] min-w-max gap-3">
            {STATUSES.filter(([k]) => !stF || k === stF).map(([k, label], i) => {
              const col = list.filter((p) => colOf(p.status) === k);
              const color = (stages as { key: string; color?: string }[]).find((x) => x.key === k)?.color;
              return (
                <BoardLane key={k} tone={laneTone(color, i, STATUSES.length)} over={over === k} title={label} count={col.length}
                  meta={<><span className="font-semibold text-charcoal">{col.reduce((t, p) => t + p.total, 0)}</span> μονάδες · {col.reduce((t, p) => t + p.available, 0)} διαθέσιμες</>}
                  empty="Κανένα έργο"
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(k); } }} onDrop={(e) => { e.preventDefault(); if (drag) move(drag, k); setDrag(null); setOver(null); }}>
                  {col.map((p) => card(p, true))}
                </BoardLane>
              );
            })}
          </div>
          {canEdit && <p className="mt-2 text-xs text-charcoal-600/60">Σύρετε ένα έργο σε άλλη στήλη για να αλλάξει κατάσταση.</p>}
        </div>
      )}
      </div>

      {open && (
        <div className="anim-fade fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpenId(null)}>
          <aside className="anim-pop flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-stone-line px-6 py-4">
              <div className="min-w-0">
                <p className="eyebrow">Έργο</p>
                <h3 className="truncate font-display text-2xl" data-no-tr>{open.name}</h3>
                {open.location && <p className="mt-0.5 flex items-center gap-1 text-sm text-charcoal-600/70" data-no-tr><MapPin size={13} /> {open.location}</p>}
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Κλείσιμο" className="text-charcoal-600/60 hover:text-charcoal"><X size={20} /></button>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="flex flex-wrap gap-2">
                <Link href={`/projects/${open.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90"><ArrowUpRight size={14} /> Πλήρες προφίλ</Link>
                {canEdit && <Link href={`/projects/${open.id}?edit=1`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Pencil size={14} /> Επεξεργασία</Link>}
                <Link href={`/projects/${open.id}/prices`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Tags size={14} /> Τιμοκατάλογος</Link>
                <Link href={`/projects/${open.id}/map`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><MapIcon size={14} /> Διαδραστικός χάρτης</Link>
                {canEdit && <button type="button" onClick={() => remove(open)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-signal-danger hover:border-signal-danger/40"><Trash2 size={14} /> Διαγραφή</button>}
              </div>
              <div><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Κατάσταση</span>
                <PopSelect width="w-full" ariaLabel="Κατάσταση" value={colOf(open.status) ?? ''} onChange={(v) => { if (canEdit) move(open.id, v); }} options={STATUSES} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-stone-line p-3"><p className="figure text-2xl text-charcoal">{open.total}</p><p className="text-xs text-charcoal-600/70">Μονάδες</p></div>
                <div className="rounded-lg border border-stone-line p-3"><p className="figure text-2xl text-forest">{open.available}</p><p className="text-xs text-charcoal-600/70">Διαθέσιμες</p></div>
                <div className="rounded-lg border border-stone-line p-3"><p className="figure text-2xl text-charcoal">{(open.by.sold ?? 0) + (open.by.handed_over ?? 0)}</p><p className="text-xs text-charcoal-600/70">Πωλημένες</p></div>
              </div>
              {open.total > 0 && (
                <div>
                  <UnitsBar p={open} />
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-charcoal-600/80">{BOARD_STATUSES.filter((st) => open.by[st]).map((st) => <span key={st} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_STYLE[st].border }} />{STATUS_STYLE[st].label} {open.by[st]}</span>)}</div>
                </div>
              )}
              {open.delivery_date && <p className="text-sm text-charcoal-600">Παράδοση: <b className="text-charcoal">{new Date(open.delivery_date).toLocaleDateString(DATE_TAG[currentLocale().lang], { month: 'long', year: 'numeric' })}</b></p>}
              {open.description && <p className="whitespace-pre-line text-sm text-charcoal-600" data-no-tr>{open.description}</p>}
              <div>
                <p className="eyebrow mb-2">Τοποθεσία</p>
                {open.lat != null && open.lng != null ? (
                  <>
                    <iframe title={`Χάρτης ${open.name}`} loading="lazy" className="h-64 w-full rounded-md border border-stone-line"
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${open.lng - 0.006}%2C${open.lat - 0.006}%2C${open.lng + 0.006}%2C${open.lat + 0.006}&layer=mapnik&marker=${open.lat}%2C${open.lng}`} />
                    <a href={`https://www.google.com/maps?q=${open.lat},${open.lng}`} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-forest hover:underline">Άνοιγμα στο Google Maps</a>
                  </>
                ) : (
                  <p className="text-sm text-charcoal-600/70">Η ακριβής θέση δεν έχει οριστεί. {open.location && <a href={`https://www.google.com/maps/search/${encodeURIComponent(open.location)}`} target="_blank" rel="noreferrer" className="text-forest hover:underline">Αναζήτηση «{open.location}» στο Google Maps</a>} · Ορίζεται στο Πλήρες προφίλ → Τοποθεσία.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/** Επεξεργασία στηλών έργων: μετονομασία, προσθήκη, διαγραφή (με ερώτηση αν έχει έργα), σειρά με σύρσιμο. */
function StagesEditor({ raw, projects, onClose }: { raw: { key: string; label: string }[]; projects: ProjectCard[]; onClose: () => void }) {
  const router = useRouter();
  const [rows, setRows] = useState(raw);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dnd = useDragSort((a, b) => setRows((r) => moveItem(r, a, b)), true, 'pstages');
  const count = (k: string) => projects.filter((p) => (p.status ?? raw[0]?.key) === k).length;
  const del = (i: number) => {
    const k = rows[i].key; const n = count(k);
    if (rows.length <= 1) return;
    if (n > 0 && !confirm(`Η στήλη «${rows[i].label}» έχει ${n} έργ${n === 1 ? 'ο' : 'α'}. Σίγουρα να διαγραφεί; Τα έργα θα μεταφερθούν στη στήλη «${rows.find((_, j) => j !== i)?.label}».`)) return;
    setRows((r) => r.filter((_, j) => j !== i));
  };
  const add = () => { let k = 'stage'; let n = 1; while (rows.some((r) => r.key === k)) k = `stage_${++n}`; setRows((r) => [...r, { key: k, label: 'Νέα στήλη' }]); };
  const save = () => start(async () => {
    if (rows.some((r) => !r.label.trim())) { setErr('Κάθε στήλη χρειάζεται όνομα.'); return; }
    const res = await saveOrgSlice('projectStages', rows);
    if (!res.ok) { setErr(res.error); return; }
    const keep = new Set(rows.map((r) => r.key));
    for (const p of projects) if (p.status && !keep.has(p.status) && raw.some((r) => r.key === p.status)) await updateProjectStatus(p.id, rows[0].key);
    router.refresh(); onClose();
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4" onClick={onClose}>
      <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><p className="font-semibold text-charcoal">Στήλες έργων</p><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <ul className="space-y-1.5">
          {rows.map((r, i) => (
            <li key={r.key} {...dnd.item(i)} className={`flex items-center gap-2 rounded-lg border border-stone-line p-2 ${dnd.cls(i)}`}>
              <span className="cursor-grab text-charcoal-600/40" title="Σύρετε για αλλαγή σειράς"><GripVertical size={16} /></span>
              <ColorPick value={(r as { color?: string }).color} auto={'#' + laneTone(null, i, rows.length).split(' ').map((n) => Number(n).toString(16).padStart(2, '0')).join('')} onChange={(c) => setRows((x) => x.map((y, j) => (j === i ? { ...y, color: c } : y)))} />
              <input className="input flex-1 py-1 text-sm" value={r.label} maxLength={40} onChange={(e) => setRows((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} aria-label="Όνομα στήλης" />
              <span className="w-10 text-right text-xs text-charcoal-600/60">{count(r.key)}</span>
              <button type="button" disabled={rows.length <= 1} onClick={() => del(i)} className="text-charcoal-600/50 hover:text-signal-danger disabled:opacity-20" aria-label="Διαγραφή στήλης" title="Διαγραφή στήλης"><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondary text-sm" onClick={add}><Plus size={14} /> Νέα στήλη</button>
        {err && <p className="text-sm text-signal-danger">{err}</p>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Άκυρο</button><button type="button" className="btn-primary" disabled={pending} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></div>
      </div>
    </div>
  );
}
