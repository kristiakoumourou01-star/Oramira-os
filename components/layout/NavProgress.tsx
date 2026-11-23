'use client';

import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Λεπτή γραμμή στο πάνω μέρος όσο ανοίγει η επόμενη σελίδα — η τρέχουσα σελίδα
 * μένει ορατή (χωρίς κενό σκελετό) μέχρι να είναι έτοιμη η καινούρια.
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [on, setOn] = useState(false);
  useEffect(() => { setOn(false); }, [pathname, search]);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || a.target || a.hasAttribute('download') || a.origin !== location.origin) return;
      if (a.pathname === location.pathname && a.search === location.search) return;
      setOn(true);
    };
    document.addEventListener('click', click);
    return () => document.removeEventListener('click', click);
  }, []);
  if (!on) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px] overflow-hidden" aria-hidden="true">
      <div className="nav-progress h-full w-1/3 bg-forest" />
    </div>
  );
}
