'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

export interface NavSubItem { href: string; label: string; badge?: number }

/**
 * Collapsible workspace group for the sidebar. The header links to the
 * workspace's primary page; the chevron expands its sub-items (which deep-link
 * to in-page tabs via ?tab=…). Auto-expands when its route is active. Client-only
 * (usePathname) — receives the icon as a pre-rendered element from the server.
 */
const OPEN_EVENT = 'oramira:nav-open';
const OPEN_KEY = 'nav:open';

export function NavGroup({ href, label, icon, items: children, compact = false, accordion = true }: { href: string; label: string; icon: ReactNode; items: NavSubItem[]; compact?: boolean; accordion?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams?.get('tab') ?? null;
  const bases = children.map((c) => c.href.split('?')[0]);
  const active = pathname === href || pathname.startsWith(href + '/') || bases.some((b) => pathname === b || pathname.startsWith(b + '/'));
  const [open, setOpen] = useState(active); // SSR-safe default (matches server render)
  const key = `nav:${label}`;

  // «Μία ενότητα ανοιχτή τη φορά»: opening a group tells the others to close.
  const announce = () => {
    if (!accordion) return;
    try { window.localStorage.setItem(OPEN_KEY, label); } catch {}
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: label }));
  };
  useEffect(() => {
    if (!accordion) return;
    const onOpen = (e: Event) => { if ((e as CustomEvent).detail !== label) setOpen(false); };
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_EVENT, onOpen);
  }, [accordion, label]);

  // Restore the last state on mount; the active group always opens.
  useEffect(() => {
    let stored: string | null = null;
    try { stored = accordion ? window.localStorage.getItem(OPEN_KEY) : window.localStorage.getItem(key); } catch {}
    if (active) setOpen(true);
    else if (stored !== null) setOpen(accordion ? stored === label : stored === '1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { if (active) { setOpen(true); announce(); } // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);
  const toggle = () => {
    const n = !open;
    setOpen(n);
    if (accordion) {
      if (n) announce();
      else { try { if (window.localStorage.getItem(OPEN_KEY) === label) window.localStorage.removeItem(OPEN_KEY); } catch {} }
    } else {
      try { window.localStorage.setItem(key, n ? '1' : '0'); } catch {}
    }
  };

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
        <Link href={href} onClick={() => { if (!open) { setOpen(true); announce(); } }} className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-[13px] transition-colors ${active ? 'font-medium text-champagne' : 'text-stone-100/65 hover:text-stone-100'}`}>
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
              <Link key={c.href} href={c.href} className={`flex items-center justify-between gap-2 rounded-md px-2.5 py-1 text-[12.5px] transition-colors ${on ? 'font-medium text-champagne' : 'text-stone-100/55 hover:bg-white/[0.05] hover:text-stone-100/90'}`}>
                <span className="truncate">{c.label}</span>
                {c.badge ? <span className="shrink-0 rounded-full bg-signal-danger px-1.5 text-[10px] font-semibold leading-4 text-white">{c.badge > 99 ? '99+' : c.badge}</span> : null}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
