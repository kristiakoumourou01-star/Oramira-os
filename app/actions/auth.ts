'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { homeRouteForRole } from '@/lib/auth';
import { clearImpersonationCookie } from '@/lib/impersonation';
import { logActivity } from '@/lib/activity';

export interface LoginState { error?: string }

/**
 * Login server action. Signature is (prevState, formData) so it can drive a
 * useFormState form that surfaces errors and a pending state. Returns
 * { error } on failure (rendered by the form); redirects on success.
 */
export async function login(_prevState: LoginState | undefined, formData: FormData): Promise<LoginState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');

  if (!email || !password) return { error: 'Enter your email and password.' };

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

  console.error('[login] success, role:', profile?.role ?? '(no profile)');
  // Access event for the global audit log (captures IP + device via logActivity).
  await logActivity({ entityType: 'auth', entityId: data.user.id, action: 'login', metadata: { role: profile?.role ?? null } });
  redirect(homeRouteForRole((profile?.role as any) ?? 'buyer'));
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
  const supabase = await createSupabaseServerClient();

  const { data: invite, error: inviteError } = await supabase
    .from('invites')
    .select('email, role')
    .eq('token', token)
    .eq('status', 'pending')
    .single();

  if (inviteError || !invite) {
    return { error: 'This invite is invalid or has expired.' };
  }

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email: invite.email,
    password,
  });
  if (signUpError || !signUpData.user) {
    return { error: signUpError?.message ?? 'Could not create account.' };
  }

  const { error: rpcError } = await supabase.rpc('accept_invite', {
    invite_token: token,
    new_user_id: signUpData.user.id,
  });
  if (rpcError) {
    return { error: rpcError.message };
  }

  redirect(homeRouteForRole(invite.role as any));
}
