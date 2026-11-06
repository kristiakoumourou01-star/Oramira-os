'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CalendarClock } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import type { ReservationSettings } from '@/lib/pricing-shared';

/** Settings → Pipelines → Κρατήσεις: default hold, warning, auto-release. */
export function ReservationSettingsForm({ initial, canEdit }: { initial: ReservationSettings; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<ReservationSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const save = () => start(async () => {
    const r = await saveOrgSlice('reservations', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });
  return (
    <div className="panel space-y-3 p-5">
      <div>
        <h4 className="flex items-center gap-2"><CalendarClock size={16} /> Κρατήσεις μονάδων</h4>
        <p className="text-xs text-charcoal-600/60">Πόσο κρατά μια μονάδα για τον αγοραστή μέχρι να πληρωθεί η προκαταβολή, και τι γίνεται όταν λήξει.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="eyebrow mb-1 block">Διάρκεια νέας κράτησης (μέρες)</span>
          <input className="input" type="number" min={1} max={180} disabled={!canEdit} value={v.holdDays} onChange={(e) => patch({ holdDays: Number(e.target.value) })} />
        </label>
        <label className="block">
          <span className="eyebrow mb-1 block">Προειδοποίηση πριν τη λήξη (μέρες)</span>
          <input className="input" type="number" min={0} max={30} disabled={!canEdit} value={v.warnDays} onChange={(e) => patch({ warnDays: Number(e.target.value) })} />
          <span className="mt-1 block text-[11px] text-charcoal-600/60">Ειδοποίηση στον πωλητή όταν η προκαταβολή δεν έχει πληρωθεί.</span>
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-0.5" disabled={!canEdit} checked={v.autoRelease} onChange={(e) => patch({ autoRelease: e.target.checked })} />
        <span>Αυτόματη αποδέσμευση: όταν η κράτηση λήξει χωρίς προκαταβολή, η μονάδα γίνεται ξανά διαθέσιμη.
          <span className="block text-[11px] text-charcoal-600/60">Κλειστό = η μονάδα μένει κρατημένη και η ομάδα ειδοποιείται να την παρατείνει ή να την ακυρώσει.</span></span>
      </label>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="reservations" />}
        </div>
      )}
    </div>
  );
}
