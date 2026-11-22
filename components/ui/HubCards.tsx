'use client';

import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';

/**
 * Κάρτες-«πλακίδια» στην κορυφή κάθε ενότητας (όπως στο FitnessCRM): λευκές,
 * με εικονίδιο σε απαλό φόντο του χρώματος της εταιρείας. Η ανοιχτή κάρτα
 * τονίζεται μόνο με το ίδιο χρώμα — κανένα άλλο χρώμα.
 */
export interface HubCardDef {
  key: string;
  icon: LucideIcon;
  title: string;
  value?: React.ReactNode;
  sub?: React.ReactNode;
  sub2?: React.ReactNode;
  href?: string;
}

export function HubCards({ cards, active, onSelect, cols = 4 }: { cards: HubCardDef[]; active?: string; onSelect?: (key: string) => void; cols?: 2 | 3 | 4 }) {
  const grid = cols === 3 ? 'grid-cols-2 lg:grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-2 xl:grid-cols-4';
  return (
    <div className={`grid gap-2.5 sm:gap-4 ${grid}`}>
      {cards.map((c) => <HubCard key={c.key} c={c} on={active === c.key} onSelect={onSelect} />)}
    </div>
  );
}

export function HubCard({ c, on, onSelect }: { c: HubCardDef; on: boolean; onSelect?: (key: string) => void }) {
  const cls = `group block w-full min-w-0 rounded-[14px] border p-3 text-left sm:p-4 shadow-sm transition-colors duration-150 ease-[cubic-bezier(0.4,0,0.2,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/30 ${on ? 'border-forest/40 bg-gradient-to-br from-white to-forest/[0.10] text-charcoal' : 'border-stone-line bg-white hover:border-forest/40 hover:bg-stone-50/60'}`;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-9 w-9 items-center justify-center rounded-xl sm:h-11 sm:w-11 ${on ? 'bg-forest/[0.12] text-forest' : 'bg-forest/[0.09] text-forest'}`}><c.icon size={19} strokeWidth={1.8} /></span>
        <span className={`hidden rounded-full border px-2.5 py-0.5 text-[12px] font-medium sm:inline  ${on ? 'border-forest/20 bg-forest/10 text-forest' : 'border-stone-line text-charcoal-600'}`}>{on ? 'Ανοιχτό' : 'Πατήστε για άνοιγμα'}</span>
      </div>
      <p className="mt-3 flex items-baseline justify-between gap-2 sm:mt-4">
        <span className={`truncate text-[15px] font-semibold sm:text-[17px] ${'text-charcoal'}`}>{c.title}</span>
        {c.value !== undefined && <span className={`text-xl font-semibold tabular-nums sm:text-2xl ${'text-charcoal'}`}>{c.value}</span>}
      </p>
      {c.sub && <p className={`mt-1 line-clamp-2 text-[13px] sm:text-[14px] ${on ? 'text-forest/80' : 'text-charcoal-600'}`}>{c.sub}</p>}
      {c.sub2 && <p className={`hidden text-[13px] sm:block ${on ? 'text-forest/70' : 'text-charcoal-600/80'}`}>{c.sub2}</p>}
    </>
  );
  if (c.href) return <Link href={c.href} scroll={false} className={cls}>{inner}</Link>;
  return <button type="button" onClick={() => onSelect?.(c.key)} className={cls}>{inner}</button>;
}
