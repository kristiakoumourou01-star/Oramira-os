'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ListChecks } from 'lucide-react';
import { createScheduleFromPlan } from '@/app/actions/pricing';

/** Contract with no installments → create them from the unit's / project's payment plan. */
export function CreateScheduleButton({ contractId }: { contractId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <button type="button" disabled={pending} className="btn-secondary px-3 py-1.5 text-xs"
        onClick={() => start(async () => { setErr(null); const r = await createScheduleFromPlan(contractId); if (r.ok) router.refresh(); else setErr(r.error); })}>
        <ListChecks size={13} /> {pending ? 'Δημιουργία…' : 'Δημιουργία δόσεων από το πρόγραμμα πληρωμών'}
      </button>
      {err && <p className="text-xs text-signal-danger">{err}</p>}
    </div>
  );
}
