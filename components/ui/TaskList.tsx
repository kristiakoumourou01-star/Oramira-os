'use client';

import { useState, useTransition } from 'react';
import { Check, Circle } from 'lucide-react';
import { toggleTaskDone } from '@/app/actions/tasks';

export interface TaskItem {
  id: string;
  title: string;
  due_at: string | null;
  is_done: boolean;
}

/** Shared task list used in the internal dashboard, follow-up reminders, and ticket triage. */
export function TaskList({ tasks, table = 'tasks' }: { tasks: TaskItem[]; table?: 'tasks' | 'follow_up_tasks' }) {
  const [items, setItems] = useState(tasks);
  const [isPending, startTransition] = useTransition();

  function toggle(id: string, current: boolean) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, is_done: !current } : t)));
    startTransition(() => toggleTaskDone(id, !current, table));
  }

  if (items.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No tasks right now.</p>;
  }

  return (
    <ul className="divide-y divide-stone-line">
      {items.map((task) => (
        <li key={task.id} className="flex items-center gap-3 py-2.5">
          <button
            onClick={() => toggle(task.id, task.is_done)}
            disabled={isPending}
            className={`flex h-5 w-5 items-center justify-center rounded-full border transition-colors ${
              task.is_done ? 'border-forest bg-forest text-stone-100' : 'border-stone-line text-transparent'
            }`}
            aria-label={task.is_done ? 'Mark incomplete' : 'Mark complete'}
          >
            <Check size={12} strokeWidth={2.5} />
          </button>
          <span className={`flex-1 text-sm ${task.is_done ? 'text-charcoal-600/50 line-through' : 'text-charcoal'}`}>
            {task.title}
          </span>
          {task.due_at && (
            <span className="text-xs text-charcoal-600/60">
              {new Date(task.due_at).toLocaleDateString()}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
