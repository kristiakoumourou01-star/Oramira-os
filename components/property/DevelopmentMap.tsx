'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Layers, Building2, MapPin, X, ArrowUpRight, Home } from 'lucide-react';
import { STATUS_STYLES, type MapBlock, type DisplayStatus, type UnitDetail } from '@/lib/development-map';
import type { SignedMedia } from '@/lib/project-media-shared';
import { formatDate } from '@/lib/format';

interface Props {
  blocks: MapBlock[];
  media: SignedMedia[];
  unitDetails: Record<string, UnitDetail>;
  ownerUnitId?: string | null;
  unitBasePath?: string | null; // e.g. "/projects/<id>/units" — staff deep links
}

const LegendBar = ({ counts }: { counts: Record<DisplayStatus, number> }) => (
  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
    {(Object.keys(STATUS_STYLES) as DisplayStatus[]).map((k) => (
      <span key={k} className="flex items-center gap-1.5 text-xs text-charcoal-600/80">
        <span className={`h-2.5 w-2.5 rounded-sm ${STATUS_STYLES[k].dot}`} /> {STATUS_STYLES[k].label}
        {counts[k] > 0 && <span className="figure text-charcoal-600/50">{counts[k]}</span>}
      </span>
    ))}
  </div>
);

/** Mini horizontal status distribution bar for a block/floor. */
function StatusStrip({ counts, total }: { counts: Record<DisplayStatus, number>; total: number }) {
  if (total === 0) return null;
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-stone-200">
      {(Object.keys(STATUS_STYLES) as DisplayStatus[]).map((k) =>
        counts[k] > 0 ? <span key={k} className={STATUS_STYLES[k].dot} style={{ width: `${(counts[k] / total) * 100}%` }} /> : null,
      )}
    </div>
  );
}

export function DevelopmentMap({ blocks, media, unitDetails, ownerUnitId, unitBasePath }: Props) {
  // Auto-drill to the owner's block/floor on first render.
  const ownerLoc = useMemo(() => {
    if (!ownerUnitId) return null;
    for (const b of blocks) for (const f of b.floors) if (f.units.some((u) => u.id === ownerUnitId)) return { blockId: b.id, floor: f.floor };
    return null;
  }, [blocks, ownerUnitId]);

  const [blockId, setBlockId] = useState<string | null>(ownerLoc?.blockId ?? null);
  const [floor, setFloor] = useState<number | null>(ownerLoc?.floor ?? null);
  const [selectedUnit, setSelectedUnit] = useState<string | null>(ownerUnitId ?? null);

  const totals = useMemo(() => {
    const t: Record<DisplayStatus, number> = { available: 0, reserved: 0, sold: 0, owned: 0, not_released: 0 };
    for (const b of blocks) for (const k of Object.keys(t) as DisplayStatus[]) t[k] += b.statusCounts[k];
    return t;
  }, [blocks]);

  const block = blocks.find((b) => b.id === blockId) ?? null;
  const floorObj = block?.floors.find((f) => f.floor === floor) ?? null;

  const masterplan = media.find((m) => m.kind === 'masterplan') ?? media.find((m) => m.kind === 'render' || m.kind === 'block_layout');
  const floorPlan = floorObj && block
    ? media.find((m) => m.building_id === block.id && m.floor === floorObj.floor)
      ?? media.find((m) => m.kind === 'floor_plan' && m.building_id === block.id)
    : null;

  const detail = selectedUnit ? unitDetails[selectedUnit] : null;
  const sqm = (n: number | null) => (n == null ? '—' : `${n} m²`);

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1.5 text-sm">
        <button onClick={() => { setBlockId(null); setFloor(null); }} className={`flex items-center gap-1 ${blockId ? 'text-charcoal-600/70 hover:text-forest' : 'font-medium text-forest'}`}>
          <MapPin size={13} strokeWidth={1.75} /> Development
        </button>
        {block && <><ChevronRight size={13} className="text-charcoal-600/40" /><button onClick={() => setFloor(null)} className={`${floor != null ? 'text-charcoal-600/70 hover:text-forest' : 'font-medium text-forest'}`}>{block.name}</button></>}
        {floorObj && <><ChevronRight size={13} className="text-charcoal-600/40" /><span className="font-medium text-forest">{floorObj.label}</span></>}
      </div>

      <LegendBar counts={totals} />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className={selectedUnit ? 'lg:col-span-2' : 'lg:col-span-3'}>
          {/* ── Project / development view ── */}
          {!block && (
            <div className="space-y-4">
              {masterplan?.url && (
                <div className="overflow-hidden rounded-lg border border-stone-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={masterplan.url} alt="Masterplan" className="max-h-[360px] w-full object-cover" />
                </div>
              )}
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {blocks.map((b) => (
                  <button key={b.id} onClick={() => { setBlockId(b.id); setFloor(null); }} className="rounded-lg border border-stone-line bg-white p-4 text-left transition-all hover:border-forest hover:shadow-soft">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium text-charcoal"><Building2 size={15} className="text-olive" strokeWidth={1.75} /> {b.name}</span>
                      <span className="figure text-xs text-charcoal-600/60">{b.unitCount} units</span>
                    </div>
                    <StatusStrip counts={b.statusCounts} total={b.unitCount} />
                    <p className="mt-2 text-xs text-charcoal-600/60">{b.floors.length} floor{b.floors.length === 1 ? '' : 's'}{b.id === ownerLoc?.blockId ? ' · your block' : ''}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Block view: floors ── */}
          {block && !floorObj && (
            <div className="space-y-2">
              {block.floors.map((f) => {
                const counts = f.units.reduce((acc, u) => { acc[u.status] += 1; return acc; }, { available: 0, reserved: 0, sold: 0, owned: 0, not_released: 0 } as Record<DisplayStatus, number>);
                const hasOwner = ownerUnitId && f.units.some((u) => u.id === ownerUnitId);
                return (
                  <button key={f.floor} onClick={() => setFloor(f.floor)} className={`flex w-full items-center gap-4 rounded-lg border bg-white p-4 text-left transition-all hover:border-forest hover:shadow-soft ${hasOwner ? 'border-sky-400' : 'border-stone-line'}`}>
                    <Layers size={16} className="shrink-0 text-olive" strokeWidth={1.75} />
                    <div className="w-28 shrink-0">
                      <p className="font-medium text-charcoal">{f.label}</p>
                      <p className="figure text-xs text-charcoal-600/60">{f.units.length} units</p>
                    </div>
                    <div className="flex-1"><StatusStrip counts={counts} total={f.units.length} /></div>
                    {hasOwner && <span className="badge-forest shrink-0"><Home size={11} className="mr-1" /> your floor</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Floor view: unit grid ── */}
          {floorObj && (
            <div className="space-y-4">
              {floorPlan?.url && (
                <div className="overflow-hidden rounded-lg border border-stone-line">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={floorPlan.url} alt={`${floorObj.label} plan`} className="max-h-[340px] w-full object-contain bg-stone-50" />
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                {floorObj.units.map((u) => {
                  const s = STATUS_STYLES[u.status];
                  const isOwner = u.id === ownerUnitId;
                  const isSelected = u.id === selectedUnit;
                  return (
                    <button
                      key={u.id}
                      onClick={() => setSelectedUnit(u.id)}
                      title={`${u.unit_number} · ${s.label}`}
                      className={`relative rounded-md p-2.5 text-center transition-all ${s.fill} ${isSelected ? 'ring-2 ring-offset-2' : ''} ${isSelected ? s.ring : ''} ${isOwner ? 'outline outline-2 outline-offset-2 outline-sky-500 animate-pulse' : 'hover:scale-[1.03]'}`}
                    >
                      <span className="figure block text-sm font-semibold">{u.unit_number}</span>
                      {u.bedrooms != null && <span className="block text-[10px] opacity-80">{u.bedrooms} bed</span>}
                      {isOwner && <Home size={11} className="absolute right-1 top-1" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Selected unit detail panel ── */}
        {detail && (
          <div className="rounded-lg border border-stone-line bg-white p-5">
            <div className="mb-3 flex items-start justify-between">
              <div>
                <p className="eyebrow">Unit</p>
                <h4 className="text-xl">{detail.unit_number}</h4>
                <p className="text-xs text-charcoal-600/60">{detail.floor_label}</p>
              </div>
              <button onClick={() => setSelectedUnit(null)} className="text-charcoal-600/50 hover:text-charcoal"><X size={16} /></button>
            </div>
            <span className={`mb-3 inline-block rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[detail.status].fill}`}>{STATUS_STYLES[detail.status].label}</span>

            <dl className="space-y-1.5 text-sm">
              {detail.type && <Row k="Type" v={detail.type} />}
              {detail.bedrooms != null && <Row k="Bedrooms" v={String(detail.bedrooms)} />}
              <Row k="Internal" v={sqm(detail.internal_sqm)} />
              <Row k="Covered veranda" v={sqm(detail.covered_veranda_sqm)} />
              <Row k="Uncovered veranda" v={sqm(detail.uncovered_veranda_sqm)} />
              <Row k="Storage" v={sqm(detail.storage_sqm)} />
              <Row k="Parking" v={detail.parking_spaces != null ? `${detail.parking_spaces} space${detail.parking_spaces === 1 ? '' : 's'}` : '—'} />
              <Row k="Handover" v={detail.handover_date ? formatDate(detail.handover_date) : '—'} />
              {detail.owner_name && <Row k="Owner" v={detail.owner_name} />}
            </dl>

            {unitBasePath && (
              <Link href={`${unitBasePath}/${detail.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-forest hover:underline">
                Open full record <ArrowUpRight size={14} strokeWidth={1.75} />
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3"><dt className="text-charcoal-600/70">{k}</dt><dd className="figure text-charcoal">{v}</dd></div>
);
