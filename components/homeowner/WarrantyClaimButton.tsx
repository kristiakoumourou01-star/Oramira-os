'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldQuestion, X } from 'lucide-react';
import { fileWarrantyClaim } from '@/app/actions/maintenance';

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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs">
        <ShieldQuestion size={13} strokeWidth={1.75} /> File claim
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-lg">Warranty claim</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p className="mb-4 text-sm text-charcoal-600/70">{label}</p>
        <form action={submit} className="space-y-3">
          <textarea name="description" required placeholder="Describe the problem with this covered item…" className="input min-h-[100px]" />
          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? 'Submitting…' : 'Submit claim'}
          </button>
        </form>
      </div>
    </div>
  );
}
