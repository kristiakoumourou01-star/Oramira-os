import { StatusPill, type Tone } from '@/components/ui/StatusPill';

/**
 * Unit status pill, shared across the inventory grid, unit detail, and the
 * buyer portal. Pure/presentational so it renders in Server Components too.
 * Colours: available green, reserved amber, sold red, the rest neutral.
 */
export const UNIT_TONE: Record<string, Tone> = {
  available: 'green',
  reserved: 'amber',
  sold: 'red',
  handed_over: 'neutral',
  blocked: 'neutral',
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Διαθέσιμη',
  reserved: 'Κρατημένη',
  sold: 'Πωλημένη',
  handed_over: 'Παραδόθηκε',
  blocked: 'Μη διαθέσιμη',
};

export function UnitStatusBadge({ status }: { status: string }) {
  return <StatusPill tone={UNIT_TONE[status] ?? 'neutral'} dot>{STATUS_LABEL[status] ?? status}</StatusPill>;
}
