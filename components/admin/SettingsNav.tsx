'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home, Brush, LayoutGrid, Grid3x3, Euro, Bell, Lock, Tag, Workflow, Plug, Database,
  Users, MessageSquare, Zap, ScrollText, ShieldCheck, LifeBuoy, LayoutList, Shuffle, type LucideIcon,
} from 'lucide-react';
import type { SettingsNavGroup } from '@/lib/settings-sections';
import { navLabel } from '@/lib/i18n';

const ICONS: Record<string, LucideIcon> = {
  business: Home, appearance: Brush, layout: LayoutGrid, dashboard: Grid3x3, invoices: Euro,
  notifications: Bell, security: Lock, tags: Tag, pipelines: Workflow, integrations: Plug, gdpr: Database, portals: LifeBuoy, unitforms: LayoutList, leads: Shuffle,
  users: Users, roles: ShieldCheck, templates: MessageSquare, automation: Zap, audit: ScrollText,
};

/** Left menu of the Settings area: every setting in one place, grouped. */
export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const section = searchParams?.get('section') ?? (pathname === '/settings' ? 'business' : null);

  const isActive = (href: string) => {
    const [base, query] = href.split('?');
    if (pathname !== base) return false;
    if (!query) return true;
    return new URLSearchParams(query).get('section') === section;
  };

  return (
    <nav className="panel space-y-4 p-3" aria-label="Ρυθμίσεις">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="eyebrow mb-1.5 px-2">{navLabel(`settings:${g.label}`, g.label)}</p>
          <div className="space-y-0.5">
            {g.items.map((it) => {
              const Icon = ICONS[it.icon] ?? Home;
              const active = isActive(it.href);
              return (
                <Link
                  key={it.href}
                  href={it.href}
                  scroll={false}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors ${active ? 'bg-forest/[0.07] font-medium text-forest' : 'text-charcoal-600 hover:bg-forest/5 hover:text-forest'}`}
                >
                  <Icon size={15} strokeWidth={1.75} /> {navLabel(it.href, it.label)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
