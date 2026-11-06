import { getCurrentProfile } from '@/lib/auth';
import { effectiveCan } from '@/lib/permissions';
import { SETTINGS_NAV } from '@/lib/settings-sections';
import { SettingsNav } from '@/components/admin/SettingsNav';

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
    <div className="space-y-5">
      <div className="panel p-5">
        <p className="eyebrow mb-1">Admin</p>
        <h1 className="text-3xl">Settings</h1>
        <p className="text-sm text-charcoal-600/70">Όλες οι ρυθμίσεις της εταιρείας σε ένα μέρος: εμφάνιση, χρήστες, κανόνες, χρήματα και συνδέσεις.</p>
      </div>
      <div className="grid gap-6 md:grid-cols-[230px_minmax(0,1fr)]">
        <aside className="md:sticky md:top-20 md:self-start">
          <SettingsNav groups={groups} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
