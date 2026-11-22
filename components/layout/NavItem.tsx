'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavItem({
  href,
  label,
  icon,
  compact = false,
  others = [],
}: {
  href: string;
  label: string;
  // Receive the icon as an already-rendered element, not a component function —
  // a function can't cross the Server → Client Component boundary (the parent
  // Sidebar renders it on the server). See components/layout/Sidebar.tsx.
  icon: ReactNode;
  compact?: boolean;
  /** Οι άλλες διευθύνσεις του μενού — αν κάποια ταιριάζει πιο συγκεκριμένα, αυτό δεν είναι ενεργό. */
  others?: string[];
}) {
  const pathname = usePathname();
  const matches = (h: string) => pathname === h || pathname.startsWith(h + '/');
  const active = matches(href) && !others.some((o) => o !== href && o.length > href.length && matches(o));

  return (
    <Link
      href={href}
      title={compact ? label : undefined}
      className={`group relative flex items-center rounded-lg py-[7px] text-[14px] transition-colors duration-150 ${compact ? 'justify-center px-0' : 'gap-2.5 px-3'} ${
        active
          ? 'bg-[color:var(--sb-active-bg)] font-medium text-[color:var(--sb-active-text)]'
          : 'text-[color:var(--sb-text)] hover:bg-[color:var(--sb-hover-bg)] hover:text-[color:var(--sb-text-hover)]'
      }`}
    >
      {active && (
        <span className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r bg-[color:var(--sb-active-text)]" />
      )}
      <span className={active ? 'text-[color:var(--sb-active-text)]' : 'text-[color:var(--sb-icon)] group-hover:text-[color:var(--sb-text-hover)]'}>{icon}</span>
      {!compact && <span>{label}</span>}
    </Link>
  );
}
