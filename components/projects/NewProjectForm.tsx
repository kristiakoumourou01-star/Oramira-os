'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createProject } from '@/app/actions/projects';

const STATUSES = ['planning', 'permitting', 'under_construction', 'selling', 'completed', 'on_hold'];

/** Create-project modal — same overlay pattern as NewLeadForm. */
export function NewProjectForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createProject({
        name: String(formData.get('name')),
        location: String(formData.get('location') || '') || undefined,
        description: String(formData.get('description') || '') || undefined,
        status: String(formData.get('status') || 'planning'),
      });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> New project
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl">New project</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <form action={handleSubmit} className="grid grid-cols-2 gap-3">
          <input name="name" required placeholder="Project name" className="input col-span-2" />
          <input name="location" placeholder="Location (e.g. Limassol)" className="input" />
          <select name="status" className="input" defaultValue="planning">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <textarea name="description" placeholder="Short description" className="input col-span-2 min-h-[70px]" />
          <button type="submit" disabled={isPending} className="btn-primary col-span-2">
            {isPending ? 'Creating…' : 'Create project'}
          </button>
        </form>
      </div>
    </div>
  );
}

export { STATUSES as PROJECT_STATUSES };
