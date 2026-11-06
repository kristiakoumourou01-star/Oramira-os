'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { requestLeave } from '@/app/actions/hr';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

const TYPES = ['annual', 'sick', 'unpaid'];

/** Employee-facing leave request modal (Dashboard → Leave). */
export function LeaveRequestForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    const startDate = String(formData.get('start'));
    const endDate = String(formData.get('end'));
    if (!startDate || !endDate) return;
    startTransition(async () => {
      await requestLeave({
        leaveType: String(formData.get('type')),
        startDate,
        endDate,
        reason: String(formData.get('reason') || '') || undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary text-xs">
        <CalendarPlus size={13} strokeWidth={1.75} /> Request leave
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request leave" size="md">
        <form action={submit} className="flex min-h-0 flex-1 flex-col">
          <ModalBody className="space-y-3">
            <select name="type" defaultValue="annual" className="input capitalize">
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-charcoal-600/70">From<input name="start" type="date" required className="input mt-1" /></label>
              <label className="text-xs text-charcoal-600/70">To<input name="end" type="date" required className="input mt-1" /></label>
            </div>
            <textarea name="reason" placeholder="Reason (optional)" className="input min-h-[60px]" />
          </ModalBody>
          <ModalFooter>
            <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={isPending} className="btn-primary flex-1">{isPending ? 'Submitting…' : 'Submit request'}</button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  );
}
