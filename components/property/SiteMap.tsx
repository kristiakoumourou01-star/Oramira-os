'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Home, X, ArrowUpRight, AlertTriangle, Waves, Car, MapPin } from 'lucide-react';
import { STATUS_STYLES, type MapUnit, type UnitDetail, type DisplayStatus } from '@/lib/development-map';
import type { SignedMedia } from '@/lib/project-media-shared';
import { formatDate } from '@/lib/format';

interface Props {
  houses: MapUnit[];
  media: SignedMedia[];
  unitDetails: Record<string, UnitDetail>;
  ownerUnitId?: string | null;
  unitBasePath?: string | null; // staff deep link to full house record
}

const Legend = () => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    {(Object.keys(STATUS_STYLES) as DisplayStatus[]).map((k) => (
      <span key={k} className="flex items-center gap-1.5 text-xs text-charcoal-600/80">
        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_STYLES[k].dot}`} /> {STATUS_STYLES[k].label}
      </span>
    ))}
    <span className="flex items-center gap-1.5 text-xs text-charcoal-600/80">
      <span className="flex h-2.5 w-2.5 items-center justify-center rounded-full bg-signal-danger" /> Maintenance issue
    </span>
  </div>
);

/** Marker pin for a house on the site plan. */
function HouseMarker({ house, isOwner, isSelected, onClick }: { house: MapUnit; isOwner: boolean; isSelected: boolean; onClick: () => void }) {
  const s = STATUS_STYLES[house.status];
  return (
    <button
      onClick={onClick}
      title={`${house.unit_number} · ${s.label}`}
      style={{ left: `${house.map_x}%`, top: `${house.map_y}%` }}
      className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-2.5 py-1 text-xs font-semibold shadow-soft transition-transform hover:scale-110 ${s.fill} ${isSelected ? 'ring-2 ring-white ring-offset-2 ' + s.ring : ''} ${isOwner ? 'outline outline-2 outline-offset-2 outline-sky-500 animate-pulse' : ''}`}
    >
      {house.unit_number}
      {house.has_issue && <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-signal-danger text-white"><AlertTriangle size={9} /></span>}
    </button>
  );
}

/** House card for the grid / unplaced houses. */
function HouseCard({ house, isOwner, isSelected, onClick }: { house: MapUnit; isOwner: boolean; isSelected: boolean; onClick: () => void }) {
  const s = STATUS_STYLES[house.status];
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-lg border bg-white p-3 text-left transition-all hover:border-forest hover:shadow-soft ${isSelected ? 'border-forest shadow-soft' : 'border-stone-line'} ${isOwner ? 'ring-2 ring-sky-400' : ''}`}
    >
      <span className={`flex h-9 w-9 items-center justify-center rounded-md ${s.fill}`}><Home size={16} /></span>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-charcoal">{house.unit_number}{isOwner ? ' · yours' : ''}</p>
        <p className="text-xs text-charcoal-600/60">{s.label}</p>
      </div>
      {house.has_issue && <AlertTriangle size={14} className="ml-auto shrink-0 text-signal-danger" />}
    </button>
  );
}

/**
 * Interactive villa site map — the centre of Property Management. Renders the
 * masterplan/site plan with each house positioned and clickable (colour-coded by
 * status, red badge for maintenance issues, the owner's house highlighted), with
 * a grid fallback for any house not yet placed on the plan.
 */
export function SiteMap({ houses, media, unitDetails, ownerUnitId, unitBasePath }: Props) {
  const [selected, setSelected] = useState<string | null>(ownerUnitId ?? null);

  const sitePlan = useMemo(
    () => media.find((m) => m.kind === 'masterplan') ?? media.find((m) => m.kind === 'block_layout' || m.kind === 'render'),
    [media],
  );
  const placed = houses.filter((h) => h.map_x != null && h.map_y != null);
  const unplaced = houses.filter((h) => h.map_x == null || h.map_y == null);

  const detail = selected ? unitDetails[selected] : null;
  const sqm = (n: number | null) => (n == null ? '—' : `${n} m²`);

  return (
    <div className="space-y-4">
      <Legend />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={detail ? 'space-y-4 lg:col-span-2' : 'space-y-4 lg:col-span-3'}>
          {/* Site plan with positioned houses */}
          {sitePlan?.url ? (
            <div className="relative overflow-hidden rounded-lg border border-stone-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={sitePlan.url} alt="Site plan" className="w-full object-contain" />
              {placed.map((h) => (
                <HouseMarker key={h.id} house={h} isOwner={h.id === ownerUnitId} isSelected={h.id === selected} onClick={() => setSelected(h.id)} />
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-dashed border-stone-line p-4 text-sm text-charcoal-600/70">
              <MapPin size={15} strokeWidth={1.75} /> Upload a masterplan / site plan to position houses visually.
            </div>
          )}

          {/* House grid (all houses, or just the unplaced ones when a plan exists) */}
          <div>
            {sitePlan?.url && unplaced.length > 0 && <p className="mb-2 text-xs text-charcoal-600/50">Not yet placed on the plan</p>}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {(sitePlan?.url ? unplaced : houses).map((h) => (
                <HouseCard key={h.id} house={h} isOwner={h.id === ownerUnitId} isSelected={h.id === selected} onClick={() => setSelected(h.id)} />
              ))}
            </div>
          </div>
        </div>

        {/* House detail panel */}
        {detail && (
          <div className="rounded-lg border border-stone-line bg-white p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="eyebrow">House</p>
                <h4 className="text-xl">{detail.unit_number}</h4>
              </div>
              <button onClick={() => setSelected(null)} className="text-charcoal-600/50 hover:text-charcoal"><X size={16} /></button>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[detail.status].fill}`}>{STATUS_STYLES[detail.status].label}</span>
              {detail.has_issue && <span className="inline-flex items-center gap-1 rounded bg-signal-danger/10 px-2 py-0.5 text-xs font-medium text-signal-danger"><AlertTriangle size={11} /> Maintenance issue</span>}
              {detail.has_pool && <span className="inline-flex items-center gap-1 rounded bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700"><Waves size={11} /> Pool</span>}
            </div>

            <dl className="space-y-1.5 text-sm">
              <Row k="Plot size" v={sqm(detail.plot_size_sqm)} />
              <Row k="Internal" v={sqm(detail.internal_sqm)} />
              <Row k="Covered veranda" v={sqm(detail.covered_veranda_sqm)} />
              <Row k="Uncovered veranda" v={sqm(detail.uncovered_veranda_sqm)} />
              <Row k="Garden" v={sqm(detail.garden_sqm)} />
              <Row k="Storage" v={sqm(detail.storage_sqm)} />
              <Row k="Parking" v={detail.parking_spaces != null ? `${detail.parking_spaces}` : '—'} icon={<Car size={12} />} />
              <Row k="Handover" v={detail.handover_date ? formatDate(detail.handover_date) : '—'} />
              {detail.owner_name && <Row k="Owner" v={detail.owner_name} />}
            </dl>

            {unitBasePath && (
              <Link href={`${unitBasePath}/${detail.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                Open full house record <ArrowUpRight size={14} strokeWidth={1.75} />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ k, v, icon }: { k: string; v: string; icon?: React.ReactNode }) => (
  <div className="flex justify-between gap-3"><dt className="flex items-center gap-1 text-charcoal-600/70">{icon}{k}</dt><dd className="figure text-charcoal">{v}</dd></div>
);
