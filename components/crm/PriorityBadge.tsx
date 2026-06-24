import { priorityTier } from '@/lib/priority';

const TIER_CLASS: Record<string, string> = {
  hot: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
  warm: 'badge-champagne',
  cool: 'badge-neutral',
};

/** Compact priority score pill — hot/warm/cool by score. Pure (server-safe). */
export function PriorityBadge({ score }: { score: number }) {
  return <span className={`${TIER_CLASS[priorityTier(score)]} figure`}>{score}</span>;
}
