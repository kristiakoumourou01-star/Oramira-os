'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export function CopyLink({ url }: { url: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <input readOnly value={url} className="input flex-1 font-mono text-sm" onFocus={(e) => e.target.select()} />
      <button type="button" className="btn-secondary shrink-0 text-sm" onClick={async () => { try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* */ } }}>
        {done ? <Check size={14} /> : <Copy size={14} />} {done ? 'Αντιγράφηκε' : 'Αντιγραφή'}
      </button>
    </div>
  );
}
