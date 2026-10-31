'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Merge, X } from 'lucide-react';
import { mergeContacts, dismissDuplicate } from '@/app/actions/duplicates';
import { MATCH_EL } from '@/lib/lead-automation-shared';
import type { DupMatch } from '@/lib/lead-automation-shared';

/** «Πιθανό διπλό» πάνω στην καρτέλα επαφής / lead, με ενοποίηση σε ένα κλικ (αυτή η επαφή μένει). */
export function DuplicateBanner({ contactId, matches, canMerge, afterMergeHref }: { contactId: string; matches: DupMatch[]; canMerge: boolean; afterMergeHref?: string }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!matches.length) return null;
  const run = (f: () => Promise<{ ok: boolean; error?: string }>) => start(async () => {
    const r = await f();
    if (r.ok) { if (afterMergeHref) router.push(afterMergeHref); router.refresh(); } else setErr((r as any).error ?? 'Αποτυχία.');
  });
  return (
    <div className="rounded-lg border border-champagne/60 bg-champagne-50/60 px-4 py-3">
      <p className="flex items-center gap-2 text-sm font-medium text-charcoal"><Users size={15} /> Πιθανό διπλό — {matches.length === 1 ? 'μια ακόμα επαφή μοιάζει' : `${matches.length} επαφές μοιάζουν`} με αυτή</p>
      <ul className="mt-2 space-y-1.5">
        {matches.slice(0, 5).map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <Link href={`/crm/${m.id}`} className="font-medium text-forest hover:underline">{m.full_name ?? m.email}</Link>
            <span className="text-xs text-charcoal-600/70">{[m.email, m.phone].filter(Boolean).join(' · ')}</span>
            <span className="text-[11px] text-charcoal-600/60">{m.reasons.map((r) => MATCH_EL[r] ?? r).join(', ')}</span>
            {canMerge && (
              <span className="ml-auto flex gap-2">
                <button type="button" disabled={pending} className="btn-secondary px-2 py-1 text-xs"
                  onClick={() => { if (window.confirm(`Να ενοποιηθεί η «${m.full_name ?? m.email}» σε αυτή την επαφή; Η άλλη θα διαγραφεί.`)) run(() => mergeContacts(contactId, m.id)); }}>
                  <Merge size={12} /> Ενοποίηση εδώ
                </button>
                <button type="button" disabled={pending} className="btn-ghost px-2 py-1 text-xs" onClick={() => run(() => dismissDuplicate(contactId, m.id))}><X size={12} /> Όχι ίδιος</button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {err && <p className="mt-1 text-xs text-signal-danger">{err}</p>}
    </div>
  );
}
