'use client';

import { useState } from 'react';
import { PhotoLightbox } from '@/components/construction/ConstructionUpdates';
import { milestoneLabel, scopeLabel, type ConstructionUpdate } from '@/lib/construction-shared';
import { formatDate } from '@/lib/format';
import type { Lang } from '@/lib/locale-shared';

/** The buyer's view of construction updates: newest first, photos open full screen. */
export function BuyerUpdatesFeed({ items, lang, buildingName }: { items: ConstructionUpdate[]; lang: Lang; buildingName: string | null }) {
  const [box, setBox] = useState<{ photos: ConstructionUpdate['photos']; i: number } | null>(null);
  return (
    <>
      <ol className="relative space-y-6 border-l border-stone-line pl-5">
        {items.map((u) => (
          <li key={u.id} className="relative">
            <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full border-2 border-white bg-forest" />
            <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-charcoal-600/70">
              <span className="figure">{formatDate(u.createdAt)}</span>
              <span className="badge-neutral">{u.buildingId && !u.buildingName ? (buildingName ?? scopeLabel(u, lang)) : scopeLabel(u, lang, true)}</span>
              {u.milestoneType && <span className="badge-neutral">{milestoneLabel(u.milestoneType, lang)}</span>}
              {u.progress !== null && <span className="badge-forest">{u.progress}%</span>}
            </p>
            <p className="mt-1 font-medium text-charcoal">{u.title}</p>
            {u.body && <p className="mt-1 whitespace-pre-line text-sm text-charcoal-600">{u.body}</p>}
            {u.photos.filter((p) => p.url).length > 0 && (
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {u.photos.filter((p) => p.url).map((p, i, arr) => (
                  <button key={p.path} type="button" onClick={() => setBox({ photos: arr, i })} className="aspect-[4/3] overflow-hidden rounded bg-sand-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.url!} alt={p.caption ?? ''} className="h-full w-full object-cover transition hover:scale-[1.03]" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>
      {box && <PhotoLightbox photos={box.photos} index={box.i} onClose={() => setBox(null)} />}
    </>
  );
}
