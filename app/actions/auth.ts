'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { homeRouteForRole } from '@/lib/auth';

export async function login(formData: FormData) {
  const email = String(formData.get('email'));
  const password = String(formData.get('password'));

  const supabase = await createSupabaseServerClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .single();

  redirect(homeRouteForRole((profile?.role as any) ?? 'buyer'));
}

export async function logout() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
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
