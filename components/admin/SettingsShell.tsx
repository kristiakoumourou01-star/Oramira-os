import { getCurrentProfile } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { SETTINGS_NAV } from '@/lib/settings-sections';
import { SettingsHubNav } from '@/components/admin/SettingsHubNav';

/**
 * Frame for every Settings page: one header and one grouped menu on the left,
 * the chosen setting on the right. Admins see everything; anyone else only the
 * entries their permissions allow (e.g. Templates/Automations for Marketing).
 */
export async function SettingsShell({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  const isAdmin = profile?.role === 'admin';
  const groups = SETTINGS_NAV
    .map((g) => ({
      ...g,
      items: g.items.filter((it) =>
        isAdmin || (!!profile && !!it.module && effectiveCan(profile.role, profile.moduleAccess, it.module, 'view', profile.permissions)),
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <SettingsHubNav groups={groups}>{children}</SettingsHubNav>
  );
}
