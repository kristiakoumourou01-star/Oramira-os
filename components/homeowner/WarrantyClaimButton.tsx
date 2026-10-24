'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldQuestion } from 'lucide-react';
import { fileWarrantyClaim } from '@/app/actions/maintenance';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

/**
 * File a warranty claim against a specific covered item. Creates a maintenance
 * ticket linked to the warranty, so the claim flows through the same tracking,
 * contractor assignment, and messaging as any other issue.
 */
export function WarrantyClaimButton({ warrantyId, unitId, label }: { warrantyId: string; unitId: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(async () => {
      await fileWarrantyClaim({ warrantyId, unitId, description: String(formData.get('description')) });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
        <ShieldQuestion size={13} strokeWidth={1.75} /> File claim
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Warranty claim" description={label} size="md">
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody>
            <textarea name="description" required placeholder="Describe the problem with this covered item…" className="input min-h-[100px]" />
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Submitting…' : 'Submit claim'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
