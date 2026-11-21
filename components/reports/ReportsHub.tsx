'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { BarChart3, Briefcase, LineChart, Target, Network, Brain, Users, Layers, Home, CalendarCheck, BadgePercent, Receipt, Wrench, ListChecks, Plane, SlidersHorizontal, Megaphone } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';

export interface ReportTile { key: string; title: string; desc: string; icon: string; group?: string; tone?: string }
const ICONS: Record<string, any> = { BarChart3, Briefcase, LineChart, Target, Network, Brain, Users, Layers, Home, CalendarCheck, BadgePercent, Receipt, Wrench, ListChecks, Plane, SlidersHorizontal, Megaphone };

/**
 * Reports όπως στο FitnessCRM: πλέγμα 3 στηλών με ίδια λευκά κουτάκια (ένα
 * χρώμα — της εταιρείας)· με κλικ η αναφορά εμφανίζεται από κάτω, με export.
 */
export function ReportsHub({ tiles, active, children, footer }: { tiles: ReportTile[]; active: string | null; children?: React.ReactNode; footer?: React.ReactNode }) {
  const path = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [active]);
  return (
    <div className="space-y-8">
      <HubCards cols={3} active={active ?? undefined} cards={tiles.map((t) => ({ key: t.key, icon: ICONS[t.icon] ?? BarChart3, title: t.title, sub: t.desc, href: `${path}?tab=${t.key}` }))} />
      <div ref={ref} className="scroll-mt-20">
        {active ? children : footer}
      </div>
    </div>
  );
}
