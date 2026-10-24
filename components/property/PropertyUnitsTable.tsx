'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, UserCog } from 'lucide-react';
import { assignUnitOwner, removeUnitOwner } from '@/app/actions/property';

export interface PropertyUnit {
  id: string;
  unit_number: string;
  project_name: string | null;
  owner_name: string | null;
  owner_contact_id: string | null;
  occupancy_status: string;
  open_tickets: number;
}
export interface ContactOption { id: string; full_name: string | null; email: string }

const OCCUPANCY = ['owner_occupied', 'rented', 'vacant'];
const OCC_CLASS: Record<string, string> = { owner_occupied: 'badge-forest', rented: 'badge-champagne', vacant: 'badge-neutral' };

export function PropertyUnitsTable({ units, contacts }: { units: PropertyUnit[]; contacts: ContactOption[] }) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<PropertyUnit | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const q = query.trim().toLowerCase();
  const shown = q
    ? units.filter((u) => (u.owner_name ?? '').toLowerCase().includes(q) || u.unit_number.toLowerCase().includes(q) || (u.project_name ?? '').toLowerCase().includes(q))
    : units;

  function save(formData: FormData) {
    if (!active) return;
    const contactId = String(formData.get('contactId'));
    const occupancyStatus = String(formData.get('occupancy'));
    startTransition(async () => {
      if (contactId) await assignUnitOwner({ unitId: active.id, contactId, occupancyStatus, note: String(formData.get('note') || '') || undefined });
      setActive(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex max-w-sm items-center gap-2 rounded border border-stone-line bg-white px-3 py-1.5 text-sm">
        <Search size={15} className="text-charcoal-600/60" strokeWidth={1.75} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Owner, unit, or project…" className="w-full outline-none" />
      </div>

      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead><tr><th>Unit</th><th>Project</th><th>Owner</th><th>Occupancy</th><th>Open tickets</th><th></th></tr></thead>
          <tbody>
            {shown.map((u) => (
              <tr key={u.id} className="hover:bg-stone/60">
                <td className="font-medium text-charcoal">{u.unit_number}</td>
                <td className="text-charcoal-600">{u.project_name ?? '—'}</td>
                <td className="text-charcoal-600">{u.owner_name ?? <span className="text-charcoal-600/50">Unassigned</span>}</td>
                <td><span className={`${OCC_CLASS[u.occupancy_status] ?? 'badge-neutral'} capitalize`}>{u.occupancy_status.replace(/_/g, ' ')}</span></td>
                <td className="figure text-charcoal-600">{u.open_tickets || '—'}</td>
                <td className="text-right">
                  <button onClick={() => setActive(u)} className="btn-ghost text-xs"><UserCog size={13} strokeWidth={1.75} /> Manage</button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm text-charcoal-600/70">No units match.</td></tr>}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
          <div className="w-full max-w-md rounded-md bg-white p-6 shadow-overlay">
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-xl">Unit {active.unit_number}</h3>
              <button onClick={() => setActive(null)} className="text-charcoal-600 hover:text-charcoal"><X size={18} strokeWidth={1.75} /></button>
            </div>
            <p className="mb-4 text-sm text-charcoal-600/70">{active.project_name} · {active.owner_name ? `Owner: ${active.owner_name}` : 'No owner assigned'}</p>
            <form action={save} className="space-y-3">
              <div>
                <label className="eyebrow">Owner (CRM contact)</label>
                <select name="contactId" defaultValue={active.owner_contact_id ?? ''} className="input mt-1">
                  <option value="">Select a contact…</option>
                  {contacts.map((c) => <option key={c.id} value={c.id}>{c.full_name ?? c.email} · {c.email}</option>)}
                </select>
              </div>
              <div>
                <label className="eyebrow">Occupancy</label>
                <select name="occupancy" defaultValue={active.occupancy_status} className="input mt-1 capitalize">
                  {OCCUPANCY.map((o) => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <input name="note" placeholder="Transfer note (optional)" className="input" />
              <button type="submit" disabled={isPending} className="btn-primary w-full">Save owner & occupancy</button>
              {active.owner_contact_id && (
                <button type="button" onClick={() => startTransition(async () => { await removeUnitOwner(active.id); setActive(null); router.refresh(); })} disabled={isPending} className="btn-ghost w-full text-xs text-signal-danger">
                  Remove owner (set vacant)
                </button>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
