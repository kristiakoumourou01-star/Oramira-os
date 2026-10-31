'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Eye, EyeOff, RotateCcw, Copy } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import {
  DASHBOARD_CATALOG, SIZE_LABEL, defaultLayout, normalizeLayout,
  type BlockSize, type DashBlock, type DashboardSettings,
} from '@/lib/dashboard-shared';
import { INTERNAL_ROLES, ROLE_LABEL } from '@/lib/permissions';
import type { RolesSettings } from '@/lib/roles-shared';

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
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= list.length) return;
    const n = [...list]; [n[i], n[j]] = [n[j], n[i]]; setList(n);
  };
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
          <ul className="divide-y divide-stone-line">
            {list.map((b, i) => {
              const def = DASHBOARD_CATALOG.find((d) => d.key === b.key)!;
              return (
                <li key={b.key} className={`flex flex-wrap items-center gap-3 py-2.5 ${b.visible ? '' : 'opacity-55'}`}>
                  <div className="flex">
                    <button type="button" className="btn-ghost px-1.5" disabled={!canEdit || i === 0} onClick={() => move(i, -1)} aria-label="Πάνω"><ArrowUp size={14} /></button>
                    <button type="button" className="btn-ghost px-1.5" disabled={!canEdit || i === list.length - 1} onClick={() => move(i, 1)} aria-label="Κάτω"><ArrowDown size={14} /></button>
                  </div>
                  <div className="min-w-[180px] flex-1">
                    <p className="text-sm font-medium text-charcoal">{def.label}</p>
                    <p className="text-xs text-charcoal-600/60">{def.hint}</p>
                  </div>
                  <div className="flex rounded-lg border border-stone-line p-0.5">
                    {def.sizes.map((sz) => (
                      <button key={sz} type="button" disabled={!canEdit} onClick={() => patch(b.key, { size: sz })}
                        className={`rounded-md px-2 py-0.5 text-xs ${b.size === sz ? 'bg-forest text-stone-100' : 'text-charcoal-600 hover:bg-forest/5'}`}>
                        {SIZE_LABEL[sz]}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="btn-ghost text-xs" disabled={!canEdit} onClick={() => patch(b.key, { visible: !b.visible })}>
                    {b.visible ? <><Eye size={13} /> Ορατό</> : <><EyeOff size={13} /> Κρυφό</>}
                  </button>
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
