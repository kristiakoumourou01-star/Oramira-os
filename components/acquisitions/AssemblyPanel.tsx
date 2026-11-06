import Link from 'next/link';
import { Layers, Puzzle } from 'lucide-react';
import type { AssemblyCluster } from '@/lib/land-assembly';
import { STAGE_LABEL } from '@/lib/acquisitions-shared';
import { formatNumber } from '@/lib/format';

/** Land assembly opportunities — clusters of adjacent owners in one area, with
 *  fragmentation flags and how much is already secured. */
export function AssemblyPanel({ clusters }: { clusters: AssemblyCluster[] }) {
  if (clusters.length === 0) {
    return (
      <div className="panel flex flex-col items-center p-10 text-center">
        <span className="mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/8 text-forest"><Puzzle size={20} /></span>
        <p className="text-sm font-medium text-charcoal">No assembly clusters yet</p>
        <p className="mt-1 max-w-sm text-xs text-charcoal-600/60">Tag parcels with the same <span className="font-medium">assembly area</span> and once two or more owners share one, potential land-assembly plays will surface here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clusters.map((c) => (
        <div key={c.areaRef} className="panel p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h4 className="flex items-center gap-2 text-charcoal"><Layers size={16} className="text-forest" strokeWidth={1.85} /> {c.areaRef}</h4>
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              {c.strategic && <span className="rounded-full bg-forest px-2 py-0.5 font-medium text-white">Strategic</span>}
              {c.fragmented && <span className="rounded-full bg-champagne-50 px-2 py-0.5 font-medium text-champagne-600">Fragmented</span>}
              <span className="rounded-full bg-forest/8 px-2 py-0.5 text-forest">{c.ownerCount} owners · {formatNumber(Math.round(c.totalArea))}m²</span>
              <span className="figure rounded-full bg-sand-100 px-2 py-0.5 text-charcoal-600">avg {c.avgScore}</span>
            </div>
          </div>
          {c.estimatedUplift > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-x-6 gap-y-1 rounded-lg bg-forest/[0.04] px-3 py-2 text-xs">
              <span className="text-charcoal-600/70">Uplift if fully assembled <span className="figure font-semibold text-forest">€{formatNumber(Math.round(c.estimatedUplift))}</span></span>
              {c.missingCount > 0 && <span className="text-charcoal-600/70">Missing <span className="figure font-semibold text-signal-danger">{c.missingCount}</span> of {c.ownerCount} owners</span>}
            </div>
          )}
          {/* progress */}
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-[11px] text-charcoal-600/60"><span>Secured {c.securedCount}/{c.ownerCount}</span><span>{c.progressPct}%</span></div>
            <div className="h-1.5 w-full rounded-full bg-sand-100"><div className="h-1.5 rounded-full bg-forest" style={{ width: `${Math.max(3, c.progressPct)}%` }} /></div>
          </div>
          <ul className="divide-y divide-stone-line">
            {c.parcels.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <Link href={`/acquisitions/${p.id}`} className="min-w-0 truncate text-charcoal hover:text-forest">{p.reference}{p.ownerName ? ` · ${p.ownerName}` : ''}</Link>
                <span className="flex shrink-0 items-center gap-2 text-[11px]">
                  <span className="text-charcoal-600/55">{p.plotSizeSqm ? `${formatNumber(Number(p.plotSizeSqm))}m²` : '—'}</span>
                  <span className="rounded bg-sand-100 px-1.5 py-0.5 text-charcoal-600/70">{STAGE_LABEL[p.stage] ?? p.stage}</span>
                  <span className="figure text-forest">{p.score}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
