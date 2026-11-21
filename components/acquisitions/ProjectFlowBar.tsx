'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Landmark, Calculator, Building2, ChevronRight, ArrowRightLeft } from 'lucide-react';
import { createDealFromParcel } from '@/app/actions/deals';
import { convertDealNow, convertParcelToProject, missingDueDiligence } from '@/app/actions/project-flow';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';

type Ref = { id: string; name: string } | null;

/**
 * Η ροή «Αγορά γης → Deal Analyzer → Έργο» σε μία γραμμή: δείχνει πού βρίσκεται
 * το οικόπεδο, με συνδέσμους προς τα πίσω και κουμπί «Μετατροπή σε έργο» σε κάθε στάδιο.
 */
export function ProjectFlowBar({ parcel, deal, project, current, canConvert = true }: { parcel: Ref; deal: Ref; project: Ref; current: 'parcel' | 'deal'; canConvert?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  // Πριν τη μετατροπή: αν λείπουν υποχρεωτικοί έλεγχοι, προειδοποίηση με τη λίστα — αποφασίζει ο χρήστης.
  const [ask, setAsk] = useState<string[] | null>(null);
  const convert = () => start(async () => {
    setErr(null);
    const missing = await missingDueDiligence({ parcelId: parcel?.id, dealId: deal?.id }).catch(() => []);
    setAsk(missing);
  });
  const doConvert = () => {
    setAsk(null);
    start(async () => {
      const r = deal ? await convertDealNow(deal.id) : parcel ? await convertParcelToProject(parcel.id) : { ok: false as const, error: '' };
      if (!r.ok) { setErr(r.error || 'Το έργο δεν δημιουργήθηκε.'); return; }
      router.push(`/projects/${r.projectId}?edit=1`);
    });
  };
  const analyze = () => parcel && start(async () => { const r = await createDealFromParcel(parcel.id); if (r.ok) router.push(`/deal-analyzer/${r.id}`); else setErr(r.error); });
  const step = (on: boolean, done: boolean) => `inline-flex h-9 min-w-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] ${on ? 'bg-forest font-medium text-white' : done ? 'border border-forest/30 bg-forest/[0.06] text-charcoal hover:border-forest/60' : 'border border-dashed border-stone-line text-charcoal-600'}`;

  const warnDialog = (
    <Modal open={ask !== null} onClose={() => setAsk(null)} size="md"
      title={ask && ask.length ? 'Λείπουν έλεγχοι' : 'Μετατροπή σε έργο'}
      description={deal ? 'Θα δημιουργηθεί έργο από αυτή την ανάλυση, με τις μονάδες της.' : 'Θα δημιουργηθεί έργο από αυτό το οικόπεδο.'}>
      <ModalBody className="space-y-3">
        {ask && ask.length > 0 ? (
          <>
            <p className="text-sm text-charcoal">Δεν έχουν ολοκληρωθεί οι υποχρεωτικοί έλεγχοι του οικοπέδου:</p>
            <ul className="space-y-1.5">{ask.map((m) => <li key={m} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">{m}</li>)}</ul>
            <p className="text-sm text-charcoal-600/80">Θέλετε να συνεχίσετε τη μετατροπή σε έργο;</p>
          </>
        ) : <p className="text-sm text-charcoal">Όλοι οι υποχρεωτικοί έλεγχοι έχουν ολοκληρωθεί. Συνέχεια;</p>}
      </ModalBody>
      <ModalFooter>
        <button type="button" className="btn-secondary" onClick={() => setAsk(null)}>Άκυρο</button>
        <button type="button" className="btn-primary" onClick={doConvert}>{ask && ask.length ? 'Συνέχεια παρ’ όλα αυτά' : 'Μετατροπή σε έργο'}</button>
      </ModalFooter>
    </Modal>
  );

  return (
    <>
    {warnDialog}
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
    </>
  );
}
