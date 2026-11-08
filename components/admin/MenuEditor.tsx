'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ChevronRight, RotateCcw, Lock, GripVertical } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { DEFAULT_NAV, NAV_ICON_NAMES, allNavTargets } from '@/lib/nav';
import {
  DEFAULT_MENU, menuOverridesFrom, resolveMenu,
  type LayoutSettings, type MenuPosition, type MenuSettings, type ResolvedNavItem,
} from '@/lib/org-settings-shared';
import { INTERNAL_ROLES, ROLE_LABEL } from '@/lib/permissions';
import { NAV_ICONS, navIcon } from '@/components/layout/nav-icons';
import { moveItem } from '@/components/ui/useDragSort';

const NAV_CARDS: { value: MenuPosition; label: string; hint: string }[] = [
  { value: 'left', label: 'Αριστερό μενού', hint: 'Προεπιλογή' },
  { value: 'top', label: 'Μενού πάνω', hint: 'Οριζόντιο' },
  { value: 'right', label: 'Δεξί μενού', hint: 'Καθρέφτης' },
];
const SIDEBAR_CARDS: { value: LayoutSettings['sidebarDefault']; label: string; hint: string }[] = [
  { value: 'full', label: 'Ανοιχτό', hint: 'Πλήρες πλάτος' },
  { value: 'icons', label: 'Στενό', hint: 'Μόνο εικονίδια' },
  { value: 'auto', label: 'Αυτόματη απόκρυψη', hint: 'Ανοίγει με το ποντίκι' },
];

/** Κάρτα επιλογής με μικρό σκίτσο της διάταξης (όπως στο demo). */
function LayoutCard({ title, hint, active, disabled, art, onClick }: { title: string; hint: string; active: boolean; disabled?: boolean; art: string; onClick: () => void }) {
  const bar = 'rounded-[2px] bg-forest';
  const line = 'h-[3px] rounded bg-stone-line';
  const pic = art === 'top'
    ? <div className="flex h-9 w-14 flex-col gap-1 rounded border border-stone-line bg-white p-1"><div className={`h-1.5 w-full ${bar}`} /><div className={`${line} w-4/5`} /><div className={`${line} w-3/5`} /></div>
    : <div className={`flex h-9 w-14 gap-1 rounded border border-stone-line bg-white p-1 ${art === 'right' ? 'flex-row-reverse' : ''}`}>
        <div className={`${bar} ${art === 'icons' ? 'w-1' : art === 'auto' ? 'w-1 opacity-60' : 'w-2.5'}`} />
        <div className="flex flex-1 flex-col gap-1 pt-0.5"><div className={`${line} w-full`} /><div className={`${line} w-2/3`} /></div>
      </div>;
  return (
    <button type="button" disabled={disabled} onClick={onClick} aria-pressed={active}
      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50 ${active ? 'border-forest bg-forest/[0.05] ring-1 ring-forest/40' : 'border-stone-line bg-white hover:border-forest/40'}`}>
      {pic}
      <span><span className="block text-sm font-medium text-charcoal">{title}</span><span className="text-xs text-charcoal-600/60">{hint}</span></span>
    </button>
  );
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
  const dropChild = (href: string, from: number, to: number) =>
    setItems((prev) => prev.map((it) => (it.href === href ? { ...it, children: moveItem(it.children, from, to) } : it)));
  const [cDrag, setCDrag] = useState<{ href: string; i: number } | null>(null);
  const [cOver, setCOver] = useState<number | null>(null);
  const toggleRole = (it: ResolvedNavItem, role: string) =>
    update(it.href, { hiddenRoles: it.hiddenRoles.includes(role) ? it.hiddenRoles.filter((r) => r !== role) : [...it.hiddenRoles, role] });

  const [dragI, setDragI] = useState<number | null>(null);
  const [overI, setOverI] = useState<number | null>(null);
  const [quickMsg, setQuickMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** Οι κάρτες αποθηκεύονται αμέσως (μόνο θέση/διάταξη — όχι οι αλλαγές στα στοιχεία του μενού). */
  function quick(p: { position?: MenuPosition; lay?: LayoutSettings }) {
    if (p.position) setPosition(p.position);
    if (p.lay) setLay(p.lay);
    setQuickMsg(null);
    start(async () => {
      const a = p.position ? await saveOrgSlice('menu', { ...menu, position: p.position }) : { ok: true as const };
      const b = a.ok && p.lay ? await saveOrgSlice('layout', p.lay) : a;
      if (a.ok && b.ok) {
        // Η δική σας προσωπική επιλογή (κουμπί πάνω αριστερά) δεν θα έκρυβε την αλλαγή.
        if (p.lay) document.cookie = 'oramira_sidebar=; path=/; max-age=0; samesite=lax';
        setQuickMsg({ ok: true, text: 'Εφαρμόστηκε.' }); router.refresh();
      } else setQuickMsg({ ok: false, text: (!a.ok ? a.error : !b.ok ? (b as any).error : '') || 'Αποτυχία αποθήκευσης.' });
    });
  }

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
      {/* Όπως στο demo: κάρτες για πλοήγηση και sidebar, σελίδα έναρξης, επαναφορά. Αποθηκεύονται αμέσως. */}
      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Πλοήγηση</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {NAV_CARDS.map((c) => (
            <LayoutCard key={c.value} title={c.label} hint={c.hint} active={position === c.value} disabled={disabled} art={c.value}
              onClick={() => quick({ position: c.value })} />
          ))}
        </div>
      </section>
      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Πλαϊνό μενού</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {SIDEBAR_CARDS.map((c) => (
            <LayoutCard key={c.value} title={c.label} hint={c.hint} active={lay.sidebarDefault === c.value} disabled={disabled || position === 'top'} art={c.value}
              onClick={() => quick({ lay: { ...lay, sidebarDefault: c.value, sidebarCompact: c.value === 'icons' } })} />
          ))}
        </div>
        {position === 'top' && <p className="text-xs text-charcoal-600/60">Με το μενού πάνω δεν υπάρχει πλαϊνό μενού.</p>}
      </section>
      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Σελίδα έναρξης</h3>
        <div className="panel space-y-4 p-5">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Πού μπαίνετε μετά τη σύνδεση</span>
            <select className="input" disabled={disabled} value={lay.startScreen} onChange={(e) => quick({ lay: { ...lay, startScreen: e.target.value } })}>
              {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </label>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-charcoal">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lay.denseLists} disabled={disabled} onChange={(e) => quick({ lay: { ...lay, denseLists: e.target.checked } })} />
              Πυκνές λίστες και πίνακες
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={lay.sidebarAccordion !== false} disabled={disabled || position === 'top'} onChange={(e) => quick({ lay: { ...lay, sidebarAccordion: e.target.checked } })} />
              Μία ενότητα ανοιχτή τη φορά στο μενού
            </label>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {quickMsg && <span className={`text-sm ${quickMsg.ok ? 'text-forest' : 'text-signal-danger'}`}>{quickMsg.text}</span>}
          {canEdit && <button type="button" className="btn-secondary text-sm" disabled={disabled} onClick={() => quick({ position: 'left', lay: { ...lay, sidebarDefault: 'full', sidebarCompact: false, startScreen: '/dashboard', denseLists: false, sidebarAccordion: true } })}>Επαναφορά προεπιλογών</button>}
        </div>
      </section>

      {/* Entries */}
      <div className="panel p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Στοιχεία μενού</p>
            <p className="text-xs text-charcoal-600/60">Σύρετε από τις τελίτσες ⋮⋮ για να αλλάξετε σειρά, αλλάξτε ονόματα και εικονίδια, κρύψτε ό,τι δεν χρειάζεστε. Πατήστε ▸ για υποενότητες και ρόλους.</p>
          </div>
        </div>
        <ul className="divide-y divide-stone-line">
          {items.map((it, i) => {
            const Icon = navIcon(it.icon);
            const expanded = open === it.href;
            return (
              <li key={it.href} draggable={!disabled}
                onDragStart={(e) => { if ((e.target as HTMLElement).closest('button,input,select')) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.href); setDragI(i); }}
                onDragOver={(e) => { if (dragI !== null) { e.preventDefault(); setOverI(i); } }}
                onDrop={(e) => { e.preventDefault(); if (dragI !== null && dragI !== i) { const n = [...items]; const [x] = n.splice(dragI, 1); n.splice(i, 0, x); setItems(n); setMsg(null); } setDragI(null); setOverI(null); }}
                onDragEnd={() => { setDragI(null); setOverI(null); }}
                className={`py-2 ${it.hidden ? 'opacity-55' : ''} ${overI === i && dragI !== i ? 'rounded-lg ring-2 ring-forest/30' : ''} ${dragI === i ? 'opacity-50' : ''}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-1 text-charcoal-600/40 ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`} title="Σύρετε για αλλαγή σειράς"><GripVertical size={16} /></span>
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
                          <li key={c.href} draggable={!disabled}
                            onDragStart={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('button,input,select')) { e.preventDefault(); return; } e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', c.href); setCDrag({ href: it.href, i: ci }); }}
                            onDragOver={(e) => { if (cDrag?.href === it.href) { e.preventDefault(); e.stopPropagation(); setCOver(ci); } }}
                            onDrop={(e) => { if (cDrag?.href !== it.href) return; e.preventDefault(); e.stopPropagation(); if (cDrag.i !== ci) { dropChild(it.href, cDrag.i, ci); setMsg(null); } setCDrag(null); setCOver(null); }}
                            onDragEnd={(e) => { e.stopPropagation(); setCDrag(null); setCOver(null); }}
                            className={`flex flex-wrap items-center gap-2 ${c.hidden ? 'opacity-55' : ''} ${cDrag?.href === it.href && cOver === ci && cDrag.i !== ci ? 'rounded-md ring-2 ring-forest/30' : ''} ${cDrag?.href === it.href && cDrag.i === ci ? 'opacity-50' : ''}`}>
                            <span className={`px-1 text-charcoal-600/40 ${disabled ? '' : 'cursor-grab active:cursor-grabbing'}`} title="Σύρετε για αλλαγή σειράς"><GripVertical size={14} /></span>
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
