'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { completeAndNext } from '@/app/actions/follow-ups';
import { NEXT_PRESETS, snoozeTo, toLocalInput } from '@/lib/follow-ups-shared';

interface Agent { id: string; full_name: string | null }

/** «Έγινε» → τι βγήκε + ποια είναι η επόμενη κίνηση (σε ένα βήμα). */
export function CompletePanel({ r, onCancel, onDone, inline = false }: { r: { id: string }; onCancel: () => void; onDone: () => void; agents?: Agent[]; inline?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState('');
  const [nextNote, setNextNote] = useState('Κλήση');
  const [nextAt, setNextAt] = useState(toLocalInput(snoozeTo('in3d')));
  const [noNext, setNoNext] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const quick = [['tomorrow', 'Αύριο'], ['in3d', '+3 μέρες'], ['nextweek', 'Δευτέρα']] as const;

  const submit = () => start(async () => {
    const res = await completeAndNext(r.id, noNext ? null : { dueAt: new Date(nextAt).toISOString(), note: nextNote }, outcome);
    if (!res.ok) { setErr(res.error); return; }
    onDone(); router.refresh();
  });

  return (
    <div className={`space-y-3 rounded-xl border border-forest/20 bg-white p-3 ${inline ? '' : 'mx-4 mb-3'}`}>
      <label className="block">
        <span className="eyebrow mb-1 block">Τι έγινε; (προαιρετικό)</span>
        <input autoFocus className="input text-sm" value={outcome} onChange={(e) => setOutcome(e.target.value)} placeholder="π.χ. Ενδιαφέρεται για 2υπνο, θέλει τιμές" onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
      </label>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="eyebrow">Επόμενη κίνηση</span>
          <label className="flex items-center gap-1.5 text-xs text-charcoal-600"><input type="checkbox" checked={noNext} onChange={(e) => setNoNext(e.target.checked)} /> Καμία</label>
        </div>
        {!noNext && (
          <>
            <div className="flex flex-wrap gap-1">
              {NEXT_PRESETS.map((p) => <button key={p} type="button" onClick={() => setNextNote(p)} className={`rounded-full border px-2.5 py-0.5 text-xs ${nextNote === p ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal-600 hover:border-forest'}`}>{p}</button>)}
            </div>
            <div className="flex flex-wrap gap-2">
              <input className="input min-w-[10rem] flex-1 text-sm" value={nextNote} onChange={(e) => setNextNote(e.target.value)} />
              <input type="datetime-local" className="input w-auto text-sm" value={nextAt} onChange={(e) => setNextAt(e.target.value)} />
            </div>
            <div className="flex gap-1">{quick.map(([k, l]) => <button key={k} type="button" onClick={() => setNextAt(toLocalInput(snoozeTo(k)))} className="rounded-md bg-stone px-2 py-0.5 text-xs text-charcoal-600 hover:bg-stone-line">{l}</button>)}</div>
          </>
        )}
      </div>
      {err && <p className="text-xs text-signal-danger">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="button" disabled={pending} onClick={submit} className="btn-primary text-sm"><Check size={14} /> {pending ? 'Αποθήκευση…' : noNext ? 'Ολοκλήρωση' : 'Ολοκλήρωση & προγραμματισμός'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost text-sm"><X size={14} /> Άκυρο</button>
      </div>
    </div>
  );
}
