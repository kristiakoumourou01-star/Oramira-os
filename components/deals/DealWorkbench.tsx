'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Check } from 'lucide-react';
import { analyzeDeal, type DealInputs } from '@/lib/deal-analyzer';
import type { DealAdvisory } from '@/lib/ai-shared';
import { saveDeal, updateDealStatus, submitDealForApproval, decideDeal } from '@/app/actions/deals';
import Link from 'next/link';
import { Send, ThumbsUp, ThumbsDown, PauseCircle, Building2 } from 'lucide-react';
import { InputsForm } from './InputsForm';
import { AnalysisOutputs } from './AnalysisOutputs';
import { RiskPanel } from './RiskPanel';
import { ScenarioPanel, type SavedScenario } from './ScenarioPanel';
import { AIAdvisoryPanel } from './AIAdvisoryPanel';
import { ConvertToProjectButton } from './ConvertToProjectButton';
import { DealRowActions } from '@/components/deals/DealRowActions';

const STATUSES = ['draft', 'reviewing', 'approved', 'rejected', 'on_hold', 'acquired'];

/**
 * The acquisitions workbench. Inputs on the left, the live-computed analysis on
 * the right — every keystroke re-runs the model in-browser via the shared
 * engine. Saving persists the inputs and a server-recomputed snapshot; the AI
 * advisory reads from that saved state.
 */
export function DealWorkbench({
  dealId,
  dealName,
  status,
  initialInputs,
  scenarios,
  advisory,
  advisoryGeneratedAt,
  projectId,
  canApprove = false,
}: {
  dealId: string;
  dealName: string;
  status: string;
  initialInputs: DealInputs;
  scenarios: SavedScenario[];
  advisory: DealAdvisory | null;
  advisoryGeneratedAt: string | null;
  projectId: string | null;
  canApprove?: boolean;
}) {
  const [inputs, setInputs] = useState<DealInputs>(initialInputs);
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialInputs));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const outputs = useMemo(() => analyzeDeal(inputs), [inputs]);
  const dirty = JSON.stringify(inputs) !== savedSnapshot;

  function patch(p: Partial<DealInputs>) {
    setInputs((prev) => ({ ...prev, ...p }));
  }

  function save() {
    startTransition(async () => {
      await saveDeal(dealId, inputs);
      setSavedSnapshot(JSON.stringify(inputs));
      router.refresh();
    });
  }

  const [flowErr, setFlowErr] = useState<string | null>(null);
  function submitForApproval() {
    startTransition(async () => {
      if (dirty) await saveDeal(dealId, inputs);
      const r = await submitDealForApproval(dealId);
      if (!r.ok) setFlowErr(r.error); else { setFlowErr(null); router.refresh(); }
    });
  }
  function decide(d: 'approved' | 'rejected' | 'on_hold') {
    if (d === 'approved' && !confirm('Έγκριση; Θα δημιουργηθεί αυτόματα το έργο με τις μονάδες της ανάλυσης.')) return;
    startTransition(async () => {
      if (dirty) await saveDeal(dealId, inputs);
      const r = await decideDeal(dealId, d);
      if (!r.ok) setFlowErr(r.error); else { setFlowErr(null); if (r.projectId) router.push(`/projects/${r.projectId}`); else router.refresh(); }
    });
  }

  function changeStatus(next: string) {
    startTransition(async () => {
      await updateDealStatus(dealId, next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Sticky action bar */}
      <div className="sticky top-14 z-10 -mx-6 flex flex-wrap items-center justify-between gap-3 border-b border-stone-line bg-stone/95 px-6 py-3 backdrop-blur">
        <div>
          <p className="eyebrow">Deal Analyzer</p>
          <div className="flex items-center gap-2"><h1 className="font-display text-2xl">{dealName}</h1><DealRowActions id={dealId} name={dealName} compact /></div>
        </div>
        <div className="flex items-center gap-3">
          {(status === 'approved' || status === 'acquired' || projectId) && (
            <ConvertToProjectButton dealId={dealId} projectId={projectId} />
          )}
          <select
            value={status}
            onChange={(e) => changeStatus(e.target.value)}
            disabled={isPending}
            className="input max-w-[160px] capitalize"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>{({ draft: 'Πρόχειρο', reviewing: 'Σε αναμονή έγκρισης', approved: 'Εγκρίθηκε', rejected: 'Απορρίφθηκε', on_hold: 'Σε αναμονή', acquired: 'Έγινε έργο' } as Record<string, string>)[s] ?? s}</option>
            ))}
          </select>
          <button onClick={save} disabled={isPending || !dirty} className="btn-primary">
            {dirty ? <Save size={15} strokeWidth={1.75} /> : <Check size={15} strokeWidth={1.75} />}
            {isPending ? 'Saving…' : dirty ? 'Save analysis' : 'Saved'}
          </button>
        </div>
      </div>

      {/* Ροή έγκρισης: Draft → Ανάλυση & αποστολή → Έγκριση / Απόρριψη / Αναμονή → Έργο */}
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 ${status === 'reviewing' ? 'border-champagne/50 bg-champagne/10' : status === 'approved' || status === 'acquired' ? 'border-forest/30 bg-forest/[0.05]' : status === 'rejected' ? 'border-signal-danger/30 bg-signal-danger/5' : 'border-stone-line bg-white/60'}`}>
        <p className="text-sm text-charcoal">
          {status === 'reviewing' ? <><b>Σε αναμονή έγκρισης.</b> Η ανάλυση έγινε — δείτε τα αποτελέσματα και τις παρατηρήσεις πιο κάτω.</>
            : status === 'acquired' || projectId ? <><b>Εγκρίθηκε</b> και έγινε έργο.</>
            : status === 'approved' ? <><b>Εγκρίθηκε.</b></>
            : status === 'rejected' ? <><b>Απορρίφθηκε.</b> Αλλάξτε τα στοιχεία και στείλτε ξανά για έγκριση.</>
            : status === 'on_hold' ? <><b>Σε αναμονή (on hold).</b></>
            : <>Όταν τα στοιχεία είναι έτοιμα, στείλτε την ανάλυση για έγκριση.</>}
        </p>
        <div className="ml-auto flex flex-wrap gap-2">
          {['draft', 'rejected', 'on_hold'].includes(status) && <button type="button" className="btn-primary text-sm" disabled={isPending} onClick={submitForApproval}><Send size={14} /> {isPending ? 'Ανάλυση…' : 'Ανάλυση & αποστολή για έγκριση'}</button>}
          {canApprove && ['reviewing', 'on_hold', 'draft'].includes(status) && <>
            <button type="button" className="btn-primary text-sm" disabled={isPending} onClick={() => decide('approved')}><ThumbsUp size={14} /> Έγκριση → έργο</button>
            {status !== 'on_hold' && <button type="button" className="btn-secondary text-sm" disabled={isPending} onClick={() => decide('on_hold')}><PauseCircle size={14} /> Αναμονή</button>}
            <button type="button" className="btn-secondary text-sm text-signal-danger" disabled={isPending} onClick={() => decide('rejected')}><ThumbsDown size={14} /> Απόρριψη</button>
          </>}
          {projectId && <Link href={`/projects/${projectId}`} className="btn-secondary text-sm"><Building2 size={14} /> Άνοιγμα έργου</Link>}
          {canApprove && status === 'approved' && !projectId && <button type="button" className="btn-primary text-sm" disabled={isPending} onClick={() => decide('approved')}><Building2 size={14} /> Δημιουργία έργου</button>}
        </div>
        {flowErr && <p className="w-full text-sm text-signal-danger">{flowErr}</p>}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-1">
          <InputsForm inputs={inputs} onChange={patch} />
        </div>
        <div className="col-span-2">
          <AnalysisOutputs outputs={outputs} />
        </div>
      </div>

      <RiskPanel risk={outputs.risk} sensitivity={outputs.sensitivity} />

      <ScenarioPanel dealId={dealId} currentInputs={inputs} currentOutputs={outputs} scenarios={scenarios} />

      <AIAdvisoryPanel dealId={dealId} initial={advisory} generatedAt={advisoryGeneratedAt} />
    </div>
  );
}
