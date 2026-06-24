'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { recordCompletionPhotos } from '@/app/actions/contractor';

/**
 * Completion photo upload. Media goes straight to the private defect-reports
 * bucket from the browser (storage RLS allows the assigned contractor), then
 * the paths are recorded against the ticket server-side.
 */
export function CompletionPhotoUpload({ ticketId, unitId }: { ticketId: string; unitId: string }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  async function submit() {
    if (files.length === 0) return;
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const paths: string[] = [];
    try {
      for (const file of files) {
        const path = `${unitId}/completion/${crypto.randomUUID()}-${file.name}`;
        const { error } = await supabase.storage.from('defect-reports').upload(path, file, { upsert: false });
        if (!error) paths.push(path);
      }
    } finally {
      setUploading(false);
    }
    startTransition(async () => {
      await recordCompletionPhotos(ticketId, paths);
      setFiles([]);
      router.refresh();
    });
  }

  const busy = uploading || isPending;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2 text-sm text-charcoal-600/80 hover:bg-sand-100">
        <Camera size={15} strokeWidth={1.75} />
        {files.length > 0 ? `${files.length} selected` : 'Add completion photos'}
        <input type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      </label>
      {files.length > 0 && (
        <button onClick={submit} disabled={busy} className="btn-primary">
          {uploading ? 'Uploading…' : isPending ? 'Saving…' : 'Upload'}
        </button>
      )}
    </div>
  );
}
