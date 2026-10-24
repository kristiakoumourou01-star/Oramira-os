'use client';

import { useState } from 'react';
import Link from 'next/link';
import { UnitStatusBadge } from './UnitStatusBadge';
import { formatCurrency } from '@/lib/format';

export interface InventoryUnit {
  id: string;
  unit_number: string;
  floor: number | null;
  type: string | null;
  sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  status: string;
  building_name: string | null;
}

const FILTERS = ['all', 'available', 'reserved', 'sold', 'handed_over', 'blocked'] as const;

/** Inventory grid for a project, with a quiet status filter strip. */
export function UnitInventoryTable({ projectId, units }: { projectId: string; units: InventoryUnit[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all');
  const shown = filter === 'all' ? units : units.filter((u) => u.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const count = f === 'all' ? units.length : units.filter((u) => u.status === f).length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`badge capitalize ${filter === f ? 'badge-forest' : 'badge-neutral'}`}
            >
              {f.replace(/_/g, ' ')} <span className="figure ml-1 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Unit</th>
              <th>Building</th>
              <th>Type</th>
              <th>Floor</th>
              <th>Size</th>
              <th>Beds / Baths</th>
              <th>Price</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className="hover:bg-stone/60">
                <td>
                  <Link href={`/projects/${projectId}/units/${u.id}`} className="font-medium text-forest hover:underline">
                    {u.unit_number}
                  </Link>
                </td>
                <td className="text-charcoal-600">{u.building_name ?? '—'}</td>
                <td className="text-charcoal-600">{u.type ?? '—'}</td>
                <td className="figure text-charcoal-600">{u.floor ?? '—'}</td>
                <td className="figure">{u.sqm != null ? `${u.sqm} m²` : '—'}</td>
                <td className="figure text-charcoal-600">
                  {u.bedrooms ?? '—'} / {u.bathrooms ?? '—'}
                </td>
                <td className="figure">{u.price != null ? `${formatCurrency(Number(u.price))}` : '—'}</td>
                <td><UnitStatusBadge status={u.status} /></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-charcoal-600/70">No units in this view.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
