'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X, Paperclip } from 'lucide-react';
import { createTicket } from '@/app/actions/maintenance';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const CATEGORIES = ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'cosmetic', 'other'];
const URGENCY = [
  { value: 'low', label: 'Low — at your convenience' },
  { value: 'medium', label: 'Medium — within a week' },
  { value: 'high', label: 'High — needs attention soon' },
  { value: 'emergency', label: 'Emergency — urgent / safety' },
] as const;

/**
 * Raise a maintenance ticket. Photos/videos upload straight to the private
 * defect-reports bucket from the browser (storage RLS allows the homeowner),
 * then their paths are recorded against the ticket server-side — so large
 * media never round-trips through a Server Action.
 */
export function NewTicketForm({ unitId }: { unitId: string }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function handleSubmit(formData: FormData) {
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const photoPaths: string[] = [];
    try {
      for (const file of files) {
        const path = `${unitId}/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from('defect-reports').upload(path, file, { upsert: false });
        if (!error) photoPaths.push(path);
      }
    } finally {
      setUploading(false);
    }

    startTransition(async () => {
      await createTicket({
        unitId,
        title: String(formData.get('title')),
        category: String(formData.get('category')),
        priority: String(formData.get('priority')) as 'low' | 'medium' | 'high' | 'emergency',
        description: String(formData.get('description') || '') || undefined,
        photoPaths,
      });
      setFiles([]);
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> Report an issue
      </button>
    );
  }

  const busy = uploading || isPending;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xl">Report an issue</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <p className="mb-4 text-sm text-charcoal-600/70">Your Oramira team will be notified and will arrange a contractor visit.</p>
        <form action={handleSubmit} className="space-y-3">
          <input name="title" required placeholder="What's the issue? (e.g. Kitchen tap dripping)" className="input" />
          <div className="grid grid-cols-2 gap-3">
            <select name="category" className="input capitalize" defaultValue="plumbing">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select name="priority" className="input" defaultValue="medium">
              {URGENCY.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          <textarea name="description" placeholder="Describe the issue in a little more detail…" className="input min-h-[90px]" />

          <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2.5 text-sm text-charcoal-600/80 hover:bg-sand-100">
            <Paperclip size={15} strokeWidth={1.75} />
            {files.length > 0 ? `${files.length} file(s) attached` : 'Attach photos or video'}
            <input
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </label>

          <button type="submit" disabled={busy} className="btn-primary w-full">
            {uploading ? 'Uploading…' : isPending ? 'Submitting…' : 'Submit ticket'}
          </button>
        </form>
      </div>
    </div>
  );
}
