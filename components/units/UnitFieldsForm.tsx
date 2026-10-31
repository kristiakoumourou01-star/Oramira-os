'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pencil, EyeOff, Target } from 'lucide-react';
import { saveUnitFields } from '@/app/actions/unit-fields';
import { formatNumber } from '@/lib/format';
import { currentLocale } from '@/lib/locale-shared';
import { UNIT_SECTIONS, fieldsFor, label, showValue, type FieldValue, type UnitField, type UnitFormsSettings } from '@/lib/unit-forms-shared';

/** Unit page: the unit's type and your own fields (Settings → Φόρμες μονάδων). */
export function UnitFieldsForm({ unitId, projectId, cfg, typeKey, values, canEdit, missing }: {
  unitId: string; projectId: string; cfg: UnitFormsSettings; typeKey: string | null; values: Record<string, FieldValue>; canEdit: boolean; missing: boolean;
}) {
  const router = useRouter();
  const lang = currentLocale().lang;
  const [edit, setEdit] = useState(false);
  const [type, setType] = useState<string | null>(typeKey);
  const [vals, setVals] = useState<Record<string, FieldValue>>(values);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fields = useMemo(() => fieldsFor(cfg, type), [cfg, type]);
  const set = (k: string, v: FieldValue) => { setVals((x) => ({ ...x, [k]: v })); setMsg(null); };
  const save = () => start(async () => {
    const r = await saveUnitFields(unitId, projectId, type, vals);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); setEdit(false); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  const input = (f: UnitField) => {
    const v = vals[f.key];
    if (f.type === 'yesno') return (
      <select className="input" value={v === true ? 'yes' : v === false ? 'no' : ''} onChange={(e) => set(f.key, e.target.value === '' ? null : e.target.value === 'yes')}>
        <option value="">—</option><option value="yes">Ναι</option><option value="no">Όχι</option>
      </select>
    );
    if (f.type === 'number') return <div className="flex items-center gap-1"><input className="input figure" type="number" step="any" value={v == null ? '' : String(v)} onChange={(e) => set(f.key, e.target.value === '' ? null : Number(e.target.value))} />{f.suffix && <span className="text-xs text-charcoal-600">{f.suffix}</span>}</div>;
    if (f.type === 'choice') return (
      <select className="input" value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.key, e.target.value || null)}>
        <option value="">—</option>{f.options.map((o) => <option key={o}>{o}</option>)}
      </select>
    );
    if (f.type === 'multi') {
      const arr = Array.isArray(v) ? v : [];
      return <div className="flex flex-wrap gap-x-3 gap-y-1">{f.options.map((o) => <label key={o} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={arr.includes(o)} onChange={() => set(f.key, arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o])} /> {o}</label>)}</div>;
    }
    if (f.type === 'date') return <input className="input" type="date" value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.key, e.target.value || null)} />;
    return <input className="input" value={typeof v === 'string' ? v : ''} onChange={(e) => set(f.key, e.target.value || null)} />;
  };

  const typeLabel = cfg.types.find((t) => t.key === type);
  return (
    <div className="panel space-y-4 p-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4>Χαρακτηριστικά μονάδας</h4>
          <p className="text-xs text-charcoal-600/60">Τα πεδία ορίζονται στο Settings → Φόρμες μονάδων. <EyeOff size={10} className="inline" /> = μόνο προσωπικό · <Target size={10} className="inline" /> = μετρά στο matching.</p>
        </div>
        {canEdit && !missing && !edit && <button type="button" onClick={() => setEdit(true)} className="btn-secondary px-3 py-1.5 text-xs"><Pencil size={13} /> Επεξεργασία</button>}
      </div>
      {missing && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει η αλλαγή στη βάση (migration 0061).</p>}

      <label className="block max-w-xs">
        <span className="eyebrow mb-1 block">Τύπος</span>
        {edit ? (
          <select className="input" value={type ?? ''} onChange={(e) => setType(e.target.value || null)}>
            <option value="">—</option>{cfg.types.map((t) => <option key={t.key} value={t.key}>{label(t, lang)}</option>)}
          </select>
        ) : <span className="text-sm text-charcoal">{typeLabel ? label(typeLabel, lang) : '—'}</span>}
      </label>

      {UNIT_SECTIONS.map((s) => {
        const fs = fields.filter((f) => f.section === s.key);
        if (!fs.length) return null;
        return (
          <div key={s.key}>
            <p className="eyebrow mb-2">{label(s, lang)}</p>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {fs.map((f) => (
                <div key={f.key} className={edit ? '' : 'flex justify-between gap-3 border-b border-stone-line pb-1.5 text-sm'}>
                  <span className={edit ? 'mb-1 flex items-center gap-1 text-xs text-charcoal-600/80' : 'flex items-center gap-1 text-charcoal-600/70'}>
                    {label(f, lang)}{f.required && edit ? ' *' : ''}
                    {!f.visibleToClient && <EyeOff size={11} className="text-charcoal-600/50" />}
                    {f.useInMatching && <Target size={11} className="text-forest" />}
                  </span>
                  {edit ? input(f) : <span className="text-right text-charcoal">{showValue(f, vals[f.key] ?? null, lang, formatNumber)}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {fields.length === 0 && <p className="text-sm text-charcoal-600/70">Δεν υπάρχουν πεδία για αυτόν τον τύπο.</p>}

      {edit && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn-primary px-3 py-1.5 text-xs"><Check size={13} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" onClick={() => { setEdit(false); setVals(values); setType(typeKey); setMsg(null); }} className="btn-secondary px-3 py-1.5 text-xs">Άκυρο</button>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</p>}
    </div>
  );
}
