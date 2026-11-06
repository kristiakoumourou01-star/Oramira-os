'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getOrgSettings } from '@/lib/org-settings';
import { passwordProblem } from '@/lib/security-shared';
import { logActivity } from '@/lib/activity';
import { queueNotificationEmail } from '@/lib/notifications';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { isInternalRole, sanitizePermissions, type AppRole, type UserPermissions } from '@/lib/permissions';

/**
 * Admin user management. Inviting staff reuses the same invite → accept_invite
 * chokepoint as the portals (migration 0006): accept_invite inserts the profile
 * with the invited role, so no self-registration exists for staff either.
 * Admin-only — the one place roles/access change.
 */
export async function inviteUser(params: {
  email: string;
  role: AppRole;
  fullName?: string;
  position?: string;
  workSchedule?: string;
  annualLeaveDays?: number;
  sickLeaveDays?: number;
  startDate?: string;
  agreedSalary?: number;
  salaryBasis?: string;
  commissionPct?: number;
}) {
  const profile = await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Onboarding config is applied to the new profile (+ seeds leave balances)
  // by accept_invite when the employee activates their account.
  const onboarding = {
    full_name: params.fullName ?? null,
    position: params.position ?? null,
    work_schedule: params.workSchedule ?? null,
    annual_leave_days: params.annualLeaveDays ?? null,
    sick_leave_days: params.sickLeaveDays ?? null,
    start_date: params.startDate ?? null,
    agreed_salary: params.agreedSalary ?? null,
    salary_basis: params.salaryBasis ?? null,
    commission_pct: params.commissionPct ?? null,
  };

  const { error } = await supabase.from('invites').insert({
    email: params.email,
    role: params.role,
    token,
    expires_at: expiresAt,
    invited_by: profile.id,
    onboarding: onboarding as any,
  });
  if (error) throw error;

  await queueNotificationEmail({
    triggerType: 'staff_invite',
    recipientEmail: params.email,
    subject: 'Your Oramira OS access is ready',
    body: `<p>You've been invited to Oramira OS as <strong>${params.role}</strong>. Set up your account: <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}">Activate access</a></p>`,
  });

  await logActivity({ entityType: 'invite', entityId: profile.id, action: 'user_invited', metadata: { email: params.email, role: params.role } });
  revalidatePath('/settings/users');
}

export interface VerificationContract {
  type?: string;
  title?: string;
  start_date?: string;
  expiry_date?: string;
  renewal_date?: string;
  probation_end_date?: string;
  storage_path?: string;
  bucket?: string;
}

/**
 * Employee Verification → invite. The master employee profile is configured in
 * full (identity, role, manual module access, employment, leave, benefits,
 * salary master, contracts) and stored on the invite. accept_invite applies the
 * whole profile when the employee activates — payroll/permissions/leave all
 * originate here, never re-entered later.
 */
export async function createEmployeeInvite(params: {
  // identity
  email: string; fullName: string; phone?: string; idPassport?: string; address?: string; emergencyContact?: string;
  // role & position
  role: AppRole; position?: string; department?: string;
  // manual access
  moduleAccess: string[];
  // employment
  startDate?: string; contractType?: string; contractStatus?: string; workSchedule?: string;
  // leave
  annualLeaveDays?: number; sickLeaveDays?: number; specialLeaveDays?: number; unpaidLeaveDays?: number;
  // benefits
  benefits?: Record<string, boolean>;
  // salary master
  agreedSalary?: number; salaryBasis?: string; salaryFrequency?: string; commissionPct?: number; bonusStructure?: string;
  // contracts captured during verification
  contracts?: VerificationContract[];
}) {
  const profile = await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const onboarding = {
    full_name: params.fullName ?? null,
    phone: params.phone ?? null,
    id_passport: params.idPassport ?? null,
    address: params.address ?? null,
    emergency_contact: params.emergencyContact ?? null,
    position: params.position ?? null,
    department: params.department ?? null,
    module_access: params.moduleAccess ?? [],
    start_date: params.startDate ?? null,
    work_schedule: params.workSchedule ?? null,
    annual_leave_days: params.annualLeaveDays ?? null,
    sick_leave_days: params.sickLeaveDays ?? null,
    special_leave_days: params.specialLeaveDays ?? null,
    unpaid_leave_days: params.unpaidLeaveDays ?? null,
    benefits: params.benefits ?? {},
    agreed_salary: params.agreedSalary ?? null,
    salary_basis: params.salaryBasis ?? 'gross',
    salary_frequency: params.salaryFrequency ?? null,
    commission_pct: params.commissionPct ?? null,
    bonus_structure: params.bonusStructure ?? null,
    contracts: (params.contracts ?? []).filter((c) => c.title || c.storage_path || c.start_date),
  };

  const { error } = await supabase.from('invites').insert({
    email: params.email,
    role: params.role,
    token,
    expires_at: expiresAt,
    invited_by: profile.id,
    onboarding: onboarding as any,
  });
  if (error) throw error;

  await queueNotificationEmail({
    triggerType: 'staff_invite',
    recipientEmail: params.email,
    subject: 'Your Oramira OS access is ready',
    body: `<p>Welcome to the team. Your account has been set up as <strong>${params.position ?? params.role}</strong>. Activate your access: <a href="${process.env.NEXT_PUBLIC_APP_URL}/invite/${token}">Activate account</a></p>`,
  });

  await logActivity({ entityType: 'invite', entityId: profile.id, action: 'employee_verified_invited', metadata: { email: params.email, role: params.role } });
  revalidatePath('/hr');
  revalidatePath('/settings/users');
}

export async function setUserRole(profileId: string, role: AppRole) {
  return assignRole(profileId, role);
}

/**
 * Assign a role from the Users list. `choice` is a built-in role ("sales") or
 * an admin-defined role ("custom:<id>"), which also sets the base role the
 * database uses for that user.
 */
export async function assignRole(profileId: string, choice: string): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  if (profileId === admin.id) return { ok: false, error: 'Δεν αλλάζετε τον δικό σας ρόλο.' };
  const resolved = await resolveChoice(choice);
  if (!resolved) return { ok: false, error: 'Μη έγκυρος ρόλος.' };
  const service = createSupabaseServiceRoleClient();
  const { error } = await service.from('profiles').update({ role: resolved.role } as any).eq('id', profileId);
  if (error) return { ok: false, error: error.message };
  // Separate write: the custom_role column (migration 0054) may not exist yet.
  const { error: e2 } = await service.from('profiles').update({ custom_role: resolved.customRole } as any).eq('id', profileId);
  if (e2 && resolved.customRole) return { ok: false, error: 'Οι δικοί σας ρόλοι χρειάζονται μια μικρή αλλαγή στη βάση (migration 0054).' };
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'role_changed', metadata: { role: resolved.role, customRole: resolved.customRole } });
  revalidatePath('/settings/users');
  return { ok: true };
}

async function resolveChoice(choice: string): Promise<{ role: AppRole; customRole: string | null } | null> {
  if (choice.startsWith('custom:')) {
    const id = choice.slice(7);
    const { roles } = await getOrgSettings();
    const r = roles.custom.find((c) => c.id === id);
    return r ? { role: r.base, customRole: r.id } : null;
  }
  return isInternalRole(choice) ? { role: choice, customRole: null } : null;
}

export async function setUserActive(profileId: string, isActive: boolean) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('profiles').update({ is_active: isActive }).eq('id', profileId);
  await logActivity({ entityType: 'profile', entityId: profileId, action: isActive ? 'activated' : 'deactivated' });
  revalidatePath('/settings/users');
}

export async function revokeInvite(inviteId: string) {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('invites').update({ status: 'revoked' }).eq('id', inviteId);
  revalidatePath('/settings/users');
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin-created accounts (no email invite)
//
// The admin types the person's name, email and a password, picks the role and
// exactly what they can see/do, and hands the details over themselves. The
// account is live immediately; on first sign-in the user is asked to replace
// the temporary password (profiles.must_change_password, migration 0053).
// Uses the service-role client (auth admin API) — admin-only, server-only.
// ─────────────────────────────────────────────────────────────────────────────

export type UserActionResult = { ok: true } | { ok: false; error: string };


function cleanEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function createUserWithPassword(params: {
  fullName: string;
  email: string;
  password: string;
  /** Built-in role or "custom:<id>". */
  role: string;
  /** null = follow the role's defaults. */
  permissions: UserPermissions | null;
  mustChangePassword: boolean;
}): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  const email = cleanEmail(params.email);
  const fullName = params.fullName.trim();

  if (!fullName) return { ok: false, error: 'Συμπληρώστε το όνομα.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Το email δεν είναι έγκυρο.' };
  const pwIssue = passwordProblem(params.password, (await getOrgSettings()).security);
  if (pwIssue) return { ok: false, error: pwIssue };
  const chosen = await resolveChoice(params.role);
  if (!chosen) return { ok: false, error: 'Μη έγκυρος ρόλος.' };

  const service = createSupabaseServiceRoleClient();
  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    password: params.password,
    email_confirm: true,
    user_metadata: { full_name: fullName, pw_changed_at: new Date().toISOString() },
  });
  if (authError || !created.user) {
    const msg = authError?.message ?? '';
    if (/already|registered|exists/i.test(msg)) return { ok: false, error: 'Υπάρχει ήδη λογαριασμός με αυτό το email.' };
    return { ok: false, error: `Ο λογαριασμός δεν δημιουργήθηκε: ${msg || 'άγνωστο σφάλμα'}` };
  }

  const { error: profileError } = await service.from('profiles').insert({
    id: created.user.id,
    role: chosen.role,
    full_name: fullName,
    is_active: true,
    permissions: params.permissions ? sanitizePermissions(params.permissions) : null,
    must_change_password: params.mustChangePassword,
  } as any);
  if (profileError) {
    // Never leave a login without a profile behind.
    await service.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: `Ο λογαριασμός δεν δημιουργήθηκε: ${profileError.message}` };
  }
  if (chosen.customRole) {
    await service.from('profiles').update({ custom_role: chosen.customRole } as any).eq('id', created.user.id);
  }

  await logActivity({
    entityType: 'profile',
    entityId: created.user.id,
    action: 'user_created_by_admin',
    metadata: { email, role: chosen.role, customRole: chosen.customRole, customPermissions: !!params.permissions, by: admin.id },
  });
  revalidatePath('/settings/users');
  return { ok: true };
}

/** Save a user's access matrix. null = back to the role's defaults. */
export async function setUserPermissions(profileId: string, permissions: UserPermissions | null): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  if (profileId === admin.id) return { ok: false, error: 'Τα δικαιώματα του admin δεν αλλάζουν.' };
  const service = createSupabaseServiceRoleClient();
  const value = permissions ? sanitizePermissions(permissions) : null;
  const { error } = await service.from('profiles').update({ permissions: value } as any).eq('id', profileId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'permissions_changed', metadata: { permissions: value } });
  revalidatePath('/settings/users');
  return { ok: true };
}

/** Admin sets a new (temporary) password for someone, e.g. when they forget it. */
export async function setUserPassword(profileId: string, password: string, mustChange = true): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  const pwIssue = passwordProblem(password, (await getOrgSettings()).security);
  if (pwIssue) return { ok: false, error: pwIssue };
  const service = createSupabaseServiceRoleClient();
  const { error } = await service.auth.admin.updateUserById(profileId, { password, user_metadata: { pw_changed_at: new Date().toISOString() } });
  if (error) return { ok: false, error: error.message };
  await service.from('profiles').update({ must_change_password: mustChange && profileId !== admin.id } as any).eq('id', profileId);
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'password_set_by_admin' });
  revalidatePath('/settings/users');
  return { ok: true };
}
