'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createDeal } from '@/app/actions/deals';

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

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> New deal
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-md rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl">New deal analysis</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <form action={handleSubmit} className="space-y-3">
          <input name="name" required placeholder="Deal name (e.g. Larnaca seafront plot)" className="input" autoFocus />
          <p className="text-xs text-charcoal-600/60">Starts from Oramira's default Cyprus assumptions — tune everything in the workbench.</p>
          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? 'Creating…' : 'Create & open'}
          </button>
        </form>
      </div>
    </div>
  );
}
