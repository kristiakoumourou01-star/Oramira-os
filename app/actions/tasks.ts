'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { pushEventToGoogle } from '@/lib/calendar-sync';
import { revalidatePath } from 'next/cache';

/** Source-aware task completion. The unified My Tasks feed spans three tables:
 *  `tasks` and `follow_up_tasks` track completion via `is_done`, while a planner
 *  task lives in `calendar_events` and tracks it via `status`. Route to the
 *  right column so completing always updates the correct source. */
export async function toggleTaskDone(taskId: string, done: boolean, table: 'tasks' | 'follow_up_tasks' | 'calendar_events' = 'tasks') {
  const supabase = await createSupabaseServerClient();
  if (table === 'calendar_events') {
    await supabase.from('calendar_events').update({ status: done ? 'completed' : 'scheduled' }).eq('id', taskId);
    await logActivity({ entityType: 'calendar_event', entityId: taskId, action: done ? 'completed' : 'reopened' });
  } else {
    await supabase.from(table).update({ is_done: done }).eq('id', taskId);
    await logActivity({ entityType: table === 'tasks' ? 'task' : 'follow_up_task', entityId: taskId, action: done ? 'completed' : 'reopened' });
  }
  revalidatePath('/dashboard');
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

  // Auto-sync dated tasks to the assignee's Google Calendar (best-effort).
  if (data && params.dueAt) {
    const sync = await pushEventToGoogle(params.assignedTo, { summary: params.title, start: params.dueAt, durationMin: 30 });
    if (sync) await supabase.from('tasks').update({ google_event_id: sync.googleEventId, calendar_synced_at: new Date().toISOString() }).eq('id', data.id);
  }
  return data;
}
