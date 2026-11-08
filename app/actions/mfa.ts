'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireProfile, requireRole } from '@/lib/auth';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { getMfaStatus, revokeDevices, trustThisDevice } from '@/lib/mfa';

export type MfaResult = { ok: true } | { ok: false; error: string };
export type EnrollResult = { ok: true; factorId: string; qr: string; secret: string } | { ok: false; error: string };

const code6 = (c: string) => String(c ?? '').replace(/\s+/g, '');

/** Only same-site paths, never "//evil.com". */
function safeNext(next: string | undefined, fallback: string): string {
  return typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

/**
 * Sign-in step 2: the 6-digit code from the authenticator app. On success the
 * session becomes aal2; with "remember" (and Settings allowing it) this
 * browser skips the code for the next 30 days.
 */
export async function verifyLoginCode(_prev: { error?: string } | undefined, formData: FormData): Promise<{ error?: string }> {
  const code = code6(String(formData.get('code') ?? ''));
  const remember = formData.get('remember') === 'on';
  const next = safeNext(String(formData.get('next') ?? ''), '/dashboard');
  if (!/^\d{6}$/.test(code)) return { error: 'Γράψτε τον 6ψήφιο κωδικό από την εφαρμογή.' };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect('/login');
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const factor = (factors?.totp ?? []).find((f) => f.status === 'verified');
  if (!factor) redirect(next);

  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
  if (error) {
    await logActivity({ entityType: 'auth', entityId: auth.user.id, action: 'login_2fa_failed' });
    return { error: 'Λάθος ή ληγμένος κωδικός. Δοκιμάστε τον επόμενο που θα εμφανιστεί.' };
  }
  const { security } = await getOrgSettingsRaw();
  if (remember && security.trustedDevices) await trustThisDevice(auth.user.id);
  await logActivity({ entityType: 'auth', entityId: auth.user.id, action: 'login_2fa', metadata: { remembered: remember && security.trustedDevices } });
  redirect(next);
}

/** Start adding an authenticator: returns the QR code to scan. */
export async function startTotpEnroll(): Promise<EnrollResult> {
  await requireProfile({ allowMfaSetup: true, allowPasswordChange: true });
  const supabase = await createSupabaseServerClient();
  // Drop half-finished attempts so a new one can start cleanly.
  const { data: list } = await supabase.auth.mfa.listFactors();
  for (const f of list?.all ?? []) if (f.status !== 'verified') await supabase.auth.mfa.unenroll({ factorId: f.id });
  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `Oramira ${new Date().toISOString().slice(0, 16)}` });
  if (error || !data) {
    return { ok: false, error: /disabled|not enabled/i.test(error?.message ?? '') ? 'Ο κωδικός μίας χρήσης δεν είναι ενεργός στη Supabase (Authentication → Multi-Factor → TOTP).' : error?.message ?? 'Δεν ξεκίνησε.' };
  }
  if (data.type !== 'totp') return { ok: false, error: 'Μη αναμενόμενη απάντηση.' };
  return { ok: true, factorId: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

/** Finish adding: the first code from the app proves it was scanned correctly. */
export async function confirmTotpEnroll(factorId: string, code: string): Promise<MfaResult> {
  const profile = await requireProfile({ allowMfaSetup: true, allowPasswordChange: true });
  const c = code6(code);
  if (!/^\d{6}$/.test(c)) return { ok: false, error: 'Γράψτε τον 6ψήφιο κωδικό.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: c });
  if (error) return { ok: false, error: 'Λάθος κωδικός. Ελέγξτε ότι η ώρα του κινητού είναι σωστή και δοκιμάστε τον επόμενο.' };
  await logActivity({ entityType: 'auth', entityId: profile.impersonator?.id ?? profile.id, action: 'mfa_enabled' });
  revalidatePath('/account/security');
  return { ok: true };
}

/** Turn 2FA off for yourself (not allowed while Settings make it mandatory). */
export async function removeTotp(factorId: string): Promise<MfaResult> {
  const profile = await requireProfile({ allowPasswordChange: true });
  const { security } = await getOrgSettingsRaw();
  if (security.otp) return { ok: false, error: 'Ο κωδικός μίας χρήσης είναι υποχρεωτικός στην εταιρεία. Για νέο κινητό, προσθέστε πρώτα το νέο ή ζητήστε από τον admin να τον μηδενίσει.' };
  const st = await getMfaStatus();
  if (st.current !== 'aal2') return { ok: false, error: 'Για ασφάλεια, αποσυνδεθείτε και μπείτε ξανά με κωδικό από την εφαρμογή, και μετά απενεργοποιήστε το.' };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { ok: false, error: error.message };
  if (st.userId) await revokeDevices(st.userId);
  await logActivity({ entityType: 'auth', entityId: profile.id, action: 'mfa_disabled' });
  revalidatePath('/account/security');
  return { ok: true };
}

/** Forget one (or all) of my trusted devices. */
export async function forgetDevice(deviceId?: string): Promise<MfaResult> {
  await requireProfile({ allowPasswordChange: true });
  const st = await getMfaStatus();
  if (!st.userId) return { ok: false, error: 'Δεν είστε συνδεδεμένοι.' };
  await revokeDevices(st.userId, deviceId);
  revalidatePath('/account/security');
  return { ok: true };
}

/**
 * Admin: lost phone. Removes the user's authenticators and trusted devices;
 * at the next sign-in they set up 2FA again (if it is mandatory).
 */
export async function resetUserMfa(userId: string): Promise<MfaResult> {
  await requireRole(['admin']);
  const admin = (createSupabaseServiceRoleClient() as any).auth.admin.mfa;
  const { data, error } = await admin.listFactors({ userId });
  if (error) return { ok: false, error: error.message };
  for (const f of data?.factors ?? []) await admin.deleteFactor({ id: f.id, userId });
  await revokeDevices(userId);
  await logActivity({ entityType: 'profile', entityId: userId, action: 'mfa_reset' });
  revalidatePath('/settings/users');
  return { ok: true };
}
