'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X } from 'lucide-react';
import { updateUnit } from '@/app/actions/units';
import { parseAmount } from '@/lib/amount';

export interface EditableUnit { id: string; project_id: string; unit_number: string; building_id: string | null; floor: number | null; sqm: number | null; price: number | null; bedrooms: number | null; bathrooms: number | null; description: string | null }

/** Διόρθωση των βασικών στοιχείων μιας μονάδας (αριθμός, κτίριο, όροφος, m², δωμάτια, τιμή, περιγραφή). */
export function EditUnitButton({ unit, buildings }: { unit: EditableUnit; buildings: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const num = (v: FormDataEntryValue | null) => { const s = String(v ?? '').trim().replace(',', '.'); if (!s) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
  const submit = (fd: FormData) => start(async () => {
    const unitNumber = String(fd.get('unitNumber') ?? '').trim();
    if (!unitNumber) { setErr('Δώστε αριθμό μονάδας.'); return; }
    const r = await updateUnit(unit.id, unit.project_id, {
      unitNumber, buildingId: String(fd.get('buildingId') || '') || null,
      floor: num(fd.get('floor')), sqm: num(fd.get('sqm')), bedrooms: num(fd.get('bedrooms')), bathrooms: num(fd.get('bathrooms')),
      price: String(fd.get('price') ?? '').trim() ? parseAmount(fd.get('price')) ?? null : null,
      description: String(fd.get('description') ?? '').trim() || null,
    });
    if (r && 'ok' in r && !r.ok) { setErr(r.error); return; }
    setOpen(false); router.refresh();
  });
  return (
    <>
      <button type="button" onClick={() => { setErr(null); setOpen(true); }} className="btn-ghost text-sm" title="Επεξεργασία μονάδας"><Pencil size={14} /> Επεξεργασία</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4" onClick={() => setOpen(false)}>
          <form action={submit} className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-5 text-left shadow-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="font-semibold text-charcoal">Επεξεργασία μονάδας</p><button type="button" onClick={() => setOpen(false)} aria-label="Κλείσιμο"><X size={18} /></button></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <label className="col-span-2 block sm:col-span-1"><span className="text-xs text-charcoal-600/70">Αριθμός μονάδας</span><input name="unitNumber" defaultValue={unit.unit_number} className="input" data-no-tr /></label>
              <label className="col-span-2 block"><span className="text-xs text-charcoal-600/70">Κτίριο</span>
                <select name="buildingId" defaultValue={unit.building_id ?? ''} className="input" data-no-tr><option value="">Χωρίς κτίριο</option>{buildings.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
              <label className="block"><span className="text-xs text-charcoal-600/70">Όροφος</span><input name="floor" type="number" defaultValue={unit.floor ?? ''} className="input" /></label>
              <label className="block"><span className="text-xs text-charcoal-600/70">m²</span><input name="sqm" inputMode="decimal" defaultValue={unit.sqm ?? ''} className="input" /></label>
              <label className="block"><span className="text-xs text-charcoal-600/70">Τιμή (€)</span><input name="price" inputMode="decimal" defaultValue={unit.price != null ? Number(unit.price).toLocaleString('de-DE') : ''} placeholder="π.χ. 650.000" className="input" /></label>
              <label className="block"><span className="text-xs text-charcoal-600/70">Υπνοδωμάτια</span><input name="bedrooms" type="number" min={0} defaultValue={unit.bedrooms ?? ''} className="input" /></label>
              <label className="block"><span className="text-xs text-charcoal-600/70">Μπάνια</span><input name="bathrooms" type="number" min={0} step="0.5" defaultValue={unit.bathrooms ?? ''} className="input" /></label>
              <label className="col-span-2 block sm:col-span-3"><span className="text-xs text-charcoal-600/70">Περιγραφή</span><textarea name="description" defaultValue={unit.description ?? ''} className="input min-h-[70px]" /></label>
            </div>
            <p className="text-xs text-charcoal-600/60">Τύπος μονάδας, αριθμός ορόφων κατοικίας, προδιαγραφές κ.λπ. αλλάζουν στα «Χαρακτηριστικά» πιο κάτω (κουμπί Επεξεργασία).</p>
            {err && <p className="text-sm text-signal-danger">{err}</p>}
            <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Άκυρο</button><button type="submit" className="btn-primary" disabled={pending}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></div>
          </form>
        </div>
      )}
    </>
  );
}
