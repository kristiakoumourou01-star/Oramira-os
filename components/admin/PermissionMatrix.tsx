'use client';

import { Lock } from 'lucide-react';
import {
  MODULE_ACTIONS, MODULE_REQUIRES, PERMISSION_GROUPS, groupPermissions,
  type Action, type Module, type PermissionDef, type UserPermissions,
} from '@/lib/permissions';

/** On/off switch in the company colour. */
export function Switch({ on, onChange, disabled, label }: { on: boolean; onChange?: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange?.(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed ${on ? 'bg-forest' : 'bg-stone-line'} ${disabled ? 'opacity-60' : ''}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

/** One permission row: label, key, what it means, toggle. */
export function PermissionRow({ p, on, onChange, disabled }: { p: { key: string; title: React.ReactNode; label: string; hint: string }; on: boolean; onChange?: (v: boolean) => void; disabled?: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-[14px] font-medium text-charcoal">{p.title}</span>
          <code className="text-[11px] text-charcoal-600/70" data-no-tr>{p.key}</code>
        </span>
        {p.hint && <span className="block text-[12.5px] text-charcoal-600">{p.hint}</span>}
      </span>
      <Switch on={on} onChange={onChange} disabled={disabled} label={p.label} />
    </li>
  );
}

/**
 * The permission catalogue, grouped by area (as in Staff → Ρόλοι): a header
 * per area, then one row per permission with its key and a toggle. Turning on
 * any action also turns on "view"; turning "view" off clears the whole area.
 * Staff and Settings are shown locked: they stay with the Owner.
 */
export function PermissionMatrix({
  value,
  onChange,
  disabled = false,
  readOnlyAll = false,
}: {
  value: UserPermissions;
  onChange: (next: UserPermissions) => void;
  disabled?: boolean;
  /** Owner view: every toggle on and locked. */
  readOnlyAll?: boolean;
}) {
  const has = (m: Module, a: Action) => readOnlyAll || (value[m]?.includes(a) ?? false);

  function toggle(p: PermissionDef, on: boolean) {
    const next: UserPermissions = { ...value };
    const set = new Set(next[p.module] ?? []);
    if (on) { set.add(p.action); set.add('view'); }
    else if (p.action === 'view') set.clear();
    else set.delete(p.action);
    const ordered = MODULE_ACTIONS[p.module].filter((x) => set.has(x));
    if (ordered.length) next[p.module] = ordered; else delete next[p.module];
    // A sub-area needs its parent's "view" (e.g. Invoices live under Finance).
    const parent = MODULE_REQUIRES[p.module];
    if (on && parent && !next[parent]?.includes('view')) next[parent] = ['view', ...(next[parent] ?? [])];
    if (!on && p.action === 'view') {
      for (const [child, par] of Object.entries(MODULE_REQUIRES) as [Module, Module][]) if (par === p.module) delete next[child];
    }
    onChange(next);
  }

  function setGroup(mods: Module[], on: boolean) {
    const next: UserPermissions = { ...value };
    for (const m of mods) { if (on) next[m] = [...MODULE_ACTIONS[m]]; else delete next[m]; }
    if (on) for (const m of mods) { const par = MODULE_REQUIRES[m]; if (par && !next[par]?.includes('view')) next[par] = ['view', ...(next[par] ?? [])]; }
    onChange(next);
  }

  return (
    <div className="space-y-3">
      {PERMISSION_GROUPS.map((g) => {
        const perms = groupPermissions(g);
        const locked = g.locked && !readOnlyAll;
        const onCount = perms.filter((p) => (g.locked ? readOnlyAll : has(p.module, p.action))).length;
        return (
          <section key={g.id} className="overflow-hidden rounded-xl border border-stone-line bg-white">
            <header className="flex items-center gap-2 border-b border-stone-line bg-stone-50/70 px-4 py-2">
              <span className="text-[12px] font-semibold uppercase tracking-[0.08em] text-charcoal-600">{g.label}</span>
              <span className="text-[12px] tabular-nums text-charcoal-600/70">{onCount}/{perms.length}</span>
              {locked ? (
                <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-charcoal-600"><Lock size={12} /> {g.lockedNote}</span>
              ) : !readOnlyAll && !disabled && (
                <span className="ml-auto flex gap-1">
                  <button type="button" onClick={() => setGroup(g.modules, true)} className="rounded-md px-2 py-0.5 text-[12px] text-forest hover:bg-forest/[0.07]">Όλα</button>
                  <button type="button" onClick={() => setGroup(g.modules, false)} className="rounded-md px-2 py-0.5 text-[12px] text-charcoal-600 hover:bg-stone-100">Κανένα</button>
                </span>
              )}
            </header>
            <ul className="divide-y divide-stone-line/70">
              {perms.map((p) => (
                <PermissionRow key={p.key} p={{ key: p.key, label: p.actionLabel, hint: p.hint, title: <><span>{p.moduleLabel}</span> <span className="text-charcoal-600/60">·</span> <span>{p.actionLabel}</span></> }} on={g.locked ? readOnlyAll : has(p.module, p.action)}
                  disabled={disabled || readOnlyAll || !!g.locked} onChange={(v) => toggle(p, v)} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
