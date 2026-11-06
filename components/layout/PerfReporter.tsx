'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

/**
 * Μετρά πόσο αργεί κάθε σελίδα όπως τη ζει ο χρήστης (από το κλικ μέχρι να
 * εμφανιστεί) και το στέλνει στα logs του server ως «[perf] …». Μόνο αριθμοί
 * και η διαδρομή — κανένα προσωπικό δεδομένο.
 */
export function PerfReporter() {
  const pathname = usePathname();
  const search = useSearchParams();
  const clickAt = useRef<number | null>(null);
  const first = useRef(true);

  const send = (body: Record<string, unknown>) => {
    try {
      const data = JSON.stringify(body);
      if (!navigator.sendBeacon?.('/api/perf', new Blob([data], { type: 'application/json' }))) {
        void fetch('/api/perf', { method: 'POST', body: data, keepalive: true, headers: { 'content-type': 'application/json' } });
      }
    } catch { /* never break the page */ }
  };

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (a && a.origin === location.origin && !a.target && !e.metaKey && !e.ctrlKey) clickAt.current = performance.now();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      const report = () => {
        const n = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (n) send({ kind: 'load', path: pathname, ttfb: Math.round(n.responseStart), ms: Math.round(n.loadEventEnd || n.domContentLoadedEventEnd) });
      };
      if (document.readyState === 'complete') setTimeout(report, 0); else window.addEventListener('load', () => setTimeout(report, 0), { once: true });
      return;
    }
    if (clickAt.current !== null) {
      const t0 = clickAt.current; clickAt.current = null;
      requestAnimationFrame(() => send({ kind: 'nav', path: pathname, ms: Math.round(performance.now() - t0) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, search]);

  return null;
}
