'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarClock, AlertTriangle } from 'lucide-react';
import { extendReservation, cancelReservation, confirmDeposit } from '@/app/actions/reservations';
import { daysUntil, type ReservationSettings } from '@/lib/pricing-shared';
import { formatCurrency, formatDate } from '@/lib/format';

export interface ActiveReservation {
  id: string; unitId: string; unitNumber: string; buyerId: string; buyer: string | null;
  deposit: number | null; depositPaid: boolean; reservedAt: string | null; expiresAt: string | null; price: number | null;
}

/** Ενεργές κρατήσεις του έργου, η πιο επείγουσα πρώτη — παράταση, προκαταβολή, ακύρωση. */
export function ReservationsList({ projectId, items, settings, canEdit }: { projectId: string; items: ActiveReservation[]; settings: ReservationSettings; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const run = (fn: () => Promise<unknown>) => start(async () => {
    setErr(null);
    try { await fn(); router.refresh(); } catch (e) { setErr(e instanceof Error ? e.message : 'Δεν έγινε.'); }
  });
  const sorted = [...items].sort((a, b) => (Date.parse(a.expiresAt ?? '9999') - Date.parse(b.expiresAt ?? '9999')));

  return (
    <div className="panel space-y-3 p-5">
      <div>
        <h4 className="flex items-center gap-2"><CalendarClock size={15} /> Ενεργές κρατήσεις</h4>
        <p className="text-xs text-charcoal-600/70">
          Νέα κράτηση: {settings.holdDays} μέρες · προειδοποίηση {settings.warnDays} μέρες πριν τη λήξη ·
          {settings.autoRelease ? ' η μονάδα αποδεσμεύεται αυτόματα αν λήξει χωρίς προκαταβολή' : ' χωρίς αυτόματη αποδέσμευση'}{' '}
          (<Link href="/settings?section=pipelines" className="underline hover:text-forest">Ρυθμίσεις</Link>)
        </p>
      </div>
      {err && <p className="text-sm text-signal-danger">{err}</p>}
      {!sorted.length ? <p className="text-sm text-charcoal-600/60">Καμία ενεργή κράτηση.</p> : (
        <div className="overflow-x-auto rounded-md border border-stone-line">
          <table className="w-full text-sm">
            <thead className="bg-sand-100 text-left text-xs text-charcoal-600">
              <tr><th className="px-2 py-2">Μονάδα</th><th className="px-2 py-2">Αγοραστής</th><th className="px-2 py-2">Προκαταβολή</th><th className="px-2 py-2">Λήξη</th>{canEdit && <th className="px-2 py-2"></th>}</tr>
            </thead>
            <tbody className="divide-y divide-stone-line">
              {sorted.map((r) => {
                const left = daysUntil(r.expiresAt);
                const urgent = left !== null && !r.depositPaid && left <= settings.warnDays;
                return (
                  <tr key={r.id} className={urgent ? 'bg-red-50/50' : ''}>
                    <td className="px-2 py-1.5 font-medium"><Link href={`/projects/${projectId}/units/${r.unitId}`} className="hover:underline">{r.unitNumber}</Link>{r.price ? <span className="block text-[11px] font-normal text-charcoal-600/60">{formatCurrency(r.price)}</span> : null}</td>
                    <td className="px-2 py-1.5"><Link href={`/crm/${r.buyerId}`} className="hover:underline">{r.buyer ?? '—'}</Link>{r.reservedAt && <span className="block text-[11px] text-charcoal-600/60">από {formatDate(r.reservedAt)}</span>}</td>
                    <td className="px-2 py-1.5">
                      {r.deposit ? formatCurrency(r.deposit) : '—'}{' '}
                      <span className={`text-[11px] ${r.depositPaid ? 'text-signal-success' : 'text-champagne-600'}`}>{r.depositPaid ? 'πληρώθηκε' : 'εκκρεμεί'}</span>
                    </td>
                    <td className="px-2 py-1.5">
                      {r.expiresAt ? formatDate(r.expiresAt) : '—'}
                      {left !== null && (
                        <span className={`ml-1 inline-flex items-center gap-0.5 text-[11px] ${left < 0 ? 'text-signal-danger' : urgent ? 'text-signal-danger' : 'text-charcoal-600/70'}`}>
                          {urgent && <AlertTriangle size={11} />}{left < 0 ? `έληξε πριν ${-left} μέρες` : left === 0 ? 'λήγει σήμερα' : `σε ${left} μέρες`}
                        </span>
                      )}
                    </td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-2 py-1.5 text-right text-xs">
                        <button type="button" disabled={pending} onClick={() => run(() => extendReservation(r.id, 7))} className="mr-2 text-forest hover:underline">+7 μέρες</button>
                        {!r.depositPaid && <button type="button" disabled={pending} onClick={() => run(() => confirmDeposit(r.id))} className="mr-2 text-forest hover:underline">Πληρώθηκε</button>}
                        <button type="button" disabled={pending} onClick={() => { if (window.confirm(`Ακύρωση της κράτησης της ${r.unitNumber}; Η μονάδα γίνεται ξανά διαθέσιμη.`)) run(() => cancelReservation(r.id)); }} className="text-charcoal-600/60 hover:text-signal-danger">Ακύρωση</button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
