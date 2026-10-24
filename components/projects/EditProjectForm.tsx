'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { updateProject } from '@/app/actions/projects';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

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

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-ghost text-xs" aria-label="Edit project">
        <Pencil size={13} strokeWidth={1.75} /> Edit
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit project" size="lg">
        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-3">
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
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Saving…' : 'Save changes'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
