'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin, ZoomIn, ZoomOut, Maximize2, Layers, X } from 'lucide-react';
import { PARCEL_STAGES, STAGE_LABEL, STAGE_COLOR, type ParcelItem } from '@/lib/acquisitions-shared';
import { formatNumber, formatCurrency } from '@/lib/format';

const W = 800, H = 460, PAD = 48;

/**
 * Map-first acquisition surface. A lightweight SVG map (no external tiles)
 * projects each parcel's lat/lng into view, colours pins by stage, shades
 * assembly areas, and opens a right-side panel on click. Parcels without
 * coordinates drop into an "unmapped" tray. Zoom/pan via the viewBox.
 */
export function AcquisitionMap({ parcels }: { parcels: ParcelItem[] }) {
  const [stageFilter, setStageFilter] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<ParcelItem | null>(null);
  const [showAssembly, setShowAssembly] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [center, setCenter] = useState({ x: W / 2, y: H / 2 });

  const mapped = parcels.filter((p) => p.latitude != null && p.longitude != null);
  const unmapped = parcels.filter((p) => p.latitude == null || p.longitude == null);
  const visible = (p: ParcelItem) => stageFilter.size === 0 || stageFilter.has(p.stage);

  // Projection — fit all coords into the padded viewport (equirectangular).
  const project = useMemo(() => {
    if (mapped.length === 0) return (_lat: number, _lng: number) => ({ x: W / 2, y: H / 2 });
    const lats = mapped.map((p) => p.latitude!); const lngs = mapped.map((p) => p.longitude!);
    let minLat = Math.min(...lats), maxLat = Math.max(...lats), minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    if (maxLat - minLat < 0.002) { minLat -= 0.01; maxLat += 0.01; }
    if (maxLng - minLng < 0.002) { minLng -= 0.01; maxLng += 0.01; }
    return (lat: number, lng: number) => ({
      x: PAD + ((lng - minLng) / (maxLng - minLng)) * (W - 2 * PAD),
      y: PAD + (1 - (lat - minLat) / (maxLat - minLat)) * (H - 2 * PAD),
    });
  }, [mapped]);

  // Assembly hulls (bounding boxes) per area_ref with 2+ mapped parcels.
  const areas = useMemo(() => {
    const by = new Map<string, { x: number; y: number }[]>();
    for (const p of mapped) { if (!p.areaRef) continue; const pt = project(p.latitude!, p.longitude!); const a = by.get(p.areaRef) ?? []; a.push(pt); by.set(p.areaRef, a); }
    return [...by.entries()].filter(([, pts]) => pts.length >= 2).map(([ref, pts]) => {
      const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
      const areaParcels = mapped.filter((p) => p.areaRef === ref);
      const secured = areaParcels.filter((p) => ['offer_made', 'due_diligence', 'acquired'].includes(p.stage)).length;
      return { ref, x: Math.min(...xs) - 16, y: Math.min(...ys) - 16, w: Math.max(...xs) - Math.min(...xs) + 32, h: Math.max(...ys) - Math.min(...ys) + 32, owners: areaParcels.length, coverage: Math.round((secured / areaParcels.length) * 100) };
    });
  }, [mapped, project]);

  const vb = { x: center.x - (W / 2) / zoom, y: center.y - (H / 2) / zoom, w: W / zoom, h: H / zoom };
  const reset = () => { setZoom(1); setCenter({ x: W / 2, y: H / 2 }); };

  return (
    <div className="ws-card !p-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#F0EADF] px-4 py-2.5">
        <span className="text-[13px] font-semibold text-charcoal">Acquisition map</span>
        <span className="text-[11px] text-charcoal-600/50">{mapped.length} mapped{unmapped.length ? ` · ${unmapped.length} unmapped` : ''}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {PARCEL_STAGES.map((s) => {
            const on = stageFilter.has(s);
            return (
              <button key={s} onClick={() => setStageFilter((prev) => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; })}
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium transition-all ${on || stageFilter.size === 0 ? 'opacity-100' : 'opacity-40'}`} style={{ background: `${STAGE_COLOR[s]}1A`, color: STAGE_COLOR[s] }}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: STAGE_COLOR[s] }} />{STAGE_LABEL[s]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative flex">
        {/* Map */}
        <div className="relative flex-1 bg-[linear-gradient(180deg,#F3F6F1,#EAF0E6)]">
          <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} className="h-[460px] w-full">
            {/* faint grid */}
            {Array.from({ length: 9 }).map((_, i) => <line key={`v${i}`} x1={(i * W) / 8} y1={0} x2={(i * W) / 8} y2={H} stroke="#1F4D3A" strokeOpacity={0.04} />)}
            {Array.from({ length: 6 }).map((_, i) => <line key={`h${i}`} x1={0} y1={(i * H) / 5} x2={W} y2={(i * H) / 5} stroke="#1F4D3A" strokeOpacity={0.04} />)}

            {/* assembly areas */}
            {showAssembly && areas.map((a) => (
              <g key={a.ref}>
                <rect x={a.x} y={a.y} width={a.w} height={a.h} rx={12} fill="#1F4D3A" fillOpacity={0.05} stroke="#1F4D3A" strokeOpacity={0.25} strokeDasharray="4 3" />
                <text x={a.x + 6} y={a.y + 13} fontSize={9} fill="#1F4D3A" fillOpacity={0.7}>{a.ref} · {a.owners} owners · {a.coverage}%</text>
              </g>
            ))}

            {/* pins */}
            {mapped.filter(visible).map((p) => {
              const { x, y } = project(p.latitude!, p.longitude!);
              const sel = selected?.id === p.id;
              return (
                <g key={p.id} onClick={() => setSelected(p)} className="cursor-pointer">
                  <circle cx={x} cy={y} r={sel ? 9 : 6} fill={STAGE_COLOR[p.stage]} stroke="#fff" strokeWidth={2} />
                  {sel && <circle cx={x} cy={y} r={13} fill="none" stroke={STAGE_COLOR[p.stage]} strokeOpacity={0.4} strokeWidth={2} />}
                </g>
              );
            })}
          </svg>

          {/* zoom controls */}
          <div className="absolute bottom-3 right-3 flex flex-col gap-1">
            <button onClick={() => setZoom((z) => Math.min(4, z + 0.4))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-charcoal-600 shadow-sm hover:text-forest"><ZoomIn size={15} /></button>
            <button onClick={() => setZoom((z) => Math.max(1, z - 0.4))} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-charcoal-600 shadow-sm hover:text-forest"><ZoomOut size={15} /></button>
            <button onClick={reset} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-charcoal-600 shadow-sm hover:text-forest"><Maximize2 size={14} /></button>
          </div>
          <button onClick={() => setShowAssembly((v) => !v)} className={`absolute left-3 top-3 flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] shadow-sm ${showAssembly ? 'bg-forest text-white' : 'bg-white text-charcoal-600'}`}><Layers size={12} /> Assembly</button>

          {mapped.length === 0 && (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <MapPin size={26} className="mb-2 text-forest/40" />
              <p className="text-sm font-medium text-charcoal">No parcels on the map yet</p>
              <p className="mt-0.5 max-w-xs text-xs text-charcoal-600/60">Add latitude/longitude to parcels to plot them here.</p>
            </div>
          )}
        </div>

        {/* Right parcel panel */}
        {selected && (
          <div className="w-72 shrink-0 border-l border-[#F0EADF] p-4">
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLOR[selected.stage] }} /><span className="text-[11px] font-medium" style={{ color: STAGE_COLOR[selected.stage] }}>{STAGE_LABEL[selected.stage]}</span></div>
              <button onClick={() => setSelected(null)} className="text-charcoal-600/50 hover:text-charcoal"><X size={15} /></button>
            </div>
            <Link href={`/acquisitions/${selected.id}`} className="text-base font-semibold text-charcoal hover:text-forest">{selected.reference}</Link>
            <p className="text-xs text-charcoal-600/60">{selected.ownerName ?? 'Owner unknown'}{selected.location ? ` · ${selected.location}` : ''}</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg bg-forest/[0.05] p-2"><p className="figure text-lg text-forest">{selected.score.score}</p><p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">Score</p></div>
              <div className="rounded-lg bg-champagne-50/60 p-2"><p className="figure text-lg text-champagne-600">{selected.readiness.score}</p><p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">Readiness</p></div>
            </div>
            <dl className="mt-3 space-y-1.5 text-xs">
              <div className="flex justify-between"><dt className="text-charcoal-600/60">Plot</dt><dd className="figure text-charcoal">{selected.plotSizeSqm ? `${formatNumber(Number(selected.plotSizeSqm))}m²` : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-charcoal-600/60">Uplift</dt><dd className="figure text-forest">{selected.uplift ? formatCurrency(selected.uplift.marginAbs) : '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-charcoal-600/60">Due diligence</dt><dd className="figure text-charcoal">{selected.dd.pct}%</dd></div>
            </dl>
            <Link href={`/acquisitions/${selected.id}`} className="mt-3 block rounded-lg bg-forest px-3 py-2 text-center text-xs font-medium text-white hover:bg-forest/90">Open parcel</Link>
          </div>
        )}
      </div>
    </div>
  );
}
