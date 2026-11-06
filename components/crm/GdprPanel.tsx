'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Download, UserX, Info } from 'lucide-react';
import { eraseContact, setMarketingConsent } from '@/app/actions/gdpr';
import { formatDateTime } from '@/lib/format';

export interface GdprInfo {
  consentAt: string | null;
  consentSource: string | null;
  consentText: string | null;
  marketing: boolean;
  marketingAt: string | null;
  anonymizedAt: string | null;
}

/** Contact card → GDPR: consent on record, marketing on/off, export, erasure. */
export function GdprPanel({ contactId, info, hold, canEdit, canErase, canExport, missing }: {
  contactId: string;
  info: GdprInfo;
  /** Why erasure is blocked right now (null = allowed). */
  hold: string | null;
  canEdit: boolean;
  canErase: boolean;
  canExport: boolean;
  /** Migration 0057 not run yet. */
  missing: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [erasing, setErasing] = useState(false);
  const [reason, setReason] = useState('');

  if (info.anonymizedAt) {
    return (
      <div className="panel p-6">
        <h4 className="mb-2 flex items-center gap-2"><ShieldCheck size={16} className="text-forest" /> GDPR</h4>
        <p className="text-sm text-charcoal-600">Τα προσωπικά στοιχεία διαγράφηκαν στις {formatDateTime(info.anonymizedAt)}. Μένει μόνο ό,τι χρειάζεται για στατιστικά, χωρίς όνομα.</p>
      </div>
    );
  }

  const toggleMarketing = () => start(async () => {
    const res = await setMarketingConsent(contactId, !info.marketing);
    setMsg(res.ok ? { ok: true, text: 'Αποθηκεύτηκε.' } : { ok: false, text: res.error });
    if (res.ok) router.refresh();
  });
  const erase = () => {
    if (!confirm('Οριστική διαγραφή των προσωπικών στοιχείων αυτής της επαφής; Δεν αναιρείται.')) return;
    start(async () => {
      const res = await eraseContact(contactId, reason);
      if (res.ok) { setErasing(false); router.refresh(); } else setMsg({ ok: false, text: res.error });
    });
  };

  return (
    <div className="panel space-y-3 p-6">
      <h4 className="flex items-center gap-2"><ShieldCheck size={16} className="text-forest" /> GDPR</h4>
      {missing && <p className="text-xs text-champagne-600">Ενεργοποιείται μόλις τρέξει το supabase/ΕΚΚΡΕΜΕΙ_ΣΤΗ_ΒΑΣΗ.sql.</p>}

      <div className="text-sm">
        <p className="eyebrow mb-0.5">Συγκατάθεση</p>
        {info.consentAt ? (
          <p className="text-charcoal">{formatDateTime(info.consentAt)}{info.consentSource ? <span className="text-charcoal-600/70"> · {info.consentSource}</span> : null}</p>
        ) : <p className="text-charcoal-600/70">Δεν έχει καταγραφεί (π.χ. επαφή που μπήκε χειροκίνητα).</p>}
        {info.consentText && <p className="mt-1 text-xs italic text-charcoal-600/70">«{info.consentText}»</p>}
      </div>

      <div className="flex items-center justify-between gap-3 text-sm">
        <div>
          <p className="eyebrow mb-0.5">Marketing</p>
          <p className={info.marketing ? 'text-signal-success' : 'text-charcoal-600'}>{info.marketing ? `Ναι${info.marketingAt ? ` · από ${formatDateTime(info.marketingAt)}` : ''}` : 'Όχι'}</p>
        </div>
        {canEdit && !missing && (
          <button type="button" disabled={pending} onClick={toggleMarketing} className="btn-secondary px-3 py-1.5 text-xs">{info.marketing ? 'Ανάκληση' : 'Ενεργοποίηση'}</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-stone-line pt-3">
        {canExport && (
          <a href={`/api/gdpr/contact/${contactId}`} className="btn-secondary px-3 py-1.5 text-xs"><Download size={13} /> Εξαγωγή δεδομένων</a>
        )}
        {canErase && !missing && !erasing && (
          <button type="button" onClick={() => { setErasing(true); setMsg(null); }} className="btn-secondary px-3 py-1.5 text-xs text-signal-danger"><UserX size={13} /> Διαγραφή στοιχείων</button>
        )}
      </div>

      {erasing && (
        hold ? (
          <p className="flex items-start gap-2 rounded-md bg-champagne-50 px-3 py-2 text-xs text-champagne-600"><Info size={13} className="mt-0.5 shrink-0" />{hold}</p>
        ) : (
          <div className="space-y-2 rounded-md border border-signal-danger/30 p-3">
            <p className="text-xs text-charcoal-600">Σβήνονται όνομα, email, τηλέφωνο, σημειώσεις, μηνύματα και tags. Τα έργα, οι προβολές και τα στατιστικά μένουν χωρίς όνομα.</p>
            <input className="input" value={reason} placeholder="Αιτία (π.χ. αίτημα πελάτη με email 12/3)" onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <button type="button" disabled={pending} onClick={erase} className="btn-primary bg-signal-danger px-3 py-1.5 text-xs">{pending ? '…' : 'Οριστική διαγραφή'}</button>
              <button type="button" onClick={() => setErasing(false)} className="btn-secondary px-3 py-1.5 text-xs">Άκυρο</button>
            </div>
          </div>
        )
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</p>}
    </div>
  );
}
