'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, Search, Trash2, Users } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PopSelect } from '@/components/ui/PopSelect';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { FieldLabel } from '@/components/admin/settings-ui';
import { addFamilyContact, removeFamilyContact } from '@/app/actions/customer-card';
import { findContacts, type ContactHit } from '@/app/actions/contact-card';
import { FAMILY_RELATIONS, familyLabel, generationOf, type FamilyRow } from '@/lib/family-shared';

const GEN_LABEL: Record<number, string> = { [-2]: 'Παππούδες', [-1]: 'Γονείς', 0: 'Ίδια γενιά', 1: 'Παιδιά', 2: 'Εγγόνια' };
const initials = (n: string) => n.split(/\s+/).map((x) => x[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();

/** Καρτέλα πελάτη → Προφίλ → Επαφές: λίστα, «Νέα επαφή» και οικογενειακό δέντρο. */
export function FamilyContacts({ contactId, name, rows, canEdit, missing }: { contactId: string; name: string; rows: FamilyRow[]; canEdit: boolean; missing: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const del = (r: FamilyRow) => { if (window.confirm('Αφαίρεση της επαφής;')) start(async () => { const x = await removeFamilyContact(r.id, contactId); if (x.ok) router.refresh(); else setErr(x.error); }); };

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
          <div><h3 className="text-[17px] font-semibold text-charcoal">Επαφές</h3><p className="text-[13px] text-charcoal-600">Μέλη της οικογένειας ή άλλα πρόσωπα που σχετίζονται με τον πελάτη.</p></div>
          {canEdit && !missing && <button type="button" onClick={() => setOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90"><Plus size={14} /> Νέα επαφή</button>}
        </div>
        {missing && <p className="mx-5 mb-4 rounded-xl border border-stone-line bg-stone-50 px-3 py-2 text-xs text-charcoal-600">Ενεργοποιείται με το migration 0092.</p>}
        {err && <p className="mx-5 mb-3 text-sm text-signal-danger">{err}</p>}
        {rows.length === 0 ? (
          <div className="border-t border-stone-line px-5 py-10 text-center"><Users size={26} className="mx-auto text-forest/50" /><p className="mt-2 text-sm text-charcoal-600">Δεν υπάρχουν επαφές ακόμη.</p></div>
        ) : (
          <div className="overflow-x-auto border-t border-stone-line">
            <table className="o-table">
              <thead><tr><th>Όνομα</th><th>Σχέση</th><th>Κινητό</th><th>Email</th><th>Σημειώσεις</th><th className="text-right">Ενέργειες</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td className="o-strong">{r.contactId ? <Link href={`/crm/${r.contactId}`} className="hover:text-forest" data-no-tr>{r.name}</Link> : <span data-no-tr>{r.name}</span>}{r.contactId && <span className="ml-1.5 rounded-full bg-forest/10 px-1.5 py-px text-[10px] font-semibold text-forest">Πελάτης</span>}</td>
                  <td>{familyLabel(r.relation)}</td>
                  <td>{r.phone ? <a href={`tel:${r.phone.replace(/[^\d+]/g, '')}`} className="hover:text-forest" data-no-tr>{r.phone}</a> : '—'}</td>
                  <td>{r.email ? <a href={`mailto:${r.email}`} className="hover:text-forest" data-no-tr>{r.email}</a> : '—'}</td>
                  <td><span className="block max-w-[220px] truncate" data-no-tr>{r.note ?? '—'}</span></td>
                  <td className="text-right">{canEdit && <button type="button" disabled={pending} onClick={() => del(r)} title="Αφαίρεση" aria-label="Αφαίρεση" className="inline-flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <FamilyTree name={name} rows={rows} />
      {open && <AddContactDialog contactId={contactId} onClose={() => setOpen(false)} onSaved={() => { setOpen(false); router.refresh(); }} />}
    </div>
  );
}

/** Οικογενειακό δέντρο: γενιές σε σειρές, κάρτες ενωμένες με γραμμές στο χρώμα της εταιρείας. */
function FamilyTree({ name, rows }: { name: string; rows: FamilyRow[] }) {
  const gens = useMemo(() => {
    const m = new Map<number, FamilyRow[]>();
    for (const r of rows) { const g = generationOf(r.relation); if (g === null) continue; m.set(g, [...(m.get(g) ?? []), r]); }
    return m;
  }, [rows]);
  const others = rows.filter((r) => generationOf(r.relation) === null);
  const levels = [-2, -1, 0, 1, 2].filter((g) => g === 0 || (gens.get(g) ?? []).length);
  const Card = ({ title, sub, href, center }: { title: string; sub: string; href?: string | null; center?: boolean }) => {
    const inner = (
      <span className={`flex w-[150px] items-center gap-2 rounded-xl border px-2.5 py-2 text-left ${center ? 'border-forest bg-forest text-white shadow-[0_8px_20px_-12px_rgb(var(--c-forest)/0.7)]' : 'border-forest/25 bg-white hover:border-forest/60'}`}>
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${center ? 'bg-white/20 text-white' : 'bg-forest/[0.09] text-forest'}`}>{initials(title) || '?'}</span>
        <span className="min-w-0"><span className={`block truncate text-[13px] font-semibold ${center ? 'text-white' : 'text-charcoal'}`} data-no-tr>{title}</span><span className={`block truncate text-[11px] ${center ? 'text-white/80' : 'text-charcoal-600'}`}>{sub}</span></span>
      </span>
    );
    return <span className="relative z-10 flex flex-col items-center">{href ? <Link href={href}>{inner}</Link> : inner}</span>;
  };
  return (
    <section className="rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <h3 className="text-[17px] font-semibold text-charcoal">Οικογενειακό δέντρο</h3>
      {rows.length === 0 ? <p className="mt-2 text-sm text-charcoal-600">Προσθέστε επαφές για να δείτε το οικογενειακό δέντρο.</p> : (
        <div className="-mx-1 mt-4 overflow-x-auto px-1 pb-1">
          <div className="mx-auto flex w-max min-w-full flex-col items-center">
            {levels.map((g, i) => {
              const items = gens.get(g) ?? [];
              const cards = g === 0 ? [{ key: 'me', node: <Card title={name} sub="Πελάτης" center /> }, ...items.map((r) => ({ key: r.id, node: <Card title={r.name} sub={familyLabel(r.relation)} href={r.contactId ? `/crm/${r.contactId}` : null} /> }))]
                : items.map((r) => ({ key: r.id, node: <Card title={r.name} sub={familyLabel(r.relation)} href={r.contactId ? `/crm/${r.contactId}` : null} /> }));
              return (
                <div key={g} className="flex flex-col items-center">
                  {i > 0 && <span className="h-6 w-px bg-forest/50" />}
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-600/70">{GEN_LABEL[g]}</p>
                  <div className="relative flex gap-3 pt-3">
                    {cards.length > 1 && <span className="absolute left-[75px] right-[75px] top-0 h-px bg-forest/50" />}
                    {cards.map((c) => <span key={c.key} className="relative flex flex-col items-center"><span className="absolute -top-3 h-3 w-px bg-forest/50" />{c.node}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {others.length > 0 && (
        <div className="mt-5 border-t border-stone-line pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-600/70">Συνεργάτες & άλλοι</p>
          <div className="flex flex-wrap gap-3">{others.map((r) => <Card key={r.id} title={r.name} sub={familyLabel(r.relation)} href={r.contactId ? `/crm/${r.contactId}` : null} />)}</div>
        </div>
      )}
    </section>
  );
}

function AddContactDialog({ contactId, onClose, onSaved }: { contactId: string; onClose: () => void; onSaved: () => void }) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [picked, setPicked] = useState<ContactHit | null>(null);
  const [f, setF] = useState({ relation: '', firstName: '', lastName: '', phone: '', email: '', note: '' });
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (picked || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => setHits(await findContacts(q, contactId)), 250);
    return () => clearTimeout(t);
  }, [q, picked, contactId]);
  const save = () => start(async () => {
    setErr(null);
    if (!f.relation) { setErr('Διαλέξτε σχέση.'); return; }
    const r = await addFamilyContact(contactId, { relatedContactId: picked?.id ?? null, ...f });
    if (!r.ok) { setErr(r.error); return; }
    onSaved();
  });
  return (
    <Modal open onClose={onClose} title="Νέα επαφή" description="Μέλη της οικογένειας ή άλλα πρόσωπα που σχετίζονται με τον πελάτη." size="lg">
      <ModalBody className="space-y-4">
        <div className="relative">
          <FieldLabel>Σύνδεση με υπάρχοντα πελάτη</FieldLabel>
          {picked ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-forest/30 bg-forest/[0.05] px-3 py-2 text-sm">
              <span className="min-w-0"><span className="font-medium text-charcoal" data-no-tr>{picked.name}</span><span className="block truncate text-xs text-charcoal-600" data-no-tr>{picked.email ?? picked.phone ?? ''}</span></span>
              <button type="button" className="text-[13px] text-charcoal-600 hover:text-charcoal" onClick={() => setPicked(null)}>Αλλαγή</button>
            </div>
          ) : (
            <>
              <label className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
                <input className="input pl-8" placeholder="Αναζήτηση πελάτη — ή αφήστε κενό: Καμία (εξωτερική επαφή)" value={q} onChange={(e) => setQ(e.target.value)} /></label>
              {hits.length > 0 && (
                <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-line bg-white shadow-overlay">
                  {hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setPicked(h); setQ(''); setHits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50"><span data-no-tr>{h.name}</span> <span className="text-xs text-charcoal-600" data-no-tr>{h.email ?? h.phone ?? ''}</span></button></li>)}
                </ul>
              )}
            </>
          )}
          {picked && <p className="mt-1.5 text-xs text-charcoal-600">Η σχέση γράφεται και στην καρτέλα του άλλου πελάτη (π.χ. Πατέρας ↔ Γιος / Κόρη).</p>}
        </div>
        <label className="block"><FieldLabel>Σχέση *</FieldLabel>
          <PopSelect width="w-full" value={f.relation} placeholder="Διαλέξτε…" onChange={(v) => setF({ ...f, relation: v })} options={FAMILY_RELATIONS.map((r) => [r.v, r.l] as [string, string])} /></label>
        {!picked && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><FieldLabel>Όνομα *</FieldLabel><input className="input" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} /></label>
            <label className="block"><FieldLabel>Επώνυμο</FieldLabel><input className="input" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} /></label>
            <label className="block"><FieldLabel>Κινητό</FieldLabel><PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} /></label>
            <label className="block"><FieldLabel>Email</FieldLabel><input type="email" className="input" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
          </div>
        )}
        <label className="block"><FieldLabel>Σημειώσεις</FieldLabel><textarea className="input min-h-[70px]" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        {err && <p className="text-sm text-signal-danger">{err}</p>}
      </ModalBody>
      <ModalFooter className="justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Άκυρο</button>
        <button type="button" className="btn-primary" disabled={pending} onClick={save}><Plus size={14} /> Προσθήκη</button>
      </ModalFooter>
    </Modal>
  );
}

