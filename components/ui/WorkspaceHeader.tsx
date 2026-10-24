/**
 * Standard workspace page header — one consistent Title · Description · single
 * top-right primary action across every module. Server-safe (accepts the action
 * as a ReactNode). Keep exactly ONE primary CTA in `action`; put secondary
 * actions inside the workspace body.
 */
export function WorkspaceHeader({ eyebrow, title, description, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-display text-[26px] leading-tight tracking-tight text-charcoal">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-charcoal-600/70">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
