'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, X, Plus } from 'lucide-react';
import { setLeadAreas } from '@/app/actions/lead-areas';
import { AREAS } from '@/lib/areas';

/** Lead page: where the buyer wants to buy. Drives location matching with units. */
export function LeadAreasEditor({ leadId, initial, canEdit }: { leadId: string; initial: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [areas, setAreas] = useState<string[]>(initial);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = (next: string[]) => start(async () => {
    setErr(null);
    const r = await setLeadAreas(leadId, next);
    if (r.ok) { setAreas(r.areas); router.refresh(); } else setErr(r.error);
  });
  const add = () => { const t = draft.trim(); if (!t) return; setDraft(''); save([...areas, t]); };

  return (
    <div className="panel space-y-3 p-6">
      <div>
        <h4 className="flex items-center gap-2"><MapPin size={15} className="text-olive" /> Περιοχές που θέλει</h4>
        <p className="text-xs text-charcoal-600/60">Οι μονάδες σε αυτές τις περιοχές (ή κοντά, έως ~12 km) ανεβαίνουν στα «Προτεινόμενα ακίνητα». Μια πόλη καλύπτει και τις γειτονιές της.</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {areas.length === 0 && <span className="text-sm text-charcoal-600/60">Οπουδήποτε</span>}
        {areas.map((a) => (
          <span key={a} className="badge-neutral inline-flex items-center gap-1">
            {a}
            {canEdit && <button type="button" disabled={pending} onClick={() => save(areas.filter((x) => x !== a))} className="text-charcoal-600/50 hover:text-signal-danger"><X size={11} /></button>}
          </span>
        ))}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input className="input text-sm" list="cy-areas" value={draft} placeholder="π.χ. Λεμεσός, Γερμασόγεια, Πάφος…" onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <datalist id="cy-areas">{AREAS.map((a) => <option key={a.key} value={a.el}>{a.en}</option>)}</datalist>
          <button type="button" disabled={pending || !draft.trim()} onClick={add} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Προσθήκη</button>
        </div>
      )}
      {err && <p className="text-xs text-signal-danger">{err}</p>}
    </div>
  );
}
