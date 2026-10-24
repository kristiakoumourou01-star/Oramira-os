'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { queueNotificationEmail } from '@/lib/notifications';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import type { AppRole } from '@/lib/permissions';

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
  await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  await supabase.from('profiles').update({ role }).eq('id', profileId);
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'role_changed', metadata: { role } });
  revalidatePath('/settings/users');
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
