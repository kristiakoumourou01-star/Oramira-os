'use client';

import type { HTMLAttributes, ReactNode } from 'react';

/** Κλίμακα «Αυτόματο»: άμμος → φασκόμηλο → πράσινο Oramira (RGB χωρίς κόμματα, για rgb(… / a)). */
const TONES = ['191 171 136', '201 160 99', '184 146 92', '150 160 110', '110 150 112', '74 134 104', '47 110 84', '17 49 36'];
export function autoTone(i: number, n: number): string {
  if (n <= 1) return TONES[TONES.length - 1];
  return TONES[Math.round((i / (n - 1)) * (TONES.length - 1))];
}
/** Χρώμα στήλης: το δικό της (#rrggbb) αλλιώς η αυτόματη κλίμακα. */
export function laneTone(color: string | undefined | null, i: number, n: number): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(color ?? '');
  return m ? `${parseInt(m[1], 16)} ${parseInt(m[2], 16)} ${parseInt(m[3], 16)}` : autoTone(i, n);
}

/**
 * Μία στήλη πίνακα με την εμφάνιση των Deals: στρογγυλή «λωρίδα» με απαλό
 * χρώμα, κεφαλίδα με κουκκίδα, μετρητή και (προαιρετικά) μπάρα προόδου.
 */
export function BoardLane({ tone, title, count, meta, progress, over = false, highlight = false, empty, width = 'w-[280px]', children, className = '', ...rest }: {
  tone: string; title: ReactNode; count?: number; meta?: ReactNode; progress?: number; over?: boolean; highlight?: boolean; empty?: string | null; width?: string; children?: ReactNode; className?: string;
} & Omit<HTMLAttributes<HTMLDivElement>, 'title'>) {
  const hasItems = Array.isArray(children) ? children.some(Boolean) && (children as unknown[]).flat().length > 0 : !!children;
  return (
    <div {...rest}
      style={{ backgroundColor: `rgb(${tone} / ${over ? 0.18 : highlight ? 0.13 : 0.07})`, boxShadow: over ? `inset 0 0 0 2px rgb(${tone} / 0.6)` : highlight ? `inset 0 0 0 2px rgb(${tone} / 0.45)` : `inset 0 0 0 1px rgb(${tone} / 0.14)` }}
      className={`flex shrink-0 flex-col rounded-2xl transition-colors ${width} ${className}`}>
      <div className="px-3.5 pb-2.5 pt-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: `rgb(${tone})`, boxShadow: `0 0 0 3px rgb(${tone} / 0.18)` }} />
          <p className="min-w-0 flex-1 truncate text-[15px] font-semibold tracking-tight text-charcoal">{title}</p>
          {count !== undefined && <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ backgroundColor: `rgb(${tone} / 0.16)`, color: `rgb(${tone})` }}>{count}</span>}
        </div>
        {meta && <p className="mt-1 text-xs text-charcoal-600/75">{meta}</p>}
        {progress !== undefined && <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full" style={{ backgroundColor: `rgb(${tone} / 0.15)` }}><div className="h-full rounded-full" style={{ width: `${Math.max(3, Math.min(100, progress))}%`, backgroundColor: `rgb(${tone})` }} /></div>}
      </div>
      <div className="flex min-h-[120px] flex-1 flex-col gap-1 px-1.5 pb-2">
        {children}
        {!hasItems && empty !== null && <p className="mx-2 mt-2 rounded-xl border border-dashed py-6 text-center text-xs text-charcoal-600/50" style={{ borderColor: `rgb(${tone} / 0.3)` }}>{empty ?? 'Κενό'}</p>}
      </div>
    </div>
  );
}

/** Γραμμή μέσα σε στήλη (όχι «κουτί»): απαλό λευκό, φωτίζεται στο hover. */
export const laneRow = 'group relative rounded-xl bg-white/70 px-3 py-2.5 text-sm transition hover:bg-white hover:shadow-[0_4px_16px_-6px_rgba(17,49,36,0.18)]';
