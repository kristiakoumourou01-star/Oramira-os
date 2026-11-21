'use client';

import { BarChart3, Briefcase, LineChart, Users, Award, Building2, Wallet, Wrench, Megaphone, PhoneCall, SlidersHorizontal, TrendingUp } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import type { ReportTileDef } from '@/lib/reports-shared';

const ICONS: Record<string, any> = { BarChart3, Briefcase, LineChart, Users, Award, Building2, Wallet, Wrench, Megaphone, PhoneCall, SlidersHorizontal, TrendingUp };

/** Reports όπως στο FitnessCRM: πλέγμα με κάρτες αναφορών· κάθε κάρτα ανοίγει τη δική της σελίδα. */
export function ReportsHub({ tiles }: { tiles: ReportTileDef[] }) {
  return <HubCards cols={3} cards={tiles.map((t) => ({ key: t.key, icon: ICONS[t.icon] ?? BarChart3, title: t.title, sub: t.desc, href: `/reports?tab=${t.key}` }))} />;
}
