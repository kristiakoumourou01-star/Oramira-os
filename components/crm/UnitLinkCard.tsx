'use client';

import { useTransition } from 'react';
import { activateBuyerPortal } from '@/app/actions/invites';
import { KeyRound, CheckCircle2 } from 'lucide-react';
import { formatNumber } from '@/lib/format';

export interface UnitLinkData {
  buyerId: string;
  portalEligible: boolean;
  portalActivated: boolean;
  unit: { id: string; unit_number: string; sqm: number | null; price: number | null; project_name: string | null } | null;
  reservation: { deposit_amount: number | null; deposit_paid: boolean } | null;
  contract: { status: string } | null;
  payments: { amount_paid: number; paid_at: string }[];
}

/**
 * The buyer-side linkage on a contact's record: unit, reservation, contract
 * status, payment history, and the semi-automatic Buyer Portal activation
 * button — disabled until contract is signed AND deposit is confirmed
 * (Phase 4 decision), never automatic on "unit sold".
 */
export function UnitLinkCard({ data }: { data: UnitLinkData }) {
  const [isPending, startTransition] = useTransition();

  if (!data.unit) {
    return (
      <div className="panel p-6">
        <h4 className="mb-2">Unit & purchase</h4>
        <p className="text-sm text-charcoal-600/70">No unit reserved yet.</p>
      </div>
    );
  }

  const totalPaid = data.payments.reduce((sum, p) => sum + Number(p.amount_paid), 0);

  return (
    <div className="panel p-6">
      <h4 className="mb-4">Unit & purchase</h4>

      <div className="mb-4 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="eyebrow">Project</p>
          <p className="text-charcoal">{data.unit.project_name}</p>
        </div>
        <div>
          <p className="eyebrow">Unit</p>
          <p className="text-charcoal">{data.unit.unit_number} · <span className="figure">{data.unit.sqm} sqm</span></p>
        </div>
        <div>
          <p className="eyebrow">Price</p>
          <p className="figure text-charcoal">€{formatNumber(Number(data.unit.price ?? 0))}</p>
        </div>
        <div>
          <p className="eyebrow">Paid to date</p>
          <p className="figure text-charcoal">€{formatNumber(totalPaid)}</p>
        </div>
      </div>

      <div className="mb-4 flex gap-2">
        <span className={data.reservation?.deposit_paid ? 'badge-forest' : 'badge-neutral'}>
          Deposit {data.reservation?.deposit_paid ? 'confirmed' : 'pending'}
        </span>
        <span className={data.contract?.status === 'signed' ? 'badge-forest' : 'badge-neutral'}>
          Contract {data.contract?.status ?? 'not started'}
        </span>
      </div>

      <div className="border-t border-stone-line pt-4">
        {data.portalActivated ? (
          <p className="flex items-center gap-2 text-sm text-signal-success">
            <CheckCircle2 size={15} strokeWidth={1.75} /> Buyer Portal access is active
          </p>
        ) : (
          <button
            disabled={!data.portalEligible || isPending}
            onClick={() => startTransition(() => activateBuyerPortal(data.buyerId))}
            className="btn-primary"
          >
            <KeyRound size={15} strokeWidth={1.75} />
            {isPending ? 'Activating…' : 'Activate Buyer Portal'}
          </button>
        )}
        {!data.portalEligible && !data.portalActivated && (
          <p className="mt-2 text-xs text-charcoal-600/60">
            Available once the contract is signed and the deposit is confirmed.
          </p>
        )}
      </div>
    </div>
  );
}
