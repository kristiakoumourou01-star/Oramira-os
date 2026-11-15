'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { BarChart3, Briefcase, LineChart, Target, Network, Brain, Users, Layers, Home, CalendarCheck, BadgePercent, Receipt, Wrench, ListChecks, Plane, ChevronRight } from 'lucide-react';

export interface ReportTile { key: string; title: string; desc: string; icon: string; group: string; tone: string }
const ICONS: Record<string, any> = { BarChart3, Briefcase, LineChart, Target, Network, Brain, Users, Layers, Home, CalendarCheck, BadgePercent, Receipt, Wrench, ListChecks, Plane };
const TONE: Record<string, string> = {
  forest: 'bg-forest text-white', green: 'bg-emerald-500 text-white', amber: 'bg-amber-500 text-white', sky: 'bg-sky-500 text-white',
  violet: 'bg-violet-500 text-white', rose: 'bg-rose-500 text-white', sand: 'bg-[#b07d22] text-white', teal: 'bg-teal-500 text-white',
};

/**
 * Reports όπως στο FitnessCRM: κουτάκια ανά κατηγορία πάνω· με κλικ η σελίδα
 * κατεβαίνει στην αναφορά (με export / εκτύπωση).
 */
export function ReportsHub({ tiles, active, children }: { tiles: ReportTile[]; active: string | null; children?: React.ReactNode }) {
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [active]);
  const groups = Array.from(new Set(tiles.map((t) => t.group)));
  const current = tiles.find((t) => t.key === active);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <section key={g}>
          <p className="mb-2.5 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-forest"><span className="h-4 w-1 rounded-full bg-forest" />{g}</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.filter((t) => t.group === g).map((t) => {
              const I = ICONS[t.icon] ?? BarChart3; const on = t.key === active;
              return (
                <Link key={t.key} href={`${path}?tab=${t.key}`} scroll={false} aria-current={on ? 'page' : undefined}
                  className={`group flex items-start gap-3 rounded-2xl border p-4 transition ${on ? 'border-forest bg-forest/[0.06] shadow-[0_0_0_2px_rgba(17,49,36,0.25)]' : 'border-stone-line bg-white hover:-translate-y-0.5 hover:border-forest/30 hover:shadow-[0_8px_20px_-12px_rgba(17,49,36,0.35)]'}`}>
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${TONE[t.tone] ?? TONE.forest}`}><I size={18} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 font-semibold text-charcoal">{t.title}<ChevronRight size={14} className={`transition ${on ? 'text-forest' : 'text-charcoal-600/30 group-hover:translate-x-0.5 group-hover:text-forest'}`} /></span>
                    <span className="mt-0.5 block text-xs leading-snug text-charcoal-600/70">{t.desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <div ref={ref} className="scroll-mt-20">
        {current ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b border-stone-line pb-3">
              <h2 className="font-display text-2xl text-charcoal">{current.title}</h2>
            </div>
            {children}
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-forest/25 bg-forest/[0.03] px-4 py-10 text-center text-sm text-charcoal-600/70">Διαλέξτε μια αναφορά από τα κουτάκια για να εμφανιστεί εδώ.</p>
        )}
      </div>
    </div>
  );
}
