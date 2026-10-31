'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, RotateCcw, Lock, Users } from 'lucide-react';
import { saveCustomRole, deleteCustomRole, saveSystemRole } from '@/app/actions/roles';
import { PermissionMatrix } from '@/components/admin/PermissionMatrix';
import { INTERNAL_ROLES, ROLE_LABEL, defaultPermissionsFor, type AppRole, type UserPermissions } from '@/lib/permissions';
import { BASE_TYPES, DEFAULT_RIGHTS, RIGHTS, type RightKey, type RolesSettings } from '@/lib/roles-shared';

type Sel = { kind: 'system'; role: AppRole } | { kind: 'custom'; id: string } | { kind: 'new' };

interface Draft { name: string; description: string; base: AppRole; permissions: UserPermissions; rights: RightKey[] }

function RightsPicker({ value, onChange, disabled }: { value: RightKey[]; onChange: (v: RightKey[]) => void; disabled?: boolean }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {RIGHTS.map((r) => (
        <label key={r.key} className="flex items-start gap-2 rounded-lg border border-stone-line p-2.5 text-sm">
          <input type="checkbox" className="mt-0.5" disabled={disabled} checked={value.includes(r.key)}
            onChange={() => onChange(value.includes(r.key) ? value.filter((k) => k !== r.key) : [...value, r.key])} />
          <span><span className="block font-medium text-charcoal">{r.label}</span><span className="text-xs text-charcoal-600/60">{r.hint}</span></span>
        </label>
      ))}
    </div>
  );
}

/**
 * Roles & permissions: the built-in roles (adjustable, with reset) and the
 * company's own roles (create / edit / delete). Each role = what it sees and
 * does per area + special rights; custom roles also pick a base type, which is
 * what the database enforces (e.g. a sales-based role only ever sees its own leads).
 */
export function RolesAdmin({ roles, counts, migrationMissing }: { roles: RolesSettings; counts: Record<string, number>; migrationMissing: boolean }) {
  const [sel, setSel] = useState<Sel>({ kind: 'system', role: 'sales' });
  const [draft, setDraft] = useState<Draft>(() => draftFor({ kind: 'system', role: 'sales' }));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function draftFor(s: Sel): Draft {
    if (s.kind === 'custom') {
      const r = roles.custom.find((c) => c.id === s.id)!;
      return { name: r.name, description: r.description, base: r.base, permissions: r.permissions, rights: r.rights };
    }
    if (s.kind === 'new') return { name: '', description: '', base: 'sales', permissions: defaultPermissionsFor('sales'), rights: [] };
    const adj = roles.system[s.role];
    return {
      name: ROLE_LABEL[s.role], description: '', base: s.role,
      permissions: adj?.permissions ?? defaultPermissionsFor(s.role),
      rights: adj?.rights ?? DEFAULT_RIGHTS[s.role],
    };
  }
  const pick = (s: Sel) => { setSel(s); setDraft(draftFor(s)); setMsg(null); };
  const patch = (p: Partial<Draft>) => { setDraft((d) => ({ ...d, ...p })); setMsg(null); };
  const done = (res: { ok: boolean; error?: string }, text: string, after?: () => void) => {
    if (res.ok) { setMsg({ ok: true, text }); after?.(); router.refresh(); } else setMsg({ ok: false, text: res.error ?? 'Σφάλμα.' });
  };

  function save() {
    start(async () => {
      if (sel.kind === 'system') {
        done(await saveSystemRole(sel.role, { permissions: draft.permissions, rights: draft.rights }), 'Αποθηκεύτηκε. Ισχύει για όλους με αυτόν τον ρόλο.');
      } else {
        const res = await saveCustomRole({ id: sel.kind === 'custom' ? sel.id : undefined, ...draft });
        done(res, sel.kind === 'new' ? 'Ο ρόλος δημιουργήθηκε.' : 'Αποθηκεύτηκε.', () => { if (res.ok && res.id) setSel({ kind: 'custom', id: res.id }); });
      }
    });
  }
  function remove() {
    if (sel.kind !== 'custom') return;
    if (!window.confirm(`Διαγραφή του ρόλου «${draft.name}»; Οι χρήστες του θα κρατήσουν τον βασικό τύπο (${ROLE_LABEL[draft.base]}).`)) return;
    start(async () => done(await deleteCustomRole(sel.id), 'Ο ρόλος διαγράφηκε.', () => pick({ kind: 'system', role: 'sales' })));
  }
  function reset() {
    if (sel.kind !== 'system') return;
    start(async () => done(await saveSystemRole(sel.role, null), 'Επαναφέρθηκε στα αρχικά.', () => setDraft({ ...draft, permissions: defaultPermissionsFor(sel.role), rights: DEFAULT_RIGHTS[sel.role] })));
  }

  const isAdmin = sel.kind === 'system' && sel.role === 'admin';
  const RoleButton = ({ s, label, sub, active }: { s: Sel; label: string; sub: string; active: boolean }) => (
    <button type="button" onClick={() => pick(s)}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${active ? 'bg-forest/[0.07] font-medium text-forest' : 'text-charcoal-600 hover:bg-forest/5'}`}>
      <span className="truncate">{label}</span><span className="ml-2 shrink-0 text-xs text-charcoal-600/60">{sub}</span>
    </button>
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-forest">Ρόλοι & δικαιώματα</h2>
        <p className="text-sm text-charcoal-600/70">Τι βλέπει και τι κάνει κάθε ρόλος. Οι αλλαγές ισχύουν αμέσως για όλους όσοι έχουν τον ρόλο. Αν ένας χρήστης έχει δικά του δικαιώματα (Χρήστες → Δικαιώματα), αυτά υπερισχύουν.</p>
      </div>
      {migrationMissing && (
        <p className="rounded-md bg-champagne-50 px-4 py-2 text-sm text-champagne-600">
          Για να δίνετε δικούς σας ρόλους σε χρήστες χρειάζεται μια μικρή αλλαγή στη βάση (migration 0054). Μπορείτε ήδη να φτιάχνετε ρόλους και να ρυθμίζετε τους βασικούς.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="panel space-y-4 p-3 lg:self-start">
          <div>
            <p className="eyebrow mb-1.5 px-2">Βασικοί ρόλοι</p>
            {INTERNAL_ROLES.map((r) => (
              <RoleButton key={r} s={{ kind: 'system', role: r }} label={ROLE_LABEL[r] + (roles.system[r] ? ' ·' : '')} sub={`${counts[r] ?? 0}`} active={sel.kind === 'system' && sel.role === r} />
            ))}
          </div>
          <div>
            <p className="eyebrow mb-1.5 px-2">Δικοί σας ρόλοι</p>
            {roles.custom.length === 0 && <p className="px-3 py-1 text-xs text-charcoal-600/60">Κανένας ακόμα.</p>}
            {roles.custom.map((c) => (
              <RoleButton key={c.id} s={{ kind: 'custom', id: c.id }} label={c.name} sub={`${counts[`custom:${c.id}`] ?? 0}`} active={sel.kind === 'custom' && sel.id === c.id} />
            ))}
            <button type="button" onClick={() => pick({ kind: 'new' })} className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-forest hover:bg-forest/5">
              <Plus size={14} /> Νέος ρόλος
            </button>
          </div>
          <p className="flex items-center gap-1.5 px-2 text-[11px] text-charcoal-600/60"><Users size={11} /> = χρήστες με τον ρόλο · «·» = αλλαγμένος</p>
        </aside>

        <div className="panel space-y-5 p-5">
          {isAdmin ? (
            <p className="flex items-center gap-2 text-sm text-charcoal-600"><Lock size={14} /> Ο Admin έχει πάντα πρόσβαση σε όλα και δεν αλλάζει.</p>
          ) : (
            <>
              {sel.kind !== 'system' ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block"><span className="eyebrow mb-1.5 block">Όνομα ρόλου</span>
                    <input className="input" value={draft.name} placeholder="π.χ. Sales Manager, Λογιστήριο, Εργοταξιάρχης" onChange={(e) => patch({ name: e.target.value })} />
                  </label>
                  <label className="block"><span className="eyebrow mb-1.5 block">Περιγραφή (προαιρετικά)</span>
                    <input className="input" value={draft.description} onChange={(e) => patch({ description: e.target.value })} />
                  </label>
                  <div className="sm:col-span-2">
                    <p className="eyebrow mb-1.5">Βασικός τύπος (ασφάλεια δεδομένων)</p>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {BASE_TYPES.map((b) => (
                        <label key={b.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${draft.base === b.value ? 'border-forest bg-forest/[0.04]' : 'border-stone-line'}`}>
                          <input type="radio" className="mt-0.5" checked={draft.base === b.value} onChange={() => patch({ base: b.value })} />
                          <span><span className="block font-medium text-charcoal">{b.label}</span><span className="text-xs text-charcoal-600/60">{b.hint}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <h3 className="text-xl">{ROLE_LABEL[sel.role]}</h3>
                  <p className="text-xs text-charcoal-600/60">Βασικός ρόλος. Μπορείτε να αλλάξετε τι βλέπει και τι κάνει, και να επιστρέψετε στα αρχικά όποτε θέλετε.</p>
                </div>
              )}

              <div>
                <p className="eyebrow mb-1.5">Τι βλέπει και τι κάνει</p>
                <PermissionMatrix value={draft.permissions} onChange={(p) => patch({ permissions: p })} disabled={pending} />
              </div>
              <div>
                <p className="eyebrow mb-1.5">Ειδικά δικαιώματα</p>
                <RightsPicker value={draft.rights} onChange={(r) => patch({ rights: r })} disabled={pending} />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary" disabled={pending} onClick={save}>
                  {pending ? 'Αποθήκευση…' : sel.kind === 'new' ? 'Δημιουργία ρόλου' : 'Αποθήκευση'}
                </button>
                {sel.kind === 'system' && roles.system[sel.role] && (
                  <button type="button" className="btn-ghost" disabled={pending} onClick={reset}><RotateCcw size={14} /> Επαναφορά στα αρχικά</button>
                )}
                {sel.kind === 'custom' && (
                  <button type="button" className="btn-ghost text-signal-danger" disabled={pending} onClick={remove}><Trash2 size={14} /> Διαγραφή ρόλου</button>
                )}
                {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
