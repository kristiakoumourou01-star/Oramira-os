'use client';

import { useTransition } from 'react';
import { updateLeadStatus } from '@/app/actions/leads';

const STAGES = ['new', 'contacted', 'qualified', 'viewing', 'negotiating', 'reserved', 'won'] as const;
const TERMINAL = ['lost', 'nurture'] as const;

const LABELS: Record<string, string> = {
  new: 'New', contacted: 'Contacted', qualified: 'Qualified', viewing: 'Viewing',
  negotiating: 'Negotiating', reserved: 'Reserved', won: 'Won', lost: 'Lost', nurture: 'Nurture',
};

/**
 * The lead status pipeline, rendered as a quiet horizontal stepper rather
 * than a colorful kanban — fits the brand's restraint. Lost/Nurture sit
 * apart since they're exits from the pipeline, not points along it.
 */
export function StatusPipeline({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const currentIndex = STAGES.indexOf(currentStatus as any);

  function setStatus(status: string) {
    startTransition(() => updateLeadStatus(leadId, status));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const reached = currentIndex >= 0 && i <= currentIndex;
          return (
            <button
              key={stage}
              disabled={isPending}
              onClick={() => setStatus(stage)}
              className={`flex-1 rounded px-2 py-2 text-center text-xs font-medium transition-colors ${
                reached ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'
              }`}
            >
              {LABELS[stage]}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        {TERMINAL.map((stage) => (
          <button
            key={stage}
            disabled={isPending}
            onClick={() => setStatus(stage)}
            className={`btn-ghost text-xs ${currentStatus === stage ? 'bg-sand-100 text-charcoal' : ''}`}
          >
            Mark as {LABELS[stage]}
          </button>
        ))}
      </div>
    </div>
  );
}
