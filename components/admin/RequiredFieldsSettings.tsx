'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { PUBLIC_FIELD_OPTIONS, STAFF_FIELD_OPTIONS, type FieldRules } from '@/lib/org-settings-shared';

/** Settings → Tags, ομάδες & πεδία → which fields are mandatory, for staff and for the public. */
export function RequiredFieldsSettings({ initial, canEdit }: { initial: FieldRules; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<FieldRules>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const toggle = (side: 'staff' | 'public', k: string) => {
    setMsg(null);
    setV((x) => ({ ...x, [side]: x[side].includes(k) ? x[side].filter((y) => y !== k) : [...x[side], k] }));
  };
  const save = () => start(async () => {
    const r = await saveOrgSlice('fields', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });
  const Box = ({ side, k, label }: { side: 'staff' | 'public'; k: string; label: string }) => (
    <label className="flex items-center gap-2 py-1 text-sm text-charcoal">
      <input type="checkbox" disabled={!canEdit} checked={v[side].includes(k)} onChange={() => toggle(side, k)} /> {label}
    </label>
  );
  return (
    <div className="panel space-y-3 p-5">
      <div>
        <h4>Υποχρεωτικά πεδία</h4>
        <p className="text-xs text-charcoal-600/60">Πέρα από όσα χρειάζονται πάντα (όνομα και email όταν καταχωρεί το προσωπικό· email ή τηλέφωνο στις φόρμες). Για τα δικά σας πεδία, τσεκάρετε «υποχρεωτικό» στο καθένα παραπάνω.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="eyebrow mb-1">Όταν καταχωρεί το προσωπικό (νέο lead)</p>
          {STAFF_FIELD_OPTIONS.map((o) => <Box key={o.key} side="staff" k={o.key} label={o.label} />)}
        </div>
        <div>
          <p className="eyebrow mb-1">Όταν γράφεται ο πελάτης (ιστοσελίδα, κράτηση προβολής)</p>
          {PUBLIC_FIELD_OPTIONS.map((o) => <Box key={o.key} side="public" k={o.key} label={o.label} />)}
        </div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="fields" />}
        </div>
      )}
    </div>
  );
}
