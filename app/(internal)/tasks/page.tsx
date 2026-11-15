import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INTERNAL_ROLES } from '@/lib/permissions';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { TeamTasks, type TeamTask } from '@/components/tasks/TeamTasks';

export const dynamic = 'force-dynamic';

/** Tasks (όπως στο FitnessCRM): εργασίες σε άτομα ή σε όλη την ομάδα, με προθεσμίες. */
export default async function TasksPage({ searchParams }: { searchParams: { view?: string } }) {
  const profile = await requireProfile();
  const db = (await createSupabaseServerClient()) as any;
  const isLead = ['admin', 'management'].includes(profile.role);
  const [{ data: rows }, { data: staff }] = await Promise.all([
    db.from('tasks').select('id, title, description, assigned_to, due_at, is_done, priority, created_by, group_id, list, completed_at, outcome, created_at, related_entity_type, related_entity_id').order('due_at', { ascending: true, nullsFirst: false }).limit(3000),
    db.from('profiles').select('id, full_name, role').in('role', INTERNAL_ROLES as unknown as string[]).order('full_name'),
  ]);
  const names = new Map(((staff ?? []) as any[]).map((s) => [s.id, s.full_name ?? '—']));
  const tasks: TeamTask[] = ((rows ?? []) as any[]).map((t) => ({
    id: t.id, title: t.title, description: t.description, assignedTo: t.assigned_to, assignee: names.get(t.assigned_to) ?? '—', dueAt: t.due_at, done: !!t.is_done,
    priority: t.priority ?? 'normal', createdBy: t.created_by, creator: t.created_by ? names.get(t.created_by) ?? '—' : null, groupId: t.group_id, list: t.list,
    completedAt: t.completed_at, outcome: t.outcome, createdAt: t.created_at,
    href: t.related_entity_type === 'lead' && t.related_entity_id ? `/crm/leads/${t.related_entity_id}` : null,
  }));
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Marketing" title="Tasks" description="Αναθέστε εργασίες σε συγκεκριμένα άτομα ή σε όλη την ομάδα, με προθεσμίες και ειδοποιήσεις." />
      <TeamTasks tasks={tasks} staff={((staff ?? []) as any[]).map((s) => ({ id: s.id, name: s.full_name ?? '—' }))} me={profile.id} isLead={isLead} initialView={searchParams.view} />
    </div>
  );
}
