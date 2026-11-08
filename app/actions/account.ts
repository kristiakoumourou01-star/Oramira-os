'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireProfile } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { readImpersonationTarget, clearImpersonationCookie } from '@/lib/impersonation';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { passwordProblem } from '@/lib/security-shared';

export type ChangePasswordState = { ok?: boolean; error?: string };

/**
 * The signed-in user changes their own password (first login after an admin
 * set a temporary one, or any time from the account page). Always acts on the
 * REAL session user — never on someone an admin is viewing as.
 */
export async function changeOwnPassword(_prev: ChangePasswordState | undefined, formData: FormData): Promise<ChangePasswordState> {
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  if (await readImpersonationTarget()) {
    return { error: 'Βγείτε πρώτα από την προβολή ως άλλος χρήστης.' };
  }
  const issue = passwordProblem(password, (await getOrgSettingsRaw()).security);
  if (issue) return { error: issue };
  if (password !== confirm) return { error: 'Οι δύο κωδικοί δεν είναι ίδιοι.' };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: 'Η σύνδεση έληξε. Συνδεθείτε ξανά.' };

  const { error } = await supabase.auth.updateUser({ password, data: { pw_changed_at: new Date().toISOString() } });
  if (error) return { error: error.message };

  // The flag is admin-managed, so clear it with the service client — scoped to
  // the verified session user only.
  const service = createSupabaseServiceRoleClient();
  await service.from('profiles').update({ must_change_password: false } as any).eq('id', auth.user.id);
  await logActivity({ entityType: 'auth', entityId: auth.user.id, action: 'password_changed' });
  return { ok: true };
}

const IMG = /^data:image\/(png|jpeg|webp|gif);base64,/i;

/** Ο λογαριασμός μου → Προφίλ: μόνο τα δικά μου στοιχεία (όνομα, τηλέφωνο, θέση, φωτογραφία). */
export async function updateMyProfile(p: { fullName: string; phone: string; jobTitle: string; avatarUrl?: string | null }): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await requireProfile();
  if (me.impersonator) return { ok: false, error: 'Βλέπετε ως άλλος χρήστης — τα στοιχεία του τα αλλάζει μόνο ο ίδιος.' };
  const fullName = (p.fullName ?? '').trim().slice(0, 120);
  if (!fullName) return { ok: false, error: 'Γράψτε το ονοματεπώνυμό σας.' };
  const patch: Record<string, unknown> = { full_name: fullName, phone: (p.phone ?? '').trim().slice(0, 40) || null, job_title: (p.jobTitle ?? '').trim().slice(0, 80) || null };
  if (p.avatarUrl !== undefined) {
    if (p.avatarUrl && (!IMG.test(p.avatarUrl) || p.avatarUrl.length > 400_000)) return { ok: false, error: 'Η φωτογραφία πρέπει να είναι εικόνα έως 300 KB.' };
    patch.avatar_url = p.avatarUrl || null;
  }
  const { error } = await (createSupabaseServiceRoleClient() as any).from('profiles').update(patch).eq('id', me.id);
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'profile', entityId: me.id, action: 'profile_updated' });
  revalidatePath('/account');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Αποσύνδεση από όλες τις συσκευές (και από αυτή). */
export async function signOutEverywhere(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) await logActivity({ entityType: 'auth', entityId: auth.user.id, action: 'logout_everywhere' });
  await supabase.auth.signOut({ scope: 'global' });
  await clearImpersonationCookie();
  redirect('/login');
}
