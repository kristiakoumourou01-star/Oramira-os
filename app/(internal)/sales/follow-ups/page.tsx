import { requirePermission } from '@/lib/auth';
import { getOpenFollowUps, getSalesAgents } from '@/lib/sales-hub-data';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { FollowUpsView } from '@/components/sales/FollowUpsView';

export const dynamic = 'force-dynamic';

/** Διαχείριση leads → Follow-ups: καθυστερημένα, σήμερα, επόμενα. */
export default async function FollowUpsPage() {
  const profile = await requirePermission('leads');
  const [rows, agents] = await Promise.all([getOpenFollowUps(), getSalesAgents()]);
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Sales" title="Follow-ups" description="Ποιον πρέπει να πάρετε τηλέφωνο: καθυστερημένα, σήμερα και επόμενα. Κλήση, «Έγινε» ή αναβολή με ένα κλικ." />
      <FollowUpsView rows={rows} agents={agents} currentUserId={profile.id} />
    </div>
  );
}
