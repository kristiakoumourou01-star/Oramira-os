'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createProject } from '@/app/actions/projects';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useAutoOpen } from '@/lib/use-auto-open';

const STATUSES = ['planning', 'permitting', 'under_construction', 'selling', 'completed', 'on_hold'];

/** Create-project modal. */
export function NewProjectForm() {
  const [open, setOpen] = useAutoOpen('project');
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

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> New project
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New project" size="lg">
        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="grid grid-cols-2 gap-3">
            <input name="name" required placeholder="Project name" className="input col-span-2" />
            <input name="location" placeholder="Location (e.g. Limassol)" className="input" />
            <select name="status" className="input" defaultValue="planning">
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <textarea name="description" placeholder="Short description" className="input col-span-2 min-h-[70px]" />
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Creating…' : 'Create project'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

export { STATUSES as PROJECT_STATUSES };
