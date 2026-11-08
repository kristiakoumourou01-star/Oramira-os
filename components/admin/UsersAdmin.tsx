'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, Mail, Eye, KeyRound, ShieldCheck, Copy, RefreshCw } from 'lucide-react';
import {
  inviteUser, assignRole, setUserActive, revokeInvite,
  createUserWithPassword, setUserPermissions, setUserPassword,
} from '@/app/actions/users';
import { startImpersonation } from '@/app/actions/impersonation';
import { resetUserMfa } from '@/app/actions/mfa';
import { INTERNAL_ROLES, ROLE_LABEL, defaultPermissionsFor, type AppRole, type UserPermissions } from '@/lib/permissions';
import { PermissionMatrix } from '@/components/admin/PermissionMatrix';
import { DEFAULT_ROLES, resolveRole, type RolesSettings } from '@/lib/roles-shared';

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
    <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-forest-deep/40 p-4">
      <div className={`my-8 w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} rounded-md bg-white p-6 shadow-overlay`}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl">{title}</h3>
          <button onClick={onClose} className="text-charcoal-600 hover:text-charcoal" aria-label="Κλείσιμο"><X size={18} strokeWidth={1.75} /></button>
        </div>
        {children}
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
        <div className="flex justify-end gap-2">
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
          <div className="flex justify-end gap-2">
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
          <div className="flex justify-end gap-2">
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
}: {
  users: AdminUser[];
  invites: AdminInvite[];
  currentUserId: string;
  portalUsers?: AdminUser[];
  canImpersonate?: boolean;
  roles?: RolesSettings;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [permsFor, setPermsFor] = useState<AdminUser | null>(null);
  const [passwordFor, setPasswordFor] = useState<AdminUser | null>(null);
  const [isPending, startTransition] = useTransition();
  const [impErr, setImpErr] = useState<string | null>(null);
  const [roleMsg, setRoleMsg] = useState<{ id: string; text: string } | null>(null);
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
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Admin</p>
          <h1 className="text-3xl">Users & roles</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowInvite(true)} className="btn-ghost">
            <Mail size={15} strokeWidth={1.75} /> Πρόσκληση με email
          </button>
          <button onClick={() => setShowCreate(true)} className="btn-primary">
            <UserPlus size={15} strokeWidth={1.75} /> Νέος χρήστης
          </button>
        </div>
      </div>

      {impErr && <p className="rounded-md bg-signal-danger/10 px-4 py-2 text-sm text-signal-danger">{impErr}</p>}

      {/* Users */}
      <div className="panel overflow-x-auto">
        <table className="table-base w-full min-w-[760px]">
          <thead><tr><th>Name</th><th>Role</th><th>Πρόσβαση</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id} className="hover:bg-stone/60">
                  <td>
                    <p className="font-medium text-charcoal">{u.full_name ?? 'Unnamed'}{self && <span className="ml-2 text-xs text-charcoal-600/50">(you)</span>}</p>
                    {u.email && <p className="text-xs text-charcoal-600/60">{u.email}</p>}
                    {u.mustChangePassword && <span className="badge-neutral mt-1 inline-block text-[11px]">Προσωρινός κωδικός</span>}
                  </td>
                  <td>
                    <select
                      value={u.customRole && roles.custom.some((c) => c.id === u.customRole) ? `custom:${u.customRole}` : u.role}
                      disabled={isPending || self}
                      onChange={(e) => {
                        const v = e.target.value;
                        const label = e.target.selectedOptions[0]?.text ?? v;
                        setImpErr(null); setRoleMsg(null);
                        startTransition(async () => {
                          const res = await assignRole(u.id, v);
                          if (!res.ok) setImpErr(res.error);
                          else setRoleMsg({ id: u.id, text: `Ο ρόλος άλλαξε σε «${label}».` });
                          router.refresh();
                        });
                      }}
                      className="input w-48 min-w-[11rem] text-sm"
                    >
                      <RoleOptions roles={roles} />
                    </select>
                    {roleMsg?.id === u.id && <p className="mt-1 text-[11px] text-forest">{roleMsg.text}</p>}
                  </td>
                  <td>
                    {u.role === 'admin'
                      ? <span className="badge-neutral">Όλα</span>
                      : u.permissions
                        ? <span className="badge-champagne whitespace-nowrap">Προσαρμοσμένα</span>
                        : <span className="badge-neutral whitespace-nowrap">Του ρόλου</span>}
                  </td>
                  <td>
                    <span className={u.is_active ? 'badge-forest' : 'badge-neutral'}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="text-right">
                    {!self && (
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {u.role !== 'admin' && (
                          <button onClick={() => setPermsFor(u)} disabled={isPending} className="btn-ghost text-xs" title="Τι βλέπει και τι κάνει">
                            <ShieldCheck size={13} strokeWidth={1.75} /> Δικαιώματα
                          </button>
                        )}
                        <button onClick={() => setPasswordFor(u)} disabled={isPending} className="btn-ghost text-xs" title="Νέος κωδικός">
                          <KeyRound size={13} strokeWidth={1.75} /> Κωδικός
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Μηδενισμός 2FA: σβήνεται η εφαρμογή επαλήθευσης και οι εμπιστευμένες συσκευές του. Στην επόμενη σύνδεση το ρυθμίζει ξανά. Συνέχεια;')) run(() => resetUserMfa(u.id)); }}
                          disabled={isPending} className="btn-ghost text-xs" title="Έχασε το κινητό; Μηδενισμός κωδικού μίας χρήσης"
                        >
                          <RefreshCw size={13} strokeWidth={1.75} /> 2FA
                        </button>
                        {canImpersonate && (
                          <button onClick={() => viewAs(u.id)} disabled={isPending} className="btn-ghost text-xs" title="Προβολή ως αυτός ο χρήστης">
                            <Eye size={13} strokeWidth={1.75} /> View as
                          </button>
                        )}
                        <button onClick={() => run(() => setUserActive(u.id, !u.is_active))} disabled={isPending} className="btn-ghost text-xs">
                          {u.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Portal & client accounts — read-only here, but impersonable so an
          admin can see exactly what a buyer/homeowner/investor/contractor sees. */}
      {canImpersonate && portalUsers.length > 0 && (
        <div className="panel overflow-hidden">
          <div className="flex items-center gap-2 px-4 pt-4">
            <h4>Portal & client accounts</h4>
            <span className="badge-neutral">{portalUsers.length}</span>
          </div>
          <table className="table-base mt-2 w-full">
            <thead><tr><th>Name</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {portalUsers.map((u) => (
                <tr key={u.id} className="hover:bg-stone/60">
                  <td className="font-medium text-charcoal">{u.full_name ?? 'Unnamed'}</td>
                  <td><span className="badge-neutral">{PORTAL_ROLE_LABEL[u.role] ?? u.role}</span></td>
                  <td><span className={u.is_active ? 'badge-forest' : 'badge-neutral'}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td className="text-right">
                    <button onClick={() => viewAs(u.id)} disabled={isPending} className="btn-ghost text-xs" title="Προβολή ως αυτός ο χρήστης">
                      <Eye size={13} strokeWidth={1.75} /> View as
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pending invites */}
      <div className="panel p-6">
        <h4 className="mb-4">Pending invites</h4>
        {invites.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No pending invites.</p>
        ) : (
          <ul className="divide-y divide-stone-line">
            {invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <Mail size={14} className="text-olive" strokeWidth={1.75} />
                  <span className="text-sm text-charcoal">{inv.email}</span>
                  <span className="badge-neutral capitalize">{ROLE_LABEL[inv.role as AppRole] ?? inv.role}</span>
                </div>
                <button onClick={() => run(() => revokeInvite(inv.id))} disabled={isPending} className="btn-ghost text-xs text-signal-danger">Revoke</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showCreate && <CreateUserModal roles={roles} onClose={() => setShowCreate(false)} onDone={() => router.refresh()} />}
      {permsFor && <PermissionsModal roles={roles} user={permsFor} onClose={() => setPermsFor(null)} onDone={() => router.refresh()} />}
      {passwordFor && <PasswordModal user={passwordFor} onClose={() => setPasswordFor(null)} onDone={() => router.refresh()} />}

      {showInvite && (
        <div className="fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-forest-deep/40 p-4">
          <div className="my-8 w-full max-w-lg rounded-md bg-white p-6 shadow-overlay">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl">Invite employee</h3>
              <button onClick={() => setShowInvite(false)} className="text-charcoal-600 hover:text-charcoal"><X size={18} strokeWidth={1.75} /></button>
            </div>
            <form
              action={(fd) => {
                const email = String(fd.get('email'));
                if (!email.trim()) return;
                run(() => inviteUser({
                  email,
                  fullName: String(fd.get('fullName') || '') || undefined,
                  role: String(fd.get('role')) as AppRole,
                  position: String(fd.get('position') || '') || undefined,
                  workSchedule: String(fd.get('workSchedule') || '') || undefined,
                  annualLeaveDays: Number(fd.get('annualLeave')) || undefined,
                  sickLeaveDays: Number(fd.get('sickLeave')) || undefined,
                  startDate: String(fd.get('startDate') || '') || undefined,
                  agreedSalary: Number(fd.get('salary')) || undefined,
                  salaryBasis: String(fd.get('salaryBasis') || '') || undefined,
                  commissionPct: Number(fd.get('commission')) || undefined,
                }));
                setShowInvite(false);
              }}
              className="grid grid-cols-2 gap-3"
            >
              <input name="fullName" placeholder="Full name" className="input" autoFocus />
              <input name="email" type="email" required placeholder="Email" className="input" />
              <select name="role" defaultValue="sales" className="input capitalize">
                {INTERNAL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
              <input name="position" placeholder="Position (e.g. Sales Manager)" className="input" />
              <select name="workSchedule" defaultValue="5_day" className="input">
                <option value="5_day">5-day week</option>
                <option value="6_day">6-day week</option>
              </select>
              <input name="startDate" type="date" className="input" />
              <input name="annualLeave" type="number" placeholder="Annual leave (days)" className="input" />
              <input name="sickLeave" type="number" placeholder="Sick leave (days)" className="input" />
              <input name="salary" type="number" placeholder="Salary (€/month)" className="input" />
              <select name="salaryBasis" defaultValue="net" className="input">
                <option value="net">Net agreed</option>
                <option value="gross">Gross</option>
              </select>
              <input name="commission" type="number" step="0.1" placeholder="Commission % (sales)" className="input col-span-2" />
              <button type="submit" disabled={isPending} className="btn-primary col-span-2">Send invite</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
