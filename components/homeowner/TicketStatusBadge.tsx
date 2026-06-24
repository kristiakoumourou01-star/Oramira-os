/** Maintenance ticket status pill — shared across homeowner, staff, and contractor views. Pure. */
const STATUS_CLASS: Record<string, string> = {
  open: 'badge-champagne',
  acknowledged: 'badge-champagne',
  in_progress: 'badge-forest',
  awaiting_parts: 'border-signal-warning/30 bg-champagne-50 text-signal-warning badge',
  resolved: 'badge-forest',
  closed: 'badge-neutral',
  reopened: 'badge-champagne',
};

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  acknowledged: 'Acknowledged',
  in_progress: 'In progress',
  awaiting_parts: 'Awaiting parts',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

export function TicketStatusBadge({ status }: { status: string }) {
  return <span className={STATUS_CLASS[status] ?? 'badge-neutral'}>{STATUS_LABEL[status] ?? status}</span>;
}

const PRIORITY_CLASS: Record<string, string> = {
  low: 'badge-neutral',
  medium: 'badge-neutral',
  high: 'badge-champagne',
  emergency: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
};

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={PRIORITY_CLASS[priority] ?? 'badge-neutral'}>{priority}</span>;
}
