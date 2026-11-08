'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, X } from 'lucide-react';
import { duplicateUnit } from '@/app/actions/units';

/** «Αντιγραφή» μονάδας: ίδια χαρακτηριστικά σε νέα μονάδα (ή πολλές, με διαδοχικούς αριθμούς). */
export function DuplicateUnitButton({ unitId, projectId, unitNumber }: { unitId: string; projectId: string; unitNumber: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [num, setNum] = useState('');
  const [count, setCount] = useState(1);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const suggest = () => { const m = unitNumber.match(/^(.*?)(\d+)$/); const l = unitNumber.match(/^(.*?)([A-Ya-y])$/); return m ? `${m[1]}${String(Number(m[2]) + 1).padStart(m[2].length, '0')}` : l ? `${l[1]}${String.fromCharCode(l[2].charCodeAt(0) + 1)}` : `${unitNumber} (2)`; };
  return (
    <>
      <button type="button" className="btn-secondary" onClick={() => { setNum(suggest()); setCount(1); setErr(null); setOpen(true); }}><Copy size={15} strokeWidth={1.75} /> Αντιγραφή</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 text-left shadow-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><p className="font-semibold text-charcoal">Αντιγραφή μονάδας {unitNumber}</p><button type="button" onClick={() => setOpen(false)} aria-label="Κλείσιμο"><X size={18} /></button></div>
            <p className="text-sm text-charcoal-600/80">Η νέα μονάδα παίρνει τα ίδια: τύπο, m², υπνοδωμάτια, τιμή, χώρους, προδιαγραφές και πεδία. Ξεκινά «Διαθέσιμη», χωρίς αγοραστή, φωτογραφίες ή έγγραφα.</p>
            <label className="block"><span className="text-xs text-charcoal-600/70">Αριθμός νέας μονάδας</span><input className="input" value={num} onChange={(e) => setNum(e.target.value)} data-no-tr /></label>
            <label className="block"><span className="text-xs text-charcoal-600/70">Πόσα αντίγραφα</span><input className="input w-24" type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} /></label>
            {count > 1 && <p className="text-xs text-charcoal-600/60">Οι αριθμοί συνεχίζουν διαδοχικά από «{num}» (π.χ. A2, A3… ή B, C…).</p>}
            {err && <p className="text-sm text-signal-danger">{err}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Άκυρο</button>
              <button type="button" className="btn-primary" disabled={pending || !num.trim()} onClick={() => start(async () => {
                const r = await duplicateUnit(unitId, num, count);
                if (!r.ok) { setErr(r.error); return; }
                setOpen(false);
                router.push(count === 1 ? `/projects/${projectId}/units/${r.ids[0]}` : `/projects/${projectId}`);
                router.refresh();
              })}><Copy size={14} /> {pending ? 'Αντιγραφή…' : count > 1 ? `Δημιουργία ${count} μονάδων` : 'Δημιουργία'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
