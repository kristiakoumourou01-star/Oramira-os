import { requireProfile } from '@/lib/auth';
import { loadTaskBoard } from '@/lib/tasks-board';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { TeamTasks } from '@/components/tasks/TeamTasks';

export const dynamic = 'force-dynamic';

/** Tasks (όπως στο FitnessCRM): λίστες κλήσεων από αναφορές και εργασίες ομάδας, με πρόοδο x από N. */
export default async function TasksPage({ searchParams }: { searchParams: { view?: string } }) {
  const profile = await requireProfile();
  const isLead = ['admin', 'management'].includes(profile.role);
  const b = await loadTaskBoard(profile.id, isLead);
  return (
    <div className="space-y-5">
      <WorkspaceHeader title="Tasks" description="Λίστες κλήσεων από μια αναφορά και εργασίες, ανατεθειμένες στην ομάδα σας." />
      <TeamTasks rows={b.rows} staff={b.staff} me={profile.id} isLead={isLead} initialView={searchParams.view} reports={b.reports} groups={b.groups} callListsReady={b.callListsReady} />
    </div>
  );
}
