'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sparkles, CalendarCheck, FileSignature, PenLine, Wallet, UserRound, UserX, KeyRound, DoorOpen, DoorClosed, Wrench, CheckCircle2, Receipt, BadgeCheck, FileText, RefreshCw, Plus, Pencil, Trash2, type LucideIcon } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PopSelect } from '@/components/ui/PopSelect';
import { formatCurrency, formatDate } from '@/lib/format';
import { parseAmount } from '@/lib/amount';
import { CHARGE_KIND, CHARGE_STATUS, OCCUPANCY, OWNER_KIND, TENANCY_STATUS, type HistoryKind, type Tenancy, type UnitHistory } from '@/lib/unit-history-shared';
import { addCharge, changeUnitOwner, deleteCharge, deleteOwnershipEntry, deleteTenancy, saveTenancy, setAnnualFee, setChargeStatus, setUnitOccupancy } from '@/app/actions/unit-history';

const ICON: Record<HistoryKind, LucideIcon> = {
  created: Sparkles, reservation: CalendarCheck, reservation_end: CalendarCheck, contract: FileSignature, contract_signed: PenLine, payment: Wallet,
  owner: UserRound, owner_removed: UserX, tenancy_start: DoorOpen, tenancy_end: DoorClosed, handover: KeyRound, ticket: Wrench, ticket_resolved: CheckCircle2,
  charge: Receipt, charge_paid: BadgeCheck, document: FileText, status: RefreshCw,
};
const GROUPS: [string, string, HistoryKind[]][] = [
  ['all', 'Όλα', []],
  ['sale', 'Πώληση & ιδιοκτήτες', ['reservation', 'reservation_end', 'contract', 'contract_signed', 'owner', 'owner_removed', 'handover', 'status', 'created']],
  ['rent', 'Ενοικιάσεις', ['tenancy_start', 'tenancy_end']],
  ['money', 'Πληρωμές & χρεώσεις', ['payment', 'charge', 'charge_paid']],
  ['care', 'Συντήρηση', ['ticket', 'ticket_resolved']],
  ['docs', 'Έγγραφα', ['document']],
];
const card = 'rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5';
const small = 'inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-2.5 text-[13px] text-charcoal hover:border-forest/30';
const iconBtn = 'flex h-7 w-7 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-charcoal';
const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';

/** Καρτέλα «Ιστορικό & ιδιοκτησία» της μονάδας: χρονολόγιο, ιδιοκτήτες, ενοικιάσεις, χρεώσεις. */
export function UnitHistoryPanel({ unitId, history, contacts, canEdit }: { unitId: string; history: UnitHistory; contacts: [string, string][]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [group, setGroup] = useState('all');
  const [err, setErr] = useState<string | null>(null);
  const [ownerOpen, setOwnerOpen] = useState(false);
  const [tenancy, setTenancy] = useState<Tenancy | 'new' | null>(null);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [fee, setFee] = useState(history.annualFee != null ? String(history.annualFee) : '');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { setErr(r.error ?? 'Κάτι πήγε στραβά.'); return; }
    setErr(null); after?.(); router.refresh();
  });
  const kinds = GROUPS.find((g) => g[0] === group)?.[2] ?? [];
  const events = kinds.length ? history.events.filter((e) => kinds.includes(e.kind)) : history.events;
  const pendingTotal = history.charges.filter((c) => c.status === 'pending').reduce((t, c) => t + c.amount, 0);

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[16px] font-semibold text-charcoal">Χρονολόγιο μονάδας</p>
          <PopSelect width="min-w-[190px]" ariaLabel="Φίλτρο" value={group} onChange={setGroup} options={GROUPS.map(([k, l]) => [k, l])} />
        </div>
        {events.length === 0 ? <p className="py-6 text-center text-sm text-charcoal-600">Δεν υπάρχει ακόμη τίποτα σε αυτό το χρονολόγιο.</p> : (
          <ol className="relative space-y-4 border-l border-stone-line pl-6">
            {events.map((e) => {
              const I = ICON[e.kind];
              return (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[37px] top-0 flex h-6 w-6 items-center justify-center rounded-full border border-stone-line bg-white text-forest"><I size={13} /></span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <p className="text-[14px] font-medium text-charcoal"><span>{e.title}</span>{e.sub && <span className="text-charcoal-600"> — <span>{e.sub}</span></span>}</p>
                    <span className="text-[12px] tabular-nums text-charcoal-600">{formatDate(e.at)}</span>
                  </div>
                  <p className="flex flex-wrap gap-x-2 text-[13px] text-charcoal-600">
                    {e.person && (e.personId ? <Link href={`/crm/${e.personId}`} className="text-forest hover:underline" data-no-tr>{e.person}</Link> : <span data-no-tr>{e.person}</span>)}
                    {e.amount != null && e.amount > 0 && <span className="tabular-nums">{formatCurrency(e.amount)}</span>}
                    {e.detail && <span className="truncate" data-no-tr>{e.detail}</span>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="space-y-4">
        {err && <p className="rounded-xl border border-signal-danger/30 bg-rose-50 px-3 py-2 text-sm text-signal-danger">{err}</p>}
        {!history.ready && <p className="rounded-xl border border-stone-line bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600">Οι ενοικιάσεις και οι χρεώσεις ενεργοποιούνται μόλις ενημερωθεί η βάση.</p>}

        {/* Ιδιοκτήτες */}
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-semibold text-charcoal">Ιδιοκτήτης</p>
            {canEdit && <button type="button" className={small} onClick={() => setOwnerOpen(true)}><UserRound size={14} /> Αλλαγή</button>}
          </div>
          {history.currentOwner ? (
            <Link href={`/crm/${history.currentOwner.id}`} className="block text-[15px] font-medium text-forest hover:underline" data-no-tr>{history.currentOwner.name ?? '—'}</Link>
          ) : <p className="text-sm text-charcoal-600">Δεν έχει οριστεί ιδιοκτήτης.</p>}
          {history.owners.length > 0 && (
            <ul className="mt-3 divide-y divide-stone-line border-t border-stone-line">
              {history.owners.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-charcoal" data-no-tr>{o.name ?? '—'}</p>
                    <p className="text-charcoal-600">
                      {o.kind && OWNER_KIND[o.kind] && <span>{OWNER_KIND[o.kind]} </span>}
                      <span className="tabular-nums">{o.from ? formatDate(o.from) : '…'} – {o.to ? formatDate(o.to) : <span>σήμερα</span>}</span>
                      {o.price != null && <span className="tabular-nums"> · {formatCurrency(o.price)}</span>}
                    </p>
                  </div>
                  {canEdit && o.id !== 'current' && <button type="button" className={iconBtn} title="Διαγραφή εγγραφής" aria-label="Διαγραφή εγγραφής" onClick={() => { if (confirm('Να διαγραφεί αυτή η εγγραφή από το ιστορικό;')) run(() => deleteOwnershipEntry(unitId, o.id)); }}><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Χρήση & ενοικιάσεις */}
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-semibold text-charcoal">Χρήση & ενοικιάσεις</p>
            {canEdit && history.ready && <button type="button" className={small} onClick={() => setTenancy('new')}><Plus size={14} /> Ενοικίαση</button>}
          </div>
          <span className={label}>Χρήση</span>
          {canEdit ? <PopSelect width="w-full" ariaLabel="Χρήση" value={history.occupancy ?? 'vacant'} onChange={(v) => run(() => setUnitOccupancy(unitId, v))} options={Object.entries(OCCUPANCY)} />
            : <p className="text-sm text-charcoal">{OCCUPANCY[history.occupancy ?? ''] ?? '—'}</p>}
          {history.tenancies.length > 0 ? (
            <ul className="mt-3 divide-y divide-stone-line border-t border-stone-line">
              {history.tenancies.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2"><span className="truncate font-medium text-charcoal" data-no-tr>{t.tenantName ?? '—'}</span><span className={`rounded-full px-2 py-0.5 text-[11px] ${t.status === 'active' ? 'bg-forest text-white' : 'border border-stone-line text-charcoal-600'}`}>{TENANCY_STATUS[t.status] ?? t.status}</span></p>
                    <p className="tabular-nums text-charcoal-600">{t.startDate ? formatDate(t.startDate) : '…'} – {t.endDate ? formatDate(t.endDate) : '…'}{t.monthlyRent != null && <span> · {formatCurrency(t.monthlyRent)}/<span>μήνα</span></span>}</p>
                  </div>
                  {canEdit && <span className="flex shrink-0">
                    <button type="button" className={iconBtn} title="Επεξεργασία" aria-label="Επεξεργασία" onClick={() => setTenancy(t)}><Pencil size={14} /></button>
                    <button type="button" className={iconBtn} title="Διαγραφή" aria-label="Διαγραφή" onClick={() => { if (confirm('Να διαγραφεί αυτή η ενοικίαση;')) run(() => deleteTenancy(unitId, t.id)); }}><Trash2 size={14} /></button>
                  </span>}
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[13px] text-charcoal-600">Καμία ενοικίαση.</p>}
        </div>

        {/* Χρεώσεις & ετήσια συντήρηση */}
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="font-semibold text-charcoal">Χρεώσεις ιδιοκτήτη</p>
            {canEdit && history.ready && <button type="button" className={small} onClick={() => setChargeOpen(true)}><Plus size={14} /> Χρέωση</button>}
          </div>
          <span className={label}>Ετήσια συντήρηση (€)</span>
          {canEdit && history.ready ? (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); run(() => setAnnualFee(unitId, fee.trim() ? parseAmount(fee) ?? null : null)); }}>
              <input className="input h-8 flex-1 py-1 text-[13px]" inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="π.χ. 1.200" />
              <button type="submit" className="btn-secondary h-8 px-3 py-1 text-[13px]" disabled={pending}>Αποθήκευση</button>
            </form>
          ) : <p className="text-sm text-charcoal tabular-nums">{history.annualFee != null ? formatCurrency(history.annualFee) : '—'}</p>}
          {pendingTotal > 0 && <p className="mt-2 text-[13px] text-charcoal-600"><span>Εκκρεμούν</span> <b className="tabular-nums text-charcoal">{formatCurrency(pendingTotal)}</b></p>}
          {history.charges.length > 0 ? (
            <ul className="mt-3 divide-y divide-stone-line border-t border-stone-line">
              {history.charges.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-charcoal" data-no-tr>{c.description ?? '—'}</p>
                    <p className="text-charcoal-600"><span>{CHARGE_KIND[c.kind] ?? c.kind}</span> · <span className="tabular-nums">{formatDate(c.dueDate ?? c.createdAt)}</span></p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="tabular-nums font-medium text-charcoal">{formatCurrency(c.amount)}</span>
                    {canEdit ? <PopSelect width="w-[118px]" ariaLabel="Κατάσταση χρέωσης" value={c.status} onChange={(v) => run(() => setChargeStatus(c.id, v as 'pending' | 'paid' | 'cancelled'))} options={Object.entries(CHARGE_STATUS)} />
                      : <span className="text-charcoal-600">{CHARGE_STATUS[c.status] ?? c.status}</span>}
                    {canEdit && <button type="button" className={iconBtn} title="Διαγραφή" aria-label="Διαγραφή" onClick={() => { if (confirm('Να διαγραφεί η χρέωση;')) run(() => deleteCharge(c.id)); }}><Trash2 size={14} /></button>}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-[13px] text-charcoal-600">Καμία χρέωση.</p>}
        </div>
      </div>

      <OwnerDialog open={ownerOpen} onClose={() => setOwnerOpen(false)} contacts={contacts} hasOwner={!!history.currentOwner} pending={pending}
        onSave={(p) => run(() => changeUnitOwner({ unitId, ...p }), () => setOwnerOpen(false))} />
      {tenancy && <TenancyDialog t={tenancy === 'new' ? null : tenancy} contacts={contacts} pending={pending} onClose={() => setTenancy(null)}
        onSave={(p) => run(() => saveTenancy({ unitId, ...p }), () => setTenancy(null))} />}
      <ChargeDialog open={chargeOpen} onClose={() => setChargeOpen(false)} pending={pending}
        onSave={(p) => run(() => addCharge({ unitId, ...p }), () => setChargeOpen(false))} />
    </div>
  );
}

function OwnerDialog({ open, onClose, contacts, hasOwner, pending, onSave }: { open: boolean; onClose: () => void; contacts: [string, string][]; hasOwner: boolean; pending: boolean; onSave: (p: { contactId: string | null; kind: string; date: string | null; price: number | null; note: string }) => void }) {
  const [contact, setContact] = useState('');
  const [kind, setKind] = useState(hasOwner ? 'resale' : 'sale');
  return (
    <Modal open={open} onClose={onClose} title="Αλλαγή ιδιοκτήτη" description="Ο προηγούμενος ιδιοκτήτης μένει στο ιστορικό. Ο νέος αποκτά πρόσβαση στην πλατφόρμα ιδιοκτητών." size="md">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ contactId: contact || null, kind, date: String(f.get('date') || '') || null, price: parseAmount(f.get('price')) ?? null, note: String(f.get('note') || '') }); }}>
        <ModalBody className="space-y-3">
          <div><span className={label}>Νέος ιδιοκτήτης</span><PopSelect searchable width="w-full" ariaLabel="Νέος ιδιοκτήτης" value={contact} onChange={setContact} placeholder="Επιλέξτε πελάτη…" options={[['', hasOwner ? 'Κανένας (αφαίρεση ιδιοκτήτη)' : 'Επιλέξτε πελάτη…'], ...contacts]} /></div>
          {contact && <div><span className={label}>Τρόπος</span><PopSelect width="w-full" ariaLabel="Τρόπος" value={kind} onChange={setKind} options={Object.entries(OWNER_KIND).filter(([k]) => k !== 'removed')} /></div>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={label}>Ημερομηνία</span><input name="date" type="date" className="input" defaultValue={new Date().toISOString().slice(0, 10)} /></label>
            {contact && <label className="block"><span className={label}>Τιμή (€)</span><input name="price" inputMode="decimal" className="input" placeholder="προαιρετικό" /></label>}
          </div>
          <label className="block"><span className={label}>Σημείωση</span><input name="note" className="input" placeholder="προαιρετικό" /></label>
        </ModalBody>
        <ModalFooter><button type="button" className="btn-secondary" onClick={onClose}>Άκυρο</button><button type="submit" className="btn-primary flex-1" disabled={pending || (!contact && !hasOwner)}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></ModalFooter>
      </form>
    </Modal>
  );
}

function TenancyDialog({ t, contacts, pending, onClose, onSave }: { t: Tenancy | null; contacts: [string, string][]; pending: boolean; onClose: () => void; onSave: (p: { id?: string; tenantContactId: string | null; tenantName: string; startDate: string | null; endDate: string | null; monthlyRent: number | null; deposit: number | null; status: string; notes: string }) => void }) {
  const [tenant, setTenant] = useState(t?.tenantContactId ?? '');
  const [status, setStatus] = useState(t?.status ?? 'active');
  return (
    <Modal open onClose={onClose} title={t ? 'Επεξεργασία ενοικίασης' : 'Νέα ενοικίαση'} size="md">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ id: t?.id, tenantContactId: tenant || null, tenantName: String(f.get('tenantName') || ''), startDate: String(f.get('start') || '') || null, endDate: String(f.get('end') || '') || null, monthlyRent: parseAmount(f.get('rent')) ?? null, deposit: parseAmount(f.get('deposit')) ?? null, status, notes: String(f.get('notes') || '') }); }}>
        <ModalBody className="space-y-3">
          <div><span className={label}>Ενοικιαστής (πελάτης)</span><PopSelect searchable width="w-full" ariaLabel="Ενοικιαστής" value={tenant} onChange={setTenant} options={[['', 'Χωρίς καρτέλα πελάτη'], ...contacts]} /></div>
          {!tenant && <label className="block"><span className={label}>Όνομα ενοικιαστή</span><input name="tenantName" className="input" defaultValue={t?.tenantContactId ? '' : t?.tenantName ?? ''} data-no-tr /></label>}
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={label}>Από</span><input name="start" type="date" className="input" defaultValue={t?.startDate ?? new Date().toISOString().slice(0, 10)} /></label>
            <label className="block"><span className={label}>Έως</span><input name="end" type="date" className="input" defaultValue={t?.endDate ?? ''} /></label>
            <label className="block"><span className={label}>Ενοίκιο / μήνα (€)</span><input name="rent" inputMode="decimal" className="input" defaultValue={t?.monthlyRent ?? ''} /></label>
            <label className="block"><span className={label}>Εγγύηση (€)</span><input name="deposit" inputMode="decimal" className="input" defaultValue={t?.deposit ?? ''} /></label>
          </div>
          <div><span className={label}>Κατάσταση</span><PopSelect width="w-full" ariaLabel="Κατάσταση" value={status} onChange={setStatus} options={Object.entries(TENANCY_STATUS)} /></div>
          <label className="block"><span className={label}>Σημειώσεις</span><textarea name="notes" className="input min-h-[60px]" defaultValue={t?.notes ?? ''} /></label>
        </ModalBody>
        <ModalFooter><button type="button" className="btn-secondary" onClick={onClose}>Άκυρο</button><button type="submit" className="btn-primary flex-1" disabled={pending}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></ModalFooter>
      </form>
    </Modal>
  );
}

export function ChargeDialog({ open, onClose, pending, onSave, defaultDescription = '' }: { open: boolean; onClose: () => void; pending: boolean; defaultDescription?: string; onSave: (p: { kind: string; description: string; amount: number; dueDate: string | null }) => void }) {
  const [kind, setKind] = useState('service');
  return (
    <Modal open={open} onClose={onClose} title="Νέα χρέωση στον ιδιοκτήτη" size="md">
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); onSave({ kind, description: String(f.get('description') || ''), amount: parseAmount(f.get('amount')) ?? 0, dueDate: String(f.get('due') || '') || null }); }}>
        <ModalBody className="space-y-3">
          <div><span className={label}>Είδος</span><PopSelect width="w-full" ariaLabel="Είδος" value={kind} onChange={setKind} options={Object.entries(CHARGE_KIND)} /></div>
          <label className="block"><span className={label}>Περιγραφή</span><input name="description" required className="input" defaultValue={defaultDescription} placeholder="π.χ. Επισκευή υδραυλικών" /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className={label}>Ποσό (€)</span><input name="amount" required inputMode="decimal" className="input" /></label>
            <label className="block"><span className={label}>Λήξη πληρωμής</span><input name="due" type="date" className="input" /></label>
          </div>
        </ModalBody>
        <ModalFooter><button type="button" className="btn-secondary" onClick={onClose}>Άκυρο</button><button type="submit" className="btn-primary flex-1" disabled={pending}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></ModalFooter>
      </form>
    </Modal>
  );
}
