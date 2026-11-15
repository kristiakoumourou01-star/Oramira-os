'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Download, Trash2, Search, FileText, AlertTriangle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getEmployeeDocUploadUrl, recordEmployeeDoc, deleteEmployeeDoc } from '@/app/actions/hr-docs';
import { getDocumentUrl } from '@/app/actions/storage';

export interface EmpDoc { id: string; profileId: string; employee: string; title: string; kind: string; expires: string | null; notes: string | null; bucket: string; path: string; createdAt: string; uploader: string | null }
export const DOC_KINDS: [string, string][] = [['id', 'Ταυτότητα / Διαβατήριο'], ['contract', 'Σύμβαση'], ['cv', 'Βιογραφικό'], ['certificate', 'Πιστοποιητικό / Δίπλωμα'], ['medical', 'Ιατρικό'], ['payroll', 'Μισθοδοσία / Κοινωνικές ασφαλίσεις'], ['other', 'Άλλο']];
const KIND = Object.fromEntries(DOC_KINDS);
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';

/** Ομάδα & HR → Έγγραφα: ανέβασμα εγγράφων ανά υπάλληλο, με τύπο, λήξη και σημειώσεις. */
export function EmployeeDocuments({ docs, employees, canEdit }: { docs: EmpDoc[]; employees: { id: string; name: string }[]; canEdit: boolean }) {
  const router = useRouter();
  const [emp, setEmp] = useState('');
  const [kindF, setKindF] = useState('');
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ profileId: employees[0]?.id ?? '', kind: 'id', title: '', expires: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [, start] = useTransition();
  const file = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
  const list = docs.filter((d) => (!emp || d.profileId === emp) && (!kindF || d.kind === kindF) && (!q || [d.title, d.employee, d.notes ?? ''].join(' ').toLowerCase().includes(q.toLowerCase())));

  const upload = async (files: FileList | null) => {
    if (!files?.length || !form.profileId) return;
    setBusy(true); setMsg(null);
    const sb = createSupabaseBrowserClient();
    let n = 0;
    for (const f of Array.from(files)) {
      const u = await getEmployeeDocUploadUrl(form.profileId, f.name, f.size);
      if (!u.ok) { setMsg({ ok: false, text: u.error }); continue; }
      const { error } = await sb.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined });
      if (error) { setMsg({ ok: false, text: error.message }); continue; }
      const r = await recordEmployeeDoc({ profileId: form.profileId, path: u.path, title: form.title.trim() || f.name, kind: form.kind, notes: form.notes, expires: form.expires || undefined });
      if (r.ok) n++; else setMsg({ ok: false, text: r.error });
    }
    setBusy(false);
    if (n) { setMsg({ ok: true, text: `Ανέβηκαν ${n} έγγραφα.` }); setForm((x) => ({ ...x, title: '', notes: '', expires: '' })); router.refresh(); }
    if (file.current) file.current.value = '';
  };
  const open = (d: EmpDoc) => start(async () => { const url = await getDocumentUrl(d.bucket as any, d.path); window.open(url, '_blank', 'noopener'); });
  const del = (d: EmpDoc) => { if (!confirm(`Διαγραφή «${d.title}»;`)) return; start(async () => { const r = await deleteEmployeeDoc(d.id); setMsg(r.ok ? { ok: true, text: 'Διαγράφηκε.' } : { ok: false, text: r.error }); router.refresh(); }); };

  return (
    <div className="space-y-5">
      {canEdit && (
        <div className="rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="mb-3 text-[16px] font-semibold text-charcoal">Ανέβασμα εγγράφου</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block"><span className={lbl}>Υπάλληλος *</span><select className="input text-sm" value={form.profileId} onChange={(e) => setForm({ ...form, profileId: e.target.value })}>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
            <label className="block"><span className={lbl}>Τύπος</span><select className="input text-sm" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>{DOC_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="block"><span className={lbl}>Τίτλος</span><input className="input text-sm" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="(όνομα αρχείου)" /></label>
            <label className="block"><span className={lbl}>Λήξη</span><input type="date" className="input text-sm" value={form.expires} onChange={(e) => setForm({ ...form, expires: e.target.value })} /></label>
          </div>
          <label className="mt-3 block"><span className={lbl}>Σημειώσεις</span><input className="input text-sm" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></label>
          <label className={`mt-3 flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-forest/25 bg-forest/[0.03] px-4 py-6 text-center text-sm text-charcoal-600 hover:border-forest/50 ${busy ? 'pointer-events-none opacity-60' : ''}`}>
            <Upload size={20} className="text-forest" />
            <span>{busy ? 'Ανέβασμα…' : 'Επιλέξτε αρχεία (PDF, εικόνες, Word — μέχρι 25MB)'}</span>
            <input ref={file} type="file" multiple hidden onChange={(e) => void upload(e.target.files)} />
          </label>
        </div>
      )}
      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}
      <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <select value={emp} onChange={(e) => setEmp(e.target.value)} className="input h-10 w-auto min-w-[170px] text-sm"><option value="">Όλοι οι υπάλληλοι</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
          <select value={kindF} onChange={(e) => setKindF(e.target.value)} className="input h-10 w-auto min-w-[170px] text-sm"><option value="">Όλοι οι τύποι</option>{DOC_KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <label className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" className="input h-10 pl-9" /></label>
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="table-base w-full min-w-[720px]">
            <thead><tr><th>Έγγραφο</th><th>Υπάλληλος</th><th>Τύπος</th><th>Λήξη</th><th>Ανέβηκε</th><th className="text-right">Ενέργειες</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td><span className="flex items-center gap-2 font-semibold text-charcoal" data-no-tr><FileText size={15} className="text-forest" />{d.title}</span>{d.notes && <span className="block text-[13px] text-charcoal-600" data-no-tr>{d.notes}</span>}</td>
                  <td className="text-sm" data-no-tr>{d.employee}</td>
                  <td className="text-sm">{KIND[d.kind] ?? 'Άλλο'}</td>
                  <td className={`text-sm ${d.expires && d.expires < today ? 'font-medium text-signal-danger' : d.expires && d.expires < soon ? 'text-forest' : 'text-charcoal-600'}`}>{d.expires ? <span className="inline-flex items-center gap-1">{d.expires < soon && <AlertTriangle size={13} />}{new Date(d.expires).toLocaleDateString('el-GR')}</span> : '—'}</td>
                  <td className="text-sm text-charcoal-600">{new Date(d.createdAt).toLocaleDateString('el-GR')}{d.uploader ? ` · ${d.uploader}` : ''}</td>
                  <td><span className="flex justify-end gap-1">
                    <button type="button" onClick={() => open(d)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-forest/10 hover:text-forest" title="Άνοιγμα" aria-label="Άνοιγμα"><Download size={15} /></button>
                    {canEdit && <button type="button" onClick={() => del(d)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger" title="Διαγραφή" aria-label="Διαγραφή"><Trash2 size={15} /></button>}
                  </span></td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-sm text-charcoal-600">Δεν υπάρχουν έγγραφα.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
