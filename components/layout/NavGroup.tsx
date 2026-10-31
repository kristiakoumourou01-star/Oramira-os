'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface NavSubItem { href: string; label: string }

/**
 * Collapsible workspace group for the sidebar. The header links to the
 * workspace's primary page; the chevron expands its sub-items (which deep-link
 * to in-page tabs via ?tab=…). Auto-expands when its route is active. Client-only
 * (usePathname) — receives the icon as a pre-rendered element from the server.
 */
export function NavGroup({ href, label, icon, items: children, compact = false }: { href: string; label: string; icon: ReactNode; items: NavSubItem[]; compact?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get('tab') ?? null;
  const bases = children.map((c) => c.href.split('?')[0]);
  const active = pathname === href || pathname.startsWith(href + '/') || bases.some((b) => pathname === b || pathname.startsWith(b + '/'));
  const [open, setOpen] = useState(active); // SSR-safe default (matches server render)
  const key = `nav:${label}`;

  // Restore persisted collapse state on mount; the active group always opens.
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
    if (stored !== null) setOpen(stored === '1');
    else if (active) setOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (active) setOpen(true); }, [active]);
  const toggle = () => setOpen((o) => { const n = !o; try { window.localStorage.setItem(key, n ? '1' : '0'); } catch {} return n; });

  // Compact rail: the group collapses to a single icon link to its primary page.
  if (compact) {
    return (
      <Link href={href} title={label} className={`group relative flex items-center justify-center rounded-lg py-1.5 ${active ? 'bg-white/[0.06] text-champagne' : 'text-stone-100/60 hover:bg-white/[0.07] hover:text-stone-100'}`}>
        {active && <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-champagne" />}
        <span className={active ? 'text-champagne' : 'text-stone-100/60 group-hover:text-stone-100'}>{icon}</span>
      </Link>
    );
  }

  return (
    <div>
      <div className={`group flex items-center rounded-lg pr-1 transition-colors ${active ? 'bg-white/[0.06]' : 'hover:bg-white/[0.05]'}`}>
        <Link href={href} className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${active ? 'font-medium text-champagne' : 'text-stone-100/65 hover:text-stone-100'}`}>
          <span className={active ? 'text-champagne' : 'text-stone-100/60 group-hover:text-stone-100'}>{icon}</span>
          <span className="truncate">{label}</span>
        </Link>
        <button onClick={toggle} aria-label={`Toggle ${label}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-100/40 hover:text-stone-100">
          <ChevronDown size={14} className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`} />
        </button>
      </div>

      {open && (
        <div className="mb-1 mt-0.5 space-y-px border-l border-white/[0.08] pl-3.5 ml-4">
          {children.map((c, i) => {
            // A sub-item is active when its page matches and, for tab links,
            // its ?tab= matches — or, with no tab in the URL, it is the page's
            // first tab (the one the page opens on).
            const [base, query] = c.href.split('?');
            const tab = query ? new URLSearchParams(query).get('tab') : null;
            const firstForBase = children.findIndex((x) => x.href.split('?')[0] === base) === i;
            // Deeper pages (e.g. /financials/invoices/123) light up their own sub-item.
            const deeper = !tab && pathname.startsWith(base + '/') && !children.some((x) => x.href !== c.href && pathname.startsWith(x.href.split('?')[0]) && x.href.split('?')[0].length > base.length);
            const on = (pathname === base && (tab ? currentTab === tab || (!currentTab && firstForBase) : !currentTab)) || deeper;
            return (
              <Link key={c.href} href={c.href} className={`block rounded-md px-2.5 py-1 text-[12.5px] transition-colors ${on ? 'font-medium text-champagne' : 'text-stone-100/55 hover:bg-white/[0.05] hover:text-stone-100/90'}`}>
                {c.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
