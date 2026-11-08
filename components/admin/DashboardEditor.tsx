'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { GripVertical, SlidersHorizontal, RotateCcw, Copy, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { Switch } from '@/components/admin/settings-ui';
import { saveOrgSlice } from '@/app/actions/org-settings';
import {
  DASHBOARD_CATALOG, defaultLayout, normalizeLayout,
  type BlockSize, type DashBlock, type DashboardSettings,
} from '@/lib/dashboard-shared';
import { INTERNAL_ROLES, ROLE_LABEL } from '@/lib/permissions';
import type { RolesSettings } from '@/lib/roles-shared';

const SIZE_TEXT: Record<BlockSize, string> = { third: 'Μικρό (⅓)', half: 'Μισό (½)', twoThirds: 'Μεγάλο (⅔)', full: 'Όλο το πλάτος' };
const PREVIEW_SPAN: Record<BlockSize, string> = { third: 'col-span-2', half: 'col-span-3', twoThirds: 'col-span-4', full: 'col-span-6' };

/**
 * Settings → Dashboard. Pick an audience (everyone, a built-in role, or one of
 * your roles), then which boxes it sees, their order and width. An audience
 * without its own layout uses «Όλοι».
 */
export function DashboardEditor({ initial, roles, canEdit }: { initial: DashboardSettings; roles: RolesSettings; canEdit: boolean }) {
  const [layouts, setLayouts] = useState<Record<string, DashBlock[]>>(initial.layouts);
  const [aud, setAud] = useState('default');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const audiences = [
    { key: 'default', label: 'Όλοι (προεπιλογή)' },
    ...INTERNAL_ROLES.map((r) => ({ key: r, label: ROLE_LABEL[r] })),
    ...roles.custom.map((c) => ({ key: `custom:${c.id}`, label: c.name })),
  ];
  const own = !!layouts[aud];
  const list = layouts[aud] ?? layouts.default ?? defaultLayout();

  const setList = (next: DashBlock[]) => { setLayouts((l) => ({ ...l, [aud]: next })); setMsg(null); };

  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const [cfg, setCfg] = useState<string | null>(null);
  const dropAt = (from: number, to: number) => { if (from === to) return; const n = [...list]; const [it] = n.splice(from, 1); n.splice(to, 0, it); setList(n); };
  const patch = (key: string, p: Partial<DashBlock>) => setList(list.map((b) => (b.key === key ? { ...b, ...p } : b)));

  function save(next = layouts, text = 'Αποθηκεύτηκε. Το dashboard άλλαξε για όσους αφορά.') {
    start(async () => {
      const clean: DashboardSettings = { layouts: Object.fromEntries(Object.entries(next).map(([k, v]) => [k, normalizeLayout(v)])) };
      const res = await saveOrgSlice('dashboard', clean);
      if (res.ok) { setMsg({ ok: true, text }); router.refresh(); } else setMsg({ ok: false, text: res.error });
    });
  }
  function resetToDefault() {
    if (aud === 'default') { setList(defaultLayout()); setMsg({ ok: true, text: 'Επαναφέρθηκε η αρχική διάταξη. Πατήστε Αποθήκευση.' }); return; }
    const next = { ...layouts }; delete next[aud];
    setLayouts(next);
    save(next, 'Αυτός ο ρόλος βλέπει πλέον το dashboard «Όλοι».');
  }

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <label className="block max-w-sm">
          <span className="eyebrow mb-1.5 block">Dashboard για</span>
          <select className="input" value={aud} onChange={(e) => { setAud(e.target.value); setMsg(null); }}>
            {audiences.map((a) => <option key={a.key} value={a.key}>{a.label}{a.key !== 'default' && layouts[a.key] ? ' · δικό του' : ''}</option>)}
          </select>
        </label>
        <p className="text-xs text-charcoal-600/60">
          {aud === 'default'
            ? 'Αυτό βλέπουν όσοι δεν έχουν δικό τους dashboard ρόλου.'
            : own
              ? 'Αυτός ο ρόλος έχει δικό του dashboard.'
              : 'Αυτός ο ρόλος βλέπει τώρα το «Όλοι». Μόλις αλλάξετε κάτι και αποθηκεύσετε, θα έχει δικό του.'}
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="panel p-5">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-baseline gap-2 font-display text-xl text-charcoal">Κουτιά dashboard <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/60">εμφάνιση / απόκρυψη</span></p>
            <Link href="/dashboard" className="btn-secondary text-xs"><LayoutGrid size={13} /> Δείτε το dashboard</Link>
          </div>
          <p className="mb-2 text-sm text-charcoal-600/70">Με τον διακόπτη εμφανίζετε ή κρύβετε ένα κουτί. Σύρετε από τις τελίτσες ⋮⋮ για να αλλάξετε σειρά· με το εικονίδιο ρυθμίσεων αλλάζετε το πλάτος.</p>
          <ul className="space-y-2">
            {list.map((b, i) => {
              const def = DASHBOARD_CATALOG.find((d) => d.key === b.key)!;
              return (
                <li key={b.key} draggable={canEdit}
                  onDragStart={(e) => { if ((e.target as HTMLElement).closest('button,input,select')) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', b.key); setDrag(i); }}
                  onDragOver={(e) => { if (drag !== null) { e.preventDefault(); setOver(i); } }}
                  onDrop={(e) => { e.preventDefault(); if (drag !== null) dropAt(drag, i); setDrag(null); setOver(null); }}
                  onDragEnd={() => { setDrag(null); setOver(null); }}
                  className={`relative flex items-center gap-3 rounded-xl border bg-white px-3 py-3 ${over === i && drag !== i ? 'border-forest ring-2 ring-forest/30' : 'border-stone-line'} ${drag === i ? 'opacity-50' : ''} ${b.visible ? '' : 'opacity-60'}`}>
                  <span className={`text-charcoal-600/40 ${canEdit ? 'cursor-grab active:cursor-grabbing' : ''}`} title="Σύρετε για αλλαγή σειράς"><GripVertical size={16} /></span>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/[0.07] text-forest"><LayoutGrid size={15} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-charcoal">{def.label}</p>
                    <p className="truncate text-xs text-charcoal-600/60">{def.hint}</p>
                  </div>
                  {def.sizes.length > 1 && (
                    <div className="relative">
                      <button type="button" disabled={!canEdit} onClick={() => setCfg(cfg === b.key ? null : b.key)} aria-label={`Ρυθμίσεις: ${def.label}`} title="Ρυθμίσεις κουτιού"
                        className={`rounded-lg p-1.5 ${cfg === b.key ? 'bg-forest/10 text-forest' : 'text-charcoal-600 hover:bg-stone'}`}><SlidersHorizontal size={16} /></button>
                      {cfg === b.key && (
                        <div className="absolute right-0 top-full z-20 mt-1 w-56 space-y-2 rounded-xl border border-stone-line bg-white p-3 shadow-overlay">
                          <p className="text-xs font-semibold uppercase tracking-wide text-charcoal-600/70">Πλάτος κουτιού</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {def.sizes.map((sz) => (
                              <button key={sz} type="button" onClick={() => { patch(b.key, { size: sz }); setCfg(null); }}
                                className={`rounded-lg border px-2 py-1.5 text-xs ${b.size === sz ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/40'}`}>
                                {SIZE_TEXT[sz]}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <Switch checked={b.visible} disabled={!canEdit} label={`${def.label} ορατό`} onChange={(x) => patch(b.key, { visible: x })} />
                </li>
              );
            })}
          </ul>
        </div>

        <div className="panel p-4 xl:self-start">
          <p className="eyebrow mb-2">Προεπισκόπηση</p>
          <div className="grid grid-cols-6 gap-1.5">
            {list.filter((b) => b.visible).map((b) => (
              <div key={b.key} className={`${PREVIEW_SPAN[b.size]} truncate rounded-md bg-forest/[0.08] px-2 py-2 text-[10px] text-forest`}>
                {DASHBOARD_CATALOG.find((d) => d.key === b.key)?.label}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-charcoal-600/60">Στο κινητό κάθε κουτί πιάνει όλο το πλάτος.</p>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={pending} onClick={() => save()}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={resetToDefault}>
            {aud === 'default' ? <><RotateCcw size={14} /> Αρχική διάταξη</> : <><Copy size={14} /> Ίδιο με «Όλοι»</>}
          </button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
