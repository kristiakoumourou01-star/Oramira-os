'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { deleteLeads } from '@/app/actions/leads';

const REASONS = ['Διπλή εγγραφή', 'Λάθος / ψεύτικα στοιχεία', 'Spam', 'Δοκιμαστικό lead', 'Ζήτησε διαγραφή (GDPR)'];

/**
 * Επιβεβαίωση διαγραφής: ρωτά «Είστε σίγουροι;» και ζητά υποχρεωτικά λόγο.
 * Το lead κρύβεται από όλες τις λίστες· ο λόγος μένει στο ιστορικό.
 */
export function DeleteLeadDialog({ ids, names, onClose, onDeleted }: { ids: string[]; names: string[]; onClose: () => void; onDeleted?: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState('');
  const [sure, setSure] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ok = reason.trim().length >= 3 && sure;
  const go = () => start(async () => {
    const r = await deleteLeads(ids, reason);
    if (!r.ok) { setErr(r.error); return; }
    onDeleted?.(); onClose(); router.refresh();
  });
  const who = ids.length === 1 ? `το lead «${names[0] ?? ''}»` : `${ids.length} leads`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="alertdialog" aria-modal="true" aria-label="Διαγραφή lead">
      <button type="button" aria-label="Άκυρο" className="absolute inset-0 bg-charcoal/40" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-overlay">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-signal-danger/10 text-signal-danger"><AlertTriangle size={18} /></span>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg text-charcoal">Διαγραφή {ids.length === 1 ? 'lead' : `${ids.length} leads`};</h3>
            <p className="text-sm text-charcoal-600">Είστε σίγουρη ότι θέλετε να διαγράψετε {who}; Θα φύγει από όλες τις λίστες και θα κλείσουν οι εκκρεμείς κινήσεις του.</p>
          </div>
          <button type="button" onClick={onClose} className="text-charcoal-600/50 hover:text-charcoal" aria-label="Κλείσιμο"><X size={16} /></button>
        </div>
        {ids.length > 1 && <p className="max-h-20 overflow-y-auto rounded bg-sand-100/60 px-3 py-2 text-xs text-charcoal-600">{names.join(', ')}</p>}
        <div className="space-y-2">
          <p className="eyebrow">Λόγος διαγραφής (υποχρεωτικό)</p>
          <div className="flex flex-wrap gap-1">
            {REASONS.map((r) => <button key={r} type="button" onClick={() => setReason(r)} className={`rounded-full border px-2.5 py-0.5 text-xs ${reason === r ? 'border-signal-danger bg-signal-danger text-white' : 'border-stone-line text-charcoal-600 hover:border-signal-danger/50'}`}>{r}</button>)}
          </div>
          <textarea className="input min-h-[70px] text-sm" value={reason} maxLength={500} onChange={(e) => { setReason(e.target.value); setErr(null); }} placeholder="Γράψτε γιατί διαγράφεται…" autoFocus />
        </div>
        <label className="flex items-center gap-2 text-sm text-charcoal"><input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} /> Ναι, είμαι σίγουρη για τη διαγραφή.</label>
        {err && <p className="text-xs text-signal-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost text-sm">Άκυρο</button>
          <button type="button" disabled={!ok || pending} onClick={go} className="inline-flex items-center gap-1.5 rounded-md bg-signal-danger px-3 py-2 text-sm font-medium text-white disabled:opacity-40"><Trash2 size={14} /> {pending ? 'Διαγραφή…' : 'Διαγραφή'}</button>
        </div>
      </div>
    </div>
  );
}
