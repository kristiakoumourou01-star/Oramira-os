'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { SettingsNavGroup } from '@/lib/settings-sections';
import { navLabel } from '@/lib/i18n';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { PopSelect } from '@/components/ui/PopSelect';
import { useRouter } from 'next/navigation';

/**
 * Ρυθμίσεις όπως στο FitnessCRM: αριστερά μενού με ομάδες (ΛΟΓΑΡΙΑΣΜΟΣ,
 * ΛΕΙΤΟΥΡΓΙΑ, ΦΟΡΟΙ, ΣΥΝΔΕΣΕΙΣ …) και από κάτω οι ρυθμίσεις τους, δεξιά το
 * περιεχόμενο. Στο κινητό το μενού γίνεται dropdown πάνω από το περιεχόμενο.
 */
export function SettingsHubNav({ groups, children }: { groups: SettingsNavGroup[]; children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const sp = useSearchParams();
  const router = useRouter();
  const section = sp?.get('section') ?? (pathname === '/settings' ? 'business' : null);
  const isActive = (href: string) => {
    const [base, query] = href.split('?');
    if (pathname !== base && !pathname.startsWith(base + '/')) return false;
    if (!query) return true;
    return new URLSearchParams(query).get('section') === section;
  };
  // Staff, Ρόλοι και Mobile app είναι δικές τους σελίδες στο μενού Admin (με δικές τους κάρτες).
  if (/^\/settings\/(users|roles|mobile-app)/.test(pathname)) return <>{children}</>;
  const all = groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })));
  const current = all.find((it) => isActive(it.href));
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Admin" title="Ρυθμίσεις" description="Όλες οι ρυθμίσεις της εταιρείας σε ένα μέρος: εμφάνιση, χρήστες, κανόνες, χρήματα και συνδέσεις." />
      <div className="lg:hidden">
        <PopSelect searchable width="w-full" ariaLabel="Ενότητα ρυθμίσεων" value={current?.href ?? ''} placeholder="Διαλέξτε ρύθμιση"
          onChange={(v) => router.push(v, { scroll: false })}
          options={all.map((it) => [it.href, `${navLabel(`settings:${it.group}`, it.group)} · ${navLabel(it.href, it.label)}`] as [string, string])} />
      </div>
      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <nav aria-label="Ρυθμίσεις" className="sticky top-20 hidden rounded-[14px] border border-stone-line bg-white p-3 shadow-sm lg:block">
          {groups.map((g, i) => (
            <div key={g.label} className={i > 0 ? 'mt-4' : ''}>
              <p className="mb-1 px-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-600/80">{navLabel(`settings:${g.label}`, g.label)}</p>
              <div className="space-y-px">
                {g.items.map((it) => {
                  const on = isActive(it.href);
                  return (
                    <Link key={it.href} href={it.href} scroll={false} aria-current={on ? 'page' : undefined}
                      className={`block truncate rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${on ? 'bg-forest/[0.09] font-medium text-forest' : 'text-charcoal-600 hover:bg-stone-50 hover:text-charcoal'}`}>
                      {navLabel(it.href, it.label)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div key={current?.href} className="anim-fade min-w-0">{children}</div>
      </div>
    </div>
  );
}
