'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { UserCog, Workflow, Users, Euro, Plug, Database, type LucideIcon } from 'lucide-react';
import type { SettingsNavGroup } from '@/lib/settings-sections';
import { navLabel } from '@/lib/i18n';
import { HubCards } from '@/components/ui/HubCards';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

const GROUP_ICON: Record<string, LucideIcon> = { 'Λογαριασμός': UserCog, 'Λειτουργία': Workflow, 'Χρήστες': Users, 'Φόροι': Euro, 'Συνδέσεις': Plug, 'Δεδομένα': Database };
const GROUP_SUB: Record<string, string> = {
  'Λογαριασμός': 'Εταιρεία, εμφάνιση, μενού, dashboard', 'Λειτουργία': 'Ειδοποιήσεις, ασφάλεια, pipelines, leads', 'Χρήστες': 'Χρήστες, ρόλοι, προβολή ως χρήστης',
  'Φόροι': 'ΦΠΑ, αρίθμηση, αποδείξεις', 'Συνδέσεις': 'Επικοινωνία, mobile app, integrations', 'Δεδομένα': 'GDPR, διατήρηση, export',
};

/** Ρυθμίσεις όπως στο FitnessCRM: κάρτες ενοτήτων πάνω, οι ρυθμίσεις της ενότητας ως επιλογές και το περιεχόμενο από κάτω. */
export function SettingsHubNav({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = usePathname();
  const sp = useSearchParams();
  const section = sp?.get('section') ?? (pathname === '/settings' ? 'business' : null);
  const isActive = (href: string) => {
    const [base, query] = href.split('?');
    if (pathname !== base && !pathname.startsWith(base + '/')) return false;
    if (!query) return true;
    return new URLSearchParams(query).get('section') === section;
  };
  // Staff, Ρόλοι και Mobile app είναι δικές τους σελίδες στο μενού Admin (με δικές τους κάρτες).
  if (/^\/settings\/(users|roles|mobile-app)/.test(pathname ?? '')) return null;
  const activeGroup = groups.find((g) => g.items.some((it) => isActive(it.href))) ?? groups[0];
  return (
    <div className="space-y-4">
      <WorkspaceHeader eyebrow="Admin" title="Settings" description="Όλες οι ρυθμίσεις της εταιρείας σε ένα μέρος: εμφάνιση, χρήστες, κανόνες, χρήματα και συνδέσεις." />
      <HubCards cols={3} active={activeGroup?.label} cards={groups.map((g) => ({ key: g.label, icon: GROUP_ICON[g.label] ?? Workflow, title: navLabel(`settings:${g.label}`, g.label), value: g.items.length, sub: GROUP_SUB[g.label], href: g.items[0].href }))} />
      {activeGroup && activeGroup.items.length > 1 && (
        <nav className="flex flex-wrap gap-1.5 rounded-2xl border border-stone-line bg-white p-1.5" aria-label="Ρυθμίσεις">
          {activeGroup.items.map((it) => {
            const on = isActive(it.href);
            return <Link key={it.href} href={it.href} scroll={false} className={`rounded-xl px-3.5 py-2 text-[14px] font-medium transition ${on ? 'bg-forest/[0.09] text-forest' : 'text-charcoal-600 hover:bg-stone-50 hover:text-charcoal'}`}>{navLabel(it.href, it.label)}</Link>;
          })}
        </nav>
      )}
    </div>
  );
}
