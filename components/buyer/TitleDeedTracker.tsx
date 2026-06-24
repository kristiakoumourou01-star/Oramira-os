import { Check } from 'lucide-react';

const STEPS = [
  { key: 'not_started', label: 'Not started' },
  { key: 'application_submitted', label: 'Application submitted' },
  { key: 'under_review', label: 'Under review at Land Registry' },
  { key: 'transfer_pending', label: 'Transfer pending' },
  { key: 'issued', label: 'Title deed issued' },
] as const;

/**
 * Title-deed progress — the Cyprus transfer process rendered as a serene
 * horizontal stepper. Read-only; reassures the buyer where their ownership
 * paperwork stands without surfacing legal machinery.
 */
export function TitleDeedTracker({ status }: { status: string }) {
  const currentIndex = Math.max(0, STEPS.findIndex((s) => s.key === status));

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const reached = i <= currentIndex;
        const isLast = i === STEPS.length - 1;
        return (
          <li key={step.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center text-center">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs ${
                  reached ? 'border-forest bg-forest text-stone-100' : 'border-stone-line bg-white text-charcoal-600/50'
                }`}
              >
                {reached ? <Check size={13} strokeWidth={2.5} /> : i + 1}
              </span>
              <span className={`mt-1.5 max-w-[88px] text-[11px] leading-tight ${reached ? 'text-charcoal' : 'text-charcoal-600/50'}`}>
                {step.label}
              </span>
            </div>
            {!isLast && <div className={`mx-1 h-[2px] flex-1 ${i < currentIndex ? 'bg-forest' : 'bg-stone-line'}`} />}
          </li>
        );
      })}
    </ol>
  );
}
