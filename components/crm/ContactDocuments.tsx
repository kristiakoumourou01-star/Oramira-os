'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Upload, Trash2, ExternalLink, Lock } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { addContactDocument, deleteContactDocument } from '@/app/actions/contact-card';
import { getDocumentUrl } from '@/app/actions/storage';
import type { BucketName } from '@/lib/storage-shared';
import { formatDate } from '@/lib/format';

export interface DocRow { id: string; title: string | null; category: string | null; bucket: string; path: string; createdAt: string; source: string | null }

export const DOC_CATEGORY: Record<string, string> = {
  kyc_id: 'Ταυτότητα / διαβατήριο', kyc_address: 'Αποδεικτικό διεύθυνσης', kyc_funds: 'Πηγή χρημάτων', kyc_other: 'Άλλο KYC',
  contract: 'Συμβόλαιο / συμφωνία', other: 'Άλλο',
};
const uid = () => (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

/** Τα έγγραφα του προσώπου (ιδιωτικά) + όσα αφορούν τις μονάδες/συμβόλαιά του. */
export function ContactDocuments({ contactId, own, related, canEdit }: { contactId: string; own: DocRow[]; related: DocRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [category, setCategory] = useState('kyc_id');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr(null);
    const supabase = createSupabaseBrowserClient();
    for (const f of Array.from(files)) {
      if (f.size > 20 * 1024 * 1024) { setErr(`Το «${f.name}» είναι πάνω από 20 MB.`); continue; }
      setBusy(f.name);
      const path = `contacts/${contactId}/${uid()}-${f.name.replace(/[^\w.\-]+/g, '_')}`;
      const { error } = await supabase.storage.from('contracts').upload(path, f, { upsert: false });
      if (error) { setErr(`Το «${f.name}» δεν ανέβηκε: ${error.message}`); continue; }
      const r = await addContactDocument(contactId, { path, title: f.name, category });
      if (!r.ok) setErr(r.error);
    }
    setBusy(null); router.refresh();
  };
  const open = (d: DocRow) => start(async () => {
    try { window.open(await getDocumentUrl(d.bucket as BucketName, d.path), '_blank', 'noopener'); } catch { setErr('Το αρχείο δεν άνοιξε.'); }
  });
  const del = (d: DocRow) => { if (window.confirm(`Διαγραφή του «${d.title ?? 'εγγράφου'}»;`)) start(async () => { const r = await deleteContactDocument(d.id, contactId); if (r.ok) router.refresh(); else setErr(r.error); }); };

  const Row = ({ d, mine }: { d: DocRow; mine: boolean }) => (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
      <button type="button" onClick={() => open(d)} className="flex min-w-0 items-center gap-2 text-left text-sm hover:text-forest">
        <FileText size={15} className="shrink-0 text-olive" />
        <span className="min-w-0">
          <span className="block truncate font-medium">{d.title ?? d.path.split('/').pop()}</span>
          <span className="block text-[11px] text-charcoal-600/60">{DOC_CATEGORY[d.category ?? ''] ?? d.category ?? '—'}{d.source ? ` · ${d.source}` : ''} · {formatDate(d.createdAt)}</span>
        </span>
        <ExternalLink size={12} className="shrink-0 text-charcoal-600/40" />
      </button>
      {mine && canEdit && <button type="button" disabled={pending} onClick={() => del(d)} className="text-charcoal-600/50 hover:text-signal-danger"><Trash2 size={14} /></button>}
    </li>
  );

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-6">
        <div>
          <h4 className="flex items-center gap-2"><Lock size={15} /> Έγγραφα του προσώπου</h4>
          <p className="text-xs text-charcoal-600/70">Ιδιωτικά: τα βλέπει μόνο το προσωπικό, ανοίγουν με σύνδεσμο που λήγει σε 5 λεπτά. Σβήνονται μαζί με την επαφή σε διαγραφή GDPR.</p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <select className="input w-auto py-1.5 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
              {Object.entries(DOC_CATEGORY).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label className="btn-secondary cursor-pointer px-3 py-1.5 text-xs">
              <Upload size={13} /> {busy ? `Ανέβασμα ${busy}…` : 'Ανέβασμα αρχείων'}
              <input type="file" multiple className="hidden" disabled={!!busy} accept="image/*,application/pdf,.doc,.docx" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            </label>
          </div>
        )}
        {err && <p className="text-sm text-signal-danger">{err}</p>}
        {own.length === 0 ? <p className="text-sm text-charcoal-600/60">Κανένα έγγραφο ακόμη.</p> : <ul className="divide-y divide-stone-line">{own.map((d) => <Row key={d.id} d={d} mine />)}</ul>}
      </div>
      {related.length > 0 && (
        <div className="panel space-y-2 p-6">
          <h4>Έγγραφα μονάδων & συμβολαίων</h4>
          <ul className="divide-y divide-stone-line">{related.map((d) => <Row key={d.id} d={d} mine={false} />)}</ul>
        </div>
      )}
    </div>
  );
}
