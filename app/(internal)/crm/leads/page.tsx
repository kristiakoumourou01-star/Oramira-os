import { redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth';
import { getRetargetingAudiences } from '@/app/actions/communications';
import { RetargetingExport } from '@/components/crm/RetargetingExport';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

/**
 * Η παλιά σελίδα «Sales» με καρτέλες. Ενοποιήθηκε στο Sales (όπως Pipedrive):
 * Lead Management / Pipeline → Deals · Follow-ups / Προβολές → Activities ·
 * Στατιστικά / Κλεισίματα → Insights. Εδώ μένει μόνο το Retargeting (Marketing).
 */
export default async function SalesPage({ searchParams }: { searchParams: { tab?: string } }) {
  const tab = searchParams?.tab;
  if (!tab || tab === 'pipeline') redirect('/sales/deals');
  if (tab === 'inbox') redirect('/sales/deals?view=list');
  if (tab === 'followups') redirect('/sales/activities');
  if (tab === 'viewings') redirect('/sales/activities?type=viewing');
  if (tab === 'kpis' || tab === 'closings') redirect('/sales/insights');
  if (tab === 'command') redirect('/command-center');
  await requirePermission('leads');
  const retarget = await getRetargetingAudiences();
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Retargeting" />
      <RetargetingExport leads={retarget} />
    </div>
  );
}
