import { formatRelative } from '@/lib/format';

export interface ActivityItem {
  id: string;
  action: string;
  actor_name: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Renders the activity_log trail for any entity (lead, deal, ticket, unit…).
 * Plain language, chronological, no jargon — "Sarah moved status to
 * Qualified" not "status_changed: qualified".
 */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-charcoal-600/70">No activity recorded yet.</p>;
  }

  return (
    <ol className="space-y-4 border-l border-stone-line pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-champagne" />
          <p className="text-sm text-charcoal">
            <span className="font-medium">{item.actor_name ?? 'System'}</span> {describeAction(item)}
          </p>
          <p className="text-xs text-charcoal-600/60">
            {formatRelative(item.created_at)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function describeAction(item: ActivityItem): string {
  switch (item.action) {
    case 'created':
      return 'created this record';
    case 'status_changed':
      return `changed status from ${item.metadata?.from} to ${item.metadata?.to}`;
    case 'contractor_assigned':
      return 'assigned a contractor';
    case 'portal_activated':
      return 'activated portal access';
    default:
      return item.action.replace(/_/g, ' ');
  }
}
