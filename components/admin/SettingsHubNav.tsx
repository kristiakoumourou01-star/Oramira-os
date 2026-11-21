'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { getSection, type SettingsNavGroup } from '@/lib/settings-sections';
import { navLabel } from '@/lib/i18n';
import { SettingsFrame } from '@/components/ui/SettingsFrame';

/** Ρυθμίσεις όπως στο FitnessCRM: μπάνερ, αριστερά μενού με ομάδες και εικονίδια, δεξιά το περιεχόμενο. */
export function SettingsHubNav({ groups, company, children }: { groups: SettingsNavGroup[]; company?: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();
  const raw = sp?.get('section') ?? (pathname === '/settings' ? 'business' : null);
  const section = raw ? getSection(raw).key : null;
  const isActive = (href: string) => {
    const [base, query] = href.split('?');
    if (pathname !== base && !pathname.startsWith(base + '/')) return false;
    if (!query) return true;
    return new URLSearchParams(query).get('section') === section;
  };
  // Staff, Ρόλοι και Mobile app είναι δικές τους σελίδες στο μενού Admin (με δικές τους κάρτες).
  if (/^\/settings\/(users|roles|mobile-app)/.test(pathname)) return <>{children}</>;

  const frameGroups = groups.map((g) => ({ label: navLabel(`settings:${g.label}`, g.label), items: g.items.map((it) => ({ label: navLabel(it.href, it.label), href: it.href, icon: it.icon })) }));
  const active = groups.flatMap((g) => g.items).find((it) => isActive(it.href))?.href ?? '';
  return (
    <SettingsFrame icon="settings" title="Ρυθμίσεις" subtitle="Προσαρμόστε τον λογαριασμό, την εμφάνιση, τις ειδοποιήσεις, τις πληρωμές και τις συνδέσεις."
      aside={company} groups={frameGroups} activeHref={active}>
      {children}
    </SettingsFrame>
  );
}
