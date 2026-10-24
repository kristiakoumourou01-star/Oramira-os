'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Crosshair, Check } from 'lucide-react';
import { updateHousePosition } from '@/app/actions/property';

export interface PlaceableHouse { id: string; unit_number: string; map_x: number | null; map_y: number | null }

/**
 * Staff tool to position each house on the masterplan. Pick a house, then click
 * where it sits on the plan — coordinates are stored as percentages so the
 * interactive site map renders the marker for everyone.
 */
export function HousePlacementEditor({ projectId, sitePlanUrl, houses }: { projectId: string; sitePlanUrl: string | null; houses: PlaceableHouse[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const imgRef = useRef<HTMLImageElement>(null);
  const router = useRouter();

  function place(e: React.MouseEvent<HTMLDivElement>) {
    if (!active || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    startTransition(async () => {
      await updateHousePosition({ unitId: active, projectId, mapX: Math.round(x * 10) / 10, mapY: Math.round(y * 10) / 10 });
      router.refresh();
    });
  }

  if (!sitePlanUrl) {
    return <p className="text-sm text-charcoal-600/70">Upload a masterplan / site plan above, then position each house here.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {houses.map((h) => (
          <button
            key={h.id}
            onClick={() => setActive((a) => (a === h.id ? null : h.id))}
            className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${active === h.id ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'}`}
          >
            {h.map_x != null ? <Check size={11} /> : <MapPin size={11} />} {h.unit_number}
          </button>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-charcoal-600/60">
        <Crosshair size={12} strokeWidth={1.75} /> {active ? 'Click on the plan to position the selected house.' : 'Select a house, then click its location on the plan.'}
        {isPending && <span className="text-forest">Saving…</span>}
      </p>

      <div onClick={place} className={`relative overflow-hidden rounded-lg border border-stone-line ${active ? 'cursor-crosshair' : ''}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={sitePlanUrl} alt="Site plan" className="w-full select-none object-contain" draggable={false} />
        {houses.filter((h) => h.map_x != null && h.map_y != null).map((h) => (
          <span
            key={h.id}
            style={{ left: `${h.map_x}%`, top: `${h.map_y}%` }}
            className={`pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-soft ${active === h.id ? 'bg-forest text-white ring-2 ring-white' : 'bg-white/90 text-charcoal'}`}
          >
            {h.unit_number}
          </span>
        ))}
      </div>
    </div>
  );
}
