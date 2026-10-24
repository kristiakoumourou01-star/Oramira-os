import { Sparkles, Gauge, MessageSquareWarning, Handshake, Clock, Palette } from 'lucide-react';
import type { SalesStrategy } from '@/lib/sales-assistant';

const INTENT: Record<string, string> = { high: 'badge-forest', medium: 'badge-champagne', low: 'badge-neutral' };

/** Advanced AI sales-assistant guidance: buyer intent, objection handling, a
 *  negotiation move, best time to follow up, and tone adaptation. */
export function AssistantStrategy({ strategy }: { strategy: SalesStrategy }) {
  const s = strategy;
  return (
    <div className="panel p-6">
      <h4 className="mb-4 flex items-center gap-2"><Sparkles size={15} className="text-champagne-600" strokeWidth={1.8} /> AI sales assistant</h4>

      <div className="mb-4 rounded-lg border border-stone-line p-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="eyebrow flex items-center gap-1.5"><Gauge size={12} className="text-olive" /> Buyer intent</p>
          <span className={INTENT[s.intent.label]}>{s.intent.label} · {s.intent.score}</span>
        </div>
        <p className="text-sm text-charcoal-600/85">{s.intent.note}</p>
      </div>

      <div className="mb-4">
        <p className="eyebrow mb-2 flex items-center gap-1.5"><MessageSquareWarning size={12} className="text-olive" /> Objection handling</p>
        <ul className="space-y-2">
          {s.objections.map((o) => (
            <li key={o.point} className="rounded-lg bg-sand-100/60 p-2.5">
              <p className="text-xs font-medium text-charcoal">{o.point}</p>
              <p className="mt-0.5 text-xs text-charcoal-600/80">{o.response}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-3 rounded-lg border border-stone-line p-3">
        <p className="eyebrow mb-1 flex items-center gap-1.5"><Handshake size={12} className="text-olive" /> Negotiation move</p>
        <p className="text-sm text-charcoal-600/85">{s.negotiation}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-stone-line p-3">
          <p className="eyebrow mb-1 flex items-center gap-1.5"><Clock size={12} className="text-olive" /> Best time to follow up</p>
          <p className="text-sm text-charcoal-600/85">{s.bestFollowUp}</p>
        </div>
        <div className="rounded-lg border border-stone-line p-3">
          <p className="eyebrow mb-1 flex items-center gap-1.5"><Palette size={12} className="text-olive" /> Tone to use</p>
          <p className="text-sm text-charcoal-600/85">{s.tone}</p>
        </div>
      </div>
    </div>
  );
}
