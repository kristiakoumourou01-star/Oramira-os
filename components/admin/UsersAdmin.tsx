'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, X, Mail, Eye } from 'lucide-react';
import { inviteUser, setUserRole, setUserActive, revokeInvite } from '@/app/actions/users';
import { startImpersonation } from '@/app/actions/impersonation';
import { INTERNAL_ROLES, ROLE_LABEL, type AppRole } from '@/lib/permissions';

export interface AdminUser { id: string; full_name: string | null; role: string; is_active: boolean }
export interface AdminInvite { id: string; email: string; role: string; created_at: string }

const PORTAL_ROLE_LABEL: Record<string, string> = {
  buyer: 'Buyer',
  homeowner: 'Homeowner',
  investor: 'Investor',
  contractor: 'Contractor',
};

export function UsersAdmin({
  users,
  invites,
  currentUserId,
  portalUsers = [],
  canImpersonate = false,
}: {
  users: AdminUser[];
  invites: AdminInvite[];
  currentUserId: string;
  portalUsers?: AdminUser[];
  canImpersonate?: boolean;
}) {
  const [showInvite, setShowInvite] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [impErr, setImpErr] = useState<string | null>(null);
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
        <button onClick={() => setShowInvite(true)} className="btn-primary">
          <UserPlus size={15} strokeWidth={1.75} /> Invite user
        </button>
      </div>

      {impErr && <p className="rounded-md bg-signal-danger/10 px-4 py-2 text-sm text-signal-danger">{impErr}</p>}

      {/* Users */}
      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead><tr><th>Name</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === currentUserId;
              return (
                <tr key={u.id} className="hover:bg-stone/60">
                  <td className="font-medium text-charcoal">{u.full_name ?? 'Unnamed'}{self && <span className="ml-2 text-xs text-charcoal-600/50">(you)</span>}</td>
                  <td>
                    <select
                      value={u.role}
                      disabled={isPending || self}
                      onChange={(e) => run(() => setUserRole(u.id, e.target.value as AppRole))}
                      className="input max-w-[180px] capitalize"
                    >
                      {INTERNAL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={u.is_active ? 'badge-forest' : 'badge-neutral'}>{u.is_active ? 'Active' : 'Inactive'}</span>
                  </td>
                  <td className="text-right">
                    {!self && (
                      <div className="flex items-center justify-end gap-1">
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
