import Link from 'next/link';
import { Home, ArrowUpRight, Map } from 'lucide-react';
import type { MatchResult } from '@/lib/matching';
import { formatCurrency } from '@/lib/format';

export interface RecommendedUnit {
  id: string;
  unit_number?: string | null;
  projectName?: string | null;
  projectId?: string | null;
  price?: number | null;
  match: MatchResult;
}

const TIER: Record<MatchResult['tier'], string> = {
  strong: 'bg-forest text-white',
  possible: 'bg-champagne-100 text-champagne-600',
  weak: 'bg-sand-100 text-charcoal-600/70',
};

/**
 * "Recommended properties" — the Matching Engine surfaced on the lead page. Ranks
 * available inventory against the buyer's budget/beds/preferred development so an
 * agent never has to hand-search which units to show. Rendered only when there
 * are real matches (no empty widget).
 */
export function RecommendedProperties({ matches, mapHref }: { matches: RecommendedUnit[]; mapHref?: string }) {
  if (matches.length === 0) return mapHref ? <Link href={mapHref} className="panel flex items-center gap-2 p-4 text-sm text-forest hover:bg-forest/[0.03]"><Map size={15} /> Ταίριασμα στον χάρτη</Link> : null;
  return (
    <div className="panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Home size={15} className="text-forest" strokeWidth={1.85} /> Προτεινόμενα ακίνητα</h4>
        {mapHref && <Link href={mapHref} className="flex items-center gap-1 text-xs text-forest hover:underline"><Map size={13} /> Στον χάρτη</Link>}
      </div>
      <ul className="space-y-2">
        {matches.map((m) => (
          <li key={m.id}>
            <Link href={m.projectId ? `/projects/${m.projectId}/units/${m.id}` : '#'} className="group flex items-center justify-between gap-2 rounded-lg border border-stone-line px-3 py-2 transition-colors hover:border-forest/40 hover:bg-forest/[0.03]">
              <div className="min-w-0">
                <p className="truncate text-sm text-charcoal">{m.projectName ?? 'Unit'}{m.unit_number ? ` · ${m.unit_number}` : ''}</p>
                <p className="truncate text-[11px] text-charcoal-600/60">{m.price != null ? formatCurrency(m.price) : '—'} · {m.match.reasons.slice(0, 2).join(', ')}</p>
                {m.match.misses?.length > 0 && <p className="truncate text-[11px] text-signal-danger">Λείπει: {m.match.misses.join(', ')}</p>}
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                <span className={`figure rounded px-1.5 py-0.5 text-[11px] font-medium ${TIER[m.match.tier]}`}>{m.match.score}</span>
                <ArrowUpRight size={13} className="text-charcoal-600/30 transition-colors group-hover:text-forest" />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
