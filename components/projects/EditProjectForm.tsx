'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { updateProject } from '@/app/actions/projects';

/** Edit a project's core details (name, location, description). Status is edited
 *  separately via ProjectStatusControl; structure/units have their own controls. */
export function EditProjectForm({
  projectId,
  name,
  location,
  description,
}: {
  projectId: string;
  name: string;
  location: string | null;
  description: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateProject({
        projectId,
        name: String(formData.get('name')),
        location: String(formData.get('location') || '') || undefined,
        description: String(formData.get('description') || '') || undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs" aria-label="Edit project">
        <Pencil size={13} strokeWidth={1.75} /> Edit
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl">Edit project</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <form action={handleSubmit} className="space-y-3">
          <div>
            <label className="eyebrow">Project name</label>
            <input name="name" required defaultValue={name} className="input mt-1" />
          </div>
          <div>
            <label className="eyebrow">Location</label>
            <input name="location" defaultValue={location ?? ''} placeholder="e.g. Limassol" className="input mt-1" />
          </div>
          <div>
            <label className="eyebrow">Description</label>
            <textarea name="description" defaultValue={description ?? ''} className="input mt-1 min-h-[80px]" />
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full">
            {isPending ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
