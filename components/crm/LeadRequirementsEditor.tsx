'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Target, Check } from 'lucide-react';
import { saveLeadRequirements } from '@/app/actions/unit-fields';
import { currentLocale } from '@/lib/locale-shared';
import { label, type Requirements, type UnitField } from '@/lib/unit-forms-shared';

/** Lead page: what the buyer is looking for, in the fields used for matching. */
export function LeadRequirementsEditor({ leadId, fields, initial, canEdit }: { leadId: string; fields: UnitField[]; initial: Requirements; canEdit: boolean }) {
  const router = useRouter();
  const lang = currentLocale().lang;
  const [req, setReq] = useState<Requirements>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const mfields = fields.filter((f) => f.useInMatching);
  if (!mfields.length) return null;
  const set = (k: string, v: Requirements[string] | undefined) => { setReq((x) => { const n = { ...x }; if (v === undefined) delete n[k]; else n[k] = v; return n; }); setMsg(null); };
  const save = () => start(async () => {
    const r = await saveLeadRequirements(leadId, req);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  return (
    <div className="panel space-y-3 p-6">
      <div>
        <h4 className="flex items-center gap-2"><Target size={15} className="text-forest" /> Τι ζητάει</h4>
        <p className="text-xs text-charcoal-600/60">Μετρά στο matching με τις μονάδες. Αφήστε κενό ό,τι δεν τον ενδιαφέρει.</p>
      </div>
      {mfields.map((f) => {
        const r = req[f.key];
        return (
          <div key={f.key} className="text-sm">
            {f.type === 'yesno' ? (
              <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={r === true} onChange={(e) => set(f.key, e.target.checked ? true : undefined)} /> Θέλει: {label(f, lang)}</label>
            ) : f.type === 'number' ? (
              <div>
                <p className="mb-1 text-charcoal-600/80">{label(f, lang)}{f.suffix ? ` (${f.suffix})` : ''}</p>
                <div className="flex items-center gap-2">
                  <input className="input figure py-1" type="number" placeholder="από" disabled={!canEdit} value={typeof r === 'object' && !Array.isArray(r) && r.min != null ? r.min : ''} onChange={(e) => { const cur = typeof r === 'object' && !Array.isArray(r) ? r : {}; const min = e.target.value === '' ? undefined : Number(e.target.value); const n = { ...cur, min }; set(f.key, n.min == null && n.max == null ? undefined : n); }} />
                  <span>–</span>
                  <input className="input figure py-1" type="number" placeholder="έως" disabled={!canEdit} value={typeof r === 'object' && !Array.isArray(r) && r.max != null ? r.max : ''} onChange={(e) => { const cur = typeof r === 'object' && !Array.isArray(r) ? r : {}; const max = e.target.value === '' ? undefined : Number(e.target.value); const n = { ...cur, max }; set(f.key, n.min == null && n.max == null ? undefined : n); }} />
                </div>
              </div>
            ) : (
              <div>
                <p className="mb-1 text-charcoal-600/80">{label(f, lang)} <span className="text-xs">(οποιοδήποτε από)</span></p>
                <div className="flex flex-wrap gap-x-3 gap-y-1">
                  {f.options.map((o) => {
                    const arr = Array.isArray(r) ? r : [];
                    return <label key={o} className="flex items-center gap-1"><input type="checkbox" disabled={!canEdit} checked={arr.includes(o)} onChange={() => { const n = arr.includes(o) ? arr.filter((x) => x !== o) : [...arr, o]; set(f.key, n.length ? n : undefined); }} /> {o}</label>;
                  })}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {canEdit && (
        <div className="flex items-center gap-2">
          <button type="button" onClick={save} disabled={pending} className="btn-primary px-3 py-1.5 text-xs"><Check size={13} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-xs ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
