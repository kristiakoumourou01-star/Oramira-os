'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Check, RotateCcw, GripVertical } from 'lucide-react';
import { useDragSort, moveItem } from '@/components/ui/useDragSort';
import { saveProjectPlan, saveUnitPlan } from '@/app/actions/pricing';
import { PLAN_WHEN, DEFAULT_PLAN, planAmounts, planProblem, planTotal, whenText, type PlanStep, type PlanWhen } from '@/lib/pricing-shared';
import { formatCurrency } from '@/lib/format';

type Target = { kind: 'project'; projectId: string } | { kind: 'unit'; projectId: string; unitId: string; custom: boolean };

/**
 * Πρόγραμμα πληρωμών: δόσεις σε % της τιμής. Για το έργο (βασικό) ή για μία
 * μονάδα (δικό της, με επιστροφή στο του έργου).
 */
export function PaymentPlanEditor({ initial, target, price, canEdit, projectPlan }: {
  initial: PlanStep[]; target: Target; price: number | null; canEdit: boolean; projectPlan?: PlanStep[];
}) {
  const router = useRouter();
  const [steps, setSteps] = useState<PlanStep[]>(initial.length ? initial : target.kind === 'project' ? DEFAULT_PLAN : projectPlan ?? DEFAULT_PLAN);
  const [editing, setEditing] = useState(target.kind === 'project' && canEdit);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const sample = price && price > 0 ? price : 250000;
  const amounts = planAmounts(steps, sample);
  const problem = planProblem(steps);
  const set = (i: number, p: Partial<PlanStep>) => { setSteps((s) => s.map((x, j) => (j === i ? { ...x, ...p } : x))); setMsg(null); };
  const dnd = useDragSort((from, to) => setSteps((s) => moveItem(s, from, to)), canEdit, 'plan');
  const fillRest = () => { const rest = Math.round((100 - planTotal(steps)) * 100) / 100; if (rest > 0) setSteps((s) => [...s, { label: 'Υπόλοιπο', pct: rest, when: 'handover' }]); };

  const save = () => start(async () => {
    const r = target.kind === 'project' ? await saveProjectPlan(target.projectId, steps) : await saveUnitPlan(target.unitId, target.projectId, steps);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); if (target.kind === 'unit') setEditing(false); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });
  const reset = () => start(async () => {
    if (target.kind !== 'unit') return;
    const r = await saveUnitPlan(target.unitId, target.projectId, null);
    if (r.ok) { setSteps(projectPlan ?? DEFAULT_PLAN); setEditing(false); setMsg({ ok: true, text: 'Ακολουθεί ξανά το πρόγραμμα του έργου.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  if (!editing) {
    return (
      <div className="space-y-2">
        <table className="table-base w-full">
          <thead><tr><th>#</th><th>Δόση</th><th>Πότε</th><th className="text-right">%</th><th className="text-right">Ποσό</th></tr></thead>
          <tbody>
            {steps.map((s, i) => (
              <tr key={i}>
                <td className="figure">{i + 1}</td><td>{s.label}</td><td className="text-charcoal-600">{whenText(s)}</td>
                <td className="figure text-right">{s.pct}%</td><td className="figure text-right">{price ? formatCurrency(amounts[i]) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap items-center gap-2 text-xs text-charcoal-600/70">
          <span>{target.kind === 'unit' && (target.custom ? 'Δικό της πρόγραμμα για αυτή τη μονάδα.' : 'Το πρόγραμμα του έργου.')}</span>
          {canEdit && target.kind === 'unit' && <button type="button" onClick={() => setEditing(true)} className="btn-secondary px-2.5 py-1 text-xs">Προσαρμογή για αυτή τη μονάδα</button>}
          {canEdit && target.kind === 'unit' && target.custom && <button type="button" disabled={pending} onClick={reset} className="text-xs hover:text-forest"><RotateCcw size={11} className="mr-1 inline" />Όπως το έργο</button>}
          {msg && <span className={msg.ok ? 'text-signal-success' : 'text-signal-danger'}>{msg.text}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {steps.map((s, i) => (
          <div key={i} {...dnd.item(i)} className={`space-y-1.5 rounded-md border border-stone-line p-2 ${dnd.cls(i)}`}>
            <div className="flex items-center gap-2">
              {canEdit && <span className="cursor-grab text-charcoal-600/40 active:cursor-grabbing" title="Σύρετε για αλλαγή σειράς"><GripVertical size={14} /></span>}
              <span className="w-5 text-xs text-charcoal-600/60 figure">{i + 1}</span>
              <input className="input min-w-0 flex-1 py-1.5 text-sm" value={s.label} disabled={!canEdit} onChange={(e) => set(i, { label: e.target.value })} placeholder="Ονομασία δόσης" />
              <div className="relative w-20 shrink-0">
                <input className="input py-1.5 pr-6 text-right text-sm" type="number" step="0.5" min={0} max={100} value={s.pct} disabled={!canEdit} onChange={(e) => set(i, { pct: Number(e.target.value) })} />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-charcoal-600/60">%</span>
              </div>
              <span className="figure w-24 shrink-0 text-right text-sm">{formatCurrency(amounts[i])}</span>
              {canEdit && (
                <span className="flex shrink-0 gap-1 text-charcoal-600/60">
                  <button type="button" title="Διαγραφή" onClick={() => setSteps((x) => x.filter((_, j) => j !== i))} className="hover:text-signal-danger"><Trash2 size={13} /></button>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 pl-7">
              <select className="input w-auto py-1 text-xs" value={s.when} disabled={!canEdit} onChange={(e) => set(i, { when: e.target.value as PlanWhen, ...(e.target.value === 'days_after_contract' && s.days == null ? { days: 30 } : {}) })}>
                {PLAN_WHEN.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
              </select>
              {s.when === 'days_after_contract' && <label className="flex items-center gap-1 text-xs"><input className="input w-20 py-1 text-xs" type="number" min={0} value={s.days ?? 30} disabled={!canEdit} onChange={(e) => set(i, { days: Number(e.target.value) })} /> μέρες</label>}
              {s.when === 'date' && <input className="input w-auto py-1 text-xs" type="date" value={s.date ?? ''} disabled={!canEdit} onChange={(e) => set(i, { date: e.target.value })} />}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {canEdit && <button type="button" onClick={() => setSteps((s) => [...s, { label: 'Νέα δόση', pct: 10, when: 'contract' }])} className="btn-secondary px-2.5 py-1 text-xs"><Plus size={12} /> Δόση</button>}
        {canEdit && planTotal(steps) < 100 && <button type="button" onClick={fillRest} className="text-xs text-forest hover:underline">Συμπλήρωση υπολοίπου ({Math.round((100 - planTotal(steps)) * 100) / 100}%)</button>}
        <span className={`text-xs ${problem ? 'text-signal-danger' : 'text-signal-success'}`}>Σύνολο {planTotal(steps)}%{problem ? '' : ' ✓'}</span>
        <span className="text-xs text-charcoal-600/60">Ποσά για τιμή {formatCurrency(sample)}{price ? '' : ' (παράδειγμα)'}</span>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={pending || !!problem} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {target.kind === 'unit' && <button type="button" onClick={() => { setEditing(false); setSteps(initial.length ? initial : projectPlan ?? DEFAULT_PLAN); setMsg(null); }} className="btn-secondary">Άκυρο</button>}
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {problem && <span className="text-xs text-signal-danger">{problem}</span>}
        </div>
      )}
    </div>
  );
}
