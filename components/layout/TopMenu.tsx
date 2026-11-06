'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface TopMenuItem { href: string; label: string; icon: ReactNode; children?: { href: string; label: string }[] }

/**
 * Horizontal menu (Settings → Μενού & διάταξη → "Πάνω"). Same entries as the
 * sidebar; a section's sub-items open in a dropdown on hover or keyboard focus.
 */
export function TopMenu({ sections, footer, brand }: { sections: { label?: string; items: TopMenuItem[] }[]; footer?: ReactNode; brand?: ReactNode }) {
  const pathname = usePathname();
  const isActive = (it: TopMenuItem) =>
    [it.href, ...(it.children ?? []).map((c) => c.href)].some((h) => {
      const base = h.split('?')[0];
      return pathname === base || pathname.startsWith(base + '/');
    });

  return (
    <header className="relative z-30 flex items-center gap-4 [background:var(--sidebar-bg)] px-4 py-2">
      {brand}
      <nav className="flex flex-1 flex-wrap items-center gap-0.5" aria-label="Κύριο μενού">
        {sections.flatMap((s) => s.items).map((it) => {
          const active = isActive(it);
          const base = `flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors ${active ? 'bg-white/[0.08] font-medium text-champagne' : 'text-stone-100/70 hover:bg-white/[0.07] hover:text-stone-100'}`;
          if (!it.children || it.children.length === 0) {
            return <Link key={it.href} href={it.href} className={base}>{it.icon}{it.label}</Link>;
          }
          return (
            <div key={it.href} className="group relative">
              <Link href={it.href} className={base}>
                {it.icon}{it.label}<ChevronDown size={12} className="opacity-60" />
              </Link>
              <div className="invisible absolute left-0 top-full z-40 min-w-[200px] pt-1 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="rounded-lg bg-white p-1.5 shadow-overlay ring-1 ring-forest/10">
                  {it.children.map((c) => (
                    <Link key={c.href} href={c.href} className="block rounded-md px-3 py-1.5 text-[13px] text-charcoal-600 hover:bg-forest/5 hover:text-forest">
                      {c.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>
      {footer && <div className="w-32 shrink-0">{footer}</div>}
    </header>
  );
}
