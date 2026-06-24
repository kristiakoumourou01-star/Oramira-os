'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

export async function toggleTaskDone(taskId: string, done: boolean, table: 'tasks' | 'follow_up_tasks' = 'tasks') {
  const supabase = await createSupabaseServerClient();
  await supabase.from(table).update({ is_done: done }).eq('id', taskId);
  await logActivity({ entityType: table === 'tasks' ? 'task' : 'follow_up_task', entityId: taskId, action: done ? 'completed' : 'reopened' });
}

export async function createTask(params: {
  title: string;
  assignedTo: string;
  dueAt?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title: params.title,
      assigned_to: params.assignedTo,
      due_at: params.dueAt ?? null,
      related_entity_type: params.relatedEntityType ?? null,
      related_entity_id: params.relatedEntityId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
