'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake } from 'lucide-react';
import { addNegotiation } from '@/app/actions/negotiations';
import { formatDate, formatCurrency } from '@/lib/format';

export interface NegotiationRow {
  id: string;
  offered_price: number | null;
  counter_offer: number | null;
  agreed_price: number | null;
  payment_terms: string | null;
  reservation_deposit: number | null;
  notes: string | null;
  created_at: string;
  author: string | null;
}

const eur = (n: number | null) => (n == null ? null : formatCurrency(n));

/** Negotiation block — append-only history of offers, counters, and terms. */
export function NegotiationTracker({ leadId, entries }: { leadId: string; entries: NegotiationRow[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const latestAgreed = entries.find((e) => e.agreed_price != null)?.agreed_price ?? null;

  function num(fd: FormData, k: string): number | null {
    const v = String(fd.get(k) || '').trim();
    return v ? Number(v) : null;
  }
  function submit(fd: FormData) {
    startTransition(async () => {
      await addNegotiation({
        leadId,
        offeredPrice: num(fd, 'offered'),
        counterOffer: num(fd, 'counter'),
        agreedPrice: num(fd, 'agreed'),
        reservationDeposit: num(fd, 'deposit'),
        paymentTerms: String(fd.get('terms') || '') || null,
        notes: String(fd.get('notes') || '') || null,
      });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Handshake size={15} className="text-olive" strokeWidth={1.75} /> Negotiation</h4>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">{open ? 'Cancel' : 'Add entry'}</button>
      </div>

      {latestAgreed != null && (
        <div className="mb-3 rounded border border-forest/30 bg-forest/5 p-2 text-sm">
          <span className="text-charcoal-600/70">Agreed price: </span><span className="figure font-medium text-forest">{eur(latestAgreed)}</span>
        </div>
      )}

      {open && (
        <form action={submit} className="mb-4 space-y-2 rounded border border-stone-line p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-charcoal-600/70">Offered price<input name="offered" type="number" step="1000" className="input mt-1 text-sm" /></label>
            <label className="text-xs text-charcoal-600/70">Counter-offer<input name="counter" type="number" step="1000" className="input mt-1 text-sm" /></label>
            <label className="text-xs text-charcoal-600/70">Agreed price<input name="agreed" type="number" step="1000" className="input mt-1 text-sm" /></label>
            <label className="text-xs text-charcoal-600/70">Reservation deposit<input name="deposit" type="number" step="500" className="input mt-1 text-sm" /></label>
          </div>
          <input name="terms" placeholder="Payment terms" className="input text-sm" />
          <textarea name="notes" placeholder="Negotiation notes" className="input min-h-[60px] text-sm" />
          <button type="submit" disabled={isPending} className="btn-primary w-full text-sm">{isPending ? 'Saving…' : 'Add to history'}</button>
        </form>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No negotiation activity yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-stone-line pl-4">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-champagne" />
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-sm">
                {eur(e.offered_price) && <span className="text-charcoal-600/80">Offer <span className="figure text-charcoal">{eur(e.offered_price)}</span></span>}
                {eur(e.counter_offer) && <span className="text-charcoal-600/80">Counter <span className="figure text-charcoal">{eur(e.counter_offer)}</span></span>}
                {eur(e.agreed_price) && <span className="text-charcoal-600/80">Agreed <span className="figure text-forest">{eur(e.agreed_price)}</span></span>}
                {eur(e.reservation_deposit) && <span className="text-charcoal-600/80">Deposit <span className="figure text-charcoal">{eur(e.reservation_deposit)}</span></span>}
              </div>
              {e.payment_terms && <p className="text-xs text-charcoal-600/70">Terms: {e.payment_terms}</p>}
              {e.notes && <p className="text-xs text-charcoal-600/70">{e.notes}</p>}
              <p className="text-xs text-charcoal-600/50">{e.author ? `${e.author} · ` : ''}{formatDate(e.created_at)}</p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
