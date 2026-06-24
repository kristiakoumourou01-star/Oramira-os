'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, X } from 'lucide-react';
import { convertLeadToReservation } from '@/app/actions/leads';

export interface AvailableUnit {
  id: string;
  label: string; // e.g. "ORA Homes · Unit A-203 · €420,000"
}

/**
 * Convert a lead into a reservation — pick an available unit, set a deposit, and
 * the reservation engine reserves it + promotes the contact to buyer, while the
 * lead advances to 'reserved'.
 */
export function ConvertToReservation({
  leadId,
  contactId,
  units,
  alreadyReserved,
}: {
  leadId: string;
  contactId: string;
  units: AvailableUnit[];
  alreadyReserved: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (alreadyReserved) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-signal-success">
        <KeyRound size={15} strokeWidth={1.75} /> Reserved
      </span>
    );
  }

  function submit(formData: FormData) {
    const unitId = String(formData.get('unitId'));
    if (!unitId) return;
    setError(null);
    startTransition(async () => {
      try {
        await convertLeadToReservation({
          leadId,
          contactId,
          unitId,
          depositAmount: Number(formData.get('deposit')) || undefined,
        });
        setOpen(false);
        router.refresh();
      } catch (e: any) {
        setError(e?.message ?? 'Could not convert');
      }
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <KeyRound size={15} strokeWidth={1.75} /> Convert to reservation
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl">Convert to reservation</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {units.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No available units to reserve. Add or free up a unit in Projects first.</p>
        ) : (
          <form action={submit} className="space-y-3">
            <div>
              <label className="eyebrow">Unit</label>
              <select name="unitId" required className="input mt-1">
                <option value="">Select an available unit…</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow">Deposit (€)</label>
              <input name="deposit" type="number" className="input mt-1" placeholder="e.g. 5000" />
            </div>
            {error && <p className="text-sm text-signal-danger">{error}</p>}
            <button type="submit" disabled={isPending} className="btn-primary w-full">
              {isPending ? 'Reserving…' : 'Reserve unit'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
