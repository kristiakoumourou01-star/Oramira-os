'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, PackageOpen } from 'lucide-react';
import { requestMaterials } from '@/app/actions/contractor';
import { formatNumber } from '@/lib/format';

interface LineItem { name: string; qty: number; unit_cost: number }

export interface MaterialRequestRow {
  id: string;
  items: { name: string; qty: number; unit_cost: number }[];
  estimated_cost: number | null;
  status: string;
  note: string | null;
  created_at: string;
}

const STATUS_CLASS: Record<string, string> = {
  pending: 'badge-champagne',
  approved: 'badge-forest',
  rejected: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge',
};

/**
 * Material requests with line items + auto-totalled estimate. The contractor
 * submits; an Oramira staff member approves or rejects (the contractor has no
 * RLS path to change the status — they can never self-approve).
 */
export function MaterialRequestPanel({ ticketId, requests }: { ticketId: string; requests: MaterialRequestRow[] }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<LineItem[]>([{ name: '', qty: 1, unit_cost: 0 }]);
  const [note, setNote] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const estimated = items.reduce((s, i) => s + Number(i.qty || 0) * Number(i.unit_cost || 0), 0);

  function update(idx: number, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function submit() {
    const clean = items.filter((i) => i.name.trim());
    if (clean.length === 0) return;
    startTransition(async () => {
      await requestMaterials({ ticketId, items: clean, estimatedCost: estimated, note: note || undefined });
      setItems([{ name: '', qty: 1, unit_cost: 0 }]);
      setNote('');
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><PackageOpen size={15} className="text-olive" strokeWidth={1.75} /> Materials</h4>
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-xs">
          <Plus size={13} strokeWidth={1.75} /> Request
        </button>
      </div>

      {open && (
        <div className="mb-4 space-y-2 border-b border-stone-line pb-4">
          {items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_56px_84px_auto] gap-2">
              <input value={it.name} onChange={(e) => update(idx, { name: e.target.value })} placeholder="Material" className="input" />
              <input value={it.qty} onChange={(e) => update(idx, { qty: Number(e.target.value) })} type="number" min="1" className="input" />
              <input value={it.unit_cost} onChange={(e) => update(idx, { unit_cost: Number(e.target.value) })} type="number" step="0.01" placeholder="€/unit" className="input" />
              <button onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))} className="text-charcoal-600/50 hover:text-signal-danger" aria-label="Remove">
                <Trash2 size={15} strokeWidth={1.75} />
              </button>
            </div>
          ))}
          <button onClick={() => setItems((prev) => [...prev, { name: '', qty: 1, unit_cost: 0 }])} className="btn-ghost text-xs">
            <Plus size={12} strokeWidth={1.75} /> Add line
          </button>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className="input" />
          <div className="flex items-center justify-between pt-1">
            <span className="text-sm text-charcoal-600/70">Estimated <span className="figure text-charcoal">€{formatNumber(estimated)}</span></span>
            <button onClick={submit} disabled={isPending} className="btn-primary">Submit request</button>
          </div>
        </div>
      )}

      {requests.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No material requests on this job.</p>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r.id} className="rounded border border-stone-line p-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="figure text-sm text-charcoal">€{formatNumber(Number(r.estimated_cost ?? 0))}</span>
                <span className={STATUS_CLASS[r.status] ?? 'badge-neutral'}>{r.status}</span>
              </div>
              <ul className="space-y-0.5 text-xs text-charcoal-600/80">
                {r.items.map((it, i) => (
                  <li key={i} className="flex justify-between">
                    <span>{it.name} <span className="text-charcoal-600/50">×{it.qty}</span></span>
                    <span className="figure">€{formatNumber(Number(it.qty) * Number(it.unit_cost))}</span>
                  </li>
                ))}
              </ul>
              {r.note && <p className="mt-1.5 text-xs text-charcoal-600/60">{r.note}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
