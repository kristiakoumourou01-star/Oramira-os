'use client';

import { useState } from 'react';
import { ChevronDown, Workflow, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { RunJobButton } from '@/components/automation/RunJobButton';
import { formatDate } from '@/lib/format';

export interface AutomationJob { key: string; label: string; description: string; schedule: string; lastStatus: string | null; lastAt: string | null }
export interface AutomationGroup { category: string; jobs: AutomationJob[] }

function health(jobs: AutomationJob[]) {
  const failed = jobs.filter((j) => j.lastStatus === 'failed').length;
  const never = jobs.filter((j) => !j.lastStatus).length;
  if (failed) return { cls: 'bg-signal-danger/10 text-signal-danger', label: `${failed} failing` };
  if (never) return { cls: 'bg-sand-100 text-charcoal-600/70', label: `${never} idle` };
  return { cls: 'bg-signal-success/10 text-signal-success', label: 'healthy' };
}

/** Collapsible automation categories — one section per domain so the ~20 jobs
 *  never appear as a wall of identical cards. */
export function AutomationCategories({ groups }: { groups: AutomationGroup[] }) {
  const [open, setOpen] = useState<Record<string, boolean>>({ [groups[0]?.category]: true });
  const toggle = (c: string) => setOpen((o) => ({ ...o, [c]: !o[c] }));

  return (
    <div className="space-y-2.5">
      {groups.map((g) => {
        const h = health(g.jobs);
        const isOpen = !!open[g.category];
        return (
          <div key={g.category} className="panel overflow-hidden !p-0">
            <button onClick={() => toggle(g.category)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-forest/[0.02]">
              <ChevronDown size={15} className={`shrink-0 text-charcoal-600/50 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
              <Workflow size={15} className="shrink-0 text-forest" strokeWidth={1.85} />
              <span className="text-[15px] font-semibold text-charcoal">{g.category}</span>
              <span className="figure rounded-full bg-forest/8 px-2 py-0.5 text-[11px] text-forest">{g.jobs.length}</span>
              <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-medium ${h.cls}`}>{h.label}</span>
            </button>

            {isOpen && (
              <ul className="divide-y divide-stone-line/70 border-t border-stone-line/70">
                {g.jobs.map((j) => (
                  <li key={j.key} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-charcoal">{j.label}</span>
                        <span className="badge-neutral">{j.schedule}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-charcoal-600/60">{j.description}</p>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-[11px] text-charcoal-600/55 sm:flex">
                      {j.lastStatus === 'success' ? <CheckCircle2 size={12} className="text-signal-success" /> : j.lastStatus === 'failed' ? <XCircle size={12} className="text-signal-danger" /> : <Clock size={12} />}
                      {j.lastAt ? formatDate(j.lastAt) : 'never'}
                    </span>
                    <RunJobButton jobKey={j.key} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
