'use client';

import { useState, useTransition } from 'react';
import { BookMarked, Search, Plus, Loader2 } from 'lucide-react';
import { searchMemoryEntries, addMemoryEntry } from '@/app/actions/memory';
import { MEMORY_KINDS, type MemoryEntry, type MemoryKind } from '@/lib/executive-memory';
import { formatDate } from '@/lib/format';

const KIND_CLS: Record<string, string> = {
  decision: 'bg-forest/10 text-forest', negotiation: 'bg-champagne-50 text-champagne-600', owner: 'bg-sky-500/10 text-sky-700',
  project: 'bg-olive/10 text-olive', employee: 'bg-violet-500/10 text-violet-700', risk: 'bg-signal-danger/10 text-signal-danger',
};
const IMP: Record<string, string> = { high: 'text-signal-danger', normal: 'text-charcoal-600/50', low: 'text-charcoal-600/40' };

/** Executive memory — searchable institutional record + manual capture. */
export function MemoryPanel({ initial }: { initial: MemoryEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [term, setTerm] = useState('');
  const [kind, setKind] = useState('');
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ kind: MemoryKind; title: string; body: string; importance: 'low' | 'normal' | 'high' }>({ kind: 'decision', title: '', body: '', importance: 'normal' });

  const refresh = () => start(async () => setEntries(await searchMemoryEntries(term, kind)));
  const save = () => start(async () => {
    const res = await addMemoryEntry(form);
    if (res.ok) { setForm({ kind: 'decision', title: '', body: '', importance: 'normal' }); setAdding(false); setEntries(await searchMemoryEntries(term, kind)); }
  });

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="panel flex flex-wrap items-center gap-2 p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/40" />
          <input value={term} onChange={(e) => setTerm(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && refresh()} placeholder="Search decisions, negotiations, owners, risks…" className="w-full rounded-lg border border-stone-line bg-white py-2 pl-9 pr-3 text-sm focus-visible:border-forest focus-visible:outline-none" />
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-stone-line bg-white px-3 py-2 text-sm capitalize">
          <option value="">All kinds</option>
          {MEMORY_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <button onClick={refresh} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line px-3 py-2 text-sm text-charcoal-600 hover:bg-sand-100">{pending ? <Loader2 size={14} className="animate-spin" /> : 'Search'}</button>
        <button onClick={() => setAdding((v) => !v)} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-sm text-white hover:bg-forest/90"><Plus size={14} /> Add</button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="panel space-y-3 p-4">
          <div className="flex gap-2">
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as MemoryKind })} className="rounded-lg border border-stone-line bg-white px-3 py-2 text-sm capitalize">
              {MEMORY_KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </select>
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title (e.g. Agreed 3% discount with the Petrov family)" className="flex-1 rounded-lg border border-stone-line bg-white px-3 py-2 text-sm focus-visible:border-forest focus-visible:outline-none" />
            <select value={form.importance} onChange={(e) => setForm({ ...form, importance: e.target.value as any })} className="rounded-lg border border-stone-line bg-white px-3 py-2 text-sm">
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </select>
          </div>
          <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Context, rationale, what to remember…" rows={3} className="w-full rounded-lg border border-stone-line bg-white px-3 py-2 text-sm focus-visible:border-forest focus-visible:outline-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdding(false)} className="rounded-lg border border-stone-line px-3 py-1.5 text-sm text-charcoal-600">Cancel</button>
            <button onClick={save} disabled={pending || !form.title.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-1.5 text-sm text-white disabled:opacity-50">{pending ? <Loader2 size={14} className="animate-spin" /> : 'Save entry'}</button>
          </div>
        </div>
      )}

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="panel p-6 text-sm text-charcoal-600/60"><BookMarked size={16} className="mb-2 text-champagne-600" /> No memory entries yet. The system auto-captures won/lost deals, closed negotiations, and resolved emergencies daily — or add your own above.</div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className="panel p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${KIND_CLS[e.kind] ?? 'bg-sand-100 text-charcoal-600'}`}>{e.kind}</span>
                    <span className="text-sm font-medium text-charcoal">{e.title}</span>
                  </div>
                  {e.body && <p className="text-sm text-charcoal-600/75">{e.body}</p>}
                  {e.tags.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{e.tags.map((t) => <span key={t} className="rounded bg-sand-100 px-1.5 py-0.5 text-[10px] text-charcoal-600/60">#{t}</span>)}</div>}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-[10px] uppercase tracking-wide ${IMP[e.importance] ?? IMP.normal}`}>{e.importance}</p>
                  <p className="figure text-[11px] text-charcoal-600/45">{formatDate(new Date(e.created_at))}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
