'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check } from 'lucide-react';
import { saveUnitRooms } from '@/app/actions/unit-page';
import { area, type Room } from '@/lib/unit-page-shared';
import { formatDecimal } from '@/lib/format';

const SUGGEST = ['Σαλόνι', 'Κουζίνα', 'Υπνοδωμάτιο 1', 'Υπνοδωμάτιο 2', 'Μπάνιο', 'WC', 'Βεράντα', 'Αποθήκη'];

/** Κάτοψη σε αριθμούς: κάθε δωμάτιο με μήκος × πλάτος, και σύνολο. */
export function RoomsEditor({ unitId, projectId, initial, canEdit, missing }: { unitId: string; projectId: string; initial: Room[]; canEdit: boolean; missing: boolean }) {
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (i: number, p: Partial<Room>) => { setRooms((r) => r.map((x, idx) => (idx === i ? { ...x, ...p } : x))); setMsg(null); };
  const total = rooms.reduce((s, r) => s + area(r), 0);
  const save = () => start(async () => {
    const r = await saveUnitRooms(unitId, projectId, rooms);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });
  const next = SUGGEST.find((s) => !rooms.some((r) => r.name === s)) ?? '';

  return (
    <div className="panel space-y-3 p-6">
      <div>
        <h4>Δωμάτια και διαστάσεις</h4>
        <p className="text-xs text-charcoal-600/60">Μήκος × πλάτος σε μέτρα. Εμφανίζονται στον πελάτη μαζί με την κάτοψη.</p>
      </div>
      {rooms.length === 0 && !canEdit && <p className="text-sm text-charcoal-600/70">Δεν έχουν καταχωρηθεί δωμάτια.</p>}
      {rooms.length > 0 && (
        <table className="w-full text-sm">
          <thead><tr className="text-left text-[11px] uppercase tracking-wide text-charcoal-600/60"><th className="py-1">Χώρος</th><th className="py-1 text-right">Μήκος</th><th className="py-1 text-right">Πλάτος</th><th className="py-1 text-right">m²</th><th /></tr></thead>
          <tbody>
            {rooms.map((r, i) => (
              <tr key={i} className="border-t border-stone-line/60">
                <td className="py-1 pr-2">{canEdit ? <input className="input py-1" value={r.name} onChange={(e) => set(i, { name: e.target.value })} /> : r.name}</td>
                <td className="w-24 py-1 text-right">{canEdit ? <input className="input figure py-1 text-right" type="number" step="0.01" min={0} value={r.length || ''} onChange={(e) => set(i, { length: Number(e.target.value) })} /> : <span className="figure">{formatDecimal(r.length, 2)}</span>}</td>
                <td className="w-24 py-1 text-right">{canEdit ? <input className="input figure py-1 text-right" type="number" step="0.01" min={0} value={r.width || ''} onChange={(e) => set(i, { width: Number(e.target.value) })} /> : <span className="figure">{formatDecimal(r.width, 2)}</span>}</td>
                <td className="figure w-20 py-1 text-right">{formatDecimal(area(r), 2)}</td>
                <td className="w-8 py-1 text-right">{canEdit && <button type="button" onClick={() => setRooms((x) => x.filter((_, idx) => idx !== i))} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>}</td>
              </tr>
            ))}
            <tr className="border-t border-charcoal/20 font-semibold"><td className="py-1.5">Σύνολο</td><td /><td /><td className="figure py-1.5 text-right">{formatDecimal(total, 2)}</td><td /></tr>
          </tbody>
        </table>
      )}
      {canEdit && !missing && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setRooms((r) => [...r, { name: next, length: 0, width: 0 }])} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Χώρος</button>
          <button type="button" onClick={save} disabled={pending} className="btn-primary px-3 py-1.5 text-xs"><Check size={13} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
      {missing && canEdit && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει το supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql.</p>}
    </div>
  );
}
