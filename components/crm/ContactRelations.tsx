'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, Trash2, Star, Search } from 'lucide-react';
import { addRelation, deleteRelation, findContacts, type ContactHit } from '@/app/actions/contact-card';
import { RELATIONS, inverseRelationLabel, relationLabel } from '@/lib/kyc-shared';
import { PhoneInput } from '@/components/ui/PhoneInput';

export interface RelationRow {
  id: string; direction: 'out' | 'in'; relation: string; decisionMaker: boolean; note: string | null;
  contactId: string | null; name: string; phone: string | null; email: string | null;
}

/** Οικογένεια & συνεργάτες: όσοι αποφασίζουν μαζί, ο δικηγόρος, ο λογιστής… */
export function ContactRelations({ contactId, rows, canEdit, missing }: { contactId: string; rows: RelationRow[]; canEdit: boolean; missing: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [picked, setPicked] = useState<ContactHit | null>(null);
  const [f, setF] = useState({ name: '', phone: '', email: '', relation: 'spouse', decisionMaker: false, note: '' });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (picked || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => setHits(await findContacts(q, contactId)), 250);
    return () => clearTimeout(t);
  }, [q, picked, contactId]);

  const save = () => start(async () => {
    setErr(null);
    const r = await addRelation(contactId, { relatedContactId: picked?.id ?? null, name: picked ? undefined : (f.name || q), phone: f.phone, email: f.email, relation: f.relation, decisionMaker: f.decisionMaker, note: f.note });
    if (!r.ok) { setErr(r.error); return; }
    setOpen(false); setPicked(null); setQ(''); setF({ name: '', phone: '', email: '', relation: 'spouse', decisionMaker: false, note: '' }); router.refresh();
  });
  const del = (r: RelationRow) => { if (window.confirm('Αφαίρεση της σχέσης;')) start(async () => { const x = await deleteRelation(r.id, contactId); if (x.ok) router.refresh(); else setErr(x.error); }); };

  return (
    <div className="panel space-y-4 p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h4 className="flex items-center gap-2"><Users size={16} /> Οικογένεια & συνεργάτες</h4>
          <p className="text-xs text-charcoal-600/70">Όσοι συναποφασίζουν, ο δικηγόρος, ο λογιστής, ο μεσίτης. Το αστέρι σημαίνει ότι αποφασίζει.</p>
        </div>
        {canEdit && !missing && !open && <button type="button" onClick={() => setOpen(true)} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Προσθήκη</button>}
      </div>
      {missing && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει το migration 0067.</p>}

      {open && (
        <div className="space-y-3 rounded-md border border-stone-line bg-stone/40 p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
            <input className="input pl-8" placeholder="Αναζήτηση επαφής ή νέο όνομα" value={picked ? picked.name : q} onChange={(e) => { setPicked(null); setQ(e.target.value); }} />
            {hits.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full rounded-md border border-stone-line bg-white shadow-overlay">
                {hits.map((h) => <li key={h.id}><button type="button" onClick={() => { setPicked(h); setHits([]); }} className="block w-full px-3 py-2 text-left text-sm hover:bg-sand-100">{h.name} <span className="text-xs text-charcoal-600/60">{[h.email, h.phone].filter(Boolean).join(' · ')}</span></button></li>)}
              </ul>
            )}
          </div>
          {picked ? <p className="text-xs text-signal-success">Θα συνδεθεί με την επαφή «{picked.name}».</p> : q.trim().length >= 2 && (
            <div className="grid gap-2 sm:grid-cols-2">
              <PhoneInput placeholder="Τηλέφωνο (προαιρετικό)" value={f.phone} onChange={(v) => setF({ ...f, phone: v })} />
              <input className="input py-1.5 text-sm" placeholder="Email (προαιρετικό)" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <select className="input py-1.5 text-sm" value={f.relation} onChange={(e) => setF({ ...f, relation: e.target.value })}>{RELATIONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.decisionMaker} onChange={(e) => setF({ ...f, decisionMaker: e.target.checked })} /> Συναποφασίζει για την αγορά</label>
          </div>
          <input className="input py-1.5 text-sm" placeholder="Σημείωση" maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
          {err && <p className="text-sm text-signal-danger">{err}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={pending || (!picked && q.trim().length < 2)} onClick={save} className="btn-primary">{pending ? '…' : 'Αποθήκευση'}</button>
            <button type="button" onClick={() => { setOpen(false); setErr(null); }} className="btn-secondary">Άκυρο</button>
          </div>
        </div>
      )}

      {rows.length === 0 ? (!missing && <p className="text-sm text-charcoal-600/60">Κανείς ακόμη.</p>) : (
        <ul className="divide-y divide-stone-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-medium text-charcoal">
                  {r.decisionMaker && <Star size={13} className="fill-champagne text-champagne" />}
                  {r.contactId ? <Link href={`/crm/${r.contactId}`} className="hover:underline">{r.name}</Link> : r.name}
                  <span className="badge-neutral font-normal">{r.direction === 'in' ? inverseRelationLabel(r.relation) : relationLabel(r.relation)}</span>
                </p>
                <p className="text-xs text-charcoal-600/60">{[r.phone, r.email, r.note].filter(Boolean).join(' · ')}</p>
              </div>
              {canEdit && r.direction === 'out' && <button type="button" disabled={pending} onClick={() => del(r)} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
