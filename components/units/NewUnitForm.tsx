'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createUnit } from '@/app/actions/units';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

export interface StructureOption { id: string; name: string }

/** Add-unit modal, scoped to a project; building/phase optional. */
export function NewUnitForm({
  projectId,
  buildings,
  phases,
}: {
  projectId: string;
  buildings: StructureOption[];
  phases: StructureOption[];
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createUnit({
        projectId,
        unitNumber: String(formData.get('unitNumber')),
        buildingId: String(formData.get('buildingId') || '') || undefined,
        phaseId: String(formData.get('phaseId') || '') || undefined,
        floor: Number(formData.get('floor')) || undefined,
        type: String(formData.get('type') || '') || undefined,
        sqm: Number(formData.get('sqm')) || undefined,
        price: Number(formData.get('price')) || undefined,
        bedrooms: Number(formData.get('bedrooms')) || undefined,
        bathrooms: Number(formData.get('bathrooms')) || undefined,
        description: String(formData.get('description') || '') || undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> New unit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New unit" size="xl">
        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="grid grid-cols-3 gap-3">
            <input name="unitNumber" required placeholder="Unit no. (e.g. A-203)" className="input col-span-2" />
            <input name="type" placeholder="Type (e.g. 2-bed)" className="input" />
            <select name="buildingId" className="input">
              <option value="">No building</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <select name="phaseId" className="input">
              <option value="">No phase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <input name="floor" type="number" placeholder="Floor" className="input" />
            <input name="sqm" type="number" step="0.1" placeholder="m²" className="input" />
            <input name="bedrooms" type="number" placeholder="Beds" className="input" />
            <input name="bathrooms" type="number" step="0.5" placeholder="Baths" className="input" />
            <input name="price" type="number" placeholder="Price (€)" className="input col-span-3" />
            <textarea name="description" placeholder="Description / internal notes" className="input col-span-3 min-h-[60px]" />
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating…' : 'Create unit'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
