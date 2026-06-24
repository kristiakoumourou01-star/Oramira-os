'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Receipt, Paperclip } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { recordInvoice } from '@/app/actions/contractor';

/**
 * Invoice upload. The file (invoice or receipt) uploads to the private
 * contractor-invoices bucket from the browser, then a documents row +
 * contractor_invoices row are created server-side, linked to this ticket.
 */
export function InvoiceUploadForm({ ticketId, projectId }: { ticketId: string; projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function submit(formData: FormData) {
    if (!file) return;
    const amount = Number(formData.get('amount'));
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `${ticketId}/${crypto.randomUUID()}-${file.name}`;
    let uploaded = false;
    try {
      const { error } = await supabase.storage.from('contractor-invoices').upload(path, file, { upsert: false });
      uploaded = !error;
    } finally {
      setUploading(false);
    }
    if (!uploaded) return;

    startTransition(async () => {
      await recordInvoice({ ticketId, projectId, amount, storagePath: path, title: String(formData.get('title') || file.name) });
      setFile(null);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Receipt size={15} strokeWidth={1.75} /> Upload invoice
      </button>
    );
  }

  const busy = uploading || isPending;

  return (
    <form action={submit} className="space-y-2 rounded border border-stone-line p-4">
      <input name="title" placeholder="Invoice title (optional)" className="input" />
      <input name="amount" type="number" step="0.01" required placeholder="Amount (€)" className="input" />
      <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2 text-sm text-charcoal-600/80 hover:bg-sand-100">
        <Paperclip size={15} strokeWidth={1.75} />
        {file ? file.name : 'Attach invoice / receipt (PDF or image)'}
        <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
      </label>
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !file} className="btn-primary flex-1">
          {uploading ? 'Uploading…' : isPending ? 'Saving…' : 'Submit invoice'}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">Cancel</button>
      </div>
    </form>
  );
}
