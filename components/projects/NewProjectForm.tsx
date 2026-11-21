'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { createProjectFull } from '@/app/actions/project-flow';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PopSelect } from '@/components/ui/PopSelect';
import { useAutoOpen } from '@/lib/use-auto-open';

const STATUSES = ['planning', 'permitting', 'under_construction', 'selling', 'completed', 'on_hold'];
const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';

/** Νέο έργο: όνομα, τοποθεσία, κατάσταση, παράδοση, περιγραφή — ανοίγει αμέσως το έργο. */
export function NewProjectForm({ stages }: { stages?: { key: string; label: string }[] }) {
  const [open, setOpen] = useAutoOpen('project');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const opts: [string, string][] = stages?.length ? stages.map((s) => [s.key, s.label]) : [['planning', 'Σχεδιασμός']];
  const [status, setStatus] = useState(opts[0][0]);
  const router = useRouter();

  const submit = (fd: FormData) => start(async () => {
    const r = await createProjectFull({
      name: String(fd.get('name') ?? ''), location: String(fd.get('location') ?? ''), status,
      deliveryDate: String(fd.get('delivery') ?? '') || null, description: String(fd.get('description') ?? ''),
    });
    if (!r.ok) { setErr(r.error); return; }
    setOpen(false); router.push(`/projects/${r.id}`);
  });

  return (
    <>
      <button type="button" onClick={() => { setErr(null); setOpen(true); }} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> Νέο έργο
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Νέο έργο" size="lg">
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="grid gap-3 sm:grid-cols-2">
            <label className="block sm:col-span-2"><span className={label}>Όνομα έργου</span><input name="name" required className="input" placeholder="π.χ. Oramira Hills" data-no-tr /></label>
            <label className="block"><span className={label}>Τοποθεσία</span><input name="location" className="input" placeholder="π.χ. Πύργος, Λεμεσός" /></label>
            <div><span className={label}>Κατάσταση</span><PopSelect width="w-full" ariaLabel="Κατάσταση" value={status} onChange={setStatus} options={opts} /></div>
            <label className="block"><span className={label}>Αναμενόμενη παράδοση</span><input name="delivery" type="date" className="input" /></label>
            <label className="block sm:col-span-2"><span className={label}>Περιγραφή</span><textarea name="description" className="input min-h-[70px]" placeholder="Λίγα λόγια για το έργο" /></label>
            {err && <p className="text-sm text-signal-danger sm:col-span-2">{err}</p>}
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Άκυρο</button>
            <button type="submit" disabled={pending} className="btn-primary flex-1">{pending ? 'Δημιουργία…' : 'Δημιουργία έργου'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}

export { STATUSES as PROJECT_STATUSES };
