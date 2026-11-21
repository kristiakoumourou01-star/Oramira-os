'use client';

import { useEffect, useState, useTransition } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { updateProject } from '@/app/actions/projects';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

/** Επεξεργασία βασικών στοιχείων έργου (όνομα, τοποθεσία, τύπος, παράδοση, περιγραφή).
 *  Ανοίγει μόνο του με ?edit=1 (π.χ. αμέσως μετά την έγκριση από το Deal Analyzer). */
export function EditProjectForm({
  projectId, name, location, description, developmentType, deliveryDate, autoOpen = false,
}: {
  projectId: string;
  name: string;
  location: string | null;
  description: string | null;
  developmentType?: string | null;
  deliveryDate?: string | null;
  autoOpen?: boolean;
}) {
  const [open, setOpen] = useState(autoOpen);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (autoOpen) setOpen(true); }, [autoOpen]);
  const close = () => { setOpen(false); if (autoOpen) router.replace(path); };

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await updateProject({
        projectId,
        name: String(formData.get('name')),
        location: String(formData.get('location') || '') || undefined,
        description: String(formData.get('description') || '') || undefined,
        developmentType: String(formData.get('developmentType') || '') || undefined,
        deliveryDate: String(formData.get('deliveryDate') || '') || null,
      });
      close();
      router.refresh();
    });
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border border-forest/40 bg-forest/[0.07] px-3 py-1.5 text-sm font-medium text-forest transition hover:bg-forest hover:text-white" aria-label="Επεξεργασία έργου">
        <Pencil size={13} strokeWidth={2} /> Επεξεργασία
      </button>
      <Modal open={open} onClose={close} title="Επεξεργασία έργου" size="lg">
        <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-3">
            {autoOpen && <p className="rounded-xl bg-forest/[0.06] px-3 py-2 text-sm text-forest">Το έργο δημιουργήθηκε. Συμπληρώστε τα στοιχεία του — τα υπόλοιπα (τοποθεσία στον χάρτη, φωτογραφίες, μονάδες, στάδια κατασκευής) είναι πιο κάτω στη σελίδα.</p>}
            <div>
              <label className="eyebrow">Όνομα έργου</label>
              <input name="name" required defaultValue={name} className="input mt-1" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="eyebrow">Τοποθεσία</label>
                <input name="location" defaultValue={location ?? ''} placeholder="π.χ. Πύργος, Λεμεσός" className="input mt-1" />
              </div>
              <div>
                <label className="eyebrow">Τύπος έργου</label>
                <select name="developmentType" defaultValue={developmentType ?? 'houses'} className="input mt-1">
                  <option value="houses">Κατοικίες / βίλες</option>
                  <option value="apartments">Διαμερίσματα</option>
                  <option value="mixed">Μικτό</option>
                </select>
              </div>
              <div>
                <label className="eyebrow">Αναμενόμενη παράδοση</label>
                <input name="deliveryDate" type="date" defaultValue={deliveryDate ?? ''} className="input mt-1" />
              </div>
            </div>
            <div>
              <label className="eyebrow">Περιγραφή</label>
              <textarea name="description" defaultValue={description ?? ''} placeholder="Λίγα λόγια για το έργο, προδιαγραφές, πλεονεκτήματα…" className="input mt-1 min-h-[110px]" />
            </div>
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={close} className="btn-secondary">Άκυρο</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">
              {isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
