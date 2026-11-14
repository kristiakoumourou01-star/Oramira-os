'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, X, Sparkles, Check } from 'lucide-react';
import { suggestUnitPrice, type PriceSuggestion } from '@/app/actions/unit-pricing';
import { formatCurrency } from '@/lib/format';
import { updateUnit } from '@/app/actions/units';
import { parseAmount } from '@/lib/amount';

export interface EditableUnit { id: string; project_id: string; unit_number: string; building_id: string | null; floor: number | null; sqm: number | null; price: number | null; bedrooms: number | null; bathrooms: number | null; description: string | null }

/** Διόρθωση των βασικών στοιχείων μιας μονάδας (αριθμός, κτίριο, όροφος, m², δωμάτια, τιμή, περιγραφή). */
export function EditUnitButton({ unit, buildings }: { unit: EditableUnit; buildings: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [sqm, setSqm] = useState(unit.sqm != null ? String(unit.sqm) : '');
  const [ppm, setPpm] = useState(unit.price && unit.sqm ? String(Math.round(Number(unit.price) / Number(unit.sqm))) : '');
  const [price, setPrice] = useState(unit.price != null ? Number(unit.price).toLocaleString('de-DE') : '');
  const [sug, setSug] = useState<PriceSuggestion | null>(null);
  useEffect(() => { if (open && !sug) suggestUnitPrice(unit.id).then(setSug).catch(() => {}); }, [open, sug, unit.id]);
  const sqmN = Number(sqm.replace(',', '.')) || 0;
  const priceN = parseAmount(price) ?? 0;
  const fromPpm = (v: string) => { setPpm(v); const n = parseAmount(v) ?? 0; if (sqmN && n) setPrice(Math.round(n * sqmN).toLocaleString('de-DE')); };
  const fromPrice = (v: string) => { setPrice(v); const n = parseAmount(v) ?? 0; if (sqmN && n) setPpm(String(Math.round(n / sqmN))); };
  const fromSqm = (v: string) => { setSqm(v); const s2 = Number(v.replace(',', '.')) || 0; const n = parseAmount(ppm) ?? 0; if (s2 && n) setPrice(Math.round(n * s2).toLocaleString('de-DE')); };
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
              <label className="block"><span className="text-xs text-charcoal-600/70">m²</span><input name="sqm" inputMode="decimal" value={sqm} onChange={(e) => fromSqm(e.target.value)} className="input" /></label>
              <label className="block"><span className="text-xs text-charcoal-600/70">€ / m² (χωρίς ΦΠΑ)</span><input inputMode="decimal" value={ppm} onChange={(e) => fromPpm(e.target.value)} placeholder="π.χ. 3.700" className="input" /></label>
              <label className="col-span-2 block sm:col-span-1"><span className="text-xs text-charcoal-600/70">Τιμή (€, χωρίς ΦΠΑ)</span><input name="price" inputMode="decimal" value={price} onChange={(e) => fromPrice(e.target.value)} placeholder="π.χ. 650.000" className="input" /></label>
              <div className="col-span-2 rounded-lg border border-forest/25 bg-forest/[0.04] p-3 text-sm sm:col-span-3">
                <p className="mb-1 flex items-center gap-1.5 font-medium text-charcoal"><Sparkles size={14} className="text-forest" /> Πρόταση τιμής για την περιοχή</p>
                {!sug ? <p className="text-xs text-charcoal-600/70">Ανάλυση…</p> : (
                  <>
                    {sug.suggested ? (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p><b className="figure text-lg text-forest">{formatCurrency(sug.suggested)}/m²</b>{sqmN ? <span className="text-charcoal-600/80"> → {formatCurrency(Math.round(sug.suggested * sqmN))}</span> : null}</p>
                        <button type="button" className="btn-secondary px-3 py-1 text-xs" onClick={() => fromPpm(String(sug.suggested))}><Check size={13} /> Έγκριση πρότασης</button>
                      </div>
                    ) : null}
                    {sug.sources.length > 0 && <ul className="mt-1 space-y-0.5 text-xs text-charcoal-600/80">{sug.sources.map((x) => <li key={x.label}>· {x.label}: <b>{formatCurrency(Math.round(x.perSqm))}/m²</b> ({x.count})</li>)}</ul>}
                    {sug.market && <p className="mt-1 text-xs text-charcoal-600/80">· Αγορά — διάμεση τιμή νέας {sug.market.kind === 'house' ? 'κατοικίας' : 'διαμερίσματος'} σε {sug.market.district}: <b>{formatCurrency(sug.market.median)}</b>{sug.market.impliedPerSqm ? ` (≈ ${formatCurrency(sug.market.impliedPerSqm)}/m² για ${sqmN || unit.sqm} m²)` : ''} · <a href={sug.market.url} target="_blank" rel="noreferrer" className="underline">{sug.market.source}</a></p>}
                    <p className="mt-1 text-[11px] text-charcoal-600/60">{sug.note}</p>
                  </>
                )}
              </div>
              {priceN > 0 && (
                <div className="col-span-2 grid grid-cols-3 gap-2 text-center text-sm sm:col-span-3">
                  <div className="rounded-lg border border-stone-line p-2"><p className="text-[11px] text-charcoal-600/70">Χωρίς ΦΠΑ</p><p className="figure font-semibold text-charcoal">{formatCurrency(priceN)}</p></div>
                  <div className="rounded-lg border border-stone-line p-2"><p className="text-[11px] text-charcoal-600/70">Με ΦΠΑ 19%</p><p className="figure font-semibold text-charcoal">{formatCurrency(Math.round(priceN * 1.19))}</p></div>
                  <div className="rounded-lg border border-stone-line p-2"><p className="text-[11px] text-charcoal-600/70">ΦΠΑ 19%</p><p className="figure font-semibold text-charcoal">{formatCurrency(Math.round(priceN * 0.19))}</p></div>
                  <p className="col-span-3 text-[11px] text-charcoal-600/60">Ο μειωμένος ΦΠΑ 5% για κύρια κατοικία ισχύει μόνο υπό προϋποθέσεις (εμβαδόν και αξία) — ελέγξτε ανά αγοραστή.</p>
                </div>
              )}
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
