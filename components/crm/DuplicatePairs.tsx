'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Merge, X, Check, UserRound, ShieldAlert } from 'lucide-react';
import { mergeContacts, dismissDuplicate } from '@/app/actions/duplicates';
import { MATCH_EL } from '@/lib/lead-automation-shared';
import type { DupContact, DupPair } from '@/lib/lead-automation-shared';
import { formatDate } from '@/lib/format';

/** «Διπλές επαφές»: για κάθε ζευγάρι διαλέγετε ποια μένει και πατάτε Ενοποίηση. */
export function DuplicatePairs({ pairs, canMerge }: { pairs: DupPair[]; canMerge: boolean }) {
  if (!pairs.length) {
    return <div className="panel p-8 text-center text-sm text-charcoal-600/70"><Check className="mx-auto mb-2 text-forest" size={22} />Δεν βρέθηκαν διπλές επαφές.</div>;
  }
  return <div className="space-y-3">{pairs.map((p) => <PairCard key={`${p.a.id}-${p.b.id}`} pair={p} canMerge={canMerge} />)}</div>;
}

/** Προτεινόμενη: όποια έχει portal, μετά αγοραστής, μετά περισσότερα leads, μετά η παλαιότερη. */
export function suggestKeep(a: DupContact, b: DupContact): string {
  const score = (c: DupContact) => (c.hasPortal ? 1000 : 0) + (c.isBuyer ? 100 : 0) + c.leads * 10;
  if (score(a) !== score(b)) return score(a) > score(b) ? a.id : b.id;
  return a.created_at <= b.created_at ? a.id : b.id;
}

function PairCard({ pair, canMerge }: { pair: DupPair; canMerge: boolean }) {
  const router = useRouter();
  const [keep, setKeep] = useState(() => suggestKeep(pair.a, pair.b));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bothPortal = pair.a.hasPortal && pair.b.hasPortal;
  const drop = keep === pair.a.id ? pair.b : pair.a;
  const kept = keep === pair.a.id ? pair.a : pair.b;

  const merge = () => {
    if (!window.confirm(`Ενοποίηση: όλα του «${drop.full_name ?? drop.email}» θα πάνε στο «${kept.full_name ?? kept.email}» και η δεύτερη επαφή θα διαγραφεί. Συνέχεια;`)) return;
    start(async () => { const r = await mergeContacts(kept.id, drop.id); if (r.ok) router.refresh(); else setErr(r.error); });
  };
  const dismiss = () => start(async () => { const r = await dismissDuplicate(pair.a.id, pair.b.id); if (r.ok) router.refresh(); else setErr(r.error); });

  const Side = ({ c }: { c: DupContact }) => (
    <label className={`flex flex-1 cursor-pointer gap-3 rounded-lg border p-3 transition-colors ${keep === c.id ? 'border-forest bg-forest/[0.04]' : 'border-stone-line hover:border-forest/40'}`}>
      <input type="radio" className="mt-1" name={`keep-${pair.a.id}-${pair.b.id}`} checked={keep === c.id} onChange={() => setKeep(c.id)} disabled={!canMerge || bothPortal} />
      <span className="min-w-0 text-sm">
        <Link href={`/crm/${c.id}`} className="font-medium text-charcoal hover:text-forest hover:underline">{c.full_name ?? 'Χωρίς όνομα'}</Link>
        <span className="block truncate text-xs text-charcoal-600/80">{c.email}</span>
        <span className="block text-xs text-charcoal-600/80">{c.phone ?? '—'}</span>
        <span className="mt-1 block text-[11px] text-charcoal-600/60">
          {c.leads} leads · από {formatDate(c.created_at)}{c.isBuyer ? ' · αγοραστής' : ''}{c.hasPortal ? ' · έχει portal' : ''}
        </span>
        {keep === c.id && <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-forest"><UserRound size={11} /> Μένει</span>}
      </span>
    </label>
  );

  return (
    <div className="panel space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {pair.reasons.map((r) => <span key={r} className="badge-champagne">{MATCH_EL[r] ?? r}</span>)}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row"><Side c={pair.a} /><Side c={pair.b} /></div>
      {bothPortal && <p className="flex items-center gap-1.5 text-xs text-signal-danger"><ShieldAlert size={13} /> Και οι δύο έχουν λογαριασμό στο portal — ενοποιούνται μόνο αφού αφαιρεθεί ο ένας λογαριασμός.</p>}
      {err && <p className="text-xs text-signal-danger">{err}</p>}
      {canMerge && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending || bothPortal} onClick={merge} className="btn-primary text-xs"><Merge size={13} /> {pending ? 'Ενοποίηση…' : 'Ενοποίηση'}</button>
          <button type="button" disabled={pending} onClick={dismiss} className="btn-ghost text-xs"><X size={13} /> Δεν είναι ο ίδιος</button>
          <span className="text-[11px] text-charcoal-600/60">Leads, μηνύματα, έγγραφα, KYC, ξεναγήσεις και πληρωμές μεταφέρονται· κενά πεδία συμπληρώνονται.</span>
        </div>
      )}
    </div>
  );
}
