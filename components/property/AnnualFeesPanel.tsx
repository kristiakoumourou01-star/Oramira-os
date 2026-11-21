'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CalendarPlus } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';
import { generateAnnualFees, setAnnualFee, setChargeStatus } from '@/app/actions/unit-history';
import { CHARGE_KIND, CHARGE_STATUS } from '@/lib/unit-history-shared';
import { formatCurrency, formatDate } from '@/lib/format';
import { parseAmount } from '@/lib/amount';

export interface FeeUnit { id: string; unitNumber: string; owner: string | null; fee: number | null }
export interface FeeCharge { id: string; unitId: string; unitNumber: string; owner: string | null; kind: string; description: string | null; amount: number; status: string; dueDate: string | null; createdAt: string }

/** Ετήσια συντήρηση & χρεώσεις ιδιοκτητών ενός έργου. */
export function AnnualFeesPanel({ projectId, units, charges, canEdit, ready }: { projectId: string; units: FeeUnit[]; charges: FeeCharge[]; canEdit: boolean; ready: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [fees, setFees] = useState<Record<string, string>>(() => Object.fromEntries(units.map((u) => [u.id, u.fee != null ? String(u.fee) : ''])));
  const [stF, setStF] = useState('pending');
  const [pageNo, setPageNo] = useState(0);
  const per = 25;
  const list = charges.filter((c) => !stF || c.status === stF);
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const years = Array.from({ length: 4 }, (_, i) => String(new Date().getFullYear() - 1 + i));
  const save = (u: FeeUnit) => { const v = fees[u.id]?.trim(); start(async () => { const r = await setAnnualFee(u.id, v ? parseAmount(v) ?? null : null); setMsg(r.ok ? null : r.error); router.refresh(); }); };
  const gen = () => start(async () => {
    const r = await generateAnnualFees({ year: Number(year), projectId });
    setMsg(r.ok ? `Δημιουργήθηκαν ${r.created} χρεώσεις.` : r.error);
    router.refresh();
  });

  if (!ready) return <p className="rounded-2xl border border-stone-line bg-white p-6 text-sm text-charcoal-600">Οι χρεώσεις ενεργοποιούνται μόλις ενημερωθεί η βάση.</p>;
  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <div>
            <p className="font-semibold text-charcoal">Ετήσια συντήρηση ανά μονάδα</p>
            <p className="text-[13px] text-charcoal-600">Ορίστε το ετήσιο ποσό κάθε μονάδας και δημιουργήστε τις χρεώσεις της χρονιάς με ένα κλικ.</p>
          </div>
          {canEdit && <span className="flex items-center gap-2">
            <PopSelect width="w-[90px]" ariaLabel="Έτος" value={year} onChange={setYear} options={years.map((y) => [y, y])} />
            <button type="button" className="btn-primary h-8 px-3 py-1 text-[13px]" disabled={pending} onClick={gen}><CalendarPlus size={14} /> Δημιουργία χρεώσεων</button>
          </span>}
        </div>
        {msg && <p className="mx-4 mb-3 rounded-xl bg-forest/[0.06] px-3 py-2 text-sm text-charcoal sm:mx-5">{msg}</p>}
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Μονάδα</th><th>Ιδιοκτήτης</th><th>Ετήσιο ποσό (€)</th></tr></thead>
            <tbody>
              {units.map((u) => (
                <tr key={u.id}>
                  <td className="o-strong" data-no-tr><Link href={`/projects/${projectId}/units/${u.id}?tab=history`} className="hover:text-forest">{u.unitNumber}</Link></td>
                  <td data-no-tr>{u.owner ?? '—'}</td>
                  <td>{canEdit ? (
                    <form className="flex max-w-[220px] gap-1.5" onSubmit={(e) => { e.preventDefault(); save(u); }}>
                      <input className="input h-8 py-1 text-[13px]" inputMode="decimal" value={fees[u.id] ?? ''} onChange={(e) => setFees((f) => ({ ...f, [u.id]: e.target.value }))} placeholder="—" aria-label="Ετήσιο ποσό" />
                      {(fees[u.id] ?? '') !== (u.fee != null ? String(u.fee) : '') && <button type="submit" className="btn-secondary h-8 px-2.5 py-1 text-[13px]" disabled={pending}>Αποθήκευση</button>}
                    </form>
                  ) : <span className="tabular-nums">{u.fee != null ? formatCurrency(u.fee) : '—'}</span>}</td>
                </tr>
              ))}
              {units.length === 0 && <tr><td colSpan={3} className="py-8 text-center text-sm text-charcoal-600">Δεν υπάρχουν μονάδες.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <p className="font-semibold text-charcoal">Χρεώσεις ιδιοκτητών</p>
          <PopSelect width="min-w-[150px]" ariaLabel="Κατάσταση" value={stF} onChange={(v) => { setStF(v); setPageNo(0); }} options={[['', 'Όλες'], ...Object.entries(CHARGE_STATUS)]} />
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Μονάδα</th><th>Ιδιοκτήτης</th><th>Είδος</th><th>Περιγραφή</th><th>Λήξη</th><th>Ποσό</th><th>Κατάσταση</th></tr></thead>
            <tbody>
              {list.slice(pg * per, pg * per + per).map((c) => (
                <tr key={c.id}>
                  <td className="o-strong" data-no-tr>{c.unitNumber}</td>
                  <td data-no-tr>{c.owner ?? '—'}</td>
                  <td>{CHARGE_KIND[c.kind] ?? c.kind}</td>
                  <td data-no-tr><span className="block max-w-[220px] truncate">{c.description ?? '—'}</span></td>
                  <td className="tabular-nums">{formatDate(c.dueDate ?? c.createdAt)}</td>
                  <td className="tabular-nums">{formatCurrency(c.amount)}</td>
                  <td>{canEdit ? <PopSelect width="w-[124px]" ariaLabel="Κατάσταση χρέωσης" value={c.status} onChange={(v) => start(async () => { await setChargeStatus(c.id, v as 'pending' | 'paid' | 'cancelled'); router.refresh(); })} options={Object.entries(CHARGE_STATUS)} /> : CHARGE_STATUS[c.status] ?? c.status}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7} className="py-8 text-center text-sm text-charcoal-600">Καμία χρέωση σε αυτή την προβολή.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager from={list.length ? pg * per + 1 : 0} to={Math.min(list.length, pg * per + per)} total={list.length} page={pg} pages={pages} onPage={setPageNo} />
      </div>
    </div>
  );
}
