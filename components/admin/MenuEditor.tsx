'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, ArrowDown, Eye, EyeOff, ChevronRight, RotateCcw, Lock } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { DEFAULT_NAV, NAV_ICON_NAMES, allNavTargets } from '@/lib/nav';
import {
  DEFAULT_MENU, menuOverridesFrom, resolveMenu,
  type LayoutSettings, type MenuPosition, type MenuSettings, type ResolvedNavItem,
} from '@/lib/org-settings-shared';
import { INTERNAL_ROLES, ROLE_LABEL } from '@/lib/permissions';
import { NAV_ICONS, navIcon } from '@/components/layout/nav-icons';

const POSITIONS: { value: MenuPosition; label: string; hint: string }[] = [
  { value: 'left', label: 'Αριστερά', hint: 'Κλασικό sidebar' },
  { value: 'top', label: 'Πάνω', hint: 'Οριζόντια μπάρα με αναδυόμενα μενού' },
  { value: 'right', label: 'Δεξιά', hint: 'Sidebar στη δεξιά πλευρά' },
];

function move<T>(list: T[], i: number, dir: -1 | 1): T[] {
  const j = i + dir;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/**
 * Settings → Μενού & διάταξη. The admin arranges the menu for everyone:
 * position, icons-only, start screen, and for every entry its order, name,
 * icon, visibility and which roles don't see it; sub-items can be renamed,
 * reordered and hidden. "Επαναφορά" returns to the built-in menu.
 */
export function MenuEditor({ layout, menu, canEdit }: { layout: LayoutSettings; menu: MenuSettings; canEdit: boolean }) {
  const [items, setItems] = useState<ResolvedNavItem[]>(() => resolveMenu(menu, DEFAULT_NAV));
  const [position, setPosition] = useState<MenuPosition>(menu.position);
  const [lay, setLay] = useState<LayoutSettings>(layout);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const targets = useMemo(() => allNavTargets(), []);

  const update = (href: string, patch: Partial<ResolvedNavItem>) => {
    setItems((prev) => prev.map((it) => (it.href === href ? { ...it, ...patch } : it)));
    setMsg(null);
  };
  const updateChild = (href: string, childHref: string, patch: { label?: string; hidden?: boolean }) =>
    setItems((prev) => prev.map((it) => (it.href === href ? { ...it, children: it.children.map((c) => (c.href === childHref ? { ...c, ...patch } : c)) } : it)));
  const moveChild = (href: string, i: number, dir: -1 | 1) =>
    setItems((prev) => prev.map((it) => (it.href === href ? { ...it, children: move(it.children, i, dir) } : it)));
  const toggleRole = (it: ResolvedNavItem, role: string) =>
    update(it.href, { hiddenRoles: it.hiddenRoles.includes(role) ? it.hiddenRoles.filter((r) => r !== role) : [...it.hiddenRoles, role] });

  function save() {
    start(async () => {
      const a = await saveOrgSlice('menu', menuOverridesFrom(items, position));
      const b = a.ok ? await saveOrgSlice('layout', lay) : a;
      if (a.ok && b.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε. Το μενού άλλαξε για όλους.' }); router.refresh(); }
      else setMsg({ ok: false, text: (!a.ok ? a.error : !b.ok ? b.error : '') || 'Αποτυχία αποθήκευσης.' });
    });
  }

  function reset() {
    setItems(resolveMenu(DEFAULT_MENU, DEFAULT_NAV));
    setPosition(DEFAULT_MENU.position);
    setMsg({ ok: true, text: 'Επαναφέρθηκε το αρχικό μενού. Πατήστε Αποθήκευση για να εφαρμοστεί.' });
  }

  const disabled = !canEdit || pending;

  return (
    <div className="space-y-4">
      {/* Position & behaviour */}
      <div className="panel space-y-4 p-5">
        <div>
          <p className="eyebrow mb-2">Θέση μενού</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {POSITIONS.map((p) => (
              <label key={p.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${position === p.value ? 'border-forest bg-forest/[0.04]' : 'border-stone-line'}`}>
                <input type="radio" name="menu-position" checked={position === p.value} disabled={disabled} onChange={() => { setPosition(p.value); setMsg(null); }} className="mt-0.5" />
                <span><span className="block font-medium text-charcoal">{p.label}</span><span className="text-xs text-charcoal-600/60">{p.hint}</span></span>
              </label>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Σελίδα έναρξης (μετά τη σύνδεση)</span>
            <select className="input" disabled={disabled} value={lay.startScreen} onChange={(e) => setLay({ ...lay, startScreen: e.target.value })}>
              {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <div className="space-y-2 pt-5 text-sm text-charcoal">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lay.sidebarCompact} disabled={disabled || position === 'top'} onChange={(e) => setLay({ ...lay, sidebarCompact: e.target.checked })} />
              Μόνο εικονίδια (στενό μενού)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lay.denseLists} disabled={disabled} onChange={(e) => setLay({ ...lay, denseLists: e.target.checked })} />
              Πυκνές λίστες και πίνακες
            </label>
          </div>
        </div>
      </div>

      {/* Entries */}
      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Στοιχεία μενού</p>
            <p className="text-xs text-charcoal-600/60">Αλλάξτε σειρά με τα βελάκια, ονόματα και εικονίδια, κρύψτε ό,τι δεν χρειάζεστε. Πατήστε ▸ για υποενότητες και ρόλους.</p>
          </div>
        </div>
        <ul className="divide-y divide-stone-line">
          {items.map((it, i) => {
            const Icon = navIcon(it.icon);
            const expanded = open === it.href;
            return (
              <li key={it.href} className={`py-2 ${it.hidden ? 'opacity-55' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex">
                    <button type="button" className="btn-ghost px-1.5" disabled={disabled || i === 0} onClick={() => setItems(move(items, i, -1))} aria-label="Πάνω"><ArrowUp size={14} /></button>
                    <button type="button" className="btn-ghost px-1.5" disabled={disabled || i === items.length - 1} onClick={() => setItems(move(items, i, 1))} aria-label="Κάτω"><ArrowDown size={14} /></button>
                  </div>
                  <span className="flex h-8 w-8 items-center justify-center rounded-md bg-forest/[0.06] text-forest"><Icon size={15} strokeWidth={1.75} /></span>
                  <select className="input w-40 py-1 text-xs" disabled={disabled} value={it.icon} onChange={(e) => update(it.href, { icon: e.target.value })} aria-label="Εικονίδιο">
                    {NAV_ICON_NAMES.filter((n) => NAV_ICONS[n]).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <input className="input min-w-[160px] flex-1 py-1" disabled={disabled} value={it.label} placeholder={it.defaultLabel} onChange={(e) => update(it.href, { label: e.target.value })} aria-label="Όνομα" />
                  {it.locked ? (
                    <span className="flex items-center gap-1 px-2 text-xs text-charcoal-600/60" title="Το Settings μένει πάντα ορατό στον admin"><Lock size={12} /> Πάντα</span>
                  ) : (
                    <button type="button" className="btn-ghost text-xs" disabled={disabled} onClick={() => update(it.href, { hidden: !it.hidden })} title={it.hidden ? 'Εμφάνιση' : 'Απόκρυψη'}>
                      {it.hidden ? <><EyeOff size={13} /> Κρυφό</> : <><Eye size={13} /> Ορατό</>}
                    </button>
                  )}
                  <button type="button" className="btn-ghost text-xs" onClick={() => setOpen(expanded ? null : it.href)} aria-expanded={expanded}>
                    <ChevronRight size={14} className={`transition-transform ${expanded ? 'rotate-90' : ''}`} />
                    {it.children.length > 0 ? `${it.children.length} υποενότητες` : 'Ρόλοι'}
                  </button>
                </div>

                {expanded && (
                  <div className="ml-10 mt-3 space-y-4 rounded-lg bg-stone/60 p-3">
                    {!it.locked && (
                      <div>
                        <p className="mb-1.5 text-xs font-medium text-charcoal">Κρυφό για τους ρόλους:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {INTERNAL_ROLES.map((r) => {
                            const off = it.hiddenRoles.includes(r);
                            return (
                              <button key={r} type="button" disabled={disabled} onClick={() => toggleRole(it, r)}
                                className={`rounded-full border px-2.5 py-0.5 text-xs ${off ? 'border-signal-danger/40 bg-signal-danger/10 text-signal-danger' : 'border-stone-line bg-white text-charcoal-600'}`}>
                                {ROLE_LABEL[r]}{off ? ' · κρυφό' : ''}
                              </button>
                            );
                          })}
                        </div>
                        <p className="mt-1 text-[11px] text-charcoal-600/60">Το μενού μόνο κρύβει. Τι επιτρέπεται να ανοίξει κάθε χρήστης ορίζεται στα δικαιώματα (Χρήστες & πρόσβαση).</p>
                      </div>
                    )}
                    {it.children.length > 0 && (
                      <ul className="space-y-1.5">
                        {it.children.map((c, ci) => (
                          <li key={c.href} className={`flex flex-wrap items-center gap-2 ${c.hidden ? 'opacity-55' : ''}`}>
                            <button type="button" className="btn-ghost px-1.5" disabled={disabled || ci === 0} onClick={() => moveChild(it.href, ci, -1)} aria-label="Πάνω"><ArrowUp size={13} /></button>
                            <button type="button" className="btn-ghost px-1.5" disabled={disabled || ci === it.children.length - 1} onClick={() => moveChild(it.href, ci, 1)} aria-label="Κάτω"><ArrowDown size={13} /></button>
                            <input className="input min-w-[160px] flex-1 py-1 text-sm" disabled={disabled} value={c.label} placeholder={c.defaultLabel} onChange={(e) => updateChild(it.href, c.href, { label: e.target.value })} aria-label="Όνομα υποενότητας" />
                            <button type="button" className="btn-ghost text-xs" disabled={disabled} onClick={() => updateChild(it.href, c.href, { hidden: !c.hidden })}>
                              {c.hidden ? <><EyeOff size={13} /> Κρυφό</> : <><Eye size={13} /> Ορατό</>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={pending} className="btn-primary">{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" onClick={reset} disabled={pending} className="btn-ghost"><RotateCcw size={14} /> Επαναφορά στο αρχικό μενού</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
