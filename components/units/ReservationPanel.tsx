'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarClock, CheckCircle2, FileText, XCircle, BadgeCheck } from 'lucide-react';
import {
  createReservation,
  confirmDeposit,
  extendReservation,
  cancelReservation,
  convertReservationToContract,
} from '@/app/actions/reservations';
import { formatDate, formatCurrency } from '@/lib/format';
import { parseAmount } from '@/lib/amount';
import { ContactPicker, type PickerContact } from '@/components/crm/ContactPicker';

export interface ReservationView {
  id: string;
  buyer_contact_id: string;
  buyer_name: string | null;
  deposit_amount: number | null;
  deposit_paid: boolean;
  status: string;
  expires_at: string | null;
  converted_contract_id: string | null;
}

export type ContactOption = PickerContact;

/**
 * The reservation lifecycle on a unit: reserve from the CRM (pick a contact),
 * hold with an expiry window, confirm the deposit, then convert to a contract.
 * Confirming the deposit + signing the (drafted) contract is exactly what the
 * migration-0006 trigger watches to flip Buyer Portal eligibility — so this
 * panel is where a unit's sale is prepared for the portal.
 */
export function ReservationPanel({
  unitId,
  projectId,
  unitStatus,
  reservation,
  contacts,
  contractStatus,
  defaultHoldDays = 14,
  price = null,
  vatRate = 19,
}: {
  unitId: string;
  projectId: string;
  unitStatus: string;
  reservation: ReservationView | null;
  contacts: ContactOption[];
  contractStatus: string | null;
  defaultHoldDays?: number;
  price?: number | null;
  vatRate?: number;
}) {
  const [vat, setVat] = useState(vatRate);
  const [depPct, setDepPct] = useState('');
  const [depAmt, setDepAmt] = useState('');
  const [base, setBase] = useState<'net' | 'gross'>('net');
  const net = Number(price ?? 0); const vatAmt = Math.round(net * vat) / 100; const gross = net + vatAmt;
  const baseVal = base === 'net' ? net : gross;
  const onPct = (v: string) => { setDepPct(v); const n = Number(v.replace(',', '.')); if (baseVal && Number.isFinite(n)) setDepAmt(Math.round(baseVal * n / 100).toLocaleString('de-DE')); };
  const onAmt = (v: string) => { setDepAmt(v); const n = parseAmount(v) ?? 0; if (baseVal) setDepPct(n ? String(Math.round((n / baseVal) * 10000) / 100) : ''); };
  const depN = parseAmount(depAmt) ?? 0;
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(fn: () => Promise<unknown>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  // ── No active hold: offer to reserve (only when the unit is available) ──
  if (!reservation || reservation.status === 'cancelled' || reservation.status === 'expired') {
    if (unitStatus !== 'available') {
      return (
        <div className="panel p-6">
          <h4 className="mb-2">Reservation</h4>
          <p className="text-sm text-charcoal-600/70">
            This unit is {unitStatus.replace(/_/g, ' ')} and not open for a new reservation.
          </p>
        </div>
      );
    }
    return (
      <div className="panel p-6">
        <h4 className="mb-4">Reserve this unit</h4>
        <form
          action={(formData) => {
            const buyerContactId = String(formData.get('buyerContactId'));
            if (!buyerContactId) return;
            run(() =>
              createReservation({
                unitId,
                buyerContactId,
                depositAmount: parseAmount(formData.get('depositAmount')) || undefined,
                holdDays: Math.max(0, Number(formData.get('holdDays')) || 0),
              })
            );
          }}
          className="space-y-3"
        >
          <div>
            <label className="eyebrow">Buyer (CRM contact)</label>
            <ContactPicker name="buyerContactId" required contacts={contacts} />
          </div>
          {net > 0 && (
            <div className="space-y-1 rounded-lg border border-stone-line p-3 text-sm">
              <div className="flex justify-between text-charcoal-600"><span>Τιμή (χωρίς ΦΠΑ)</span><span className="figure">{formatCurrency(net)}</span></div>
              <div className="flex items-center justify-between text-charcoal-600"><span className="flex items-center gap-1">ΦΠΑ
                <select className="rounded border border-stone-line bg-white px-1 py-0 text-xs" value={vat} onChange={(e) => { setVat(Number(e.target.value)); setDepPct(''); setDepAmt(''); }}><option value={19}>19%</option><option value={5}>5%</option><option value={0}>0%</option></select></span><span className="figure">{formatCurrency(vatAmt)}</span></div>
              <div className="flex justify-between border-t border-stone-line pt-1 font-semibold text-charcoal"><span>Συνολικό κόστος αγοράς</span><span className="figure">{formatCurrency(gross)}</span></div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow">Προκαταβολή %</label>
              <input inputMode="decimal" className="input mt-1" placeholder="π.χ. 10" value={depPct} onChange={(e) => onPct(e.target.value)} disabled={!net} />
            </div>
            <div>
              <label className="eyebrow">Deposit (€)</label>
              <input name="depositAmount" inputMode="decimal" className="input mt-1" placeholder="e.g. 5.000" value={depAmt} onChange={(e) => onAmt(e.target.value)} />
            </div>
            {net > 0 && <label className="col-span-2 flex items-center gap-3 text-xs text-charcoal-600"><span>Το % υπολογίζεται επί:</span>
              <label className="flex items-center gap-1"><input type="radio" checked={base === 'net'} onChange={() => { setBase('net'); setDepPct(''); setDepAmt(''); }} /> τιμής χωρίς ΦΠΑ</label>
              <label className="flex items-center gap-1"><input type="radio" checked={base === 'gross'} onChange={() => { setBase('gross'); setDepPct(''); setDepAmt(''); }} /> συνόλου με ΦΠΑ</label></label>}
            {net > 0 && depN > 0 && <p className="col-span-2 text-xs text-charcoal-600">Υπόλοιπο μετά την προκαταβολή: <b className="figure text-charcoal">{formatCurrency(Math.max(0, gross - depN))}</b></p>}
            <div>
              <label className="eyebrow">Hold (days)</label>
              <input name="holdDays" type="number" min={0} className="input mt-1" placeholder="0" defaultValue={defaultHoldDays || ''} />
            </div>
            <p className="col-span-2 text-[11px] text-charcoal-600/70">Αν αφήσετε το «Hold» κενό ή 0, η κράτηση δεν λήγει (χωρίς όριο ημερών) μέχρι να την ακυρώσετε ή να γίνει συμβόλαιο.</p>
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full">
            <CalendarClock size={15} strokeWidth={1.75} /> {isPending ? 'Reserving…' : 'Reserve unit'}
          </button>
        </form>
      </div>
    );
  }

  // ── Converted: show the contract linkage ──
  if (reservation.status === 'converted') {
    return (
      <div className="panel p-6">
        <h4 className="mb-3">Reservation</h4>
        <p className="flex items-center gap-2 text-sm text-signal-success">
          <BadgeCheck size={15} strokeWidth={1.75} /> Converted to a contract
          {contractStatus && <span className="badge-neutral capitalize">{contractStatus}</span>}
        </p>
        <p className="mt-2 text-xs text-charcoal-600/70">
          Reserved for <span className="font-medium text-charcoal">{reservation.buyer_name ?? 'buyer'}</span>.
          The contract now drives the sale — once it is signed and the deposit is confirmed, the buyer becomes
          eligible for portal activation on their CRM record.
        </p>
      </div>
    );
  }

  // ── Active hold ──
  const expiresAt = reservation.expires_at ? new Date(reservation.expires_at) : null;
  const msLeft = expiresAt ? expiresAt.getTime() - Date.now() : null;
  const daysLeft = msLeft != null ? Math.ceil(msLeft / (24 * 60 * 60 * 1000)) : null;
  const lapsed = msLeft != null && msLeft < 0;

  return (
    <div className="panel p-6">
      <h4 className="mb-4">Reservation</h4>

      <div className="mb-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-charcoal-600/70">Buyer</span>
          <span className="font-medium text-charcoal">{reservation.buyer_name ?? '—'}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal-600/70">Deposit</span>
          <span className="figure">
            {reservation.deposit_amount != null ? `${formatCurrency(Number(reservation.deposit_amount))}` : '—'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-charcoal-600/70">Hold expires</span>
          <span className={`figure ${lapsed ? 'text-signal-danger' : 'text-charcoal'}`}>
            {expiresAt ? formatDate(expiresAt) : 'Χωρίς λήξη'}
            {daysLeft != null && (lapsed ? ' · lapsed' : ` · ${daysLeft}d left`)}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <span className={reservation.deposit_paid ? 'badge-forest' : 'badge-champagne'}>
          Deposit {reservation.deposit_paid ? 'confirmed' : 'pending'}
        </span>
      </div>

      <div className="flex flex-col gap-2 border-t border-stone-line pt-4">
        {!reservation.deposit_paid && (
          <button onClick={() => run(() => confirmDeposit(reservation.id))} disabled={isPending} className="btn-primary">
            <CheckCircle2 size={15} strokeWidth={1.75} /> Confirm deposit
          </button>
        )}
        <button onClick={() => run(() => convertReservationToContract(reservation.id))} disabled={isPending} className="btn-secondary">
          <FileText size={15} strokeWidth={1.75} /> Convert to contract
        </button>
        <div className="flex gap-2">
          <button onClick={() => run(() => extendReservation(reservation.id, 14))} disabled={isPending} className="btn-ghost flex-1 text-xs">
            Extend 14 days
          </button>
          <button onClick={() => run(() => cancelReservation(reservation.id))} disabled={isPending} className="btn-ghost flex-1 text-xs text-signal-danger">
            <XCircle size={13} strokeWidth={1.75} /> Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
