'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Check } from 'lucide-react';
import { analyzeDeal, type DealInputs } from '@/lib/deal-analyzer';
import type { DealAdvisory } from '@/lib/ai';
import { saveDeal, updateDealStatus } from '@/app/actions/deals';
import { InputsForm } from './InputsForm';
import { AnalysisOutputs } from './AnalysisOutputs';
import { RiskPanel } from './RiskPanel';
import { ScenarioPanel, type SavedScenario } from './ScenarioPanel';
import { AIAdvisoryPanel } from './AIAdvisoryPanel';
import { ConvertToProjectButton } from './ConvertToProjectButton';

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
}: {
  dealId: string;
  dealName: string;
  status: string;
  initialInputs: DealInputs;
  scenarios: SavedScenario[];
  advisory: DealAdvisory | null;
  advisoryGeneratedAt: string | null;
  projectId: string | null;
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

  function changeStatus(next: string) {
    startTransition(async () => {
      await updateDealStatus(dealId, next);
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 -mx-8 flex items-center justify-between border-b border-stone-line bg-stone/95 px-8 py-3 backdrop-blur">
        <div>
          <p className="eyebrow">Deal Analyzer</p>
          <h1 className="font-display text-2xl">{dealName}</h1>
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
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <button onClick={save} disabled={isPending || !dirty} className="btn-primary">
            {dirty ? <Save size={15} strokeWidth={1.75} /> : <Check size={15} strokeWidth={1.75} />}
            {isPending ? 'Saving…' : dirty ? 'Save analysis' : 'Saved'}
          </button>
        </div>
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
