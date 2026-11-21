'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Search } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';
import { UnitStatusBadge } from './UnitStatusBadge';
import { EditUnitButton } from './EditUnitButton';
import { DeleteUnitButton } from './DeleteUnitButton';
import { setUnitStatus } from '@/app/actions/project-flow';
import { formatCurrency, formatNumber } from '@/lib/format';

export interface InventoryUnit {
  id: string;
  unit_number: string;
  floor: number | null;
  type: string | null;
  sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  price: number | null;
  status: string;
  building_name: string | null;
  building_id?: string | null;
  phase_name?: string | null;
  description?: string | null;
  owner_name?: string | null;
}

const STATUS: [string, string][] = [['available', 'Διαθέσιμη'], ['reserved', 'Κρατημένη'], ['sold', 'Πωλημένη'], ['handed_over', 'Παραδόθηκε'], ['blocked', 'Μη διαθέσιμη']];

/** Μονάδες του έργου: αναζήτηση, φίλτρο κατάστασης, αλλαγή κατάστασης, επεξεργασία και διαγραφή στη γραμμή. */
export function UnitInventoryTable({ projectId, units, buildings = [], canEdit = false }: { projectId: string; units: InventoryUnit[]; buildings?: { id: string; name: string }[]; canEdit?: boolean }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);
  const [local, setLocal] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const st = (u: InventoryUnit) => local[u.id] ?? u.status;
  const term = q.trim().toLowerCase();
  const list = units.filter((u) => (!filter || st(u) === filter) && (!term || [u.unit_number, u.type, u.building_name, u.owner_name].some((x) => (x ?? '').toLowerCase().includes(term))));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = list.slice(pg * per, pg * per + per);
  const change = (u: InventoryUnit, v: string) => {
    setLocal((l) => ({ ...l, [u.id]: v }));
    start(async () => {
      const r = await setUnitStatus(projectId, u.id, v);
      if (!r.ok) { setErr(r.error); setLocal((l) => { const n = { ...l }; delete n[u.id]; return n; }); return; }
      setErr(null); router.refresh();
    });
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
        <span>Εμφάνιση</span>
        <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
        <span>εγγραφές</span>
        <PopSelect width="min-w-[150px]" ariaLabel="Κατάσταση" value={filter} onChange={(v) => { setFilter(v); setPageNo(0); }} options={[['', 'Όλες οι καταστάσεις'], ...STATUS]} />
        <label className="relative w-full sm:ml-auto sm:w-[220px]">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} placeholder="Μονάδα, τύπος ή ιδιοκτήτης…" className="input h-8 py-1 pl-8 text-[13px]" />
        </label>
      </div>
      {err && <p className="mx-4 mb-3 rounded-xl border border-signal-danger/30 bg-rose-50 px-3 py-2 text-sm text-signal-danger sm:mx-5">{err}</p>}
      <div className="overflow-x-auto border-t border-stone-line">
        <table className="o-table">
          <thead><tr><th>Μονάδα</th><th>Κτίριο / φάση</th><th>Τύπος</th><th>Όροφος</th><th>m²</th><th>Υπν.</th><th>Τιμή</th><th>Ιδιοκτήτης</th><th>Κατάσταση</th><th className="text-right">Ενέργειες</th></tr></thead>
          <tbody>
            {page.map((u) => (
              <tr key={u.id}>
                <td className="o-strong" data-no-tr><Link href={`/projects/${projectId}/units/${u.id}`} className="hover:text-forest">{u.unit_number}</Link></td>
                <td data-no-tr>{[u.building_name, u.phase_name].filter(Boolean).join(' / ') || '—'}</td>
                <td data-no-tr>{u.type ?? '—'}</td>
                <td className="tabular-nums">{u.floor ?? '—'}</td>
                <td className="tabular-nums">{u.sqm != null ? formatNumber(Number(u.sqm)) : '—'}</td>
                <td className="tabular-nums">{u.bedrooms ?? '—'}</td>
                <td className="tabular-nums">{u.price != null ? formatCurrency(Number(u.price)) : '—'}</td>
                <td data-no-tr><span className="block max-w-[160px] truncate">{u.owner_name ?? '—'}</span></td>
                <td>{canEdit ? <PopSelect width="w-[140px]" ariaLabel="Κατάσταση" value={st(u)} onChange={(v) => change(u, v)} options={STATUS} /> : <UnitStatusBadge status={st(u)} />}</td>
                <td>
                  <span className="flex justify-end gap-0.5">
                    <Link href={`/projects/${projectId}/units/${u.id}`} title="Άνοιγμα" aria-label="Άνοιγμα" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-stone-100 hover:text-charcoal"><ArrowUpRight size={15} /></Link>
                    {canEdit && <EditUnitButton compact buildings={buildings} unit={{ id: u.id, project_id: projectId, unit_number: u.unit_number, building_id: u.building_id ?? null, floor: u.floor, sqm: u.sqm, price: u.price, bedrooms: u.bedrooms, bathrooms: u.bathrooms, description: u.description ?? null }} />}
                    {canEdit && <DeleteUnitButton compact unitId={u.id} projectId={projectId} onDone={() => undefined} />}
                  </span>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={10} className="py-10 text-center text-sm text-charcoal-600">Καμία μονάδα με αυτά τα φίλτρα.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pager from={list.length ? pg * per + 1 : 0} to={Math.min(list.length, pg * per + per)} total={list.length} page={pg} pages={pages} onPage={setPageNo} />
    </div>
  );
}
