'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import { DEFAULT_NAV } from '@/lib/nav';

const ACCOUNT_TABS: Record<string, string> = { info: 'Πληροφορίες', logs: 'Logs', audit: 'Audit log', display: 'Εμφάνιση', notifications: 'Ειδοποιήσεις', news: 'Τι νέο' };
const EXTRA: { prefix: string; label: string }[] = [
  { prefix: '/units', label: 'Μονάδα' }, { prefix: '/map', label: 'Χάρτης' }, { prefix: '/price-list', label: 'Τιμοκατάλογος' },
  { prefix: '/password', label: 'Κωδικός' }, { prefix: '/security', label: 'Ασφάλεια' },
];

/** «Πού βρίσκομαι»: Ενότητα › Σελίδα (› λεπτομέρεια) στην πάνω μπάρα, αριστερά. */
export function Breadcrumbs() {
  const path = usePathname() || '/';
  const sp = useSearchParams();
  const tab = sp?.get('tab') ?? '';
  const here = tab ? `${path}?tab=${tab}` : path;

  let best: { group: string; groupHref: string; label: string; href: string; score: number } | null = null;
  const consider = (group: string, groupHref: string, label: string, href: string) => {
    const [hp, hq] = href.split('?');
    const exact = here === href;
    const pathOk = path === hp || path.startsWith(hp + '/');
    if (!exact && !pathOk) return;
    if (hq && !exact) return; // ένα «?tab=…» ταιριάζει μόνο ακριβώς
    const score = (exact ? 1000 : 0) + hp.length + (hq ? 1 : 0);
    if (!best || score > best.score) best = { group, groupHref, label, href, score };
  };
  for (const sec of DEFAULT_NAV) for (const g of sec.items) {
    consider(g.label, g.href, g.label, g.href);
    for (const c of g.children ?? []) consider(g.label, g.href, c.label, c.href);
  }

  const crumbs: { label: string; href?: string }[] = [];
  const b = best as { group: string; groupHref: string; label: string; href: string } | null;
  if (b) {
    if (b.group !== b.label) crumbs.push({ label: b.group, href: b.groupHref });
    crumbs.push({ label: b.label, href: b.href });
    const base = b.href.split('?')[0];
    if (path.startsWith('/account') && tab && ACCOUNT_TABS[tab] && !crumbs.some((c) => c.label === ACCOUNT_TABS[tab])) crumbs.push({ label: ACCOUNT_TABS[tab] });
    else if (path.length > base.length + 1 && path.startsWith(base + '/')) {
      const rest = path.slice(base.length);
      const ex = [...EXTRA].reverse().find((e) => rest.includes(e.prefix));
      crumbs.push({ label: 'Λεπτομέρειες' });
      if (ex) crumbs.push({ label: ex.label });
    }
  }
  if (!crumbs.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="ml-2 hidden min-w-0 items-center gap-1.5 text-sm md:flex">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        return (
          <span key={i} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <ChevronRight size={14} className="shrink-0 text-charcoal-600/40" />}
            {last || !c.href
              ? <span className={`truncate ${last ? 'font-semibold text-charcoal' : 'text-charcoal-600/70'}`}>{c.label}</span>
              : <Link href={c.href} className="truncate text-charcoal-600/70 transition hover:text-forest">{c.label}</Link>}
          </span>
        );
      })}
    </nav>
  );
}
