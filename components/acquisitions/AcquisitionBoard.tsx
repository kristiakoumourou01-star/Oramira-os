'use client';

import { PopSelect } from '@/components/ui/PopSelect';

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
  const [drag, setDrag] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [local, setLocal] = useState<Record<string, string>>({});

  const move = (id: string, stage: string) => {
    const cur = local[id] ?? parcels.find((p) => p.id === id)?.stage;
    if (!stage || cur === stage) return;
    setErr(null); setMoving(id); setLocal((l) => ({ ...l, [id]: stage }));
    start(async () => {
      const res = await updateParcelStage(id, stage);
      if (res && !res.ok) { setErr(res.error ?? 'Δεν έγινε η μετακίνηση.'); setLocal((l) => { const n = { ...l }; delete n[id]; return n; }); }
      router.refresh(); setMoving(null);
    });
  };
  const byStage = (s: string) => parcels.filter((p) => (local[p.id] ?? p.stage) === s);

  return (
    <div className="-mx-1 overflow-x-auto rounded-2xl border border-stone-line bg-white p-3 pb-2 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="mb-2 text-[13px] text-charcoal-600">Σύρετε ένα οικόπεδο σε άλλο στάδιο. Το «Deal Analyzer» το βάζει αυτόματα «Σε ανάλυση»· η έγκριση το περνά στο «Acquired» και η απόρριψη στο «Απορρίφθηκε».</p>
      {err && <p className="mb-2 rounded-xl border border-signal-danger/30 bg-rose-50 px-3 py-2 text-sm text-signal-danger">{err}</p>}
      <div className="flex min-h-[420px] min-w-max gap-3">
      {PARCEL_STAGES.map((stage, i) => {
        const items = byStage(stage);
        return (
          <BoardLane key={stage} tone={autoTone(i, PARCEL_STAGES.length)} title={STAGE_LABEL[stage]} count={items.length} width="w-[264px]" empty={drag ? 'Αφήστε εδώ' : 'Κενό'}
            over={over === stage}
            onDragOver={(e) => { if (drag) { e.preventDefault(); setOver(stage); } }}
            onDragLeave={() => setOver((o) => (o === stage ? null : o))}
            onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain') || drag; setOver(null); setDrag(null); if (id) move(id, stage); }}
            meta={items.length ? <>Μέση βαθμολογία <span className="font-semibold text-charcoal">{Math.round(items.reduce((s, p) => s + p.score.score, 0) / items.length)}</span></> : undefined}>
              {items.map((p) => (
                <div key={p.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); e.dataTransfer.effectAllowed = 'move'; setDrag(p.id); }} onDragEnd={() => { setDrag(null); setOver(null); }}
                  className={`${laneRow} cursor-grab active:cursor-grabbing ${moving === p.id || drag === p.id ? 'opacity-50' : ''}`}>
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
                    {p.uplift && <p className="font-medium text-forest">Υπεραξία {formatCurrency(p.uplift.marginAbs)}{p.uplift.estimated ? ' (εκτ.)' : ''}</p>}
                  </div>
                  <div className="mt-2"><PopSelect width="w-full" ariaLabel="Στάδιο" value={local[p.id] ?? p.stage} onChange={(v) => move(p.id, v)} options={PARCEL_STAGES.map((x) => [x, STAGE_LABEL[x]] as [string, string])} /></div>
                </div>
              ))}
          </BoardLane>
        );
      })}
      </div>
    </div>
  );
}
