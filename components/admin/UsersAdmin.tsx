'use client';

import { EmployeesPanel } from '@/components/admin/EmployeesPanel';
import { PopSelect } from '@/components/ui/PopSelect';
import type { EmployeeHr } from '@/lib/staff-shared';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, Mail, Eye, KeyRound, ShieldCheck, Copy, RefreshCw, UserX, UserCheck, History, MoreHorizontal } from 'lucide-react';
import {
  inviteUser, assignRole, setUserActive, revokeInvite, inviteLink,
  createUserWithPassword, setUserPermissions, setUserPassword, getUserHistory,
} from '@/app/actions/users';
import { startImpersonation } from '@/app/actions/impersonation';
import { resetUserMfa } from '@/app/actions/mfa';
import { INTERNAL_ROLES, ROLE_LABEL, defaultPermissionsFor, type AppRole, type UserPermissions } from '@/lib/permissions';
import { PermissionMatrix } from '@/components/admin/PermissionMatrix';
import { DEFAULT_ROLES, resolveRole, type RolesSettings } from '@/lib/roles-shared';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

/** One dropdown for built-in roles and the company's own roles ("custom:<id>"). */
function RoleOptions({ roles }: { roles: RolesSettings }) {
  return (
    <>
      <optgroup label="Βασικοί ρόλοι">
        {INTERNAL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
      </optgroup>
      {roles.custom.length > 0 && (
        <optgroup label="Δικοί σας ρόλοι">
          {roles.custom.map((c) => <option key={c.id} value={`custom:${c.id}`}>{c.name}</option>)}
        </optgroup>
      )}
    </>
  );
}

/** The matrix a role choice ("sales" / "custom:<id>") gives, for the editor's starting point. */
function permsForChoice(choice: string, roles: RolesSettings): UserPermissions {
  if (choice.startsWith('custom:')) {
    const c = roles.custom.find((x) => `custom:${x.id}` === choice);
    return c ? c.permissions : {};
  }
  return resolveRole(choice, null, roles).permissions ?? defaultPermissionsFor(choice);
}
function roleChoiceLabel(choice: string, roles: RolesSettings): string {
  if (choice.startsWith('custom:')) return roles.custom.find((x) => `custom:${x.id}` === choice)?.name ?? 'Ρόλος';
  return ROLE_LABEL[choice as AppRole] ?? choice;
}

export interface AdminUser {
  id: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
  email?: string | null;
  /** null = follows the role's defaults. */
  permissions?: UserPermissions | null;
  mustChangePassword?: boolean;
  moduleAccess?: string[];
  /** Admin-defined role id, if any. */
  customRole?: string | null;
  hr?: EmployeeHr;
}
export interface AdminInvite { id: string; email: string; role: string; created_at: string }

const PORTAL_ROLE_LABEL: Record<string, string> = {
  buyer: 'Buyer',
  homeowner: 'Homeowner',
  investor: 'Investor',
  contractor: 'Contractor',
};

/** Readable temporary password: no look-alike characters. */
function generatePassword(length = 14): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint32Array(length + 2);
  crypto.getRandomValues(bytes);
  const body = Array.from(bytes.slice(0, length), (b) => chars[b % chars.length]).join('');
  // Always a digit and a symbol, so it passes the strictest password policy.
  return body + '23456789'[bytes[length] % 8] + '!#?@'[bytes[length + 1] % 4];
}

function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-forest-deep/40 p-3 sm:p-4" onClick={onClose}>
      {/* Το παράθυρο χωράει πάντα στην οθόνη: ο τίτλος μένει πάνω και το περιεχόμενο κυλάει μέσα του. */}
      <div onClick={(e) => e.stopPropagation()} className={`flex max-h-[calc(100dvh-1.5rem)] w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} flex-col overflow-hidden rounded-2xl bg-white shadow-overlay`}>
        <div className="flex shrink-0 items-center justify-between border-b border-stone-line px-5 py-4 sm:px-6">
          <h3 className="text-xl">{title}</h3>
          <button onClick={onClose} className="text-charcoal-600 hover:text-charcoal" aria-label="Κλείσιμο"><X size={18} strokeWidth={1.75} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return <p className="rounded-md bg-signal-danger/10 px-4 py-2 text-sm text-signal-danger">{text}</p>;
}

/** Create a user directly: name, email, password, role and exactly what they can access. */
function CreateUserModal({ onClose, onDone, roles }: { onClose: () => void; onDone: () => void; roles: RolesSettings }) {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(() => generatePassword());
  const [role, setRole] = useState<string>('sales');
  const [custom, setCustom] = useState(false);
  const [perms, setPerms] = useState<UserPermissions>(() => permsForChoice('sales', roles));
  const [mustChange, setMustChange] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  function changeRole(r: string) {
    setRole(r);
    if (!custom) setPerms(permsForChoice(r, roles));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createUserWithPassword({
        fullName,
        email,
        password,
        role,
        permissions: role !== 'admin' && custom ? perms : null,
        mustChangePassword: mustChange,
      });
      if (!res.ok) { setError(res.error); return; }
      setCreated({ email: email.trim().toLowerCase(), password });
      onDone();
    });
  }

  if (created) {
    const text = `Email: ${created.email}\nΚωδικός: ${created.password}`;
    return (
      <Modal title="Ο χρήστης δημιουργήθηκε" onClose={onClose}>
        <p className="mb-3 text-sm text-charcoal-600">
          Δώστε αυτά τα στοιχεία στον χρήστη. Ο κωδικός δεν θα ξαναφανεί.
          {mustChange && ' Στην πρώτη του είσοδο θα του ζητηθεί να βάλει δικό του κωδικό.'}
        </p>
        <pre className="mb-4 rounded-md bg-stone px-4 py-3 text-sm text-charcoal">{text}</pre>
        <div className="flex gap-2">
          <button onClick={() => navigator.clipboard?.writeText(text)} className="btn-ghost"><Copy size={14} strokeWidth={1.75} /> Αντιγραφή</button>
          <button onClick={onClose} className="btn-primary ml-auto">Τέλος</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Νέος χρήστης" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-1.5 block">Ονοματεπώνυμο</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" autoFocus />
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Email σύνδεσης</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Κωδικός</span>
            <div className="flex gap-2">
              <input value={password} onChange={(e) => setPassword(e.target.value)} className="input font-mono" />
              <button type="button" onClick={() => setPassword(generatePassword())} className="btn-ghost" title="Νέος τυχαίος κωδικός">
                <RefreshCw size={14} strokeWidth={1.75} />
              </button>
            </div>
          </label>
          <label className="block">
            <span className="eyebrow mb-1.5 block">Ρόλος</span>
            <select value={role} onChange={(e) => changeRole(e.target.value)} className="input">
              <RoleOptions roles={roles} />
            </select>
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm text-charcoal">
          <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
          Να αλλάξει τον κωδικό στην πρώτη είσοδο
        </label>

        {role === 'admin' ? (
          <p className="rounded-md bg-stone px-4 py-3 text-sm text-charcoal-600">Ο admin έχει πρόσβαση σε όλα.</p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" checked={!custom} onChange={() => { setCustom(false); setPerms(permsForChoice(role, roles)); }} />
                Δικαιώματα του ρόλου ({roleChoiceLabel(role, roles)})
              </label>
              <label className="flex items-center gap-2">
                <input type="radio" checked={custom} onChange={() => setCustom(true)} />
                Επιλέγω εγώ τι βλέπει
              </label>
            </div>
            <PermissionMatrix value={perms} onChange={(p) => { setCustom(true); setPerms(p); }} disabled={isPending} />
          </div>
        )}

        <ErrorLine text={error} />
        <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-2 border-t border-stone-line bg-white px-5 py-3 sm:-mx-6 sm:px-6">
          <button onClick={onClose} className="btn-ghost">Άκυρο</button>
          <button onClick={submit} disabled={isPending} className="btn-primary">
            {isPending ? 'Δημιουργία…' : 'Δημιουργία χρήστη'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Edit what an existing user can see and do. */
function PermissionsModal({ user, onClose, onDone, roles }: { user: AdminUser; onClose: () => void; onDone: () => void; roles: RolesSettings }) {
  const choice = user.customRole ? `custom:${user.customRole}` : user.role;
  const fromRole = resolveRole(user.role, user.customRole, roles).permissions;
  const roleDefaults = fromRole ?? defaultPermissionsFor(user.role, user.moduleAccess ?? []);
  const [custom, setCustom] = useState(!!user.permissions);
  const [perms, setPerms] = useState<UserPermissions>(user.permissions ?? roleDefaults);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setUserPermissions(user.id, custom ? perms : null);
      if (!res.ok) { setError(res.error); return; }
      onDone();
      onClose();
    });
  }

  return (
    <Modal title={`Δικαιώματα · ${user.full_name ?? 'Χρήστης'}`} onClose={onClose} wide>
      {user.role === 'admin' ? (
        <p className="text-sm text-charcoal-600">Ο admin έχει πρόσβαση σε όλα.</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={!custom} onChange={() => { setCustom(false); setPerms(roleDefaults); }} />
              Δικαιώματα του ρόλου ({roleChoiceLabel(choice, roles)})
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={custom} onChange={() => setCustom(true)} />
              Επιλέγω εγώ τι βλέπει
            </label>
          </div>
          <PermissionMatrix value={perms} onChange={(p) => { setCustom(true); setPerms(p); }} disabled={isPending} />
          <ErrorLine text={error} />
          <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-2 border-t border-stone-line bg-white px-5 py-3 sm:-mx-6 sm:px-6">
            <button onClick={onClose} className="btn-ghost">Άκυρο</button>
            <button onClick={save} disabled={isPending} className="btn-primary">{isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Admin sets a new temporary password for a user. */
function PasswordModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState(() => generatePassword());
  const [mustChange, setMustChange] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setUserPassword(user.id, password, mustChange);
      if (!res.ok) { setError(res.error); return; }
      setSaved(true);
      onDone();
    });
  }

  return (
    <Modal title={`Νέος κωδικός · ${user.full_name ?? 'Χρήστης'}`} onClose={onClose}>
      {saved ? (
        <div className="space-y-4">
          <p className="text-sm text-charcoal-600">Ο κωδικός άλλαξε. Δώστε τον στον χρήστη:</p>
          <pre className="rounded-md bg-stone px-4 py-3 text-sm text-charcoal">{password}</pre>
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard?.writeText(password)} className="btn-ghost"><Copy size={14} strokeWidth={1.75} /> Αντιγραφή</button>
            <button onClick={onClose} className="btn-primary ml-auto">Τέλος</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={password} onChange={(e) => setPassword(e.target.value)} className="input font-mono" />
            <button type="button" onClick={() => setPassword(generatePassword())} className="btn-ghost" title="Νέος τυχαίος κωδικός">
              <RefreshCw size={14} strokeWidth={1.75} />
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-charcoal">
            <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} />
            Να τον αλλάξει στην επόμενη είσοδο
          </label>
          <ErrorLine text={error} />
          <div className="sticky -bottom-5 -mx-5 -mb-5 flex justify-end gap-2 border-t border-stone-line bg-white px-5 py-3 sm:-mx-6 sm:px-6">
            <button onClick={onClose} className="btn-ghost">Άκυρο</button>
            <button onClick={save} disabled={isPending} className="btn-primary">{isPending ? 'Αποθήκευση…' : 'Ορισμός κωδικού'}</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function UsersAdmin({
  users,
  invites,
  currentUserId,
  portalUsers = [],
  canImpersonate = false,
  roles = DEFAULT_ROLES,
  mode = 'employees',
  canEditDocs = false,
}: {
  mode?: 'employees' | 'external';
  users: AdminUser[];
  invites: AdminInvite[];
  currentUserId: string;
  portalUsers?: AdminUser[];
  canImpersonate?: boolean;
  roles?: RolesSettings;
  canEditDocs?: boolean;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [permsFor, setPermsFor] = useState<AdminUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  const [isPending, startTransition] = useTransition();
  const [impErr, setImpErr] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState<{ id: string; text: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<AdminUser | null>(null);
  const [roleFor, setRoleFor] = useState<AdminUser | null>(null);
  const [extCat, setExtCat] = useState<string>('');
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => { await fn(); router.refresh(); });
  }

  // Start "view as": on success the server action redirects into the target's
  // surface; only an error returns here.
  function viewAs(id: string) {
    setImpErr(null);
    startTransition(async () => {
      const res = await startImpersonation(id);
      if (res && !res.ok) setImpErr(res.error);
    });
  }

  return (
    <div className="space-y-6">
      {impErr && <p className="rounded-md bg-signal-danger/10 px-4 py-2 text-sm text-signal-danger">{impErr}</p>}

      {/* Υπάλληλοι — πίνακας όπως οι Πελάτες */}
      {mode === 'employees' && (
        <EmployeesPanel
          canEdit canEditDocs={canEditDocs}
          msg={roleMsg ? <p className="text-[13px] text-forest">{roleMsg.text}</p> : null}
          rows={users.map((u) => ({ id: u.id, full_name: u.full_name, role: u.role, is_active: u.is_active, email: u.email, hr: u.hr, self: u.id === currentUserId, mustChangePassword: u.mustChangePassword,
            roleLabel: roleChoiceLabel(u.customRole && roles.custom.some((c) => c.id === u.customRole) ? `custom:${u.customRole}` : u.role, roles) }))}
          toolbar={<>
            <button type="button" onClick={() => setShowInvite(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-2.5 text-[13px] text-charcoal hover:border-forest/30"><Mail size={14} strokeWidth={1.75} /> Πρόσκληση</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-2.5 text-[14px] font-medium text-white hover:bg-forest/90"><UserPlus size={15} strokeWidth={1.75} /> Νέος υπάλληλος</button>
          </>}
          actions={(id) => {
            const u = users.find((x) => x.id === id)!;
            if (u.id === currentUserId) return null;
            return (
              <MoreMenu disabled={isPending} items={[
                { label: 'Αλλαγή ρόλου', icon: ShieldCheck, onClick: () => setRoleFor(u) },
                ...(u.role !== 'admin' ? [{ label: 'Δικαιώματα', icon: ShieldCheck, onClick: () => setPermsFor(u) }] : []),
                { label: 'Νέος κωδικός', icon: KeyRound, onClick: () => setPasswordFor(u) },
                { label: 'Μηδενισμός 2FA', icon: RefreshCw, onClick: () => { if (window.confirm('Μηδενισμός 2FA: σβήνεται η εφαρμογή επαλήθευσης και οι εμπιστευμένες συσκευές του. Στην επόμενη σύνδεση το ρυθμίζει ξανά. Συνέχεια;')) run(() => resetUserMfa(u.id)); } },
                ...(canImpersonate ? [{ label: 'Προβολή ως χρήστης', icon: Eye, onClick: () => viewAs(u.id) }] : []),
                { label: 'Ιστορικό ενεργειών', icon: History, onClick: () => setHistoryFor(u) },
                { label: u.is_active ? 'Απενεργοποίηση πρόσβασης' : 'Ενεργοποίηση πρόσβασης', icon: u.is_active ? UserX : UserCheck, danger: u.is_active,
                  onClick: () => { if (!u.is_active || window.confirm(`Απενεργοποίηση του χρήστη «${u.full_name ?? ''}»; Δεν θα μπορεί να συνδεθεί μέχρι να τον ενεργοποιήσετε ξανά.`)) run(() => setUserActive(u.id, !u.is_active)); } },
              ]} />
            );
          }}
        />
      )}

      {/* Portal & client accounts — read-only here, but impersonable so an
          admin can see exactly what a buyer/homeowner/investor/contractor sees. */}
      {mode === 'external' && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {[['', 'Όλοι'], ['homeowner', 'Ιδιοκτήτες'], ['buyer', 'Αγοραστές'], ['investor', 'Επενδυτές'], ['contractor', 'Συνεργάτες / εργολάβοι']].map(([k, l]) => (
              <button key={k} type="button" onClick={() => setExtCat(k)} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${extCat === k ? 'bg-forest text-white ring-forest' : 'bg-white text-charcoal-600 ring-stone-line hover:ring-forest/40'}`}>
                {l} <span className="opacity-70">{k ? portalUsers.filter((u) => u.role === k).length : portalUsers.length}</span>
              </button>
            ))}
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white">
            <table className="table-base w-full min-w-[640px]">
              <thead><tr><th>Όνομα</th><th>Κατηγορία</th><th>Κατάσταση</th><th className="text-right">Ενέργειες</th></tr></thead>
              <tbody>
                {portalUsers.filter((u) => !extCat || u.role === extCat).length === 0 && <tr><td colSpan={4} className="py-10 text-center text-sm text-charcoal-600/70">Κανένας λογαριασμός σε αυτή την κατηγορία.</td></tr>}
                {portalUsers.filter((u) => !extCat || u.role === extCat).map((u) => (
                  <tr key={u.id} className="hover:bg-stone/60">
                    <td><p className="font-medium text-charcoal">{u.full_name ?? 'Unnamed'}</p>{u.email && <p className="text-xs text-charcoal-600/60">{u.email}</p>}</td>
                    <td><span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${u.role === 'homeowner' ? 'bg-forest/[0.08] text-forest' : u.role === 'contractor' ? 'bg-amber-50 text-amber-800' : u.role === 'investor' ? 'bg-forest/[0.06] text-forest' : 'bg-forest/[0.06] text-forest'}`}>{PORTAL_ROLE_LABEL[u.role] ?? u.role}</span></td>
                    <td><span className={u.is_active ? 'badge-forest' : 'badge-neutral'}>{u.is_active ? 'Ενεργός' : 'Ανενεργός'}</span></td>
                    <td className="text-right">
                      <div className="flex justify-end gap-0.5">
                        {canImpersonate && <IconBtn label="Προβολή ως χρήστης" onClick={() => viewAs(u.id)} disabled={isPending}><Eye size={16} strokeWidth={1.75} /></IconBtn>}
                        <IconBtn label="Ιστορικό" onClick={() => setHistoryFor(u)} disabled={isPending}><History size={16} strokeWidth={1.75} /></IconBtn>
                        <IconBtn label={u.is_active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'} danger={u.is_active} disabled={isPending}
                          onClick={() => { if (!u.is_active || window.confirm(`Απενεργοποίηση του λογαριασμού «${u.full_name ?? ''}»;`)) run(() => setUserActive(u.id, !u.is_active)); }}>
                          {u.is_active ? <UserX size={16} strokeWidth={1.75} /> : <UserCheck size={16} strokeWidth={1.75} />}
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-charcoal-600/60">Οι λογαριασμοί ιδιοκτητών, αγοραστών, επενδυτών και συνεργατών δημιουργούνται από την καρτέλα του πελάτη (πρόσβαση στην πλατφόρμα τους).</p>
        </div>
      )}

      {/* Pending invites */}
      {mode === 'employees' && <div className="panel p-6">
        <h4 className="mb-4">Εκκρεμείς προσκλήσεις</h4>
        {invites.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">Δεν υπάρχουν εκκρεμείς προσκλήσεις.</p>
        ) : (
          <ul className="divide-y divide-stone-line">
            {invites.map((inv) => (
              <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail size={14} className="text-olive" strokeWidth={1.75} />
                  <span className="truncate text-sm text-charcoal" data-no-tr>{inv.email}</span>
                  <span className="badge-neutral capitalize">{ROLE_LABEL[inv.role as AppRole] ?? inv.role}</span>
                </div>
                <PendingInviteActions id={inv.id} onRevoke={() => run(() => revokeInvite(inv.id))} disabled={isPending} />
              </li>
            ))}
          </ul>
        )}
      </div>}

      {roleFor && (
        <Modal title={`Ρόλος · ${roleFor.full_name ?? ''}`} onClose={() => setRoleFor(null)}>
          <RoleMenu value={roleFor.customRole && roles.custom.some((c) => c.id === roleFor.customRole) ? `custom:${roleFor.customRole}` : roleFor.role} roles={roles} disabled={isPending} onPick={(v) => {
            const u = roleFor; setImpErr(null); setRoleMsg(null);
            startTransition(async () => {
              const res = await assignRole(u.id, v);
              if (!res.ok) setImpErr(res.error);
              else setRoleMsg({ id: u.id, text: `Ο ρόλος του/της «${u.full_name ?? ''}» άλλαξε σε «${roleChoiceLabel(v, roles)}».` });
              setRoleFor(null); router.refresh();
            });
          }} />
          <p className="mt-3 text-[13px] text-charcoal-600">Ο ρόλος ορίζει τι βλέπει και τι αλλάζει ο υπάλληλος. Για εξαιρέσεις χρησιμοποιήστε τα «Δικαιώματα».</p>
        </Modal>
      )}
      {historyFor && <HistoryDrawer user={historyFor} onClose={() => setHistoryFor(null)} />}
      {showCreate && <CreateUserModal roles={roles} onClose={() => setShowCreate(false)} onDone={() => router.refresh()} />}
      {permsFor && <PermissionsModal roles={roles} user={permsFor} onClose={() => setPermsFor(null)} onDone={() => router.refresh()} />}
      {passwordFor && <PasswordModal user={passwordFor} onClose={() => setPasswordFor(null)} onDone={() => router.refresh()} />}

      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onDone={() => router.refresh()} />}
    </div>
  );
}

/** Κουμπί-εικονίδιο· το όνομά του εμφανίζεται όταν περνά το ποντίκι. */
/** Αλλαγή ρόλου από τη γραμμή του πίνακα: μικρό αναδυόμενο μενού με ✓ στον τρέχοντα. */
function RoleMenu({ value, roles, disabled, onPick }: { value: string; roles: RolesSettings; disabled?: boolean; onPick: (v: string) => void }) {
  const opts: [string, string][] = [...INTERNAL_ROLES.map((r) => [r, ROLE_LABEL[r]] as [string, string]), ...roles.custom.map((c) => [`custom:${c.id}`, c.name] as [string, string])];
  return <span title="Ρόλος"><PopSelect ariaLabel="Ρόλος" width="w-full" value={value} onChange={(v) => { if (!disabled && v !== value) onPick(v); }} options={opts} /></span>;
}

/** Μενού «⋯» με τις ενέργειες λογαριασμού, για να μένει ο πίνακας καθαρός. */
function MoreMenu({ items, disabled }: { items: { label: string; icon: any; onClick: () => void; danger?: boolean }[]; disabled?: boolean }) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const open = !!pos;
  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const t = setTimeout(() => { document.addEventListener('click', close); window.addEventListener('scroll', close, true); window.addEventListener('resize', close); }, 0);
    return () => { clearTimeout(t); document.removeEventListener('click', close); window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [open]);
  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (pos) { setPos(null); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const h = items.length * 32 + 10;
    const top = r.bottom + 4 + h > window.innerHeight ? Math.max(8, r.top - 4 - h) : r.bottom + 4;
    setPos({ top, left: Math.max(8, Math.min(window.innerWidth - 232, r.right - 224)) });
  };
  return (
    <span className="relative">
      <button type="button" disabled={disabled} onClick={toggle} aria-label="Περισσότερες ενέργειες" title="Περισσότερες ενέργειες"
        className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-stone-100 hover:text-charcoal"><MoreHorizontal size={16} /></button>
      {pos && (
        <span style={{ top: pos.top, left: pos.left }} className="anim-pop fixed z-50 block w-56 rounded-lg bg-white p-1 text-left shadow-md ring-1 ring-charcoal/10">
          {items.map((it) => (
            <button key={it.label} type="button" onClick={() => { setPos(null); it.onClick(); }}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors hover:bg-stone-100 ${it.danger ? 'text-signal-danger' : 'text-charcoal'}`}>
              <it.icon size={14} /> {it.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-charcoal-600 transition-colors hover:bg-stone disabled:opacity-40 ${danger ? 'hover:text-signal-danger' : 'hover:text-forest'}`}>
      {children}
    </button>
  );
}


const ACT: Record<string, string> = { login: 'Σύνδεση', logout: 'Αποσύνδεση', login_failed: 'Αποτυχημένη σύνδεση', created: 'Δημιουργία', updated: 'Αλλαγή', deleted: 'Διαγραφή', status_changed: 'Αλλαγή σταδίου', assigned: 'Ανάθεση', reassigned: 'Ανάθεση', note_added: 'Σημείωση', completed: 'Ολοκλήρωση', document_uploaded: 'Ανέβασμα εγγράφου', impersonation_started: 'Προβολή ως χρήστης', impersonation_stopped: 'Τέλος προβολής' };
const ENT: Record<string, string> = { lead: 'Lead', deal: 'Deal', contact: 'Επαφή', auth: 'Λογαριασμός', profile: 'Προφίλ', unit: 'Μονάδα', project: 'Έργο', invoice: 'Τιμολόγιο', ticket: 'Αίτημα', task: 'Εργασία', land_parcel: 'Οικόπεδο' };

/** Ιστορικό ενεργειών χρήστη (πλαϊνό πάνελ). */
function HistoryDrawer({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [rows, setRows] = useState<{ id: string; at: string; action: string; entity: string; details: string }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { void getUserHistory(user.id).then((r) => (r.ok ? setRows(r.rows) : setErr(r.error))); }, [user.id]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-charcoal/30" onClick={onClose}>
      <aside className="flex h-full w-full max-w-md flex-col bg-white shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-stone-line px-5 py-4">
          <div><p className="text-[11px] font-semibold uppercase tracking-wide text-forest">Ιστορικό</p><h3 className="text-xl text-charcoal">{user.full_name ?? user.email ?? 'Χρήστης'}</h3></div>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600/60 hover:text-charcoal"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {err && <p className="text-sm text-signal-danger">{err}</p>}
          {!rows && !err && <p className="text-sm text-charcoal-600/60">Φόρτωση…</p>}
          {rows && rows.length === 0 && <p className="text-sm text-charcoal-600/60">Δεν υπάρχει ακόμη ιστορικό.</p>}
          {rows && rows.length > 0 && (
            <ol className="relative space-y-4 border-l-2 border-forest/15 pl-4">
              {rows.map((r) => (
                <li key={r.id} className="relative">
                  <span className={`absolute -left-[23px] top-1 h-3 w-3 rounded-full ring-2 ring-white ${r.action === 'login_failed' || r.action.includes('delet') ? 'bg-rose-500' : r.action === 'login' ? 'bg-forest' : 'bg-[rgb(var(--c-forest))]'}`} />
                  <p className="text-sm font-medium text-charcoal">{ACT[r.action] ?? r.action.replace(/_/g, ' ')} <span className="font-normal text-charcoal-600/60">· {ENT[r.entity] ?? r.entity}</span></p>
                  <p className="text-xs tabular-nums text-charcoal-600/70">{new Date(r.at).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' })}</p>
                  {r.details && <p className="text-xs text-charcoal-600/60" data-no-tr>{r.details}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}

/** Κουμπιά μιας εκκρεμούς πρόσκλησης: αντιγραφή link, νέα αποστολή, ακύρωση. */
function PendingInviteActions({ id, onRevoke, disabled }: { id: string; onRevoke: () => void; disabled: boolean }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-1">
      {msg && <span className="text-xs text-charcoal-600">{msg}</span>}
      <button type="button" disabled={busy || disabled} onClick={() => start(async () => { const r = await inviteLink(id); if (r.link) { await navigator.clipboard?.writeText(r.link); setMsg('Το link αντιγράφηκε'); } })} className="btn-ghost text-xs"><Copy size={13} /> Αντιγραφή link</button>
      <button type="button" disabled={busy || disabled} onClick={() => start(async () => { const r = await inviteLink(id, true); setMsg(r.emailSent ? 'Το email στάλθηκε ξανά' : 'Δεν στάλθηκε email· στείλτε το link'); if (!r.emailSent && r.link) await navigator.clipboard?.writeText(r.link).catch(() => {}); })} className="btn-ghost text-xs"><Mail size={13} /> Αποστολή ξανά</button>
      <button type="button" disabled={busy || disabled} onClick={onRevoke} className="btn-ghost text-xs text-signal-danger">Ακύρωση</button>
    </div>
  );
}

/** Πρόσκληση υπαλλήλου: όνομα + email (+ προαιρετικά στοιχεία). Του έρχεται email με link για να μπει στην ομάδα. */
function InviteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ link: string; emailSent: boolean; email: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();

  if (result) {
    const text = `Γεια σου${result.name ? ` ${result.name}` : ''}! Σε προσκαλούμε στην ομάδα της Oramira. Πάτησε εδώ για να ενεργοποιήσεις τον λογαριασμό σου: ${result.link}`;
    return (
      <Modal title={result.emailSent ? 'Η πρόσκληση στάλθηκε' : 'Η πρόσκληση δημιουργήθηκε'} onClose={onClose}>
        <p className="mb-3 text-sm text-charcoal-600">
          {result.emailSent
            ? <><span>Στάλθηκε email με το link στο</span> <strong data-no-tr>{result.email}</strong><span>. Μόλις το πατήσει, φτιάχνει κωδικό και μπαίνει στην ομάδα.</span></>
            : <><span>Δεν στάλθηκε αυτόματα email. Στείλτε το link στο</span> <strong data-no-tr>{result.email}</strong> <span>με ένα από τα κουμπιά.</span></>}
        </p>
        <input readOnly value={result.link} onFocus={(e) => e.target.select()} className="input mb-3 text-xs" data-no-tr />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(result.link); setCopied(true); }} className="btn-secondary text-sm"><Copy size={14} /> {copied ? 'Αντιγράφηκε ✓' : 'Αντιγραφή link'}</button>
          <a href={`mailto:${result.email}?subject=${encodeURIComponent('Πρόσκληση στην ομάδα Oramira')}&body=${encodeURIComponent(text)}`} className="btn-secondary text-sm"><Mail size={14} /> Άνοιγμα email</a>
          <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm">WhatsApp</a>
          <button type="button" onClick={onClose} className="btn-primary ml-auto text-sm">Τέλος</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Πρόσκληση υπαλλήλου" onClose={onClose}>
      <form
        action={(fd) => {
          const email = String(fd.get('email') ?? '').trim();
          const name = String(fd.get('fullName') ?? '').trim();
          if (!email) { setError('Συμπληρώστε το email.'); return; }
          setError(null);
          start(async () => {
            try {
              const r = await inviteUser({
                email,
                fullName: name || undefined,
                role: String(fd.get('role')) as AppRole,
                position: String(fd.get('position') || '') || undefined,
                workSchedule: String(fd.get('workSchedule') || '') || undefined,
                annualLeaveDays: Number(fd.get('annualLeave')) || undefined,
                sickLeaveDays: Number(fd.get('sickLeave')) || undefined,
                startDate: String(fd.get('startDate') || '') || undefined,
                agreedSalary: Number(fd.get('salary')) || undefined,
                salaryBasis: String(fd.get('salaryBasis') || '') || undefined,
                commissionPct: Number(fd.get('commission')) || undefined,
              });
              setResult({ link: r.link, emailSent: r.emailSent, email, name });
              onDone();
            } catch {
              setError('Η πρόσκληση δεν δημιουργήθηκε. Δοκιμάστε ξανά.');
            }
          });
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <label className="block"><span className="eyebrow mb-1.5 block">Ονοματεπώνυμο</span><input name="fullName" className="input" autoFocus /></label>
        <label className="block"><span className="eyebrow mb-1.5 block">Email</span><input name="email" type="email" required className="input" /></label>
        <label className="block"><span className="eyebrow mb-1.5 block">Ρόλος</span>
          <select name="role" defaultValue="sales" className="input">{INTERNAL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
        </label>
        <label className="block"><span className="eyebrow mb-1.5 block">Θέση</span><input name="position" placeholder="π.χ. Sales Manager" className="input" /></label>
        <button type="button" onClick={() => setMore((m) => !m)} className="text-left text-sm text-forest hover:underline sm:col-span-2">{more ? 'Λιγότερα στοιχεία' : '+ Περισσότερα στοιχεία (προαιρετικά)'}</button>
        <div className={`${more ? 'grid' : 'hidden'} grid-cols-1 gap-3 sm:col-span-2 sm:grid-cols-2`}>
          <label className="block"><span className="eyebrow mb-1.5 block">Ωράριο</span>
            <select name="workSchedule" defaultValue="5_day" className="input"><option value="5_day">5ήμερο</option><option value="6_day">6ήμερο</option></select>
          </label>
          <label className="block"><span className="eyebrow mb-1.5 block">Ημερομηνία έναρξης</span><input name="startDate" type="date" className="input" /></label>
          <label className="block"><span className="eyebrow mb-1.5 block">Άδεια (μέρες)</span><input name="annualLeave" type="number" className="input" /></label>
          <label className="block"><span className="eyebrow mb-1.5 block">Άδεια ασθενείας (μέρες)</span><input name="sickLeave" type="number" className="input" /></label>
          <label className="block"><span className="eyebrow mb-1.5 block">Μισθός (€/μήνα)</span><input name="salary" type="number" className="input" /></label>
          <label className="block"><span className="eyebrow mb-1.5 block">Βάση μισθού</span>
            <select name="salaryBasis" defaultValue="net" className="input"><option value="net">Καθαρός</option><option value="gross">Μικτός</option></select>
          </label>
          <label className="block sm:col-span-2"><span className="eyebrow mb-1.5 block">Προμήθεια % (πωλήσεις)</span><input name="commission" type="number" step="0.1" className="input" /></label>
        </div>
        {error && <p className="text-sm text-signal-danger sm:col-span-2">{error}</p>}
        <p className="text-xs text-charcoal-600 sm:col-span-2">Θα του σταλεί email με link. Πατώντας το, φτιάχνει τον κωδικό του και μπαίνει στην ομάδα.</p>
        <button type="submit" disabled={busy} className="btn-primary sm:col-span-2">{busy ? 'Αποστολή…' : 'Αποστολή πρόσκλησης'}</button>
      </form>
    </Modal>
  );
}
