'use server';

import { headers } from 'next/headers';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { passwordProblem } from '@/lib/security-shared';
import { logActivity } from '@/lib/activity';
import { queueNotificationEmail } from '@/lib/notifications';
import { randomBytes } from 'crypto';
import { revalidatePath } from 'next/cache';
import { isInternalRole, sanitizePermissions, storedPermissions, type AppRole, type UserPermissions } from '@/lib/permissions';

/**
 * Admin user management. Inviting staff reuses the same invite → accept_invite
 * chokepoint as the portals (migration 0006): accept_invite inserts the profile
 * with the invited role, so no self-registration exists for staff either.
 * Admin-only — the one place roles/access change.
 */
/** Η βάση των link: η διεύθυνση από την οποία δουλεύει ο admin (vercel.app ή app.oramiraltd.com). */
async function appBase(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get('x-forwarded-host') ?? h.get('host');
    if (host) return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`;
  } catch { /* fall back */ }
  return process.env.NEXT_PUBLIC_APP_URL ?? '';
}

/** Email πρόσκλησης (ελληνικά + αγγλικά) με κουμπί ενεργοποίησης. */
function inviteEmailHtml(name: string | undefined, link: string): string {
  const btn = `<a href="${link}" style="display:inline-block;background:#2f4a3f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:10px;font-weight:600">`;
  return `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2a24;line-height:1.55;max-width:520px">
<p>Γεια σου${name ? ` ${name}` : ''},</p>
<p>Σε προσκαλούμε στην ομάδα της <strong>Oramira</strong>. Πάτησε το κουμπί για να φτιάξεις τον κωδικό σου και να μπεις στο σύστημα:</p>
<p>${btn}Ενεργοποίηση λογαριασμού</a></p>
<hr style="border:none;border-top:1px solid #e5e2da;margin:22px 0">
<p>Hi${name ? ` ${name}` : ''}, you have been invited to join the <strong>Oramira</strong> team. Click the button to set your password and sign in:</p>
<p>${btn}Activate account</a></p>
<p style="font-size:12px;color:#7a807c">Το link ισχύει 7 μέρες. / The link is valid for 7 days.<br>${link}</p>
</div>`;
}

export async function inviteUser(params: {
  email: string;
  /** Βασικός ρόλος ή «custom:<id>» (ρόλος από Staff → Ρόλοι). */
  role: string;
  fullName?: string;
  position?: string;
  department?: string;
  phone?: string;
  dateOfBirth?: string;
  calendarColor?: string;
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
  const chosen = await resolveChoice(params.role);
  if (!chosen) throw new Error('Μη έγκυρος ρόλος.');

  const token = randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Onboarding config is applied to the new profile (+ seeds leave balances)
  // by accept_invite when the employee activates their account.
  // custom_role / date_of_birth / calendar_color: migration 0106.
  const onboarding = {
    full_name: params.fullName ?? null,
    position: params.position ?? null,
    department: params.department ?? null,
    phone: params.phone ?? null,
    date_of_birth: params.dateOfBirth ?? null,
    calendar_color: params.calendarColor ?? null,
    custom_role: chosen.customRole,
    salary_frequency: params.agreedSalary ? 'monthly' : null,
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
    role: chosen.role,
    token,
    expires_at: expiresAt,
    invited_by: profile.id,
    onboarding: onboarding as any,
  });
  if (error) throw error;

  const link = `${await appBase()}/invite/${token}`;
  const emailSent = await queueNotificationEmail({
    triggerType: 'staff_invite',
    recipientEmail: params.email,
    subject: 'Πρόσκληση στην ομάδα Oramira / Invitation to the Oramira team',
    body: inviteEmailHtml(params.fullName, link),
    senderProfileId: profile.id,
  });

  await logActivity({ entityType: 'invite', entityId: profile.id, action: 'user_invited', metadata: { email: params.email, role: chosen.role, customRole: chosen.customRole, emailSent } });
  revalidatePath('/settings/users');
  return { link, emailSent };
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

  const link = `${await appBase()}/invite/${token}`;
  const emailSent = await queueNotificationEmail({
    triggerType: 'staff_invite',
    recipientEmail: params.email,
    subject: 'Πρόσκληση στην ομάδα Oramira / Invitation to the Oramira team',
    body: inviteEmailHtml(params.fullName, link),
    senderProfileId: profile.id,
  });

  await logActivity({ entityType: 'invite', entityId: profile.id, action: 'employee_verified_invited', metadata: { email: params.email, role: params.role, emailSent } });
  revalidatePath('/hr');
  revalidatePath('/settings/users');
  return { link, emailSent };
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
    const { roles } = await getOrgSettingsRaw();
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

/** Το link μιας εκκρεμούς πρόσκλησης (για αντιγραφή) — και, με send, ξαναστέλνει το email. */
export async function inviteLink(inviteId: string, send = false): Promise<{ link: string | null; emailSent: boolean }> {
  const profile = await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  const { data: inv } = await supabase.from('invites').select('email, token, onboarding').eq('id', inviteId).maybeSingle();
  if (!inv?.token) return { link: null, emailSent: false };
  const link = `${await appBase()}/invite/${inv.token}`;
  if (!send) return { link, emailSent: false };
  const name = ((inv as any).onboarding?.full_name as string | undefined) ?? undefined;
  const emailSent = await queueNotificationEmail({
    triggerType: 'staff_invite', recipientEmail: inv.email,
    subject: 'Πρόσκληση στην ομάδα Oramira / Invitation to the Oramira team',
    body: inviteEmailHtml(name, link), senderProfileId: profile.id,
  });
  return { link, emailSent };
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

/** Στοιχεία υπαλλήλου από το «Νέο μέλος ομάδας». */
export interface StaffDetails {
  phone?: string; dateOfBirth?: string; startDate?: string; position?: string; department?: string;
  calendarColor?: string; agreedSalary?: number; commissionPct?: number;
}

/** Γράφει τα στοιχεία HR στο προφίλ. Το χρώμα ημερολογίου ξεχωριστά: η στήλη έρχεται με το migration 0106. */
async function saveStaffDetails(service: ReturnType<typeof createSupabaseServiceRoleClient>, id: string, d: StaffDetails) {
  const row: Record<string, unknown> = {};
  if (d.phone) row.phone = d.phone;
  if (d.dateOfBirth) row.date_of_birth = d.dateOfBirth;
  if (d.startDate) row.employment_start_date = d.startDate;
  if (d.position) row.job_title = d.position;
  if (d.department) row.department = d.department;
  if (d.agreedSalary != null) { row.agreed_salary = d.agreedSalary; row.salary_frequency = 'monthly'; }
  if (d.commissionPct != null) row.commission_pct = d.commissionPct;
  if (Object.keys(row).length) await service.from('profiles').update(row as any).eq('id', id);
  if (d.calendarColor) await service.from('profiles').update({ calendar_color: d.calendarColor } as any).eq('id', id);
}


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
  /** false = μέλος της ομάδας χωρίς σύνδεση (ο λογαριασμός μένει κλειδωμένος). */
  canLogin?: boolean;
  /** Στοιχεία υπαλλήλου (νέο μέλος ομάδας). */
  details?: StaffDetails;
}): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  const email = cleanEmail(params.email);
  const fullName = params.fullName.trim();

  if (!fullName) return { ok: false, error: 'Συμπληρώστε το όνομα.' };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: 'Το email δεν είναι έγκυρο.' };
  const canLogin = params.canLogin !== false;
  // Χωρίς σύνδεση: τυχαίος κωδικός που δεν εμφανίζεται πουθενά.
  const password = canLogin ? params.password : randomBytes(24).toString('base64url') + 'aA1!';
  const pwIssue = canLogin ? passwordProblem(password, (await getOrgSettingsRaw()).security) : null;
  if (pwIssue) return { ok: false, error: pwIssue };
  const chosen = await resolveChoice(params.role);
  if (!chosen) return { ok: false, error: 'Μη έγκυρος ρόλος.' };

  const service = createSupabaseServiceRoleClient();
  const { data: created, error: authError } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, pw_changed_at: new Date().toISOString() },
    ...(canLogin ? {} : { ban_duration: '876000h' }),
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
    permissions: params.permissions ? storedPermissions(sanitizePermissions(params.permissions, false)) : null,
    must_change_password: canLogin && params.mustChangePassword,
  } as any);
  if (profileError) {
    // Never leave a login without a profile behind.
    await service.auth.admin.deleteUser(created.user.id);
    return { ok: false, error: `Ο λογαριασμός δεν δημιουργήθηκε: ${profileError.message}` };
  }
  if (chosen.customRole) {
    await service.from('profiles').update({ custom_role: chosen.customRole } as any).eq('id', created.user.id);
  }
  if (params.details) await saveStaffDetails(service, created.user.id, params.details);

  await logActivity({
    entityType: 'profile',
    entityId: created.user.id,
    action: 'user_created_by_admin',
    metadata: { email, role: chosen.role, customRole: chosen.customRole, customPermissions: !!params.permissions, canLogin, by: admin.id },
  });
  revalidatePath('/settings/users');
  return { ok: true };
}

/** Save a user's access matrix. null = back to the role's defaults. */
export async function setUserPermissions(profileId: string, permissions: UserPermissions | null): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  if (profileId === admin.id) return { ok: false, error: 'Τα δικαιώματα του admin δεν αλλάζουν.' };
  const service = createSupabaseServiceRoleClient();
  const value = permissions ? storedPermissions(sanitizePermissions(permissions, false)) : null;
  const { error } = await service.from('profiles').update({ permissions: value } as any).eq('id', profileId);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'permissions_changed', metadata: { permissions: value } });
  revalidatePath('/settings/users');
  return { ok: true };
}

/** Admin sets a new (temporary) password for someone, e.g. when they forget it. */
export async function setUserPassword(profileId: string, password: string, mustChange = true): Promise<UserActionResult> {
  const admin = await requireRole(['admin']);
  const pwIssue = passwordProblem(password, (await getOrgSettingsRaw()).security);
  if (pwIssue) return { ok: false, error: pwIssue };
  const service = createSupabaseServiceRoleClient();
  // Νέος κωδικός = μπορεί να συνδεθεί (ξεκλειδώνει και όσους φτιάχτηκαν «χωρίς σύνδεση»).
  const { error } = await service.auth.admin.updateUserById(profileId, { password, ban_duration: 'none', user_metadata: { pw_changed_at: new Date().toISOString() } });
  if (error) return { ok: false, error: error.message };
  await service.from('profiles').update({ must_change_password: mustChange && profileId !== admin.id } as any).eq('id', profileId);
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'password_set_by_admin' });
  revalidatePath('/settings/users');
  return { ok: true };
}

/** Ιστορικό ενεργειών ενός χρήστη (Staff → εικονίδιο ιστορικού). */
export async function getUserHistory(userId: string): Promise<{ ok: true; rows: { id: string; at: string; action: string; entity: string; details: string }[] } | { ok: false; error: string }> {
  await requireRole(['admin', 'management']);
  if (!/^[0-9a-f-]{36}$/i.test(userId ?? '')) return { ok: false, error: 'Άγνωστος χρήστης.' };
  const svc = createSupabaseServiceRoleClient() as any;
  const { data, error } = await svc.from('activity_log').select('id, entity_type, action, metadata, created_at').eq('actor_id', userId).order('created_at', { ascending: false }).limit(150);
  if (error) return { ok: false, error: error.message };
  const rows = ((data ?? []) as any[]).map((r) => {
    const m = (r.metadata ?? {}) as Record<string, unknown>;
    const ua = typeof m.ua === 'string' ? m.ua : '';
    const dev = ua ? `${/iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : ''}` : '';
    const extra = Object.entries(m).filter(([k, v]) => !['ip', 'ua'].includes(k) && v != null && typeof v !== 'object').slice(0, 2).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v).slice(0, 40)}`);
    return { id: r.id, at: r.created_at, action: r.action, entity: r.entity_type, details: [...extra, m.ip ? `IP ${m.ip}` : '', dev].filter(Boolean).join(' · ') };
  });
  return { ok: true, rows };
}
