'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, X, UserPlus } from 'lucide-react';
import { getSuggestedContractors, assignContractor, removeContractorAssignment } from '@/app/actions/projects';

const TRADES = ['structure', 'mep', 'electrical', 'plumbing', 'finishes', 'landscaping', 'general'];

export interface AssignmentRow {
  id: string;
  contractor_id: string;
  trade: string | null;
  company_name: string;
}
interface Suggestion {
  contractor_id: string;
  company_name: string;
  score: number;
  is_available: boolean;
  open_assignments: number;
  avg_rating: number;
  same_region: boolean;
  same_project_history: boolean;
}

/**
 * Contractor assignments for a project. Reuses the read-only suggestion
 * engine (suggest_contractors) — "automation suggests, staff decides": the
 * scores are a signal, the assignment is always an explicit click.
 */
export function ContractorAssignment({
  projectId,
  assignments,
}: {
  projectId: string;
  assignments: AssignmentRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [trade, setTrade] = useState('structure');
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadSuggestions() {
    setLoading(true);
    try {
      const data = await getSuggestedContractors(trade, projectId);
      setSuggestions(data as Suggestion[]);
    } finally {
      setLoading(false);
    }
  }

  function assign(contractorId: string) {
    startTransition(async () => {
      await assignContractor({ projectId, contractorId, trade });
      setSuggestions(null);
      router.refresh();
    });
  }

  function remove(assignmentId: string) {
    startTransition(async () => {
      await removeContractorAssignment(assignmentId, projectId);
      router.refresh();
    });
  }

  return (
    <div className="panel p-6">
      <h4 className="mb-4">Contractors</h4>

      {assignments.length === 0 ? (
        <p className="mb-4 text-sm text-charcoal-600/70">No contractors assigned yet.</p>
      ) : (
        <ul className="mb-4 divide-y divide-stone-line">
          {assignments.map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2.5">
              <div>
                <p className="text-sm font-medium text-charcoal">{a.company_name}</p>
                {a.trade && <p className="text-xs text-charcoal-600/60 capitalize">{a.trade}</p>}
              </div>
              <button onClick={() => remove(a.id)} disabled={isPending} className="text-charcoal-600/50 hover:text-signal-danger" aria-label="Remove">
                <X size={15} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 border-t border-stone-line pt-4">
        <select value={trade} onChange={(e) => setTrade(e.target.value)} className="input capitalize">
          {TRADES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button onClick={loadSuggestions} disabled={loading} className="btn-secondary whitespace-nowrap">
          <Sparkles size={14} strokeWidth={1.75} /> {loading ? 'Finding…' : 'Suggest'}
        </button>
      </div>

      {suggestions && (
        <div className="mt-3 space-y-1.5">
          {suggestions.length === 0 && <p className="text-sm text-charcoal-600/70">No matching contractors for this trade.</p>}
          {suggestions.map((s) => (
            <div key={s.contractor_id} className="flex items-center justify-between rounded border border-stone-line px-3 py-2">
              <div>
                <p className="text-sm font-medium text-charcoal">{s.company_name}</p>
                <p className="text-xs text-charcoal-600/60">
                  <span className="figure">{Number(s.score).toFixed(0)}</span> match
                  {s.is_available ? ' · available' : ' · busy'}
                  {s.same_region && ' · same region'}
                  {s.same_project_history && ' · worked here before'}
                </p>
              </div>
              <button onClick={() => assign(s.contractor_id)} disabled={isPending} className="btn-ghost text-xs">
                <UserPlus size={13} strokeWidth={1.75} /> Assign
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
