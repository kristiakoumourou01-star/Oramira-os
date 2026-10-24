import { formatNumber } from '@/lib/format';
/**
 * Payment progress meter — a calm, ledger-like bar rather than a loud
 * percentage ring. Forest fill on a warm sand track, with the figure in the
 * signature mono numerals. Pure/presentational (renders server-side).
 */
export function PaymentProgress({ paid, total }: { paid: number; total: number | null }) {
  const pct = total && total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
  const remaining = total != null ? Math.max(0, total - paid) : null;

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="figure text-2xl text-forest">€{formatNumber(paid)}</span>
        {total != null && (
          <span className="figure text-sm text-charcoal-600/70">of €{formatNumber(total)}</span>
        )}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sand-100">
        <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-charcoal-600/70">
        <span className="figure text-champagne-600">{pct}% paid</span>
        {remaining != null && <span>Remaining <span className="figure text-charcoal">€{formatNumber(remaining)}</span></span>}
      </div>
    </div>
  );
}
