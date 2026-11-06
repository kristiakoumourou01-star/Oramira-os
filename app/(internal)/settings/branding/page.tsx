import { requireRole } from '@/lib/auth';
import { getBranding } from '@/lib/branding';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { BrandingForm } from '@/components/admin/BrandingForm';

/**
 * Settings → Branding. Admin-only surface to re-skin the whole OS — logo,
 * company name, the 5 core colors, and heading/body fonts — applied live across
 * the internal workbench, every portal, and the login screen.
 */
export default async function BrandingSettingsPage() {
  await requireRole(['admin']);
  const branding = await getBranding();

  return (
    <div className="space-y-5">
      <WorkspaceHeader
        eyebrow="Admin"
        title="Appearance & Layout"
        description="Λογότυπο, χρώματα, γραμματοσειρές, πλάτος και πυκνότητα. Οι αλλαγές ισχύουν σε όλο το CRM και τα portals."
      />
      <BrandingForm initial={branding} />
    </div>
  );
}
