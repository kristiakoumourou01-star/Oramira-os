'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, ShieldAlert, RotateCcw, ExternalLink } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { DEFAULT_AML, countryName, countryOptions, type AmlSettings } from '@/lib/kyc-shared';

function CountryList({ title, hint, value, onChange, disabled, tone }: { title: string; hint: string; value: string[]; onChange: (v: string[]) => void; disabled: boolean; tone: string }) {
  const opts = useMemo(() => countryOptions('el'), []);
  return (
    <div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mb-2 text-[11px] text-charcoal-600/60">{hint}</p>
      <div className="mb-2 flex flex-wrap gap-1">
        {value.map((c) => (
          <span key={c} className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs ${tone}`}>
            {countryName(c)}
            {!disabled && <button type="button" onClick={() => onChange(value.filter((x) => x !== c))} className="opacity-60 hover:opacity-100">×</button>}
          </span>
        ))}
      </div>
      {!disabled && (
        <select className="input w-auto py-1 text-sm" value="" onChange={(e) => { if (e.target.value && !value.includes(e.target.value)) onChange([...value, e.target.value]); }}>
          <option value="">+ Προσθήκη χώρας</option>
          {opts.filter((o) => !value.includes(o.code)).map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
        </select>
      )}
    </div>
  );
}

/** Settings → GDPR & δεδομένα → AML: λίστες FATF και επανέλεγχος φακέλων. */
export function AmlSettingsForm({ initial, canEdit }: { initial: AmlSettings; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<AmlSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const ageDays = Math.floor((Date.now() - Date.parse(v.listsAsOf)) / 86400000);
  const save = () => start(async () => { const r = await saveOrgSlice('aml', v); if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε. Οι βαθμοί κινδύνου ενημερώνονται στην επόμενη αποθήκευση κάθε φακέλου.' }); router.refresh(); } else setMsg({ ok: false, text: r.error }); });

  return (
    <div className="panel space-y-4 p-5">
      <div>
        <h4 className="flex items-center gap-2"><ShieldAlert size={16} /> AML: χώρες υψηλού κινδύνου</h4>
        <p className="text-xs text-charcoal-600/60">
          Χρησιμοποιούνται στον βαθμό κινδύνου κάθε επαφής (Καρτέλα επαφής → Ταυτότητα & AML). Η FATF αλλάζει τις λίστες τρεις φορές τον χρόνο (Φεβρουάριο, Ιούνιο, Οκτώβριο) —{' '}
          <a href="https://www.fatf-gafi.org/en/countries/black-and-grey-lists.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-forest underline">επίσημη σελίδα <ExternalLink size={10} /></a>.
        </p>
        {ageDays > 120 && <p className="mt-1 text-xs text-signal-danger">Οι λίστες είναι {ageDays} ημερών — ελέγξτε αν έχουν αλλάξει.</p>}
      </div>
      <CountryList title="Μαύρη λίστα («call for action»)" hint="Ενισχυμένη δέουσα επιμέλεια σε κάθε περίπτωση." value={v.highRisk} onChange={(x) => patch({ highRisk: x })} disabled={!canEdit} tone="bg-red-50 text-signal-danger" />
      <CountryList title="Γκρίζα λίστα («increased monitoring»)" hint="Αυξάνει τον βαθμό κινδύνου." value={v.monitored} onChange={(x) => patch({ monitored: x })} disabled={!canEdit} tone="bg-champagne-50 text-champagne-600" />
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="block"><span className="eyebrow mb-1 block">Λίστες ισχύουν από</span><input type="date" className="input py-1.5 text-sm" disabled={!canEdit} value={v.listsAsOf} onChange={(e) => patch({ listsAsOf: e.target.value })} /></label>
        {(['low', 'medium', 'high'] as const).map((l) => (
          <label key={l} className="block"><span className="eyebrow mb-1 block">Επανέλεγχος · {l === 'low' ? 'χαμηλός' : l === 'medium' ? 'μεσαίος' : 'υψηλός'} (μήνες)</span>
            <input type="number" min={1} max={120} className="input py-1.5 text-sm" disabled={!canEdit} value={v.reviewMonths[l]} onChange={(e) => patch({ reviewMonths: { ...v.reviewMonths, [l]: Number(e.target.value) } })} /></label>
        ))}
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" onClick={() => patch({ highRisk: DEFAULT_AML.highRisk, monitored: DEFAULT_AML.monitored, listsAsOf: DEFAULT_AML.listsAsOf })} className="text-xs text-charcoal-600/70 hover:text-forest"><RotateCcw size={11} className="mr-1 inline" />Λίστες FATF Ιουνίου 2026</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="aml" />}
        </div>
      )}
    </div>
  );
}
