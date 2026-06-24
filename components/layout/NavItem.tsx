'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

export function NavItem({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  // Receive the icon as an already-rendered element, not a component function —
  // a function can't cross the Server → Client Component boundary (the parent
  // Sidebar renders it on the server). See components/layout/Sidebar.tsx.
  icon: ReactNode;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + '/');

  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-white/10 text-stone-100'
          : 'text-stone-100/65 hover:bg-white/5 hover:text-stone-100'
      }`}
    >
      {active && (
        <span className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 bg-champagne" />
      )}
      {icon}
      <span>{label}</span>
    </Link>
  );
}
