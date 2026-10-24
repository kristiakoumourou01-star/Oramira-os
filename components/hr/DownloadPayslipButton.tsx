'use client';

import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { payslipDownloadUrl } from '@/app/actions/hr';

/** Fetches a short-lived signed URL for the stored payslip PDF and opens it. */
export function DownloadPayslipButton({ payslipId, className }: { payslipId: string; className?: string }) {
  const [loading, setLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  async function download() {
    setLoading(true);
    setMissing(false);
    try {
      const url = await payslipDownloadUrl(payslipId);
      if (url) window.location.href = url;
      else setMissing(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      className={className ?? 'inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-sm font-medium text-white hover:bg-forest/90 disabled:opacity-60'}
      title={missing ? 'PDF not available yet' : 'Download PDF'}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} strokeWidth={1.75} />}
      {missing ? 'Not ready' : 'PDF'}
    </button>
  );
}
