'use server';

import { revalidatePath } from 'next/cache';
import { requireRole } from '@/lib/auth';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { mergeRoles, roleIdFrom, SLUG_RE, type CustomRole, type RolesSettings, type SystemRoleAdjustment } from '@/lib/roles-shared';
import { INTERNAL_ROLES, type AppRole } from '@/lib/permissions';

export type RoleResult = { ok: true; id?: string } | { ok: false; error: string };

async function current(): Promise<RolesSettings> {
  return (await getOrgSettingsRaw()).roles;
}

async function store(next: RolesSettings, action: string, meta: Record<string, unknown>): Promise<RoleResult> {
  const res = await saveOrgSlice('roles', mergeRoles(next));
  if (!res.ok) return res;
  await logActivity({ entityType: 'org_settings', entityId: 'roles', action, metadata: meta });
  revalidatePath('/settings/roles');
  revalidatePath('/settings/users');
  revalidatePath('/', 'layout');
  return { ok: true };
}

/** Create (no id) or update a custom role. */
export async function saveCustomRole(input: Omit<CustomRole, 'id'> & { id?: string; slug?: string }): Promise<RoleResult> {
  await requireRole(['admin']);
  const name = (input.name || '').trim();
  if (!name) return { ok: false, error: 'Δώστε όνομα στον ρόλο.' };
  const roles = await current();
  if (roles.custom.some((r) => r.name.toLowerCase() === name.toLowerCase() && r.id !== input.id)) {
    return { ok: false, error: 'Υπάρχει ήδη ρόλος με αυτό το όνομα.' };
  }
  const taken = [...roles.custom.map((r) => r.id), ...INTERNAL_ROLES];
  let id: string;
  if (input.id && roles.custom.some((r) => r.id === input.id)) id = input.id;
  else if (input.slug && input.slug.trim()) {
    // A slug chosen by the owner; it stays fixed once the role exists.
    const slug = input.slug.trim().toLowerCase();
    if (!SLUG_RE.test(slug)) return { ok: false, error: 'Το slug θέλει 2–40 λατινικά πεζά, αριθμούς ή παύλες.' };
    if (taken.includes(slug)) return { ok: false, error: 'Το slug χρησιμοποιείται ήδη.' };
    id = slug;
  } else id = roleIdFrom(name, taken);
  const role: CustomRole = { name, id, description: input.description, base: input.base, permissions: input.permissions, rights: input.rights };

  // Changing the base type moves this role's users with it, so the database
  // protection (e.g. only own leads) always matches what the role says.
  const before = roles.custom.find((r) => r.id === id);
  if (before && before.base !== role.base) {
    const service = createSupabaseServiceRoleClient();
    const { error } = await service.from('profiles').update({ role: role.base } as any).eq('custom_role' as any, id);
    if (error) return { ok: false, error: `Οι χρήστες του ρόλου δεν ενημερώθηκαν: ${error.message}` };
  }

  const next = { ...roles, custom: before ? roles.custom.map((r) => (r.id === id ? role : r)) : [...roles.custom, role] };
  const res = await store(next, before ? 'role_updated' : 'role_created', { id, name });
  return res.ok ? { ok: true, id } : res;
}

/** Delete a custom role; its users fall back to the plain base role. */
export async function deleteCustomRole(id: string): Promise<RoleResult> {
  await requireRole(['admin']);
  const roles = await current();
  if (!roles.custom.some((r) => r.id === id)) return { ok: false, error: 'Ο ρόλος δεν βρέθηκε.' };
  const service = createSupabaseServiceRoleClient();
  await service.from('profiles').update({ custom_role: null } as any).eq('custom_role' as any, id);
  return store({ ...roles, custom: roles.custom.filter((r) => r.id !== id) }, 'role_deleted', { id });
}

/** Adjust a built-in role (null = back to the built-in defaults). */
export async function saveSystemRole(role: AppRole, adjustment: SystemRoleAdjustment | null): Promise<RoleResult> {
  await requireRole(['admin']);
  if (role === 'admin') return { ok: false, error: 'Ο admin έχει πάντα πρόσβαση σε όλα.' };
  const roles = await current();
  const system = { ...roles.system };
  if (adjustment) system[role] = adjustment; else delete system[role];
  return store({ ...roles, system }, adjustment ? 'system_role_adjusted' : 'system_role_reset', { role });
}
