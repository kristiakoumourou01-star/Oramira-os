'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createDeal } from '@/app/actions/deals';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

/** Creates a deal (seeded with default assumptions) and opens its workbench. */
export function NewDealButton() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    const name = String(formData.get('name'));
    if (!name.trim()) return;
    startTransition(async () => {
      const id = await createDeal({ name });
      router.push(`/deal-analyzer/${id}`);
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> New deal
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New deal analysis" size="md">
        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-3">
            <input name="name" required placeholder="Deal name (e.g. Larnaca seafront plot)" className="input" autoFocus />
            <p className="text-xs text-charcoal-600/60">Starts from Oramira's default Cyprus assumptions — tune everything in the workbench.</p>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating…' : 'Create & open'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
