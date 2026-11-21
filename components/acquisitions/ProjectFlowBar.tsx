'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Landmark, Calculator, Building2, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { createDealFromParcel } from '@/app/actions/deals';
import { convertDealNow, convertParcelToProject } from '@/app/actions/project-flow';

type Ref = { id: string; name: string } | null;

/**
 * Η ροή «Αγορά γης → Deal Analyzer → Έργο» σε μία γραμμή: δείχνει πού βρίσκεται
 * το οικόπεδο, με συνδέσμους προς τα πίσω και κουμπί «Μετατροπή σε έργο» σε κάθε στάδιο.
 */
export function ProjectFlowBar({ parcel, deal, project, current, canConvert = true }: { parcel: Ref; deal: Ref; project: Ref; current: 'parcel' | 'deal'; canConvert?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const convert = () => {
    if (!confirm(deal ? 'Να δημιουργηθεί έργο από αυτή την ανάλυση (με τις μονάδες της);' : 'Να δημιουργηθεί έργο από αυτό το οικόπεδο;')) return;
    start(async () => {
      const r = deal ? await convertDealNow(deal.id) : parcel ? await convertParcelToProject(parcel.id) : { ok: false as const, error: '' };
      if (!r.ok) { setErr(r.error || 'Το έργο δεν δημιουργήθηκε.'); return; }
      router.push(`/projects/${r.projectId}?edit=1`);
    });
  };
  const analyze = () => parcel && start(async () => { const r = await createDealFromParcel(parcel.id); if (r.ok) router.push(`/deal-analyzer/${r.id}`); else setErr(r.error); });
  const step = (on: boolean, done: boolean) => `inline-flex h-9 min-w-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] ${on ? 'bg-forest font-medium text-white' : done ? 'border border-forest/30 bg-forest/[0.06] text-charcoal hover:border-forest/60' : 'border border-dashed border-stone-line text-charcoal-600'}`;

  return (
    <div className="rounded-2xl border border-stone-line bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        {parcel ? <Link href={`/acquisitions/${parcel.id}`} className={step(current === 'parcel', true)}><Landmark size={14} className="shrink-0" /><span>Οικόπεδο</span><span className="truncate" data-no-tr>{parcel.name}</span></Link>
          : <span className={step(false, false)}><Landmark size={14} /><span>Χωρίς οικόπεδο</span></span>}
        <ChevronRight size={15} className="text-charcoal-600/50" />
        {deal ? <Link href={`/deal-analyzer/${deal.id}`} className={step(current === 'deal', true)}><Calculator size={14} className="shrink-0" /><span>Ανάλυση</span><span className="max-w-[160px] truncate" data-no-tr>{deal.name}</span></Link>
          : parcel && !project ? <button type="button" disabled={pending} onClick={analyze} className={step(false, false) + ' hover:border-forest/40 hover:text-charcoal'}><Calculator size={14} /><span>Ανάλυση στο Deal Analyzer</span></button>
          : <span className={step(false, false)}><Calculator size={14} /><span>Χωρίς ανάλυση</span></span>}
        <ChevronRight size={15} className="text-charcoal-600/50" />
        {project ? <Link href={`/projects/${project.id}`} className={step(false, true)}><Building2 size={14} className="shrink-0" /><span>Έργο</span><span className="max-w-[160px] truncate" data-no-tr>{project.name}</span></Link>
          : canConvert ? <button type="button" disabled={pending} onClick={convert} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-semibold text-white shadow-sm hover:bg-forest/90 disabled:opacity-60"><ArrowRightLeft size={14} /><span>{pending ? 'Δημιουργία…' : 'Μετατροπή σε έργο'}</span></button>
          : <span className={step(false, false)}><Building2 size={14} /><span>Δεν έγινε ακόμη έργο</span></span>}
      </div>
      {err && <p className="mt-2 text-sm text-signal-danger">{err}</p>}
    </div>
  );
}
