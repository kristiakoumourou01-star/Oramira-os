'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { updateProjectInfo } from '@/app/actions/property';
import { formatDate } from '@/lib/format';

/** Staff editor for the owner-facing project info shown on the homeowner Project page. */
export function ProjectInfoForm({
  projectId,
  deliveryDate,
  commonAreas,
  maintenanceSchedule,
  managementContact,
  emergencyContact,
}: {
  projectId: string;
  deliveryDate: string | null;
  commonAreas: string | null;
  maintenanceSchedule: string | null;
  managementContact: string | null;
  emergencyContact: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    startTransition(async () => {
      await updateProjectInfo({
        projectId,
        deliveryDate: String(fd.get('deliveryDate') || '') || null,
        commonAreas: String(fd.get('commonAreas') || '') || undefined,
        maintenanceSchedule: String(fd.get('maintenanceSchedule') || '') || undefined,
        managementContact: String(fd.get('managementContact') || '') || undefined,
        emergencyContact: String(fd.get('emergencyContact') || '') || undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h4>Owner-facing info</h4>
        <button onClick={() => setOpen((v) => !v)} className="btn-ghost text-xs">
          {open ? <X size={13} strokeWidth={1.75} /> : <Pencil size={13} strokeWidth={1.75} />} {open ? 'Cancel' : 'Edit'}
        </button>
      </div>
      {open ? (
        <form action={submit} className="space-y-3">
          <label className="block text-xs text-charcoal-600/70">Delivery date<input name="deliveryDate" type="date" defaultValue={deliveryDate ?? ''} className="input mt-1" /></label>
          <label className="block text-xs text-charcoal-600/70">Common areas<textarea name="commonAreas" defaultValue={commonAreas ?? ''} className="input mt-1 min-h-[50px]" /></label>
          <label className="block text-xs text-charcoal-600/70">Maintenance schedule<textarea name="maintenanceSchedule" defaultValue={maintenanceSchedule ?? ''} className="input mt-1 min-h-[50px]" /></label>
          <label className="block text-xs text-charcoal-600/70">Management contact<input name="managementContact" defaultValue={managementContact ?? ''} className="input mt-1" /></label>
          <label className="block text-xs text-charcoal-600/70">Emergency contact<input name="emergencyContact" defaultValue={emergencyContact ?? ''} className="input mt-1" /></label>
          <button type="submit" disabled={isPending} className="btn-primary w-full text-xs">Save owner info</button>
        </form>
      ) : (
        <div className="space-y-1.5 text-sm text-charcoal-600/80">
          <p>Delivery: <span className="figure">{deliveryDate ? formatDate(deliveryDate) : '—'}</span></p>
          <p>Management: {managementContact ?? '—'}</p>
          <p>Emergency: {emergencyContact ?? '—'}</p>
        </div>
      )}
    </div>
  );
}
