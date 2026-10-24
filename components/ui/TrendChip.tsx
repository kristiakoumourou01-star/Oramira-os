import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import type { Trend } from '@/lib/trend';

/**
 * The one reusable trend indicator — a sentiment-coloured delta chip for any KPI
 * across the OS. Green when the movement is good, red when bad (respecting each
 * metric's higher/lower-is-better), muted when flat. Renders nothing when there
 * is genuinely no movement and no history.
 */
export function TrendChip({ trend, className = '' }: { trend: Trend; className?: string }) {
  if (trend.direction === 'flat' && trend.current === 0 && trend.previous === 0) return null;
  const tone =
    trend.sentiment === 'positive' ? 'text-signal-success'
    : trend.sentiment === 'negative' ? 'text-signal-danger'
    : 'text-charcoal-600/45';
  const Icon = trend.direction === 'up' ? ArrowUp : trend.direction === 'down' ? ArrowDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${tone} ${className}`} title={`${trend.current} vs ${trend.previous} in the prior period`}>
      <Icon size={11} strokeWidth={2.4} /> {trend.label}
    </span>
  );
}
