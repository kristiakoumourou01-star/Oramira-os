'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Building, Layers, Pencil, Trash2 } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PopSelect } from '@/components/ui/PopSelect';
import { saveBuilding, deleteBuilding, savePhase, deletePhase } from '@/app/actions/project-flow';

export interface BuildingNode { id: string; name: string; floors: number | null; unitCount: number }
export interface PhaseNode { id: string; name: string; building_id: string | null; sequence: number; unitCount?: number }

const label = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-stone-100 hover:text-charcoal';
const delBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-rose-50 hover:text-signal-danger';

/** Κτίρια & φάσεις του έργου: προσθήκη, μετονομασία, διαγραφή σε καθαρούς πίνακες. */
export function StructureManager({ projectId, buildings, phases, canEdit = true }: { projectId: string; buildings: BuildingNode[]; phases: PhaseNode[]; canEdit?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [b, setB] = useState<BuildingNode | 'new' | null>(null);
  const [ph, setPh] = useState<PhaseNode | 'new' | null>(null);
  const [phBuilding, setPhBuilding] = useState('');
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, after?: () => void) => start(async () => {
    const r = await fn();
    if (!r.ok) { setErr(r.error ?? 'Κάτι πήγε στραβά.'); return; }
    setErr(null); after?.(); router.refresh();
  });
  const bName = (id: string | null) => buildings.find((x) => x.id === id)?.name ?? null;
  const sortedPhases = [...phases].sort((x, y) => x.sequence - y.sequence);

  return (
    <div className="space-y-5">
      {err && <p className="rounded-xl border border-signal-danger/30 bg-rose-50 px-3 py-2 text-sm text-signal-danger">{err}</p>}
      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 font-semibold text-charcoal"><Building size={16} className="text-forest" /> Κτίρια</p>
          {canEdit && <button type="button" className="btn-secondary h-8 px-3 py-1 text-[13px]" onClick={() => setB('new')}><Plus size={14} /> Νέο κτίριο</button>}
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Κτίριο</th><th>Όροφοι</th><th>Μονάδες</th>{canEdit && <th className="text-right">Ενέργειες</th>}</tr></thead>
            <tbody>
              {buildings.map((x) => (
                <tr key={x.id}>
                  <td className="o-strong" data-no-tr>{x.name}</td>
                  <td className="tabular-nums">{x.floors ?? '—'}</td>
                  <td className="tabular-nums">{x.unitCount}</td>
                  {canEdit && <td><span className="flex justify-end gap-0.5">
                    <button type="button" className={iconBtn} title="Επεξεργασία" aria-label="Επεξεργασία" onClick={() => setB(x)}><Pencil size={15} /></button>
                    <button type="button" className={delBtn} title="Διαγραφή" aria-label="Διαγραφή" disabled={pending} onClick={() => { if (confirm(x.unitCount ? `Το κτίριο έχει ${x.unitCount} μονάδες. Οι μονάδες θα μείνουν χωρίς κτίριο. Να διαγραφεί;` : 'Να διαγραφεί το κτίριο;')) run(() => deleteBuilding(projectId, x.id)); }}><Trash2 size={15} /></button>
                  </span></td>}
                </tr>
              ))}
              {buildings.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-sm text-charcoal-600">Κανένα κτίριο. Τα έργα με μονοκατοικίες δεν χρειάζονται κτίρια.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3 sm:px-5">
          <p className="flex items-center gap-2 font-semibold text-charcoal"><Layers size={16} className="text-forest" /> Φάσεις</p>
          {canEdit && <button type="button" className="btn-secondary h-8 px-3 py-1 text-[13px]" onClick={() => { setPhBuilding(''); setPh('new'); }}><Plus size={14} /> Νέα φάση</button>}
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Σειρά</th><th>Φάση</th><th>Κτίριο</th><th>Μονάδες</th>{canEdit && <th className="text-right">Ενέργειες</th>}</tr></thead>
            <tbody>
              {sortedPhases.map((x) => (
                <tr key={x.id}>
                  <td className="tabular-nums">{x.sequence}</td>
                  <td className="o-strong" data-no-tr>{x.name}</td>
                  <td>{bName(x.building_id) ? <span data-no-tr>{bName(x.building_id)}</span> : <span>Όλο το έργο</span>}</td>
                  <td className="tabular-nums">{x.unitCount ?? 0}</td>
                  {canEdit && <td><span className="flex justify-end gap-0.5">
                    <button type="button" className={iconBtn} title="Επεξεργασία" aria-label="Επεξεργασία" onClick={() => { setPhBuilding(x.building_id ?? ''); setPh(x); }}><Pencil size={15} /></button>
                    <button type="button" className={delBtn} title="Διαγραφή" aria-label="Διαγραφή" disabled={pending} onClick={() => { if (confirm('Να διαγραφεί η φάση; Οι μονάδες της θα μείνουν χωρίς φάση.')) run(() => deletePhase(projectId, x.id)); }}><Trash2 size={15} /></button>
                  </span></td>}
                </tr>
              ))}
              {phases.length === 0 && <tr><td colSpan={5} className="py-8 text-center text-sm text-charcoal-600">Καμία φάση. Χωρίστε το έργο σε φάσεις αν χτίζεται τμηματικά.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!b} onClose={() => setB(null)} title={b === 'new' ? 'Νέο κτίριο' : 'Επεξεργασία κτιρίου'} size="md">
        {b && <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => saveBuilding({ projectId, id: b === 'new' ? undefined : b.id, name: String(f.get('name') ?? ''), floors: Number(f.get('floors')) || null }), () => setB(null)); }}>
          <ModalBody className="grid grid-cols-[1fr_110px] gap-3">
            <label className="block"><span className={label}>Όνομα</span><input name="name" required className="input" defaultValue={b === 'new' ? '' : b.name} placeholder="π.χ. Block A" data-no-tr /></label>
            <label className="block"><span className={label}>Όροφοι</span><input name="floors" type="number" min={0} className="input" defaultValue={b === 'new' ? '' : b.floors ?? ''} /></label>
          </ModalBody>
          <ModalFooter><button type="button" className="btn-secondary" onClick={() => setB(null)}>Άκυρο</button><button type="submit" className="btn-primary flex-1" disabled={pending}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></ModalFooter>
        </form>}
      </Modal>

      <Modal open={!!ph} onClose={() => setPh(null)} title={ph === 'new' ? 'Νέα φάση' : 'Επεξεργασία φάσης'} size="md">
        {ph && <form className="flex min-h-0 flex-1 flex-col" onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); run(() => savePhase({ projectId, id: ph === 'new' ? undefined : ph.id, name: String(f.get('name') ?? ''), buildingId: phBuilding || null, sequence: Number(f.get('sequence')) || 1 }), () => setPh(null)); }}>
          <ModalBody className="space-y-3">
            <div className="grid grid-cols-[1fr_90px] gap-3">
              <label className="block"><span className={label}>Όνομα</span><input name="name" required className="input" defaultValue={ph === 'new' ? '' : ph.name} placeholder="π.χ. Φάση 1" data-no-tr /></label>
              <label className="block"><span className={label}>Σειρά</span><input name="sequence" type="number" min={1} className="input" defaultValue={ph === 'new' ? phases.length + 1 : ph.sequence} /></label>
            </div>
            <div><span className={label}>Κτίριο</span><PopSelect width="w-full" ariaLabel="Κτίριο" value={phBuilding} onChange={setPhBuilding} options={[['', 'Όλο το έργο'], ...buildings.map((x) => [x.id, x.name] as [string, string])]} /></div>
          </ModalBody>
          <ModalFooter><button type="button" className="btn-secondary" onClick={() => setPh(null)}>Άκυρο</button><button type="submit" className="btn-primary flex-1" disabled={pending}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></ModalFooter>
        </form>}
      </Modal>
    </div>
  );
}
