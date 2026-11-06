'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { convertLeadToReservation } from '@/app/actions/leads';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

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

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <KeyRound size={15} strokeWidth={1.75} /> Convert to reservation
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Convert to reservation" size="md">
        {units.length === 0 ? (
          <ModalBody><p className="text-sm text-charcoal-600/70">No available units to reserve. Add or free up a unit in Projects first.</p></ModalBody>
        ) : (
          <form action={submit} className="flex min-h-0 flex-1 flex-col">
            <ModalBody className="space-y-3">
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
            </ModalBody>
            <ModalFooter>
              <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={isPending} className="btn-primary flex-1">
                {isPending ? 'Reserving…' : 'Reserve unit'}
              </button>
            </ModalFooter>
          </form>
        )}
      </Modal>
    </>
  );
}
