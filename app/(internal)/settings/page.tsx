import { requireRole } from '@/lib/auth';
import { getBranding } from '@/lib/branding';
import { getOrgSettings } from '@/lib/org-settings';
import { isCalendarConnected } from '@/lib/calendar-sync';
import { SettingsScreen } from '@/components/admin/SettingsScreen';
import { getSection, type SettingsKey } from '@/lib/settings-sections';

export const dynamic = 'force-dynamic';

/**
 * Settings — the agency control area, structured exactly like the prototype:
 * a left sub-nav (Account / Work / Money / Connections) switching sections.
 * Appearance and Business details are fully wired; the rest arrive section by
 * section on the same org_settings backend.
 */
export default async function SettingsPage({ searchParams }: { searchParams: { section?: string } }) {
  const profile = await requireRole(['admin']);
  const [branding, settings, conn] = await Promise.all([getBranding(), getOrgSettings(), isCalendarConnected(profile.id)]);
  const initialSection = getSection(searchParams.section).key as SettingsKey;

  return (
    <SettingsScreen
      initialSection={initialSection}
      branding={branding}
      settings={settings}
      agencyName={branding.companyName}
      plan="Professional"
      canEdit={profile.role === 'admin'}
      googleConnected={conn.connected}
      googleConfigured={conn.configured}
    />
  );
}
