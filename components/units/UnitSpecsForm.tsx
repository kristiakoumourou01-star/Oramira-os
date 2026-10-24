'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ruler, Pencil } from 'lucide-react';
import { updateUnitSpecs } from '@/app/actions/property';
import { formatDate } from '@/lib/format';

export interface UnitSpecs {
  internal_sqm: number | null;
  covered_veranda_sqm: number | null;
  uncovered_veranda_sqm: number | null;
  storage_sqm: number | null;
  parking_spaces: number | null;
  plot_size_sqm: number | null;
  garden_sqm: number | null;
  has_pool: boolean | null;
  handover_date: string | null;
}

const sqm = (n: number | null) => (n == null ? '—' : `${n} m²`);

/** Area & specification breakdown with an inline staff editor. */
export function UnitSpecsForm({ unitId, projectId, specs }: { unitId: string; projectId: string; specs: UnitSpecs }) {
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function num(fd: FormData, k: string): number | null {
    const v = String(fd.get(k) || '').trim();
    return v ? Number(v) : null;
  }
  function submit(fd: FormData) {
    startTransition(async () => {
      await updateUnitSpecs({
        unitId, projectId,
        internalSqm: num(fd, 'internal'),
        coveredVerandaSqm: num(fd, 'covered'),
        uncoveredVerandaSqm: num(fd, 'uncovered'),
        storageSqm: num(fd, 'storage'),
        parkingSpaces: num(fd, 'parking'),
        plotSizeSqm: num(fd, 'plot'),
        gardenSqm: num(fd, 'garden'),
        hasPool: fd.get('pool') === 'on',
        handoverDate: String(fd.get('handover') || '') || null,
      });
      setEditing(false);
      router.refresh();
    });
  }

  const totalCovered = (specs.internal_sqm ?? 0) + (specs.covered_veranda_sqm ?? 0);

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Ruler size={15} className="text-olive" strokeWidth={1.75} /> Area & specifications</h4>
        <button onClick={() => setEditing((e) => !e)} className="btn-ghost text-xs"><Pencil size={12} strokeWidth={1.75} /> {editing ? 'Cancel' : 'Edit'}</button>
      </div>

      {editing ? (
        <form action={submit} className="grid grid-cols-2 gap-3">
          <label className="text-xs text-charcoal-600/70">Plot size (m²)<input name="plot" type="number" step="0.01" defaultValue={specs.plot_size_sqm ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Internal (m²)<input name="internal" type="number" step="0.01" defaultValue={specs.internal_sqm ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Covered veranda (m²)<input name="covered" type="number" step="0.01" defaultValue={specs.covered_veranda_sqm ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Uncovered veranda (m²)<input name="uncovered" type="number" step="0.01" defaultValue={specs.uncovered_veranda_sqm ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Garden (m²)<input name="garden" type="number" step="0.01" defaultValue={specs.garden_sqm ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Storage (m²)<input name="storage" type="number" step="0.01" defaultValue={specs.storage_sqm ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Parking spaces<input name="parking" type="number" defaultValue={specs.parking_spaces ?? ''} className="input mt-1 text-sm" /></label>
          <label className="text-xs text-charcoal-600/70">Handover date<input name="handover" type="date" defaultValue={specs.handover_date ?? ''} className="input mt-1 text-sm" /></label>
          <label className="col-span-2 flex items-center gap-2 text-sm text-charcoal-600/80"><input name="pool" type="checkbox" defaultChecked={!!specs.has_pool} className="h-4 w-4 rounded border-stone-line" /> Private pool</label>
          <button type="submit" disabled={isPending} className="btn-primary col-span-2 mt-1 text-sm">{isPending ? 'Saving…' : 'Save specifications'}</button>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Row k="Plot size" v={sqm(specs.plot_size_sqm)} />
          <Row k="Internal" v={sqm(specs.internal_sqm)} />
          <Row k="Covered veranda" v={sqm(specs.covered_veranda_sqm)} />
          <Row k="Uncovered veranda" v={sqm(specs.uncovered_veranda_sqm)} />
          <Row k="Garden" v={sqm(specs.garden_sqm)} />
          <Row k="Storage" v={sqm(specs.storage_sqm)} />
          <Row k="Parking" v={specs.parking_spaces != null ? `${specs.parking_spaces} space${specs.parking_spaces === 1 ? '' : 's'}` : '—'} />
          <Row k="Pool" v={specs.has_pool ? 'Yes' : 'No'} />
          <Row k="Handover date" v={specs.handover_date ? formatDate(specs.handover_date) : '—'} />
          {totalCovered > 0 && <Row k="Total covered" v={`${totalCovered} m²`} />}
        </dl>
      )}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between border-b border-stone-line pb-1.5"><dt className="text-charcoal-600/70">{k}</dt><dd className="figure text-charcoal">{v}</dd></div>
);
