import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getOrgSettings } from '@/lib/org-settings';
import { INTERNAL_ROLES } from '@/lib/permissions';
import { RolesAdmin } from '@/components/admin/RolesAdmin';

export const dynamic = 'force-dynamic';

/** Settings → Χρήστες → Ρόλοι & δικαιώματα (admin only). */
export default async function RolesPage() {
  await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  const { roles } = await getOrgSettings();

  // How many people hold each role (custom_role is best-effort: migration 0054).
  const counts: Record<string, number> = {};
  const { data: base } = await supabase.from('profiles').select('id, role').in('role', INTERNAL_ROLES);
  const custom = new Map<string, string>();
  const { data: cr, error: crError } = await supabase.from('profiles').select('id, custom_role').not('custom_role' as any, 'is', null);
  for (const row of (cr ?? []) as any[]) if (row.custom_role) custom.set(row.id, row.custom_role);
  for (const p of (base ?? []) as any[]) {
    const key = custom.has(p.id) ? `custom:${custom.get(p.id)}` : p.role;
    counts[key] = (counts[key] ?? 0) + 1;
  }

  return <RolesAdmin roles={roles} counts={counts} migrationMissing={!!crError} />;
}
