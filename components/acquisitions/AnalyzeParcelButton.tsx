'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator } from 'lucide-react';
import { createDealFromParcel } from '@/app/actions/deals';

/** «Ανάλυση στο Deal Analyzer»: δημιουργεί ανάλυση με τα στοιχεία του οικοπέδου και την ανοίγει. */
export function AnalyzeParcelButton({ parcelId }: { parcelId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <button type="button" disabled={pending}
        onClick={() => start(async () => { const r = await createDealFromParcel(parcelId); if (r.ok) router.push(`/deal-analyzer/${r.id}`); else setErr(r.error); })}
        className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-forest/90 disabled:opacity-60">
        <Calculator size={15} /> {pending ? 'Δημιουργία…' : 'Ανάλυση στο Deal Analyzer'}
      </button>
      {err && <span className="text-xs text-signal-danger">{err}</span>}
    </div>
  );
}
