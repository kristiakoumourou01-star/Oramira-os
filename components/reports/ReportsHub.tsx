'use client';

import { useEffect, useRef } from 'react';
import { BarChart3, Briefcase, LineChart, Users, Award, Building2, Wallet, Wrench, Megaphone, PhoneCall, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import type { ReportTileDef } from '@/lib/reports-shared';

const ICONS: Record<string, any> = { BarChart3, Briefcase, LineChart, Users, Award, Building2, Wallet, Wrench, Megaphone, PhoneCall, SlidersHorizontal, TrendingUp };

/**
 * Reports όπως στο FitnessCRM: οι κάρτες μένουν πάνω και η επιλεγμένη αναφορά
 * ανοίγει ΑΠΟ ΚΑΤΩ, στην ίδια σελίδα — η σελίδα κατεβαίνει ομαλά σε αυτήν.
 */
export function ReportsHub({ tiles, active, children }: { tiles: ReportTileDef[]; active: string | null; children?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (active && ref.current) ref.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [active]);
  return (
    <div className="space-y-8">
      <HubCards cols={3} active={active ?? undefined} cards={tiles.map((t) => ({ key: t.key, icon: ICONS[t.icon] ?? BarChart3, title: t.title, sub: t.desc, href: `/reports?r=${t.key}` }))} />
      <div ref={ref} id="report" className="scroll-mt-20">{children}</div>
    </div>
  );
}
