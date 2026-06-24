import type { LucideIcon } from 'lucide-react';

/**
 * Empty states are an invitation to act, not a dead end — per the brand's
 * editorial voice. Always pairs a plain-language explanation with the one
 * next action available.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-stone-line bg-white/50 px-6 py-16 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-sand-100 text-forest">
        <Icon size={20} strokeWidth={1.5} />
      </div>
      <h4 className="mb-1 text-charcoal">{title}</h4>
      <p className="max-w-sm text-sm text-charcoal-600/80">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
