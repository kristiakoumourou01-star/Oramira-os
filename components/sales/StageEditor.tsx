'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GripVertical, Plus, Trash2, X } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { FLOW, STATUS_EL, slugKey, type FlowStatus, type PipelineSettings, type StageDef } from '@/lib/pipeline-shared';
import { useDragSort, moveItem } from '@/components/ui/useDragSort';

/**
 * «Επεξεργασία pipeline» μέσα από τον πίνακα Deals (όπως Pipedrive): όνομα,
 * στάδια (προσθήκη, μετονομασία, διαγραφή, σειρά με σύρσιμο), πιθανότητα,
 * όριο ημερών («σάπιο»). Το «Κλείσιμο (Won)» μένει πάντα τελευταίο.
 */
export function StageEditor({ cfg, pipelineKey, onClose }: { cfg: PipelineSettings; pipelineKey: string; onClose: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const src = cfg.pipelines.find((p) => p.key === pipelineKey) ?? cfg.pipelines[0];
  const [name, setName] = useState(src.name);
  const [stages, setStages] = useState<StageDef[]>(src.stages.filter((s) => s.status !== 'won'));
  const won = src.stages.find((s) => s.status === 'won') ?? { key: 'won', status: 'won' as const, label: STATUS_EL.won, probability: 100, maxDays: null };
  const [wonLabel, setWonLabel] = useState(won.label);
  const [err, setErr] = useState<string | null>(null);
  const dnd = useDragSort((from, to) => setStages((s) => moveItem(s, from, to)), true, 'stages');
  const set = (i: number, p: Partial<StageDef>) => setStages((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const add = () => setStages((s) => [...s, { key: slugKey('stage', [...s.map((x) => x.key), 'won']), status: (s.at(-1)?.status ?? 'contacted') as FlowStatus, label: 'Νέο στάδιο', probability: Math.min(95, (s.at(-1)?.probability ?? 0) + 10), maxDays: 7 }]);
  const save = () => start(async () => {
    if (!name.trim()) { setErr('Δώστε όνομα στο pipeline.'); return; }
    if (stages.some((s) => !s.label.trim())) { setErr('Κάθε στάδιο χρειάζεται όνομα.'); return; }
    const next: PipelineSettings = { ...cfg, pipelines: cfg.pipelines.map((p) => (p.key === src.key ? { ...p, name: name.trim(), stages: [...stages, { ...won, label: wonLabel.trim() || won.label }] } : p)) };
    const r = await saveOrgSlice('pipelines', next);
    if (!r.ok) { setErr(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-3">
          <p className="font-semibold text-charcoal">Επεξεργασία pipeline</p>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600/60 hover:text-charcoal"><X size={18} /></button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          <label className="block"><span className="text-xs text-charcoal-600/70">Όνομα pipeline</span><input className="input font-medium" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="hidden gap-2 px-1 text-[11px] uppercase tracking-wide text-charcoal-600/60 sm:flex"><span className="w-5" /><span className="flex-1">Στάδιο</span><span className="w-36">Σημαίνει</span><span className="w-20">Πιθανότ.</span><span className="w-20">Όριο ημ.</span><span className="w-6" /></div>
          <ul className="space-y-1.5">
            {stages.map((s, i) => (
              <li key={s.key} {...dnd.item(i)} className={`flex flex-wrap items-center gap-2 rounded-lg border border-stone-line bg-white p-2 sm:flex-nowrap ${dnd.cls(i)}`}>
                <span className="cursor-grab text-charcoal-600/40 active:cursor-grabbing" title="Σύρετε για αλλαγή σειράς"><GripVertical size={16} /></span>
                <input className="input min-w-[8rem] flex-1 py-1 text-sm" value={s.label} maxLength={40} onChange={(e) => set(i, { label: e.target.value })} aria-label="Όνομα σταδίου" />
                <select className="input w-36 py-1 text-sm" value={s.status} onChange={(e) => set(i, { status: e.target.value as FlowStatus })} aria-label="Σημαίνει" title="Τι σημαίνει για το σύστημα (αυτοματισμοί, αναφορές)">
                  {FLOW.filter((f) => f !== 'won').map((f) => <option key={f} value={f}>{STATUS_EL[f] ?? f}</option>)}
                </select>
                <label className="flex w-20 items-center gap-1 text-xs text-charcoal-600/70"><input className="input py-1 text-right text-sm" type="number" min={0} max={100} value={s.probability} onChange={(e) => set(i, { probability: Number(e.target.value) })} aria-label="Πιθανότητα" />%</label>
                <label className="flex w-20 items-center gap-1 text-xs text-charcoal-600/70"><input className="input py-1 text-right text-sm" type="number" min={1} max={365} placeholder="∞" value={s.maxDays ?? ''} onChange={(e) => set(i, { maxDays: e.target.value === '' ? null : Number(e.target.value) })} aria-label="Όριο ημερών" />μ.</label>
                <button type="button" disabled={stages.length <= 1} onClick={() => setStages((x) => x.filter((_, j) => j !== i))} className="w-6 text-charcoal-600/50 hover:text-signal-danger disabled:opacity-20" aria-label="Διαγραφή σταδίου" title="Διαγραφή σταδίου"><Trash2 size={15} /></button>
              </li>
            ))}
            <li className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2">
              <span className="w-5" />
              <input className="input flex-1 py-1 text-sm" value={wonLabel} onChange={(e) => setWonLabel(e.target.value)} aria-label="Όνομα σταδίου κλεισίματος" />
              <span className="text-xs text-emerald-700">Κλείσιμο (Won) · πάντα τελευταίο · 100%</span>
            </li>
          </ul>
          <button type="button" onClick={add} className="btn-secondary text-sm"><Plus size={14} /> Νέο στάδιο</button>
          <p className="text-xs text-charcoal-600/60">Ένα deal σε στάδιο που διαγράφετε εμφανίζεται στο στάδιο με την ίδια σημασία ή στο προηγούμενο. Lost / Δεν ενδιαφέρεται, labels και πηγές: <Link href="/settings?section=pipelines" className="text-forest hover:underline">Ρυθμίσεις → Pipelines & φόρμες</Link>.</p>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-5 py-3">
          <button type="button" className="btn-ghost" onClick={onClose}>Άκυρο</button>
          <button type="button" className="btn-primary" disabled={pending} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
        </div>
      </div>
    </div>
  );
}
