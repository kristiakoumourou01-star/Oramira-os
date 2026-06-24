import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TaskList } from '@/components/ui/TaskList';
import { EmptyState } from '@/components/ui/EmptyState';
import { Inbox } from 'lucide-react';

export default async function DashboardPage() {
  const profile = await requireRole(['admin', 'sales', 'management']);
  const supabase = await createSupabaseServerClient();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_at, is_done')
    .eq('assigned_to', profile.id)
    .order('due_at', { ascending: true })
    .limit(8);

  return (
    <div className="space-y-8">
      <div>
        <p className="eyebrow mb-1">Welcome back</p>
        <h1 className="text-3xl">{profile.fullName ?? 'Team'}</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="panel p-6">
          <p className="eyebrow mb-2">Open leads</p>
          <p className="figure text-3xl text-forest">—</p>
        </div>
        <div className="panel p-6">
          <p className="eyebrow mb-2">Active reservations</p>
          <p className="figure text-3xl text-forest">—</p>
        </div>
        <div className="panel p-6">
          <p className="eyebrow mb-2">Open maintenance tickets</p>
          <p className="figure text-3xl text-forest">—</p>
        </div>
      </div>

      <div className="panel p-6">
        <h3 className="mb-4 text-lg">Your tasks</h3>
        {tasks && tasks.length > 0 ? (
          <TaskList tasks={tasks} />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No tasks assigned"
            description="Follow-up reminders and triage tasks will appear here as they're created."
          />
        )}
      </div>
    </div>
  );
}
