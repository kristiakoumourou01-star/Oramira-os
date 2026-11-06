'use client';

import { useState, useTransition } from 'react';
import { Calculator } from 'lucide-react';
import { setUnitCommission } from '@/app/actions/unit-page';
import { formatCurrency } from '@/lib/format';

/** Προμήθεια για αυτή τη μονάδα: ποσοστό, ΦΠΑ, μερίδιο πωλητή. */
export function CommissionCalculator({ unitId, projectId, price, initialPct, vatRate, canEdit }: { unitId: string; projectId: string; price: number | null; initialPct: number | null; vatRate: number; canEdit: boolean }) {
  const [p, setP] = useState(price ?? 0);
  const [pct, setPct] = useState(initialPct ?? 3);
  const [vat, setVat] = useState(vatRate);
  const [split, setSplit] = useState(30);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const net = Math.round(p * pct) / 100;
  const vatAmt = Math.round(net * vat) / 100;
  const agent = Math.round(net * split) / 100;
  const save = () => start(async () => { const r = await setUnitCommission(unitId, projectId, pct); setSaved(r.ok ? 'Αποθηκεύτηκε.' : r.error); });

  const Row = ({ l, v, strong }: { l: string; v: number; strong?: boolean }) => (
    <div className={`flex justify-between ${strong ? 'border-t border-stone-line pt-1.5 font-semibold text-charcoal' : 'text-charcoal-600'}`}><span>{l}</span><span className="figure">{formatCurrency(v)}</span></div>
  );
  return (
    <div className="panel space-y-3 p-6">
      <h4 className="flex items-center gap-2"><Calculator size={15} className="text-olive" /> Υπολογισμός προμήθειας</h4>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <label className="col-span-2 block"><span className="eyebrow mb-1 block">Τιμή πώλησης €</span><input className="input figure" type="number" min={0} value={p || ''} onChange={(e) => setP(Number(e.target.value))} /></label>
        <label className="block"><span className="eyebrow mb-1 block">Προμήθεια %</span><input className="input figure" type="number" step="0.1" min={0} max={100} value={pct} onChange={(e) => { setPct(Number(e.target.value)); setSaved(null); }} /></label>
        <label className="block"><span className="eyebrow mb-1 block">ΦΠΑ %</span><input className="input figure" type="number" min={0} max={100} value={vat} onChange={(e) => setVat(Number(e.target.value))} /></label>
        <label className="col-span-2 block"><span className="eyebrow mb-1 block">Μερίδιο πωλητή %</span><input className="input figure" type="number" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} /></label>
      </div>
      <div className="space-y-1 text-sm">
        <Row l="Προμήθεια (καθαρή)" v={net} />
        <Row l={`ΦΠΑ ${vat}%`} v={vatAmt} />
        <Row l="Σύνολο τιμολογίου" v={net + vatAmt} strong />
        <Row l={`Στον πωλητή (${split}%)`} v={agent} />
        <Row l="Στην εταιρεία" v={net - agent} />
      </div>
      {canEdit && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn-secondary px-3 py-1.5 text-xs">Κράτα το {pct}% για αυτή τη μονάδα</button>
          {saved && <span className="text-xs text-charcoal-600">{saved}</span>}
        </div>
      )}
    </div>
  );
}
