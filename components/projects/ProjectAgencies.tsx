'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Handshake, Plus, Trash2, ShieldCheck, X } from 'lucide-react';
import { addAgencyListing, createAgency, removeAgencyListing } from '@/app/actions/agencies';

interface Agency { id: string; name: string; contact_name: string | null; email: string | null; phone: string | null; default_commission_pct: number | null }
interface Listing { id: string; agency_id: string; unit_id: string | null; commission_pct: number | null; exclusive: boolean; start_date: string | null; end_date: string | null }

/** Έργο → Agencies: ποια μεσιτικά πουλάνε όλο το έργο ή συγκεκριμένες μονάδες, με προμήθεια και αποκλειστικότητα. */
export function ProjectAgencies({ projectId, agencies, listings, units, canEdit }: { projectId: string; agencies: Agency[]; listings: Listing[]; units: { id: string; unit_number: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [form, setForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState('');
  const [newA, setNewA] = useState({ name: '', phone: '', email: '', pct: '' });
  const [scope, setScope] = useState<'all' | 'units'>('all');
  const [picked, setPicked] = useState<string[]>([]);
  const [pct, setPct] = useState('');
  const [exclusive, setExclusive] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const unitName = (id: string | null) => units.find((u) => u.id === id)?.unit_number ?? '—';
  const today = new Date().toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const m = new Map<string, Listing[]>();
    for (const l of listings) m.set(l.agency_id, [...(m.get(l.agency_id) ?? []), l]);
    return [...m.entries()].map(([id, ls]) => ({ a: agencies.find((x) => x.id === id), ls }));
  }, [listings, agencies]);

  const save = () => start(async () => {
    setErr(null);
    let id = agencyId;
    if (id === '__new') {
      const r = await createAgency({ name: newA.name, phone: newA.phone, email: newA.email, defaultPct: newA.pct });
      if (!r.ok) { setErr(r.error); return; }
      id = r.id;
    }
    if (!id) { setErr('Διαλέξτε agency.'); return; }
    if (scope === 'units' && !picked.length) { setErr('Διαλέξτε μονάδες.'); return; }
    const r = await addAgencyListing({ agencyId: id, projectId, unitIds: scope === 'units' ? picked : [], pct: pct || (id === '__new' ? newA.pct : null), exclusive, startDate: from || null, endDate: to || null });
    if (!r.ok) { setErr(r.error); return; }
    setForm(false); setAgencyId(''); setPicked([]); setPct(''); setExclusive(false); setFrom(''); setTo(''); setNewA({ name: '', phone: '', email: '', pct: '' });
    router.refresh();
  });

  return (
    <div className="panel space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-2"><Handshake size={15} className="text-olive" /> Agencies</h4>
        {canEdit && !form && <button type="button" onClick={() => setForm(true)} className="flex items-center gap-1 text-xs text-forest hover:underline"><Plus size={13} /> Ανάθεση</button>}
      </div>
      {grouped.length === 0 && !form && <p className="text-sm text-charcoal-600/70">Κανένα agency — το έργο πουλιέται μόνο από την εταιρεία.</p>}
      <ul className="space-y-2">
        {grouped.map(({ a, ls }) => {
          const all = ls.find((l) => !l.unit_id);
          const ex = ls.some((l) => l.exclusive);
          const expired = ls.every((l) => l.end_date && l.end_date < today);
          return (
            <li key={a?.id ?? ls[0].id} className={`rounded-lg border p-3 text-sm ${ex ? 'border-forest/40 bg-forest/[0.04]' : 'border-stone-line'} ${expired ? 'opacity-50' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-medium text-charcoal" data-no-tr>{a?.name ?? '—'}{ex && <span className="badge-forest inline-flex items-center gap-1 text-[10px]"><ShieldCheck size={11} /> Αποκλειστικό</span>}</p>
                  <p className="text-xs text-charcoal-600/70" data-no-tr>{[a?.contact_name, a?.phone, a?.email].filter(Boolean).join(' · ')}</p>
                  <p className="mt-0.5 text-xs text-charcoal-600">{all ? 'Όλο το έργο' : `Μονάδες: ${ls.map((l) => unitName(l.unit_id)).join(', ')}`} · προμήθεια {(all ?? ls[0]).commission_pct ?? a?.default_commission_pct ?? '—'}%{ls[0].end_date ? ` · έως ${ls[0].end_date}` : ''}</p>
                </div>
                {canEdit && <button type="button" disabled={pending} title="Αφαίρεση" aria-label="Αφαίρεση" onClick={() => { if (confirm(`Αφαίρεση του «${a?.name ?? ''}» από το έργο;`)) start(async () => { await removeAgencyListing(projectId, ls.map((l) => l.id)); router.refresh(); }); }} className="rounded p-1 text-charcoal-600/50 hover:bg-stone hover:text-signal-danger"><Trash2 size={14} /></button>}
              </div>
            </li>
          );
        })}
      </ul>

      {form && (
        <div className="space-y-2 rounded-lg border border-stone-line p-3 text-sm">
          <div className="flex items-center justify-between"><p className="font-medium text-charcoal">Ανάθεση σε agency</p><button type="button" onClick={() => setForm(false)} aria-label="Κλείσιμο"><X size={15} /></button></div>
          <select className="input" value={agencyId} onChange={(e) => setAgencyId(e.target.value)} data-no-tr>
            <option value="">Διαλέξτε agency…</option>
            {agencies.map((a) => <option key={a.id} value={a.id}>{a.name}{a.default_commission_pct != null ? ` · ${a.default_commission_pct}%` : ''}</option>)}
            <option value="__new">+ Νέο agency</option>
          </select>
          {agencyId === '__new' && (
            <div className="grid grid-cols-2 gap-2">
              <input className="input col-span-2" placeholder="Όνομα agency" value={newA.name} onChange={(e) => setNewA({ ...newA, name: e.target.value })} />
              <input className="input" placeholder="Τηλέφωνο" value={newA.phone} onChange={(e) => setNewA({ ...newA, phone: e.target.value })} />
              <input className="input" placeholder="Email" value={newA.email} onChange={(e) => setNewA({ ...newA, email: e.target.value })} />
              <input className="input col-span-2" inputMode="decimal" placeholder="Συνήθης προμήθεια %" value={newA.pct} onChange={(e) => setNewA({ ...newA, pct: e.target.value })} />
            </div>
          )}
          <div className="flex gap-3">
            <label className="flex items-center gap-1.5"><input type="radio" checked={scope === 'all'} onChange={() => setScope('all')} /> Όλο το έργο</label>
            <label className="flex items-center gap-1.5"><input type="radio" checked={scope === 'units'} onChange={() => setScope('units')} /> Συγκεκριμένες μονάδες</label>
          </div>
          {scope === 'units' && (
            <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
              {units.length === 0 && <p className="text-xs text-charcoal-600/70">Το έργο δεν έχει μονάδες ακόμα.</p>}
              {units.map((u) => { const on = picked.includes(u.id); return <button key={u.id} type="button" onClick={() => setPicked((x) => (on ? x.filter((y) => y !== u.id) : [...x, u.id]))} className={`rounded border px-2 py-0.5 text-xs ${on ? 'border-forest bg-forest/10 text-forest' : 'border-stone-line text-charcoal-600'}`} data-no-tr>{u.unit_number}</button>; })}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="text-xs text-charcoal-600/70">Προμήθεια % (κενό = η συνήθης)</span><input className="input" inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} /></label>
            <label className="mt-5 flex items-center gap-1.5"><input type="checkbox" checked={exclusive} onChange={(e) => setExclusive(e.target.checked)} /> Αποκλειστικότητα</label>
            <label className="block"><span className="text-xs text-charcoal-600/70">Από</span><input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="block"><span className="text-xs text-charcoal-600/70">Έως</span><input type="date" className="input" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          {err && <p className="text-xs text-signal-danger">{err}</p>}
          <div className="flex justify-end gap-2"><button type="button" className="btn-ghost text-xs" onClick={() => setForm(false)}>Άκυρο</button><button type="button" className="btn-primary text-xs" disabled={pending} onClick={save}>Αποθήκευση</button></div>
        </div>
      )}
    </div>
  );
}
