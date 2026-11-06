'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Loader2 } from 'lucide-react';
import { createParcel } from '@/app/actions/acquisitions';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useAutoOpen } from '@/lib/use-auto-open';

export interface AgentOpt { id: string; full_name: string | null }

const ZONES = ['residential', 'tourist', 'commercial', 'agricultural'];

/** Add an off-market parcel + its landowner in one dialog. */
export function NewParcelForm({ agents }: { agents: AgentOpt[] }) {
  const router = useRouter();
  const [open, setOpen] = useAutoOpen('parcel');
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({ reference: '', ownerName: '', ownerPhone: '', ownerEmail: '', location: '', areaRef: '', plotSizeSqm: '', zone: '', reasonForSelling: '', assignedTo: '' });
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  const submit = () => start(async () => {
    setErr(null);
    const res = await createParcel({
      reference: f.reference, ownerName: f.ownerName || undefined, ownerPhone: f.ownerPhone || undefined, ownerEmail: f.ownerEmail || undefined,
      location: f.location || undefined, areaRef: f.areaRef || undefined, plotSizeSqm: f.plotSizeSqm ? Number(f.plotSizeSqm) : undefined,
      zone: f.zone || undefined, reasonForSelling: f.reasonForSelling || undefined, assignedTo: f.assignedTo || undefined,
    });
    if (!res.ok) { setErr(res.error ?? 'Could not create parcel'); return; }
    setOpen(false); setF({ reference: '', ownerName: '', ownerPhone: '', ownerEmail: '', location: '', areaRef: '', plotSizeSqm: '', zone: '', reasonForSelling: '', assignedTo: '' });
    router.refresh();
  });

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary"><Plus size={15} strokeWidth={1.75} /> Add parcel</button>
      <Modal open={open} onClose={() => setOpen(false)} title="New parcel" size="lg">
        <ModalBody className="space-y-3">
          <input value={f.reference} onChange={set('reference')} placeholder="Parcel reference (e.g. Plot 12, Kato Paphos)" className="input" />
          <div className="grid grid-cols-2 gap-3">
            <input value={f.ownerName} onChange={set('ownerName')} placeholder="Landowner name" className="input" />
            <input value={f.ownerPhone} onChange={set('ownerPhone')} placeholder="Phone" className="input" />
          </div>
          <input value={f.ownerEmail} onChange={set('ownerEmail')} placeholder="Email (optional)" className="input" />
          <div className="grid grid-cols-2 gap-3">
            <input value={f.location} onChange={set('location')} placeholder="Location / town" className="input" />
            <input value={f.areaRef} onChange={set('areaRef')} placeholder="Assembly area / block" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={f.plotSizeSqm} onChange={set('plotSizeSqm')} type="number" placeholder="Plot size (m²)" className="input" />
            <select value={f.zone} onChange={set('zone')} className="input"><option value="">Zone…</option>{ZONES.map((z) => <option key={z} value={z} className="capitalize">{z}</option>)}</select>
          </div>
          <input value={f.reasonForSelling} onChange={set('reasonForSelling')} placeholder="Reason for selling (optional)" className="input" />
          <select value={f.assignedTo} onChange={set('assignedTo')} className="input"><option value="">Assign to…</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? 'Agent'}</option>)}</select>
          {err && <p className="rounded-lg bg-signal-danger/10 px-3 py-2 text-xs text-signal-danger">{err}</p>}
        </ModalBody>
        <ModalFooter>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          <button onClick={submit} disabled={pending || !f.reference.trim()} className="btn-primary flex-1">{pending ? <Loader2 size={15} className="animate-spin" /> : 'Create parcel'}</button>
        </ModalFooter>
      </Modal>
    </>
  );
}
