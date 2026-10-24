'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Video, Sparkles, ArrowRight } from 'lucide-react';
import { toggleTaskDone } from '@/app/actions/tasks';
import { AvatarStack, type Attendee } from '@/components/dashboard/AvatarStack';
import { formatDayMonth } from '@/lib/format';

export interface CompactTask {
  id: string;
  title: string;
  due_at: string | null;
  is_done: boolean;
  table: 'tasks' | 'follow_up_tasks' | 'calendar_events';
  detail?: string | null;
  href?: string | null;
  meeting_link?: string | null;
  priority?: 'low' | 'normal' | 'high';
  entity?: string | null; // Lead / Property / HR / Finance
  attendees?: Attendee[];
}

const DAY = 24 * 60 * 60 * 1000;
const ENTITY_CLS: Record<string, string> = {
  Lead: 'bg-champagne-50 text-champagne-600', Property: 'bg-sky-50 text-sky-700', HR: 'bg-violet-50 text-violet-700', Finance: 'bg-forest/10 text-forest', Task: 'bg-[#F5F1E8] text-charcoal-600/70',
};

function DueBadge({ due }: { due: string }) {
  const ms = new Date(due).getTime() - Date.now();
  let cls = 'bg-[#F5F1E8] text-charcoal-600/70'; let text = formatDayMonth(new Date(due));
  if (ms < 0) { cls = 'bg-signal-danger/10 text-signal-danger'; text = 'Overdue'; }
  else if (ms < DAY) { cls = 'bg-signal-warning/10 text-signal-warning'; text = 'Today'; }
  else if (ms < 3 * DAY) { cls = 'bg-champagne-50 text-champagne-600'; }
  return <span className={`figure shrink-0 rounded px-1.5 py-0.5 text-[10px] ${cls}`}>{text}</span>;
}

type Filter = 'all' | 'overdue' | 'today' | 'week';
const FILTERS: { v: Filter; label: string }[] = [
  { v: 'all', label: 'All' }, { v: 'overdue', label: 'Overdue' }, { v: 'today', label: 'Today' }, { v: 'week', label: 'This week' },
];

export function CompactTaskList({ tasks }: { tasks: CompactTask[] }) {
  const [items, setItems] = useState(tasks);
  const [filter, setFilter] = useState<Filter>('all');
  const [, startTransition] = useTransition();

  function toggle(t: CompactTask) {
    setItems((prev) => prev.map((x) => (x.id === t.id ? { ...x, is_done: !x.is_done } : x)));
    startTransition(() => toggleTaskDone(t.id, !t.is_done, t.table));
  }

  const visible = useMemo(() => {
    const now = Date.now();
    const arr = items.filter((t) => {
      if (filter === 'all') return true;
      if (!t.due_at) return false;
      const ms = new Date(t.due_at).getTime() - now;
      if (filter === 'overdue') return ms < 0;
      if (filter === 'today') return ms >= 0 && ms < DAY;
      if (filter === 'week') return ms >= 0 && ms < 7 * DAY;
      return true;
    });
    return arr.sort((a, b) => (a.due_at ? new Date(a.due_at).getTime() : Infinity) - (b.due_at ? new Date(b.due_at).getTime() : Infinity));
  }, [items, filter]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button key={f.v} onClick={() => setFilter(f.v)} className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${filter === f.v ? 'bg-forest text-white' : 'bg-[#F5F1E8] text-charcoal-600 hover:bg-[#EFE8DA]'}`}>{f.label}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-forest/20 bg-forest/[0.03] p-5 text-center">
          <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-forest/10 text-forest"><Sparkles size={16} strokeWidth={1.8} /></span>
          <p className="text-sm font-medium text-charcoal">{filter === 'overdue' ? 'Nothing overdue — you’re on top of it.' : filter === 'today' ? 'No tasks due today.' : 'Your task list is clear.'}</p>
          <p className="mt-1 text-xs text-charcoal-600/60">{filter === 'all' ? 'The system auto-creates tasks for hot leads, unpaid deposits, and expiring contracts — new items will land here.' : 'Use the planner above to schedule your next block, or check the Command Center for what matters most.'}</p>
        </div>
      ) : (
        <ul className="-mr-1 max-h-72 divide-y divide-[#F0EADF] overflow-y-auto pr-1">
          {visible.map((t) => {
            // The whole row reads at a glance and opens in one click — the title
            // links straight to the record, no expand step.
            const TitleTag: any = t.href ? Link : 'span';
            const titleProps = t.href ? { href: t.href } : {};
            return (
              <li key={t.id} className="group flex items-center gap-2 rounded-lg px-1 py-1.5 transition-colors hover:bg-[#FBF9F4]">
                <button onClick={() => toggle(t)} className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${t.is_done ? 'border-forest bg-forest text-white' : 'border-[#E8E0D2] text-transparent hover:border-forest'}`} aria-label="toggle complete"><Check size={10} strokeWidth={3} /></button>

                <div className="min-w-0 flex-1">
                  <TitleTag {...titleProps} className={`flex items-center gap-1 text-sm ${t.is_done ? 'text-charcoal-600/50 line-through' : t.href ? 'text-charcoal hover:text-champagne-600' : 'text-charcoal'}`}>
                    <span className="truncate">{t.title}</span>
                    {t.href && <ArrowRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-60" />}
                  </TitleTag>
                  {/* Context shown inline — no click needed to understand the task */}
                  {t.detail && <span className="block truncate text-xs text-charcoal-600/60">{t.detail}</span>}
                </div>

                {t.attendees && t.attendees.length > 0 && <AvatarStack attendees={t.attendees} size={18} />}
                {t.priority === 'high' && <span className="shrink-0 rounded bg-signal-danger/10 px-1.5 py-0.5 text-[10px] text-signal-danger">High</span>}
                {t.entity && <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] ${ENTITY_CLS[t.entity] ?? ENTITY_CLS.Task}`}>{t.entity}</span>}
                {t.meeting_link && <a href={t.meeting_link} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 rounded bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700 hover:bg-violet-500/20"><Video size={10} /> Join</a>}
                {t.due_at && <DueBadge due={t.due_at} />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
