import type { ReactNode } from 'react';
import type { Tone } from '@/lib/status-tone-shared';

export type { Tone };

/**
 * Χρωματιστή «ταμπέλα» κατάστασης για πίνακες (όπως τα status badges του FitnessCRM).
 * Μόνο σημασιολογικά χρώματα — τα επιλεγμένα στοιχεία μένουν bg-forest text-white.
 */
export function StatusPill({ tone = 'neutral', dot = false, className = '', title, children }: {
  tone?: Tone; dot?: boolean; className?: string; title?: string; children: ReactNode;
}) {
  return (
    <span title={title} className={`pill pill-${tone} ${className}`}>
      {dot && <span className="pill-dot" aria-hidden />}
      {children}
    </span>
  );
}

/** Μόνο η χρωματιστή τελεία (π.χ. δίπλα σε dropdown κατάστασης που αλλάζει). */
export function StatusDot({ tone = 'neutral', className = '' }: { tone?: Tone; className?: string }) {
  return <span aria-hidden className={`pill-${tone} pill-solo ${className}`} />;
}
