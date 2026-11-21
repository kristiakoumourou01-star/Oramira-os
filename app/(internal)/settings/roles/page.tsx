import { requireRole } from '@/lib/auth';
import { getOrgSettingsRaw } from '@/lib/org-settings';
import { RolesAdmin } from '@/components/admin/RolesAdmin';
import { StaffTabs } from '@/components/admin/StaffTabs';
import { loadStaffCounts, loadRolePeople } from '@/lib/staff';

export const dynamic = 'force-dynamic';

/** Staff → Ρόλοι: κάρτες ρόλων, νέος ρόλος, δικαιώματα ανά περιοχή, ανάθεση σε ανθρώπους (μόνο Owner). */
export default async function RolesPage() {
  await requireRole(['admin']);
  const { roles } = await getOrgSettingsRaw();
  const [{ people, counts, migrationMissing }, staffCounts] = await Promise.all([loadRolePeople(), loadStaffCounts(roles.custom.length)]);
  return (
    <div className="space-y-5">
      <StaffTabs active="roles" counts={staffCounts} />
      <RolesAdmin roles={roles} counts={counts} people={people} migrationMissing={migrationMissing} />
    </div>
  );
}
