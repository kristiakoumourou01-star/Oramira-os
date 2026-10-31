'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Download, Info, Play, Search } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { previewRetention, runRetentionNow } from '@/app/actions/gdpr';
import { DEFAULT_GDPR, type GdprSettings as Gdpr } from '@/lib/org-settings-shared';
import { formatDate, formatDateTime } from '@/lib/format';

type Msg = { ok: boolean; text: string } | null;
interface Preview { count: number; oldest: string | null; missing: boolean; sample: { id: string; name: string; last: string }[] }
interface Erasure { id: string; mode: string; reason: string | null; erased_at: string; by: string | null }

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;
const Help = ({ children }: { children: React.ReactNode }) => <p className="text-xs text-charcoal-600/60">{children}</p>;

function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (b: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <div><p className="text-sm text-charcoal">{label}</p>{hint && <Help>{hint}</Help>}</div>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-stone-line'} disabled:opacity-50`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

/** Settings → GDPR & δεδομένα. */
export function GdprSettings({ initial, canEdit, erasures, missing }: { initial: Gdpr; canEdit: boolean; erasures: Erasure[]; missing: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<Gdpr>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [runMsg, setRunMsg] = useState<Msg>(null);
  const patch = (p: Partial<Gdpr>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);

  const save = () => start(async () => {
    const res = await saveOrgSlice('gdpr', v);
    if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: res.error });
  });
  const check = () => start(async () => { setPreview(await previewRetention(v.retentionLeadsMonths)); setRunMsg(null); });
  const run = () => {
    if (dirty) { setRunMsg({ ok: false, text: 'Αποθηκεύστε πρώτα τις αλλαγές.' }); return; }
    if (!confirm(`Οριστική διαγραφή στοιχείων για ${preview?.count ?? 'όλα τα'} leads χωρίς κίνηση πάνω από ${v.retentionLeadsMonths} μήνες; Δεν αναιρείται.`)) return;
    start(async () => {
      const res = await runRetentionNow();
      setRunMsg(res.ok ? { ok: true, text: res.message ?? 'Έγινε.' } : { ok: false, text: res.error });
      setPreview(null);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      {missing && (
        <p className="flex items-start gap-2 rounded-md bg-champagne-50 px-3 py-2 text-sm text-champagne-600"><Info size={14} className="mt-0.5 shrink-0" /> Για να καταγράφεται η συγκατάθεση και να γίνονται διαγραφές, τρέξτε μία φορά το supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql στο Supabase → SQL Editor.</p>
      )}

      <div className="panel space-y-3 p-5">
        <div>
          <h4>Συγκατάθεση στις φόρμες</h4>
          <Help>Εμφανίζεται στις φόρμες της ιστοσελίδας και στη σελίδα κράτησης προβολής. Κάθε επαφή κρατά το ακριβές κείμενο που αποδέχτηκε και πότε.</Help>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><Lbl>Κείμενο συγκατάθεσης · Ελληνικά</Lbl><textarea className="input min-h-[84px]" disabled={!canEdit} value={v.consentTextEl} onChange={(e) => patch({ consentTextEl: e.target.value })} /></label>
          <label className="block"><Lbl>Consent text · English</Lbl><textarea className="input min-h-[84px]" disabled={!canEdit} value={v.consentText} onChange={(e) => patch({ consentText: e.target.value })} /></label>
          <label className="block"><Lbl>Marketing (ξεχωριστό tick) · Ελληνικά</Lbl><textarea className="input min-h-[64px]" disabled={!canEdit} value={v.marketingTextEl} onChange={(e) => patch({ marketingTextEl: e.target.value })} /></label>
          <label className="block"><Lbl>Marketing · English</Lbl><textarea className="input min-h-[64px]" disabled={!canEdit} value={v.marketingText} onChange={(e) => patch({ marketingText: e.target.value })} /></label>
        </div>
        <Toggle label="Υποχρεωτική συγκατάθεση" hint="Χωρίς το tick η φόρμα δεν στέλνεται. Ενεργοποιήστε το αφού η ιστοσελίδα δείχνει το κουτάκι." checked={v.requireConsent} onChange={(b) => patch({ requireConsent: b })} disabled={!canEdit} />
        <Toggle label="Το tick για marketing είναι ήδη τσεκαρισμένο" hint="Ο GDPR θέλει ενεργή επιλογή του πελάτη — καλύτερα να μένει κλειστό." checked={v.marketingOptIn} onChange={(b) => patch({ marketingOptIn: b })} disabled={!canEdit} />
      </div>

      <div className="panel space-y-3 p-5">
        <div>
          <h4>Διατήρηση δεδομένων</h4>
          <Help>Leads που δεν έγιναν ποτέ πελάτες και δεν είχαν καμία κίνηση διαγράφονται (ανωνυμοποιούνται) μετά από αυτό το διάστημα. Όποιος έχει κράτηση, συμβόλαιο, τιμολόγιο, μονάδα ή λογαριασμό δεν αγγίζεται ποτέ αυτόματα.</Help>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><Lbl>Leads χωρίς κίνηση (μήνες)</Lbl>
            <select className="input" disabled={!canEdit} value={v.retentionLeadsMonths} onChange={(e) => { patch({ retentionLeadsMonths: Number(e.target.value) }); setPreview(null); }}>
              {[12, 18, 24, 36, 48, 60].map((m) => <option key={m} value={m}>{m} μήνες</option>)}
            </select>
          </label>
          <label className="block"><Lbl>Συμβόλαια & τιμολόγια (χρόνια)</Lbl>
            <select className="input" disabled={!canEdit} value={v.retentionDealsYears} onChange={(e) => patch({ retentionDealsYears: Number(e.target.value) })}>
              {[5, 6, 7, 10].map((y) => <option key={y} value={y}>{y} χρόνια</option>)}
            </select>
            <Help>Μέχρι τότε κανείς δεν μπορεί να διαγράψει τον πελάτη (AML / φορολογικά). Επιβεβαιώστε με τον λογιστή.</Help>
          </label>
        </div>
        <Toggle label="Αυτόματη διαγραφή κάθε βράδυ" hint="Αν είναι κλειστό, γίνεται μόνο όταν πατήσετε «Διαγραφή τώρα»." checked={v.autoRetention} onChange={(b) => patch({ autoRetention: b })} disabled={!canEdit} />

        {canEdit && !missing && (
          <div className="space-y-2 rounded-md bg-stone/60 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={check} disabled={pending} className="btn-secondary px-3 py-1.5 text-xs"><Search size={13} /> Πόσα leads έχουν λήξει;</button>
              {preview && preview.count > 0 && <button type="button" onClick={run} disabled={pending} className="btn-secondary px-3 py-1.5 text-xs text-signal-danger"><Play size={13} /> Διαγραφή τώρα</button>}
            </div>
            {preview && (
              preview.count === 0
                ? <p className="text-sm text-charcoal-600">Κανένα lead δεν έχει λήξει με αυτόν τον κανόνα.</p>
                : <div className="text-sm text-charcoal-600">
                    <p><span className="font-semibold text-charcoal">{preview.count}{preview.count === 500 ? '+' : ''}</span> επαφές· η παλαιότερη κίνηση {formatDate(preview.oldest)}. Π.χ.:</p>
                    <ul className="mt-1 list-disc pl-5 text-xs">{preview.sample.map((s) => <li key={s.id}><a className="hover:underline" href={`/crm/${s.id}`}>{s.name}</a> · τελευταία κίνηση {formatDate(s.last)}</li>)}</ul>
                  </div>
            )}
            {runMsg && <p className={`text-sm ${runMsg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{runMsg.text}</p>}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          <button type="button" className="btn-secondary" onClick={() => { if (confirm('Επαναφορά των ρυθμίσεων GDPR στα αρχικά;')) patch(DEFAULT_GDPR); }}>Επαναφορά στα αρχικά</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="gdpr" />}
        </div>
      )}

      <div className="panel space-y-2 p-5">
        <h4>Εξαγωγή δεδομένων</h4>
        <Help>Όλα τα δεδομένα της εταιρείας σε ένα ZIP με ένα αρχείο CSV ανά πίνακα (ανοίγει στο Excel). Για ένα μόνο πρόσωπο, ανοίξτε την επαφή → GDPR → «Εξαγωγή δεδομένων».</Help>
        {canEdit && <a href="/api/gdpr/export" className="btn-secondary inline-flex px-3 py-1.5 text-xs"><Download size={13} /> Κατέβασμα όλων (ZIP)</a>}
      </div>

      <div className="panel space-y-2 p-5">
        <h4>Ιστορικό διαγραφών</h4>
        <Help>Κρατιέται χωρίς προσωπικά στοιχεία, ως απόδειξη ότι το αίτημα εκτελέστηκε. Το πλήρες ιστορικό ενεργειών είναι στο Audit log.</Help>
        {erasures.length === 0 ? <p className="text-sm text-charcoal-600/70">Καμία διαγραφή ακόμη.</p> : (
          <table className="table-base w-full">
            <thead><tr><th>Πότε</th><th>Τρόπος</th><th>Αιτία</th><th>Από</th></tr></thead>
            <tbody>{erasures.map((e) => (
              <tr key={e.id}>
                <td className="text-sm">{formatDateTime(e.erased_at)}</td>
                <td className="text-sm">{e.mode === 'retention' ? 'Αυτόματα (διατήρηση)' : 'Αίτημα'}</td>
                <td className="text-sm text-charcoal-600">{e.reason ?? '—'}</td>
                <td className="text-sm text-charcoal-600">{e.by ?? (e.mode === 'retention' ? 'Σύστημα' : '—')}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}
