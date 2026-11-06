'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Home } from 'lucide-react';
import { updateHandover } from '@/app/actions/units';
import { activateHomeowner } from '@/app/actions/homeowners';
import { formatDate } from '@/lib/format';

const HANDOVER_STAGES = ['pending', 'scheduled', 'in_progress', 'completed'];

/**
 * Handover + warranty control on a unit. Marking handover 'completed' moves
 * the unit to 'handed_over' (server-side) and is the point a homeowner record
 * and its warranty window begin — the seam into the Homeowner Portal later.
 */
export function HandoverControl({
  unitId,
  projectId,
  handoverStatus,
  handoverDate,
  warrantyStartDate,
  warrantyPeriodMonths,
  hasBuyer = false,
  homeownerActivated = false,
}: {
  unitId: string;
  projectId: string;
  handoverStatus: string;
  handoverDate: string | null;
  warrantyStartDate: string | null;
  warrantyPeriodMonths: number;
  hasBuyer?: boolean;
  homeownerActivated?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    startTransition(async () => {
      await updateHandover({
        unitId,
        projectId,
        handoverStatus: String(formData.get('handoverStatus')),
        handoverDate: String(formData.get('handoverDate') || '') || null,
        warrantyStartDate: String(formData.get('warrantyStartDate') || '') || null,
        warrantyPeriodMonths: Number(formData.get('warrantyPeriodMonths')) || warrantyPeriodMonths,
      });
      router.refresh();
    });
  }

  const warrantyEnd =
    warrantyStartDate != null
      ? new Date(new Date(warrantyStartDate).setMonth(new Date(warrantyStartDate).getMonth() + warrantyPeriodMonths))
      : null;

  return (
    <div className="panel p-6">
      <h4 className="mb-4 flex items-center gap-2"><KeyRound size={15} strokeWidth={1.75} className="text-olive" /> Handover & warranty</h4>
      <form action={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="eyebrow">Handover status</label>
            <select name="handoverStatus" defaultValue={handoverStatus} className="input mt-1 capitalize">
              {HANDOVER_STAGES.map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow">Handover date</label>
            <input name="handoverDate" type="date" defaultValue={handoverDate ?? ''} className="input mt-1" />
          </div>
          <div>
            <label className="eyebrow">Warranty start</label>
            <input name="warrantyStartDate" type="date" defaultValue={warrantyStartDate ?? ''} className="input mt-1" />
          </div>
          <div>
            <label className="eyebrow">Warranty (months)</label>
            <input name="warrantyPeriodMonths" type="number" defaultValue={warrantyPeriodMonths} className="input mt-1" />
          </div>
        </div>
        {warrantyEnd && (
          <p className="text-xs text-charcoal-600/70">
            Warranty runs until <span className="figure">{formatDate(warrantyEnd)}</span>.
          </p>
        )}
        <button type="submit" disabled={isPending} className="btn-secondary w-full">
          {isPending ? 'Saving…' : 'Save handover details'}
        </button>
      </form>

      {/* Convert buyer → homeowner (roles layer; buyer history is retained). */}
      {handoverStatus === 'completed' && hasBuyer && (
        <div className="mt-4 border-t border-stone-line pt-4">
          {homeownerActivated ? (
            <p className="flex items-center gap-2 text-sm text-signal-success">
              <Home size={15} strokeWidth={1.75} /> Homeowner Portal active
            </p>
          ) : (
            <button
              onClick={() => startTransition(async () => { await activateHomeowner(unitId); router.refresh(); })}
              disabled={isPending}
              className="btn-primary w-full"
            >
              <Home size={15} strokeWidth={1.75} /> {isPending ? 'Activating…' : 'Activate Homeowner Portal'}
            </button>
          )}
          <p className="mt-2 text-xs text-charcoal-600/60">
            Moves the buyer into the Homeowner Portal for after-sales. Their contract, payments, and document history stay intact.
          </p>
        </div>
      )}
    </div>
  );
}
