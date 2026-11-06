import { requireRole } from '@/lib/auth';
import { loadViewAsData } from '@/lib/view-as';
import { ViewAsPanel } from '@/components/admin/ViewAsPanel';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

export const dynamic = 'force-dynamic';

/** Ρυθμίσεις → Χρήστες → Προβολή ως χρήστης (μόνο admin). */
export default async function ViewAsPage() {
  const profile = await requireRole(['admin']);
  const { users, history } = await loadViewAsData(profile.impersonator?.id ?? profile.id);
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Ρυθμίσεις · Χρήστες" title="Προβολή ως χρήστης" description="Δείτε την εφαρμογή ακριβώς όπως τη βλέπει ένας συνάδελφος ή πελάτης, για να ελέγξετε δικαιώματα και μενού." />
      <ViewAsPanel users={users} history={history} />
    </div>
  );
}
