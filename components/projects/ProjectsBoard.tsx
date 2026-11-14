'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Building2, MapPin, LayoutGrid, Columns3, X, ArrowUpRight, Tags, Map as MapIcon } from 'lucide-react';
import { updateProjectStatus } from '@/app/actions/projects';
import { BOARD_STATUSES, STATUS_STYLE, type BoardStatus } from '@/lib/unit-board-shared';
import { useBoardScroll } from '@/components/ui/useBoardScroll';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface ProjectCard {
  id: string; name: string; location: string | null; status: string | null; description: string | null; delivery_date: string | null;
  lat: number | null; lng: number | null; total: number; available: number; by: Partial<Record<BoardStatus, number>>;
}

const STATUSES: [string, string][] = [['planning', 'Σχεδιασμός'], ['permitting', 'Άδειες'], ['under_construction', 'Υπό κατασκευή'], ['selling', 'Σε πώληση'], ['completed', 'Ολοκληρωμένο'], ['on_hold', 'Σε αναμονή']];
const statusLabel = (s: string | null) => STATUSES.find(([k]) => k === s)?.[1] ?? (s ?? '—').replace(/_/g, ' ');

function UnitsBar({ p }: { p: ProjectCard }) {
  if (!p.total) return null;
  return (
    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-stone" title={BOARD_STATUSES.filter((st) => p.by[st]).map((st) => `${STATUS_STYLE[st].label}: ${p.by[st]}`).join(' · ')}>
      {BOARD_STATUSES.filter((st) => p.by[st]).map((st) => <span key={st} style={{ width: `${((p.by[st] ?? 0) / p.total) * 100}%`, background: STATUS_STYLE[st].border }} />)}
    </div>
  );
}

/** Έργα: πλέγμα ή στήλες ανά κατάσταση (σύρσιμο = αλλαγή κατάστασης)· κλικ → μισή σελίδα με «Πλήρες προφίλ». */
export function ProjectsBoard({ projects: initial, canEdit }: { projects: ProjectCard[]; canEdit: boolean }) {
  const router = useRouter();
  const [projects, setProjects] = useState(initial);
  useEffect(() => setProjects(initial), [initial]);
  const [view, setView] = useState<'grid' | 'board'>('grid');
  useEffect(() => { try { const v = localStorage.getItem('projects:view'); if (v === 'board' || v === 'grid') setView(v); } catch { /* */ } }, []);
  const pick = (v: 'grid' | 'board') => { setView(v); try { localStorage.setItem('projects:view', v); } catch { /* */ } };
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

  const card = (p: ProjectCard, compact = false) => (
    <div key={p.id} role="button" tabIndex={0} onClick={() => setOpenId(p.id)} onKeyDown={(e) => { if (e.key === 'Enter') setOpenId(p.id); }}
      draggable={compact && canEdit} onDragStart={(e) => { setDrag(p.id); e.dataTransfer.effectAllowed = 'move'; }} onDragEnd={() => { setDrag(null); setOver(null); }}
      className={compact ? `cursor-pointer border-b border-stone-line px-3 py-2.5 transition last:border-b-0 hover:bg-forest/[0.04] ${drag === p.id ? 'opacity-40' : ''}` : 'panel cursor-pointer p-6 transition-shadow hover:shadow-overlay'}>
      {!compact && <div className="mb-3 flex items-start justify-between"><Building2 size={20} className="text-olive" strokeWidth={1.5} /><span className="badge-neutral">{statusLabel(p.status)}</span></div>}
      <p className={compact ? 'font-semibold text-charcoal' : 'font-display text-xl text-charcoal'} data-no-tr>{p.name}</p>
      {p.location && <p className="mt-0.5 flex items-center gap-1 text-sm text-charcoal-600/70" data-no-tr><MapPin size={12} strokeWidth={1.75} /> {p.location}</p>}
      <div className={`${compact ? 'mt-1.5' : 'mt-4 border-t border-stone-line pt-3'} flex items-center justify-between text-sm`}>
        <span className="text-charcoal-600/70">Μονάδες</span>
        <span className="figure text-charcoal">{p.available}<span className="text-charcoal-600/50"> / {p.total} διαθέσιμες</span></span>
      </div>
      <UnitsBar p={p} />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 self-start rounded-lg bg-stone p-1 text-sm" role="tablist">
        <button type="button" onClick={() => pick('grid')} aria-pressed={view === 'grid'} title="Κάρτες" className={`flex items-center gap-1.5 rounded-md px-3 py-1 ${view === 'grid' ? 'bg-white font-medium text-charcoal shadow-sm' : 'text-charcoal-600'}`}><LayoutGrid size={14} /> Κάρτες</button>
        <button type="button" onClick={() => pick('board')} aria-pressed={view === 'board'} title="Στήλες" className={`flex items-center gap-1.5 rounded-md px-3 py-1 ${view === 'board' ? 'bg-white font-medium text-charcoal shadow-sm' : 'text-charcoal-600'}`}><Columns3 size={14} /> Στήλες</button>
      </div>

      {view === 'grid' ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">{projects.map((p) => card(p))}</div>
      ) : (
        <div {...scroller} className="-mx-1 overflow-x-auto pb-6">
          <div className="flex min-h-[calc(100vh-300px)] min-w-max divide-x divide-stone-line overflow-hidden rounded-xl border border-stone-line bg-white/60">
            {STATUSES.map(([k, label]) => {
              const col = projects.filter((p) => (p.status ?? 'planning') === k);
              return (
                <div key={k} className={`stage-col flex w-[272px] shrink-0 flex-col transition ${over === k ? 'bg-forest/[0.06]' : ''}`}
                  onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(k); } }} onDrop={(e) => { e.preventDefault(); if (drag) move(drag, k); setDrag(null); setOver(null); }}>
                  <div className="stage-head border-b border-stone-line bg-white px-3 py-2">
                    <p className="font-semibold text-charcoal">{label}</p>
                    <p className="text-xs text-charcoal-600/70">{col.length} έργα · {col.reduce((s, p) => s + p.total, 0)} μονάδες</p>
                  </div>
                  <div className="flex flex-col">{col.map((p) => card(p, true))}</div>
                </div>
              );
            })}
          </div>
          {canEdit && <p className="mt-2 text-xs text-charcoal-600/60">Σύρετε ένα έργο σε άλλη στήλη για να αλλάξει κατάσταση.</p>}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-charcoal/30" onClick={() => setOpenId(null)}>
          <aside className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-white shadow-overlay" onClick={(e) => e.stopPropagation()}>
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
                <Link href={`/projects/${open.id}`} className="btn-primary text-sm"><ArrowUpRight size={14} /> Πλήρες προφίλ</Link>
                <Link href={`/projects/${open.id}/prices`} className="btn-secondary text-sm"><Tags size={14} /> Τιμοκατάλογος</Link>
                <Link href={`/projects/${open.id}/map`} className="btn-secondary text-sm"><MapIcon size={14} /> Διαδραστικός χάρτης</Link>
              </div>
              <label className="block"><span className="text-xs text-charcoal-600/70">Κατάσταση</span>
                <select className="input" value={open.status ?? 'planning'} disabled={!canEdit} onChange={(e) => move(open.id, e.target.value)}>{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
              </label>
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
