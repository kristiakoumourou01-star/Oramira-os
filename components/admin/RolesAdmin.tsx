'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, RotateCcw, Lock, Users, Eye, Pencil, ShieldCheck, X } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PopSelect } from '@/components/ui/PopSelect';
import { saveCustomRole, deleteCustomRole, saveSystemRole } from '@/app/actions/roles';
import { assignRole } from '@/app/actions/users';
import { PermissionMatrix, PermissionRow } from '@/components/admin/PermissionMatrix';
import {
  CONFIGURABLE_MODULES, INTERNAL_ROLES, MODULE_ACTIONS, ROLE_LABEL, defaultPermissionsFor,
  type AppRole, type UserPermissions,
} from '@/lib/permissions';
import { BASE_TYPES, DEFAULT_RIGHTS, RIGHTS, SLUG_RE, SYSTEM_ROLE_HINT, roleIdFrom, type RightKey, type RolePerson, type RolesSettings } from '@/lib/roles-shared';


type Sel = { kind: 'system'; role: AppRole } | { kind: 'custom'; id: string } | { kind: 'new' };
interface Draft { name: string; slug: string; description: string; base: AppRole; permissions: UserPermissions; rights: RightKey[] }

const TOTAL_PERMS = CONFIGURABLE_MODULES.reduce((n, m) => n + MODULE_ACTIONS[m].length, 0);
const countPerms = (p: UserPermissions) => CONFIGURABLE_MODULES.reduce((n, m) => n + (p[m]?.length ?? 0), 0);
const choiceOf = (s: Sel) => (s.kind === 'system' ? s.role : s.kind === 'custom' ? `custom:${s.id}` : '');

/**
 * Staff → Ρόλοι (όπως στο FitnessCRM): κάρτες ρόλων με όνομα, slug, ένδειξη
 * «Σύστημα», περιγραφή και Προβολή / Επεξεργασία, και «Νέος ρόλος». Ο διάλογος
 * έχει Βασικά (όνομα, slug, περιγραφή) και Δικαιώματα ανά περιοχή με διακόπτες.
 * Ο Owner έχει πάντα όλα τα δικαιώματα και δεν αλλάζει.
 */
export function RolesAdmin({ roles, counts, people = [], migrationMissing }: { roles: RolesSettings; counts: Record<string, number>; people?: RolePerson[]; migrationMissing: boolean }) {
  const [open, setOpen] = useState<{ sel: Sel; edit: boolean } | null>(null);

  const systemPerms = (r: AppRole): UserPermissions => (r === 'admin' ? defaultPermissionsFor('admin') : roles.system[r]?.permissions ?? defaultPermissionsFor(r));
  const cards = [
    ...INTERNAL_ROLES.map((r) => ({ sel: { kind: 'system', role: r } as Sel, name: ROLE_LABEL[r], slug: r, system: true, hint: SYSTEM_ROLE_HINT[r], n: counts[r] ?? 0, perms: r === 'admin' ? TOTAL_PERMS : countPerms(systemPerms(r)), adjusted: !!roles.system[r] })),
    ...roles.custom.map((c) => ({ sel: { kind: 'custom', id: c.id } as Sel, name: c.name, slug: c.id, system: false, hint: c.description, n: counts[`custom:${c.id}`] ?? 0, perms: countPerms(c.permissions), adjusted: false })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold text-charcoal">Ρόλοι</h2>
          <p className="text-[14px] text-charcoal-600">Ομάδες δικαιωμάτων. Φτιάξτε έναν ρόλο, διαλέξτε τι βλέπει και τι κάνει, και δώστε τον στους ανθρώπους σας.</p>
        </div>
        <button type="button" onClick={() => setOpen({ sel: { kind: 'new' }, edit: true })} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-3.5 text-[14px] font-medium text-white hover:bg-forest/90">
          <Plus size={15} /> Νέος ρόλος
        </button>
      </div>
      {migrationMissing && (
        <p className="rounded-lg border border-stone-line bg-stone-50 px-4 py-2 text-[13px] text-charcoal-600">
          Για να δίνετε δικούς σας ρόλους σε ανθρώπους χρειάζεται μια μικρή αλλαγή στη βάση (migration 0054). Μπορείτε ήδη να φτιάχνετε ρόλους.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => {
          const owner = c.sel.kind === 'system' && c.sel.role === 'admin';
          return (
            <article key={choiceOf(c.sel)} className="flex flex-col rounded-[14px] border border-stone-line bg-white p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-forest/[0.09] text-forest">{owner ? <Lock size={18} /> : <ShieldCheck size={18} />}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate text-[16px] font-semibold text-charcoal" {...(c.system ? {} : { 'data-no-tr': true })}>{c.name}</span>
                    {c.system && <span className="rounded-full border border-stone-line px-2 py-0.5 text-[11px] font-medium text-charcoal-600">Σύστημα</span>}
                    {c.adjusted && <span className="rounded-full border border-forest/30 px-2 py-0.5 text-[11px] font-medium text-forest">Προσαρμοσμένος</span>}
                  </p>
                  <code className="text-[12px] text-charcoal-600/70" data-no-tr>{c.slug}</code>
                </div>
              </div>
              <p className="mt-2 line-clamp-2 min-h-[2.5em] text-[13.5px] text-charcoal-600" {...(c.system ? {} : { 'data-no-tr': true })}>{c.hint || '—'}</p>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-charcoal-600">
                <span className="inline-flex items-center gap-1"><Users size={13} /> <span className="tabular-nums">{c.n}</span> <span>άτομα</span></span>
                <span className="inline-flex items-center gap-1"><ShieldCheck size={13} /> <span className="tabular-nums">{c.perms}/{TOTAL_PERMS}</span> <span>δικαιώματα</span></span>
              </div>
              <div className="mt-3 flex gap-2 border-t border-stone-line pt-3">
                <button type="button" onClick={() => setOpen({ sel: c.sel, edit: false })} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Eye size={14} /> Προβολή</button>
                {!owner && <button type="button" onClick={() => setOpen({ sel: c.sel, edit: true })} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Pencil size={14} /> Επεξεργασία</button>}
              </div>
            </article>
          );
        })}
      </div>

      {open && <RoleDialog key={`${choiceOf(open.sel)}:${open.edit}`} sel={open.sel} startEdit={open.edit} roles={roles} people={people} onClose={() => setOpen(null)} onSwitch={(sel) => setOpen({ sel, edit: true })} />}
    </div>
  );
}

function RoleDialog({ sel, startEdit, roles, people, onClose, onSwitch }: { sel: Sel; startEdit: boolean; roles: RolesSettings; people: RolePerson[]; onClose: () => void; onSwitch: (s: Sel) => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const owner = sel.kind === 'system' && sel.role === 'admin';
  const [edit, setEdit] = useState(startEdit && !owner);
  const [draft, setDraft] = useState<Draft>(() => {
    if (sel.kind === 'custom') {
      const r = roles.custom.find((c) => c.id === sel.id)!;
      return { name: r.name, slug: r.id, description: r.description, base: r.base, permissions: r.permissions, rights: r.rights };
    }
    if (sel.kind === 'new') return { name: '', slug: '', description: '', base: 'sales', permissions: defaultPermissionsFor('sales'), rights: [] };
    const adj = roles.system[sel.role];
    return {
      name: ROLE_LABEL[sel.role], slug: sel.role, description: SYSTEM_ROLE_HINT[sel.role], base: sel.role,
      permissions: sel.role === 'admin' ? defaultPermissionsFor('admin') : adj?.permissions ?? defaultPermissionsFor(sel.role),
      rights: adj?.rights ?? DEFAULT_RIGHTS[sel.role],
    };
  });
  const [slugTouched, setSlugTouched] = useState(false);
  const patch = (p: Partial<Draft>) => { setDraft((d) => ({ ...d, ...p })); setMsg(null); };
  const ro = !edit || pending;
  const choice = choiceOf(sel);
  const holders = people.filter((p) => p.choice === choice);
  const others = people.filter((p) => p.choice !== choice && !p.self);

  const done = (res: { ok: boolean; error?: string }, text: string, after?: () => void) => {
    if (res.ok) { setMsg({ ok: true, text }); after?.(); router.refresh(); } else setMsg({ ok: false, text: res.error ?? 'Σφάλμα.' });
  };
  function save() {
    if (sel.kind !== 'system' && !draft.name.trim()) { setMsg({ ok: false, text: 'Δώστε όνομα στον ρόλο.' }); return; }
    start(async () => {
      if (sel.kind === 'system') {
        done(await saveSystemRole(sel.role, { permissions: draft.permissions, rights: draft.rights }), 'Αποθηκεύτηκε. Ισχύει για όλους με αυτόν τον ρόλο.');
      } else {
        const res = await saveCustomRole({ id: sel.kind === 'custom' ? sel.id : undefined, slug: sel.kind === 'new' ? draft.slug : undefined, name: draft.name, description: draft.description, base: draft.base, permissions: draft.permissions, rights: draft.rights });
        done(res, sel.kind === 'new' ? 'Ο ρόλος δημιουργήθηκε. Δώστε τον τώρα σε ανθρώπους.' : 'Αποθηκεύτηκε.', () => { if (res.ok && res.id && sel.kind === 'new') onSwitch({ kind: 'custom', id: res.id }); });
      }
    });
  }
  function remove() {
    if (sel.kind !== 'custom') return;
    if (!window.confirm(`Διαγραφή του ρόλου «${draft.name}»; Οι άνθρωποί του κρατούν τον βασικό τύπο (${ROLE_LABEL[draft.base]}).`)) return;
    start(async () => done(await deleteCustomRole(sel.id), 'Ο ρόλος διαγράφηκε.', onClose));
  }
  function reset() {
    if (sel.kind !== 'system') return;
    start(async () => done(await saveSystemRole(sel.role, null), 'Επαναφέρθηκε στα αρχικά.', () => patch({ permissions: defaultPermissionsFor(sel.role), rights: DEFAULT_RIGHTS[sel.role] })));
  }
  function assign(personId: string, to: string) {
    start(async () => {
      const res = await assignRole(personId, to);
      done(res, 'Ο ρόλος ανατέθηκε.');
    });
  }

  const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
  const title = sel.kind === 'new' ? 'Νέος ρόλος' : edit ? 'Επεξεργασία ρόλου' : 'Ρόλος';
  const baseOptions: [string, string][] = BASE_TYPES.map((b) => [b.value, b.label]);

  return (
    <Modal open onClose={onClose} size="xl" title={<span className="flex items-center gap-2"><span>{title}</span>{sel.kind !== 'new' && <span className="text-charcoal-600" {...(sel.kind === 'custom' ? { 'data-no-tr': true } : {})}>{draft.name}</span>}</span>}>
      <ModalBody className="space-y-5">
        {owner && (
          <p className="flex items-start gap-2 rounded-lg border border-forest/25 bg-forest/[0.05] px-3 py-2 text-[13px] text-charcoal"><Lock size={14} className="mt-0.5 shrink-0 text-forest" /> Ο κάτοχος του λογαριασμού έχει πάντα όλα τα δικαιώματα. Δεν αλλάζει και δεν μπορεί να κλειδωθεί έξω.</p>
        )}

        <section>
          <p className="mb-2 text-[15px] font-semibold text-charcoal">Βασικά</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className={lbl}>Όνομα</span>
              <input className="input text-sm" value={draft.name} disabled={ro || sel.kind === 'system'} placeholder="π.χ. Sales Manager, Λογιστήριο"
                onChange={(e) => patch({ name: e.target.value, ...(sel.kind === 'new' && !slugTouched ? { slug: roleIdFrom(e.target.value, []) } : {}) })} />
            </label>
            <label className="block"><span className={lbl}>Slug</span>
              <input className="input font-mono text-sm" value={draft.slug} disabled={ro || sel.kind !== 'new'} placeholder="sales-manager" data-no-tr
                onChange={(e) => { setSlugTouched(true); patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }); }} />
              {sel.kind === 'new' && draft.slug && !SLUG_RE.test(draft.slug) && <span className="mt-1 block text-[12px] text-signal-danger">2–40 λατινικά πεζά, αριθμοί ή παύλες.</span>}
            </label>
            <label className="block sm:col-span-2"><span className={lbl}>Περιγραφή</span>
              <textarea rows={2} className="input text-sm" value={draft.description} disabled={ro || sel.kind === 'system'} onChange={(e) => patch({ description: e.target.value })} />
            </label>
            {sel.kind !== 'system' && (
              <div className="sm:col-span-2">
                <span className={lbl}>Πρόσβαση στη βάση δεδομένων</span>
                {ro ? <p className="text-sm text-charcoal">{BASE_TYPES.find((b) => b.value === draft.base)?.label}</p>
                  : <PopSelect width="w-full sm:w-72" ariaLabel="Πρόσβαση στη βάση δεδομένων" value={draft.base} onChange={(v) => patch({ base: v as AppRole })} options={baseOptions} />}
                <p className="mt-1 text-[12.5px] text-charcoal-600">{BASE_TYPES.find((b) => b.value === draft.base)?.hint} <span>Τα δικαιώματα παρακάτω δεν μπορούν να δώσουν περισσότερα δεδομένα από αυτό.</span></p>
              </div>
            )}
          </div>
        </section>

        <section>
          <p className="mb-2 text-[15px] font-semibold text-charcoal">Δικαιώματα</p>
          <PermissionMatrix value={draft.permissions} onChange={(p) => patch({ permissions: p })} disabled={ro} readOnlyAll={owner} />
        </section>

        <section className="overflow-hidden rounded-xl border border-stone-line">
          <header className="border-b border-stone-line bg-stone-50/70 px-4 py-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-charcoal-600">Ειδικά δικαιώματα</header>
          <ul className="divide-y divide-stone-line/70">
            {RIGHTS.map((r) => (
              <PermissionRow key={r.key} p={{ key: `rights.${r.key}`, label: r.label, title: r.label, hint: r.hint }} disabled={ro || owner}
                on={owner || draft.rights.includes(r.key)} onChange={(v) => patch({ rights: v ? [...draft.rights, r.key] : draft.rights.filter((k) => k !== r.key) })} />
            ))}
          </ul>
        </section>

        {sel.kind !== 'new' && (
          <section>
            <p className="mb-2 flex items-center gap-2 text-[15px] font-semibold text-charcoal"><span>Ποιοι έχουν αυτόν τον ρόλο</span> <span className="tabular-nums text-charcoal-600">{holders.length}</span></p>
            <div className="flex flex-wrap items-center gap-2">
              {holders.length === 0 && <span className="text-[13px] text-charcoal-600">Κανένας ακόμη.</span>}
              {holders.map((p) => (
                <span key={p.id} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-stone-line px-3 text-[13px] text-charcoal">
                  <span data-no-tr>{p.name}</span>
                  {!owner && !p.self && sel.kind === 'custom' && (
                    <button type="button" disabled={pending} title="Αφαίρεση από τον ρόλο" aria-label="Αφαίρεση από τον ρόλο" onClick={() => assign(p.id, draft.base)} className="text-charcoal-600 hover:text-signal-danger"><X size={13} /></button>
                  )}
                </span>
              ))}
              {others.length > 0 && (
                <PopSelect searchable width="min-w-[200px]" ariaLabel="Ανάθεση σε" placeholder="+ Ανάθεση σε…" value="" onChange={(v) => {
                  if (!v) return;
                  if (owner && !window.confirm('Ο κάτοχος του λογαριασμού βλέπει και αλλάζει τα πάντα, μαζί με Staff και Ρυθμίσεις. Συνέχεια;')) return;
                  assign(v, choice);
                }} options={others.map((p) => [p.id, p.name] as [string, string])} />
              )}
            </div>
            <p className="mt-1.5 text-[12.5px] text-charcoal-600">Η ανάθεση γίνεται αμέσως. Αν κάποιος έχει δικά του δικαιώματα (Μέλη → Δικαιώματα), αυτά υπερισχύουν.</p>
          </section>
        )}
      </ModalBody>
      <ModalFooter className="flex-wrap items-center">
        {msg && <span className={`w-full text-[13px] sm:w-auto ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        {edit && sel.kind === 'custom' && <button type="button" disabled={pending} onClick={remove} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[14px] text-signal-danger hover:bg-signal-danger/10"><Trash2 size={14} /> Διαγραφή</button>}
        {edit && sel.kind === 'system' && roles.system[sel.role] && <button type="button" disabled={pending} onClick={reset} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[14px] text-charcoal-600 hover:bg-stone-100"><RotateCcw size={14} /> Επαναφορά</button>}
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[10px] border border-stone-line px-4 text-[14px] text-charcoal hover:border-forest/30">{edit ? 'Άκυρο' : 'Κλείσιμο'}</button>
          {edit ? (
            <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center rounded-[10px] bg-forest px-4 text-[14px] font-medium text-white hover:bg-forest/90 disabled:opacity-50">{pending ? 'Αποθήκευση…' : sel.kind === 'new' ? 'Δημιουργία ρόλου' : 'Αποθήκευση'}</button>
          ) : !owner && (
            <button type="button" onClick={() => setEdit(true)} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-4 text-[14px] font-medium text-white hover:bg-forest/90"><Pencil size={14} /> Επεξεργασία</button>
          )}
        </span>
      </ModalFooter>
    </Modal>
  );
}
