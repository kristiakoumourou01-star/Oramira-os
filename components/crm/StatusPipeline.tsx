'use client';

import { useState, useTransition } from 'react';
import { Check, X, RotateCcw, Trophy } from 'lucide-react';
import { updateLeadStatus } from '@/app/actions/leads';

/** Five core stages an employee actually works a lead through. The granular
 *  legacy statuses (engaged, waiting, negotiating…) still map into these
 *  buckets for display, but there are now far fewer decisions per lead. */
const STAGES = [
  { key: 'new', label: 'New', meaning: 'Not contacted yet.', next: 'Call or message within the hour.' },
  { key: 'contacted', label: 'Contacted', meaning: "You've reached out and a conversation has started.", next: 'Confirm their budget, timeline & what they want.' },
  { key: 'qualified', label: 'Qualified', meaning: 'Budget, timeline & requirements confirmed.', next: 'Book a property viewing.' },
  { key: 'viewing', label: 'Viewing', meaning: 'A viewing is booked or completed.', next: 'Gauge interest, then put an offer together.' },
  { key: 'offer', label: 'Offer', meaning: 'A proposal / price is on the table.', next: 'Agree terms, then reserve the unit.' },
] as const;

/** Legacy/granular DB status → which of the 5 core stages it displays as. */
const BUCKET: Record<string, number> = {
  new: 0, contacted: 1, engaged: 1, qualified: 2, viewing: 3, waiting: 3, offer: 4, negotiating: 4,
};

/** Positive end-states (past the working pipeline). */
const WON_STATES: Record<string, { label: string; note: string }> = {
  reserved: { label: 'Reserved', note: 'Deposit taken — the unit is held for this buyer.' },
  won: { label: 'Won 🎉', note: 'This deal is closed.' },
};

/** Plain-language outcomes for closing a lead, each mapped to the underlying
 *  status. This is what makes "not interested" a first-class, obvious action. */
const OUTCOMES: { key: string; label: string; status: string; tone: 'dead' | 'park' }[] = [
  { key: 'not_interested', label: 'Not interested', status: 'lost', tone: 'dead' },
  { key: 'bought_elsewhere', label: 'Bought elsewhere', status: 'lost', tone: 'dead' },
  { key: 'price_too_high', label: 'Budget / price too high', status: 'lost', tone: 'dead' },
  { key: 'no_match', label: 'No suitable property', status: 'lost', tone: 'dead' },
  { key: 'bad_timing', label: 'Not now — revisit later', status: 'nurture', tone: 'park' },
  { key: 'no_response', label: "Can't reach — no response", status: 'no_response', tone: 'park' },
];

const CLOSED_LABEL: Record<string, string> = { lost: 'Lost', nurture: 'Nurture', no_response: 'No response', retargeting: 'Retargeting' };

/**
 * The lead status pipeline — five clear stages an employee works through, each
 * captioned with what it means and the next step, so structuring a lead is
 * self-evident. Closing a lead is one plain-language action that captures WHY
 * (saved to the timeline) and clears the lead's open tasks.
 */
export function StatusPipeline({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const [isPending, startTransition] = useTransition();
  const [closing, setClosing] = useState(false);
  const [reason, setReason] = useState('');

  function setStatus(status: string, why?: string) {
    startTransition(() => updateLeadStatus(leadId, status, why));
  }
  function confirmOutcome(status: string, label: string) {
    setStatus(status, reason.trim() ? `${label} — ${reason.trim()}` : label);
    setClosing(false);
    setReason('');
  }

  // ── Won / Reserved: a positive end-state banner ──
  const wonState = WON_STATES[currentStatus];
  if (wonState) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-forest/20 bg-forest/[0.05] px-4 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white"><Trophy size={16} strokeWidth={1.9} /></span>
        <div>
          <p className="text-sm font-semibold text-charcoal">{wonState.label}</p>
          <p className="text-xs text-charcoal-600/70">{wonState.note}</p>
        </div>
      </div>
    );
  }

  // ── Closed / parked: show the outcome + a way back in ──
  const closedLabel = CLOSED_LABEL[currentStatus];
  if (closedLabel) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-line bg-sand-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-charcoal">This lead is closed — <span className="text-charcoal-600">{closedLabel}</span></p>
          <p className="text-xs text-charcoal-600/60">The reason is recorded in the timeline below. Reopen it if they come back.</p>
        </div>
        <button disabled={isPending} onClick={() => setStatus('contacted')} className="btn-ghost inline-flex items-center gap-1.5 text-xs">
          <RotateCcw size={13} strokeWidth={1.9} /> Reopen lead
        </button>
      </div>
    );
  }

  // ── Active pipeline ──
  const currentIndex = BUCKET[currentStatus] ?? 0;
  const meta = STAGES[currentIndex];
  const atOffer = currentIndex >= 4;

  return (
    <div className="space-y-3">
      {/* Five-stage stepper */}
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const reached = i <= currentIndex;
          return (
            <button
              key={stage.key}
              disabled={isPending}
              onClick={() => setStatus(stage.key)}
              title={`${stage.meaning} → ${stage.next}`}
              className={`flex-1 rounded px-2 py-2 text-center text-xs font-medium transition-colors ${
                reached ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'
              }`}
            >
              {stage.label}
            </button>
          );
        })}
      </div>

      {/* Current-stage caption — what it means + the next step to advance */}
      {meta && (
        <p className="text-xs text-charcoal-600/75">
          <span className="font-medium text-charcoal">{meta.label}:</span> {meta.meaning}
          {meta.next && <span className="text-charcoal-600/60"> Next: {meta.next}</span>}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {/* Mark won — available once an offer is on the table */}
        {atOffer && (
          <button
            disabled={isPending}
            onClick={() => setStatus('won')}
            className="inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-forest-deep"
          >
            <Trophy size={12} strokeWidth={2.1} /> Mark as won
          </button>
        )}

        {/* Close lead — plain-language, always available */}
        {!closing && (
          <button
            disabled={isPending}
            onClick={() => setClosing(true)}
            className="text-xs font-medium text-charcoal-600/70 underline-offset-2 hover:text-signal-danger hover:underline"
          >
            Lead not interested? Close lead
          </button>
        )}
      </div>

      {/* Close-lead outcome picker */}
      {closing && (
        <div className="space-y-3 rounded-lg border border-stone-line bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-charcoal">Why is this lead closing?</p>
            <button onClick={() => { setClosing(false); setReason(''); }} className="text-charcoal-600/50 hover:text-charcoal"><X size={15} /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {OUTCOMES.map((o) => (
              <button
                key={o.key}
                disabled={isPending}
                onClick={() => confirmOutcome(o.status, o.label)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${
                  o.tone === 'dead'
                    ? 'border-stone-line text-charcoal hover:border-signal-danger/40 hover:bg-signal-danger/[0.04] hover:text-signal-danger'
                    : 'border-stone-line text-charcoal hover:border-champagne/60 hover:bg-champagne-50/60'
                }`}
              >
                <Check size={12} strokeWidth={2.2} className="shrink-0 opacity-0" /> {o.label}
              </button>
            ))}
          </div>
          <div>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a detail (optional) — e.g. wanted 3-bed, we only had 2"
              className="w-full rounded-md border border-stone-line bg-sand-50 px-3 py-2 text-xs text-charcoal placeholder:text-charcoal-600/40 focus:border-forest focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-charcoal-600/50">Pick a reason above — your detail is saved to the lead's timeline, and open tasks are cleared.</p>
          </div>
        </div>
      )}
    </div>
  );
}
