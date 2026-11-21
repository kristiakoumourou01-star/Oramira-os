import { requirePermission } from '@/lib/auth';
import { getNewLeads, getSalesAgents } from '@/lib/sales-hub-data';
import { canAssignOthers, canClaimLeads } from '@/lib/sales-hub-shared';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { NewLeadsInbox } from '@/components/sales/NewLeadsInbox';

export const dynamic = 'force-dynamic';

/** Διαχείριση leads → Νέα leads: όλα τα εισερχόμενα χωρίς υπεύθυνο. */
export default async function NewLeadsPage() {
  const profile = await requirePermission('leads');
  const [leads, agents] = await Promise.all([getNewLeads(), getSalesAgents()]);
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Διαχείριση leads" title="Νέα leads" description="Όλα τα εισερχόμενα που δεν έχουν ακόμη υπεύθυνο. Αναλάβετε ένα lead και εμφανίζεται στο pipeline σας." />
      <NewLeadsInbox leads={leads} agents={agents} currentUserId={profile.id} canClaim={canClaimLeads(profile)} canAssign={canAssignOthers(profile)} />
    </div>
  );
}
