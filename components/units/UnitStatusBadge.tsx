/**
 * Unit status pill, shared across the inventory grid, unit detail, and the
 * buyer portal. Pure/presentational so it renders in Server Components too.
 * Champagne is reserved for the "reserved" hold state — the one moment a
 * unit is in play but not yet committed.
 */
const STATUS_CLASS: Record<string, string> = {
  available: 'badge-neutral',
  reserved: 'badge-champagne',
  sold: 'badge-forest',
  handed_over: 'badge-forest',
  blocked: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Available',
  reserved: 'Reserved',
  sold: 'Sold',
  handed_over: 'Handed over',
  blocked: 'Blocked',
};

export function UnitStatusBadge({ status }: { status: string }) {
  return <span className={STATUS_CLASS[status] ?? 'badge-neutral'}>{STATUS_LABEL[status] ?? status}</span>;
}
