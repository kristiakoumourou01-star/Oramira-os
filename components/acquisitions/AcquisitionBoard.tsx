'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BoardLane, autoTone, laneRow } from '@/components/ui/BoardLane';
import { MapPin, Ruler, ArrowUpRight } from 'lucide-react';
import { PARCEL_STAGES, STAGE_LABEL, type ParcelItem } from '@/lib/acquisitions-shared';
import { updateParcelStage } from '@/app/actions/acquisitions';
import { formatNumber, formatCurrency } from '@/lib/format';

const BAND: Record<string, string> = {
  Prime: 'bg-forest text-white', Strong: 'bg-forest/12 text-forest', Moderate: 'bg-champagne-50 text-champagne-600', Weak: 'bg-sand-100 text-charcoal-600/70',
};

/** Off-market sourcing pipeline — a horizontal stage board. Each card carries
 *  the land score; the stage select moves a parcel through the funnel. */
export function AcquisitionBoard({ parcels }: { parcels: ParcelItem[] }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [moving, setMoving] = useState<string | null>(null);

  const move = (id: string, stage: string) => { setMoving(id); start(async () => { const res = await updateParcelStage(id, stage); if (res && !res.ok) alert(res.error); router.refresh(); setMoving(null); }); };
  const byStage = (s: string) => parcels.filter((p) => p.stage === s);

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-2">
      <div className="flex min-h-[420px] min-w-max gap-3">
      {PARCEL_STAGES.map((stage, i) => {
        const items = byStage(stage);
        return (
          <BoardLane key={stage} tone={autoTone(i, PARCEL_STAGES.length)} title={STAGE_LABEL[stage]} count={items.length} width="w-[264px]" empty="Κενό"
            meta={items.length ? <>Μέση βαθμολογία <span className="font-semibold text-charcoal">{Math.round(items.reduce((s, p) => s + p.score.score, 0) / items.length)}</span></> : undefined}>
              {items.map((p) => (
                <div key={p.id} className={`${laneRow} ${moving === p.id ? 'opacity-50' : ''}`}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <Link href={`/acquisitions/${p.id}`} className="min-w-0 flex items-center gap-1 text-sm font-semibold text-charcoal hover:text-forest">
                      <span className="truncate">{p.reference}</span><ArrowUpRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <span className={`figure shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${BAND[p.score.band]}`}>{p.score.score}</span>
                  </div>
                  <div className="space-y-0.5 text-[11px] text-charcoal-600/70">
                    {p.ownerName && <p className="truncate">{p.ownerName}</p>}
                    <p className="flex items-center gap-2">
                      {p.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {p.location}</span>}
                      {p.plotSizeSqm && <span className="flex items-center gap-0.5"><Ruler size={10} /> {formatNumber(Number(p.plotSizeSqm))}m²</span>}
                    </p>
                    {p.uplift && <p className="font-medium text-forest">Uplift {formatCurrency(p.uplift.marginAbs)}{p.uplift.estimated ? ' (est.)' : ''}</p>}
                  </div>
                  <select value={p.stage} onChange={(e) => move(p.id, e.target.value)} className="mt-2 w-full rounded-full border border-forest/25 bg-white px-2.5 py-1 text-[11px] text-forest focus:border-forest focus:outline-none">
                    {PARCEL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select>
                </div>
              ))}
          </BoardLane>
        );
      })}
      </div>
    </div>
  );
}
