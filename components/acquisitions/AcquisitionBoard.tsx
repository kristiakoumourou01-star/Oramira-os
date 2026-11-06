'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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
    <div className="flex gap-3 overflow-x-auto pb-2">
      {PARCEL_STAGES.map((stage) => {
        const items = byStage(stage);
        return (
          <div key={stage} className="flex w-64 shrink-0 flex-col">
            <div className="mb-2 flex items-center justify-between px-1">
              <span className="text-[13px] font-semibold text-charcoal">{STAGE_LABEL[stage]}</span>
              <span className="figure rounded-full bg-forest/8 px-2 py-0.5 text-[11px] text-forest">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#E6DDCD] py-6 text-center text-[11px] text-charcoal-600/45">Empty</div>
              ) : items.map((p) => (
                <div key={p.id} className={`group rounded-xl bg-white p-3 shadow-[0_1px_2px_rgba(31,77,58,0.04),0_6px_16px_rgba(31,77,58,0.06),inset_0_0_0_1px_rgba(31,77,58,0.04)] transition-shadow hover:shadow-[0_10px_24px_rgba(31,77,58,0.12)] ${moving === p.id ? 'opacity-50' : ''}`}>
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <Link href={`/acquisitions/${p.id}`} className="min-w-0 flex items-center gap-1 text-sm font-medium text-charcoal hover:text-forest">
                      <span className="truncate">{p.reference}</span><ArrowUpRight size={12} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                    </Link>
                    <span className={`figure shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${BAND[p.score.band]}`}>{p.score.score}</span>
                  </div>
                  <div className="space-y-0.5 text-[11px] text-charcoal-600/60">
                    {p.ownerName && <p className="truncate">{p.ownerName}</p>}
                    <p className="flex items-center gap-2">
                      {p.location && <span className="flex items-center gap-0.5"><MapPin size={10} /> {p.location}</span>}
                      {p.plotSizeSqm && <span className="flex items-center gap-0.5"><Ruler size={10} /> {formatNumber(Number(p.plotSizeSqm))}m²</span>}
                    </p>
                    {p.uplift && <p className="text-forest">Uplift {formatCurrency(p.uplift.marginAbs)}{p.uplift.estimated ? ' (est.)' : ''}</p>}
                  </div>
                  <select value={p.stage} onChange={(e) => move(p.id, e.target.value)} className="mt-2 w-full rounded-md border border-[#E8E0D2] bg-white px-1.5 py-1 text-[11px] text-charcoal-600 focus:border-forest focus:outline-none">
                    {PARCEL_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
