'use client';

import { useState, useTransition } from 'react';
import { Network, Search, Sparkles, Loader2 } from 'lucide-react';
import { lookupContactGraph } from '@/app/actions/knowledge';
import type { KnowledgeOverview, ContactGraph } from '@/lib/knowledge-graph';
import { formatNumber } from '@/lib/format';

/** Company knowledge graph — node/edge overview, relationship highlights, and a
 *  per-contact 360° lookup for relationship intelligence. */
export function KnowledgePanel({ overview, contacts }: { overview: KnowledgeOverview; contacts: { id: string; name: string }[] }) {
  const [term, setTerm] = useState('');
  const [graph, setGraph] = useState<ContactGraph | null>(null);
  const [pending, start] = useTransition();

  const match = contacts.find((c) => c.name.toLowerCase() === term.toLowerCase().trim());
  function run() {
    if (!match) return;
    start(async () => setGraph(await lookupContactGraph(match!.id)));
  }

  return (
    <div className="space-y-5">
      {/* Node/edge overview */}
      <div className="panel p-6">
        <h4 className="mb-4 flex items-center gap-2 text-forest"><Network size={16} strokeWidth={1.8} /> Knowledge graph · {formatNumber(overview.edges)} connections</h4>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {overview.nodes.map((n) => (
            <div key={n.type} className="rounded-lg bg-sand-100/50 p-3 text-center">
              <p className="figure text-xl text-forest">{n.count}</p>
              <p className="text-[10px] uppercase tracking-wide text-charcoal-600/50">{n.type}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Relationship highlights */}
      <div className="panel p-6">
        <h4 className="mb-3 flex items-center gap-2 text-forest"><Sparkles size={15} className="text-champagne-600" strokeWidth={1.8} /> Relationship intelligence</h4>
        {overview.highlights.length === 0 ? <p className="text-sm text-charcoal-600/60">No cross-role relationships surfaced yet.</p> : (
          <ul className="space-y-2">
            {overview.highlights.map((h, i) => (
              <li key={i} className={`rounded-lg border p-3 ${h.severity === 'opportunity' ? 'border-forest/20 bg-forest/5' : 'border-stone-line bg-white'}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-charcoal">{h.title}</span>
                  {h.href && <a href={h.href} className="shrink-0 text-xs text-forest hover:underline">Open →</a>}
                </div>
                <p className="mt-0.5 text-xs text-charcoal-600/70">{h.detail}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Contact 360 lookup */}
      <div className="panel p-6">
        <h4 className="mb-3 text-forest">Contact 360°</h4>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/40" />
            <input list="kg-contacts" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search a contact by name…" className="w-full rounded-lg border border-stone-line bg-white py-2 pl-9 pr-3 text-sm focus-visible:border-forest focus-visible:outline-none" />
            <datalist id="kg-contacts">{contacts.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          </div>
          <button onClick={run} disabled={!match || pending} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-sm text-white disabled:opacity-50">{pending ? <Loader2 size={14} className="animate-spin" /> : 'Map'}</button>
        </div>

        {graph && (
          <div className="mt-4 rounded-lg border border-stone-line p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium text-charcoal">{graph.name}</span>
              {graph.roles.map((r) => <span key={r} className="rounded bg-champagne-50 px-1.5 py-0.5 text-[10px] text-champagne-600">{r}</span>)}
            </div>
            {graph.connections.length === 0 ? <p className="text-xs text-charcoal-600/60">No connections on record.</p> : (
              <ul className="space-y-1.5">
                {graph.connections.map((c, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span className="text-charcoal-600/80"><span className="text-[11px] uppercase tracking-wide text-charcoal-600/45">{c.relation}</span> · {c.label}</span>
                    {c.href && <a href={c.href} className="text-xs text-forest hover:underline">Open</a>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
