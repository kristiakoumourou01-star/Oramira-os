'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';

/** Calls a server action that returns a base64 PDF, then triggers a download. */
export function DownloadReportButton({ label = 'Export PDF', action }: { label?: string; action: () => Promise<{ filename: string; base64: string }> }) {
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    try {
      const { filename, base64 } = await action();
      const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button onClick={run} disabled={loading} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-60">
      {loading ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} strokeWidth={1.9} />} {label}
    </button>
  );
}
