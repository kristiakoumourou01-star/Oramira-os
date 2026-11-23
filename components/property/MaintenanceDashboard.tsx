'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Receipt, ArrowUpRight } from 'lucide-react';
import { assignTicketContractor, setTicketStatus } from '@/app/actions/property';
import { addCharge, setChargeStatus } from '@/app/actions/unit-history';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';
import { StatusPill, type Tone } from '@/components/ui/StatusPill';
import { ChargeDialog } from '@/components/units/UnitHistoryPanel';
import { CHARGE_STATUS } from '@/lib/unit-history-shared';
import { formatCurrency, formatDate } from '@/lib/format';

export interface AdminTicket {
  id: string;
  title: string;
  description?: string | null;
  category: string | null;
  status: string;
  priority: string;
  created_at: string;
  unit_id?: string | null;
  project_id?: string | null;
  unit_number: string | null;
  project_name: string | null;
  owner_name: string | null;
  contractor_id: string | null;
  contractor_name: string | null;
  charges?: { id: string; amount: number; status: string; description: string | null }[];
}
export interface ContractorOption { id: string; company_name: string }

const STATUS: [string, string][] = [['open', 'Ανοιχτό'], ['acknowledged', 'Παραλήφθηκε'], ['in_progress', 'Σε εξέλιξη'], ['awaiting_parts', 'Αναμονή υλικών'], ['resolved', 'Λύθηκε'], ['closed', 'Κλειστό'], ['reopened', 'Ξανάνοιξε']];
const OPEN = ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened'];
export const CATEGORY: Record<string, string> = { plumbing: 'Υδραυλικά', electrical: 'Ηλεκτρολογικά', hvac: 'Κλιματισμός / θέρμανση', appliance: 'Συσκευές', pool: 'Πισίνα', garden: 'Κήπος', cleaning: 'Καθαρισμός', structural: 'Δομικά', cosmetic: 'Φινιρίσματα', warranty: 'Εγγύηση', other: 'Άλλο' };
const STATUS_TONE: Record<string, Tone> = { open: 'blue', acknowledged: 'blue', in_progress: 'amber', awaiting_parts: 'amber', resolved: 'green', closed: 'neutral', reopened: 'red' };
const PRIORITY_TONE: Record<string, Tone> = { low: 'neutral', medium: 'blue', high: 'amber', emergency: 'red' };
const PRIORITY: Record<string, string> = { low: 'Χαμηλή', medium: 'Κανονική', high: 'Υψηλή', emergency: 'Επείγον' };

/** Κέντρο αιτημάτων ιδιοκτητών: φίλτρα, πίνακας, και καρτέλα αιτήματος με κατάσταση, συνεργείο και χρέωση στον ιδιοκτήτη. */
export function MaintenanceDashboard({ tickets, contractors, canEdit = true }: { tickets: AdminTicket[]; contractors: ContractorOption[]; canEdit?: boolean }) {
  const [filter, setFilter] = useState<'open' | 'all' | 'emergency' | 'charged'>('open');
  const [openId, setOpenId] = useState<string | null>(null);
  const [chargeFor, setChargeFor] = useState<AdminTicket | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  const run = (fn: () => Promise<unknown>, after?: () => void) => start(async () => {
    const r = (await fn()) as { ok?: boolean; error?: string } | undefined;
    if (r && r.ok === false) { setErr(r.error ?? 'Κάτι πήγε στραβά.'); return; }
    setErr(null); after?.(); router.refresh();
  });

  const count = { open: tickets.filter((t) => OPEN.includes(t.status)).length, all: tickets.length, emergency: tickets.filter((t) => t.priority === 'emergency').length, charged: tickets.filter((t) => (t.charges ?? []).length > 0).length };
  const shown = tickets.filter((t) => (filter === 'all' ? true : filter === 'emergency' ? t.priority === 'emergency' : filter === 'charged' ? (t.charges ?? []).length > 0 : OPEN.includes(t.status)));
  const pages = Math.max(1, Math.ceil(shown.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = shown.slice(pg * per, pg * per + per);
  const open = tickets.find((t) => t.id === openId) ?? null;
  const unitHref = (t: AdminTicket) => (t.project_id && t.unit_id ? `/projects/${t.project_id}/units/${t.unit_id}?tab=history` : null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([['open', 'Ανοιχτά'], ['emergency', 'Επείγοντα'], ['charged', 'Με χρέωση'], ['all', 'Όλα']] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setFilter(k); setPageNo(0); }} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${filter === k ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/30'}`}>
            <span>{l}</span><span className="tabular-nums opacity-80">{count[k]}</span>
          </button>
        ))}
      </div>
      {err && <p className="rounded-xl border border-signal-danger/30 bg-rose-50 px-3 py-2 text-sm text-signal-danger">{err}</p>}

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:px-5">
          <span>Προβάλλονται</span>
          <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          <span>εγγραφές</span>
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Αίτημα</th><th>Είδος</th><th>Ακίνητο</th><th>Ιδιοκτήτης</th><th>Προτεραιότητα</th><th>Κατάσταση</th><th>Χρέωση</th><th>Ημερομηνία</th></tr></thead>
            <tbody>
              {page.map((t) => {
                const charged = (t.charges ?? []).filter((c) => c.status !== 'cancelled').reduce((s, c) => s + c.amount, 0);
                return (
                  <tr key={t.id} onClick={() => setOpenId(t.id)} className="cursor-pointer">
                    <td className="o-strong" data-no-tr><span className="block max-w-[240px] truncate">{t.title}</span></td>
                    <td>{CATEGORY[t.category ?? 'other'] ?? t.category}</td>
                    <td><span data-no-tr>{t.project_name ?? ''}</span>{t.unit_number && <span data-no-tr> · {t.unit_number}</span>}</td>
                    <td data-no-tr>{t.owner_name ?? '—'}</td>
                    <td><StatusPill tone={PRIORITY_TONE[t.priority] ?? 'neutral'}>{PRIORITY[t.priority] ?? t.priority}</StatusPill></td>
                    <td><StatusPill tone={STATUS_TONE[t.status] ?? 'neutral'} dot>{STATUS.find(([k]) => k === t.status)?.[1] ?? t.status}</StatusPill></td>
                    <td className="tabular-nums">{charged ? formatCurrency(charged) : '—'}</td>
                    <td className="tabular-nums">{formatDate(t.created_at)}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-sm text-charcoal-600">Κανένα αίτημα σε αυτή την προβολή.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager from={shown.length ? pg * per + 1 : 0} to={Math.min(shown.length, pg * per + per)} total={shown.length} page={pg} pages={pages} onPage={setPageNo} />
      </div>

      {open && (
        <div className="anim-fade fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setOpenId(null)}>
          <aside className="anim-pop flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-stone-line px-5 py-4">
              <div className="min-w-0">
                <p className="eyebrow">Αίτημα ιδιοκτήτη</p>
                <h3 className="font-display text-xl text-charcoal" data-no-tr>{open.title}</h3>
                <p className="mt-0.5 text-sm text-charcoal-600"><span>{CATEGORY[open.category ?? 'other'] ?? open.category}</span> · <span>{PRIORITY[open.priority] ?? open.priority}</span> · <span className="tabular-nums">{formatDate(open.created_at)}</span></p>
              </div>
              <button type="button" onClick={() => setOpenId(null)} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={20} /></button>
            </div>
            <div className="space-y-5 px-5 py-5">
              <div className="space-y-1 text-sm">
                <p><span className="text-charcoal-600">Ιδιοκτήτης: </span><b className="text-charcoal" data-no-tr>{open.owner_name ?? '—'}</b></p>
                <p><span className="text-charcoal-600">Ακίνητο: </span><b className="text-charcoal" data-no-tr>{[open.project_name, open.unit_number].filter(Boolean).join(' · ') || '—'}</b></p>
                {unitHref(open) && <Link href={unitHref(open)!} className="inline-flex items-center gap-1 text-forest hover:underline"><ArrowUpRight size={14} /> Ιστορικό μονάδας</Link>}
              </div>
              {open.description && <p className="whitespace-pre-line rounded-xl bg-stone-50 p-3 text-sm text-charcoal" data-no-tr>{open.description}</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <div><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Κατάσταση</span>
                  <PopSelect width="w-full" ariaLabel="Κατάσταση" value={open.status} onChange={(v) => canEdit && run(() => setTicketStatus(open.id, v as any))} options={STATUS} /></div>
                <div><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Συνεργείο</span>
                  <PopSelect searchable width="w-full" ariaLabel="Συνεργείο" value={open.contractor_id ?? ''} onChange={(v) => { if (v && canEdit) run(() => assignTicketContractor(open.id, v)); }} options={[['', 'Ανάθεση…'], ...contractors.map((c) => [c.id, c.company_name] as [string, string])]} /></div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="font-semibold text-charcoal">Χρεώσεις στον ιδιοκτήτη</p>
                  {canEdit && open.unit_id && <button type="button" className="btn-secondary h-8 px-3 py-1 text-[13px]" onClick={() => setChargeFor(open)}><Receipt size={14} /> Νέα χρέωση</button>}
                </div>
                {(open.charges ?? []).length === 0 ? <p className="text-sm text-charcoal-600">Καμία χρέωση για αυτό το αίτημα.</p> : (
                  <ul className="divide-y divide-stone-line rounded-xl border border-stone-line">
                    {(open.charges ?? []).map((c) => (
                      <li key={c.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                        <span className="min-w-0 truncate" data-no-tr>{c.description ?? '—'}</span>
                        <span className="flex shrink-0 items-center gap-2"><b className="tabular-nums">{formatCurrency(c.amount)}</b>
                          <PopSelect width="w-[118px]" ariaLabel="Κατάσταση χρέωσης" value={c.status} onChange={(v) => canEdit && run(() => setChargeStatus(c.id, v as any))} options={Object.entries(CHARGE_STATUS)} /></span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}
      {chargeFor && <ChargeDialog open onClose={() => setChargeFor(null)} pending={pending} defaultDescription={chargeFor.title}
        onSave={(p) => run(() => addCharge({ unitId: chargeFor.unit_id!, ticketId: chargeFor.id, ...p }), () => setChargeFor(null))} />}
    </div>
  );
}
