'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { homeRouteForRole } from '@/lib/auth';
import { isInternalRole } from '@/lib/permissions';
import { clearImpersonationCookie } from '@/lib/impersonation';
import { logActivity } from '@/lib/activity';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { START_SCREENS } from '@/lib/org-settings-shared';
import { isTrustedDevice } from '@/lib/mfa';
import { t } from '@/lib/i18n';
import '@/lib/locale-server';
import { LOCALE_COOKIE, parseLocale, serializeLocale } from '@/lib/locale-shared';

export interface LoginState { error?: string }

/**
 * Login server action. Signature is (prevState, formData) so it can drive a
 * useFormState form that surfaces errors and a pending state. Returns
 * { error } on failure (rendered by the form); redirects on success.
 */
export async function login(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: t('enterEmailPassword') };

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    console.error('[login] signIn failed:', error.message);
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  // Admin decisions on the account (best-effort columns, see migration 0053):
  // a deactivated user is signed straight back out; a temporary password must
  // be changed before anything else.
  const { data: state } = await supabase
    .from('profiles')
    .select('is_active, must_change_password')
    .eq('id', data.user.id)
    .maybeSingle();
  if (state && (state as any).is_active === false) {
    await supabase.auth.signOut();
    return { error: 'Ο λογαριασμός σας έχει απενεργοποιηθεί. Επικοινωνήστε με τον διαχειριστή.' };
  }

  console.error('[login] success, role:', profile?.role ?? '(no profile)');
  // Access event for the global audit log (captures IP + device via logActivity).
  await logActivity({ entityType: 'auth', entityId: data.user.id, action: 'login', metadata: { role: profile?.role ?? null } });

  const role = (profile?.role as any) ?? 'buyer';
  // Internal staff land on the org-configured start screen (Settings → Layout),
  // validated against the allow-list; portal users keep their fixed home.
  let target = homeRouteForRole(role);
  if (isInternalRole(role)) {
    const { layout } = await getOrgSettingsRaw();
    if (START_SCREENS.some((s) => s.value === layout.startScreen)) target = layout.startScreen;
  }
  if (state && (state as any).must_change_password === true) target = '/account/password';
  // Step 2 (Settings → Ασφάλεια): anyone with an authenticator types the code,
  // unless this browser is one of their trusted devices.
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') {
    const { security } = await getOrgSettingsRaw();
    if (!(security.trustedDevices && (await isTrustedDevice(data.user.id)))) target = `/login/2fa?next=${encodeURIComponent(target)}`;
  }
  // Language + number format: the user's own choice, else the company default.
  {
    const { locale: companyLocale } = await getOrgSettingsRaw();
    const mine = (data.user.user_metadata as any)?.locale;
    (await cookies()).set(LOCALE_COOKIE, serializeLocale(parseLocale(mine, companyLocale)), { sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  // Fresh session → fresh activity clock (an old value must not time it out).
  (await cookies()).set('oramira_seen', String(Date.now()), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect(target);
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) await logActivity({ entityType: 'auth', entityId: auth.user.id, action: 'logout' });
  await supabase.auth.signOut();
  // Never let a stale "view as" grant survive a sign-out / re-login.
  await clearImpersonationCookie();
  redirect('/login');
}

/**
 * Completes the invite flow: creates the auth user (or signs them in if
 * they already started), then runs accept_invite() — the Postgres function
 * from Phase 3 that links the new profile to the correct contact/buyer/
 * investor/homeowner/contractor record. No self-registration path exists
 * anywhere else in the system; this is the only door in.
 */
export async function acceptInvite(token: string, password: string) {
  // Ο προσκεκλημένος δεν είναι ακόμα συνδεδεμένος, άρα δεν «βλέπει» τον πίνακα
  // invites (RLS: μόνο προσωπικό). Ο έλεγχος γίνεται εδώ στον server με το
  // service client — το token είναι το μυστικό που αποδεικνύει την πρόσκληση.
  if (!/^[a-f0-9]{32,64}$/i.test(token ?? '')) return { error: 'This invite is invalid or has expired.' };
  if (!password || password.length < 8) return { error: 'Password must be at least 8 characters.' };
  const service = createSupabaseServiceRoleClient();
  const { data: invite } = await service
    .from('invites')
    .select('email, role, expires_at')
    .eq('token', token)
    .eq('status', 'pending')
    .maybeSingle();
  if (!invite || (invite.expires_at && Date.parse(invite.expires_at as string) < Date.now())) {
    return { error: 'This invite is invalid or has expired.' };
  }

  // Ο λογαριασμός δημιουργείται επιβεβαιωμένος (δεν χρειάζεται email επιβεβαίωσης).
  let userId: string | null = null;
  const { data: created, error: createErr } = await service.auth.admin.createUser({ email: invite.email, password, email_confirm: true });
  if (created?.user) userId = created.user.id;
  else if (createErr && !/already|registered|exists/i.test(createErr.message)) return { error: createErr.message };

  const supabase = await createSupabaseServerClient();
  const { data: signIn, error: signInErr } = await supabase.auth.signInWithPassword({ email: invite.email, password });
  if (signInErr || !signIn.user) {
    return { error: userId ? 'Account created, but sign-in failed. Please try logging in.' : 'An account with this email already exists. Log in with its password, or ask an admin to reset it.' };
  }
  userId = signIn.user.id;

  const { error: rpcError } = await service.rpc('accept_invite', { invite_token: token, new_user_id: userId });
  if (rpcError && !/duplicate key|already exists/i.test(rpcError.message)) {
    return { error: rpcError.message };
  }

  redirect(homeRouteForRole(invite.role as any));
}
