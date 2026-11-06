'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { HardHat, Droplets, Zap, Wifi, KeyRound, Plus, Trash2, Check } from 'lucide-react';
import { updateHouseLifecycle } from '@/app/actions/property';

export interface ChecklistItem { label: string; done: boolean }
const UTILITY = [
  { v: 'not_connected', label: 'Not connected' },
  { v: 'pending', label: 'Pending' },
  { v: 'active', label: 'Active' },
];
const UTILITY_CLASS: Record<string, string> = { active: 'text-signal-success', pending: 'text-signal-warning', not_connected: 'text-charcoal-600/50' };

/** House lifecycle: construction progress, utility setup, key-handover checklist. */
export function HouseLifecycle({
  unitId, projectId, constructionProgress, water, electricity, internet, checklist,
}: {
  unitId: string; projectId: string;
  constructionProgress: number; water: string; electricity: string; internet: string; checklist: ChecklistItem[];
}) {
  const [progress, setProgress] = useState(constructionProgress);
  const [util, setUtil] = useState({ water, electricity, internet });
  const [items, setItems] = useState<ChecklistItem[]>(checklist);
  const [newItem, setNewItem] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save(next?: Partial<{ constructionProgress: number; utilityWater: string; utilityElectricity: string; utilityInternet: string; handoverChecklist: ChecklistItem[] }>) {
    startTransition(async () => {
      await updateHouseLifecycle({
        unitId, projectId,
        constructionProgress: progress,
        utilityWater: util.water, utilityElectricity: util.electricity, utilityInternet: util.internet,
        handoverChecklist: items,
        ...next,
      });
      router.refresh();
    });
  }

  function toggleItem(i: number) {
    const next = items.map((it, idx) => (idx === i ? { ...it, done: !it.done } : it));
    setItems(next);
    save({ handoverChecklist: next });
  }
  function addItem() {
    if (!newItem.trim()) return;
    const next = [...items, { label: newItem.trim(), done: false }];
    setItems(next);
    setNewItem('');
    save({ handoverChecklist: next });
  }
  function removeItem(i: number) {
    const next = items.filter((_, idx) => idx !== i);
    setItems(next);
    save({ handoverChecklist: next });
  }

  const utilRow = (key: 'water' | 'electricity' | 'internet', label: string, Icon: any) => (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-2 text-charcoal-600/80"><Icon size={14} className={UTILITY_CLASS[util[key]]} strokeWidth={1.75} /> {label}</span>
      <select value={util[key]} onChange={(e) => { const u = { ...util, [key]: e.target.value }; setUtil(u); save({ [`utility${key[0].toUpperCase()}${key.slice(1)}` as any]: e.target.value }); }} className="rounded border border-stone-line bg-white px-2 py-1 text-xs">
        {UTILITY.map((o) => <option key={o.v} value={o.v}>{o.label}</option>)}
      </select>
    </div>
  );

  return (
    <div className="panel p-6">
      <h4 className="mb-4 flex items-center gap-2"><HardHat size={15} className="text-olive" strokeWidth={1.75} /> House lifecycle</h4>

      {/* Construction progress */}
      <div className="mb-5">
        <div className="mb-1 flex items-center justify-between text-sm">
          <span className="text-charcoal-600/80">Construction progress</span>
          <span className="figure text-charcoal">{progress}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-stone-200">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${progress}%` }} />
        </div>
        <input type="range" min={0} max={100} step={5} value={progress} onChange={(e) => setProgress(Number(e.target.value))} onMouseUp={() => save()} onTouchEnd={() => save()} className="mt-2 w-full" />
      </div>

      {/* Utilities */}
      <div className="mb-5 space-y-2 border-t border-stone-line pt-4">
        <p className="eyebrow mb-1">Utility setup</p>
        {utilRow('water', 'Water', Droplets)}
        {utilRow('electricity', 'Electricity', Zap)}
        {utilRow('internet', 'Internet', Wifi)}
      </div>

      {/* Handover checklist */}
      <div className="border-t border-stone-line pt-4">
        <p className="eyebrow mb-2 flex items-center gap-1"><KeyRound size={11} strokeWidth={1.75} /> Key handover checklist</p>
        {items.length === 0 && <p className="mb-2 text-sm text-charcoal-600/60">No checklist items yet.</p>}
        <ul className="mb-2 space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex items-center justify-between gap-2 text-sm">
              <button onClick={() => toggleItem(i)} disabled={isPending} className="flex items-center gap-2 text-left">
                <span className={`flex h-4 w-4 items-center justify-center rounded border ${it.done ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>{it.done && <Check size={11} />}</span>
                <span className={it.done ? 'text-charcoal-600/50 line-through' : 'text-charcoal'}>{it.label}</span>
              </button>
              <button onClick={() => removeItem(i)} disabled={isPending} className="text-charcoal-600/40 hover:text-signal-danger"><Trash2 size={13} /></button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <input value={newItem} onChange={(e) => setNewItem(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } }} placeholder="Add checklist item…" className="input flex-1 text-sm" />
          <button onClick={addItem} disabled={isPending || !newItem.trim()} className="btn-secondary text-sm"><Plus size={14} strokeWidth={1.75} /></button>
        </div>
      </div>
    </div>
  );
}
