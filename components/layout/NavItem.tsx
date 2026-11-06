'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavItem({
  href,
  label,
  icon,
  compact = false,
}: {
  href: string;
  label: string;
  // Receive the icon as an already-rendered element, not a component function —
  // a function can't cross the Server → Client Component boundary (the parent
  // Sidebar renders it on the server). See components/layout/Sidebar.tsx.
  icon: ReactNode;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      title={compact ? label : undefined}
      className={`group relative flex items-center rounded-lg py-1.5 text-[13px] transition-all duration-150 ${compact ? 'justify-center px-0' : 'gap-2.5 px-3'} ${
        active
          ? 'bg-gradient-to-r from-champagne/[0.18] to-white/[0.05] font-medium text-champagne shadow-[inset_0_0_0_1px_rgba(200,169,107,0.2)]'
          : 'text-stone-100/60 hover:bg-white/[0.07] hover:text-stone-100'
      } ${active || compact ? '' : 'hover:translate-x-0.5'}`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-champagne shadow-[0_0_8px_rgba(200,169,107,0.5)]" />
      )}
      <span className={active ? 'text-champagne' : 'text-stone-100/65 group-hover:text-stone-100'}>{icon}</span>
      {!compact && <span>{label}</span>}
    </Link>
  );
}
