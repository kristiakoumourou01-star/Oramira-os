'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Paperclip } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { addContract, setContractStatus } from '@/app/actions/hr';
import { formatDate } from '@/lib/format';

export interface Employee { id: string; full_name: string | null }
export interface ContractRow {
  id: string; employee: string | null; type: string; title: string; status: string; start_date: string | null; expiry_date: string | null;
}

const TYPES = ['contract', 'amendment', 'nda', 'agreement'];

export function ContractsAdmin({ employees, contracts }: { employees: Employee[]; contracts: ContractRow[] }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(fd: FormData) {
    const profileId = String(fd.get('employee'));
    const title = String(fd.get('title'));
    if (!profileId || !title) return;
    let storagePath: string | undefined;
    if (file) {
      setBusy(true);
      const supabase = createSupabaseBrowserClient();
      const path = `${profileId}/${crypto.randomUUID()}-${file.name}`;
      const { error } = await supabase.storage.from('contracts').upload(path, file, { upsert: false });
      setBusy(false);
      if (!error) storagePath = path;
    }
    startTransition(async () => {
      await addContract({
        profileId, type: String(fd.get('type')), title, storagePath,
        startDate: String(fd.get('start') || '') || undefined,
        expiryDate: String(fd.get('expiry') || '') || undefined,
        probationEndDate: String(fd.get('probation') || '') || undefined,
        renewalDate: String(fd.get('renewal') || '') || undefined,
      });
      setFile(null);
      router.refresh();
    });
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="panel col-span-1 p-6">
        <h4 className="mb-4">Add document</h4>
        <form action={submit} className="space-y-3">
          <select name="employee" required className="input">
            <option value="">Employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? 'Employee'}</option>)}
          </select>
          <select name="type" defaultValue="contract" className="input capitalize">
            {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input name="title" required placeholder="Title (e.g. Employment contract)" className="input" />
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs text-charcoal-600/70">Start<input name="start" type="date" className="input mt-1" /></label>
            <label className="text-xs text-charcoal-600/70">Expiry<input name="expiry" type="date" className="input mt-1" /></label>
            <label className="text-xs text-charcoal-600/70">Probation end<input name="probation" type="date" className="input mt-1" /></label>
            <label className="text-xs text-charcoal-600/70">Renewal<input name="renewal" type="date" className="input mt-1" /></label>
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2 text-sm text-charcoal-600/80 hover:bg-sand-100">
            <Paperclip size={15} strokeWidth={1.75} /> {file ? file.name : 'Attach file (PDF)'}
            <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <button type="submit" disabled={isPending || busy} className="btn-primary w-full">{busy ? 'Uploading…' : 'Add document'}</button>
        </form>
      </div>

      <div className="panel col-span-2 p-6">
        <h4 className="mb-4">Employment documents</h4>
        {contracts.length === 0 ? (
          <p className="text-sm text-charcoal-600/70">No documents on file.</p>
        ) : (
          <ul className="divide-y divide-stone-line">
            {contracts.map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <FileText size={15} className="text-olive" strokeWidth={1.75} />
                  <div>
                    <p className="text-sm font-medium text-charcoal">{c.title} <span className="text-xs capitalize text-charcoal-600/50">· {c.type}</span></p>
                    <p className="text-xs text-charcoal-600/60">{c.employee} {c.expiry_date ? `· expires ${formatDate(c.expiry_date)}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={c.status === 'active' ? 'badge-forest' : 'badge-neutral'}>{c.status}</span>
                  <button onClick={() => startTransition(async () => { await setContractStatus(c.id, c.status === 'active' ? 'inactive' : 'active'); router.refresh(); })} disabled={isPending} className="btn-ghost text-xs">
                    {c.status === 'active' ? 'Deactivate' : 'Activate'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
