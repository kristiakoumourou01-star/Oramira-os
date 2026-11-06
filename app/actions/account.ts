'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { readImpersonationTarget } from '@/lib/impersonation';
import { getOrgSettings } from '@/lib/org-settings';
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
  const issue = passwordProblem(password, (await getOrgSettings()).security);
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
