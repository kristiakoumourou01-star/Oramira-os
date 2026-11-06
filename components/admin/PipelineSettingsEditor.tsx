'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, Star, ChevronDown, ChevronRight, ChevronUp, FileText, X } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { FLOW, STATUS_EL, slugKey, type FlowStatus, type PipelineDef, type PipelineSettings, type StageDef } from '@/lib/pipeline-shared';

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;

/** Settings → Pipelines & φόρμες: pipelines, στάδια με όρια ημερών, λόγοι απώλειας, πηγές, προμήθεια. */
export function PipelineSettingsEditor({ initial, canEdit, vatRates }: { initial: PipelineSettings; canEdit: boolean; vatRates: number[] }) {
  const router = useRouter();
  const [v, setV] = useState<PipelineSettings>(initial);
  const [open, setOpen] = useState<string | null>(initial.pipelines[0]?.key ?? null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [src, setSrc] = useState('');
  const dis = !canEdit;
  const patch = (p: Partial<PipelineSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const setPipe = (key: string, p: Partial<PipelineDef>) => patch({ pipelines: v.pipelines.map((q) => (q.key === key ? { ...q, ...p } : q)) });
  const stagesOf = (key: string) => v.pipelines.find((q) => q.key === key)!.stages;
  const setStage = (key: string, i: number, p: Partial<StageDef>) => setPipe(key, { stages: stagesOf(key).map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const moveStage = (key: string, i: number, d: -1 | 1) => {
    const st = [...stagesOf(key)]; const j = i + d;
    if (j < 0 || j >= st.length || st[i].status === 'won' || st[j].status === 'won') return;
    [st[i], st[j]] = [st[j], st[i]]; setPipe(key, { stages: st });
  };
  const removeStage = (key: string, i: number) => {
    const st = stagesOf(key);
    if (st[i].status === 'won' || (st[i].status === 'new' && st.filter((x) => x.status === 'new').length === 1)) return;
    setPipe(key, { stages: st.filter((_, j) => j !== i) });
  };
  const addStage = (key: string) => {
    const st = stagesOf(key);
    const label = 'Νέο στάδιο';
    const s2: StageDef = { key: slugKey(label, st.map((x) => x.key)), status: 'qualified', label, probability: 50, maxDays: 7 };
    setPipe(key, { stages: [...st.slice(0, -1), s2, st[st.length - 1]] }); // πριν το «κλείσιμο»
  };
  const addPipe = () => {
    const key = slugKey('pipeline', v.pipelines.map((p) => p.key));
    patch({ pipelines: [...v.pipelines, { key, name: 'Νέο pipeline', stages: [{ key: 'new', status: 'new', label: 'Νέο', probability: 5, maxDays: 2 }, { key: 'contacted', status: 'contacted', label: 'Επικοινωνία', probability: 20, maxDays: 5 }, { key: 'offer', status: 'offer', label: 'Προσφορά', probability: 60, maxDays: 10 }, { key: 'won', status: 'won', label: 'Κλείσιμο', probability: 100, maxDays: null }] }] });
    setOpen(key);
  };
  const save = () => start(async () => { const r = await saveOrgSlice('pipelines', v); if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error }); });
  const c = v.commission;
  const setC = (p: Partial<PipelineSettings['commission']>) => patch({ commission: { ...c, ...p } });

  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h4>Pipelines</h4>
            <p className="text-xs text-charcoal-600/60">Φτιάξτε όσα στάδια θέλετε, με δικά σας ονόματα και σειρά. Το «Σημαίνει» λέει στο σύστημα τι είναι το στάδιο (για αυτοματισμούς, αναφορές και προμήθειες). Η πιθανότητα μετρά στις προβλέψεις· αν ένα lead μείνει περισσότερες μέρες από το όριο, φαίνεται «σε καθυστέρηση» και ο υπεύθυνος ειδοποιείται.</p>
          </div>
          {canEdit && v.pipelines.length < 12 && <button type="button" onClick={addPipe} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Pipeline</button>}
        </div>
        {v.pipelines.map((p) => {
          const isOpen = open === p.key; const isDef = v.defaultKey === p.key;
          return (
            <div key={p.key} className="rounded-md border border-stone-line">
              <div className="flex items-center gap-2 px-3 py-2">
                <button type="button" onClick={() => setOpen(isOpen ? null : p.key)} className="text-charcoal-600">{isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}</button>
                <input className="input flex-1 py-1 text-sm font-medium" disabled={dis} value={p.name} onChange={(e) => setPipe(p.key, { name: e.target.value })} />
                <button type="button" disabled={dis} title="Προεπιλογή για τα νέα leads" onClick={() => patch({ defaultKey: p.key })} className={isDef ? 'text-champagne' : 'text-charcoal-600/40 hover:text-champagne'}><Star size={15} className={isDef ? 'fill-champagne' : ''} /></button>
                <span className="text-xs text-charcoal-600/60">{p.stages.length} στάδια</span>
                {canEdit && v.pipelines.length > 1 && <button type="button" onClick={() => { if (window.confirm(`Διαγραφή του «${p.name}»; Τα leads του πάνε στο προεπιλεγμένο.`)) patch({ pipelines: v.pipelines.filter((q) => q.key !== p.key), defaultKey: isDef ? v.pipelines.find((q) => q.key !== p.key)!.key : v.defaultKey }); }} className="text-charcoal-600/40 hover:text-signal-danger"><Trash2 size={14} /></button>}
              </div>
              {isOpen && (
                <div className="border-t border-stone-line p-3">
                  <div className="hidden grid-cols-[52px_1.4fr_1fr_80px_80px_28px] items-center gap-2 text-[11px] text-charcoal-600/70 sm:grid">
                    <span /><span>Όνομα σταδίου</span><span>Σημαίνει</span><span>Πιθανότητα %</span><span>Έως μέρες</span><span />
                  </div>
                  {p.stages.map((st, i) => {
                    const won = st.status === 'won';
                    const lastNew = st.status === 'new' && p.stages.filter((x) => x.status === 'new').length === 1;
                    return (
                      <div key={st.key} className="mt-1 grid grid-cols-[52px_1.4fr_1fr_80px_80px_28px] items-center gap-2">
                        <span className="flex text-charcoal-600/50">
                          <button type="button" disabled={dis || i === 0 || won} onClick={() => moveStage(p.key, i, -1)} aria-label="Πάνω" className="disabled:opacity-20 hover:text-forest"><ChevronUp size={15} /></button>
                          <button type="button" disabled={dis || won || i >= p.stages.length - 2} onClick={() => moveStage(p.key, i, 1)} aria-label="Κάτω" className="disabled:opacity-20 hover:text-forest"><ChevronDown size={15} /></button>
                        </span>
                        <input className="input py-1 text-sm" disabled={dis} value={st.label} maxLength={40} onChange={(e) => setStage(p.key, i, { label: e.target.value })} />
                        <select className="input py-1 text-sm" disabled={dis || won || lastNew} value={st.status} onChange={(e) => setStage(p.key, i, { status: e.target.value as FlowStatus })}>
                          {FLOW.filter((f) => f !== 'won' || won).map((f) => <option key={f} value={f}>{STATUS_EL[f]}</option>)}
                        </select>
                        <input className="input py-1 text-right text-sm" type="number" min={0} max={100} disabled={dis} value={st.probability} onChange={(e) => setStage(p.key, i, { probability: Number(e.target.value) })} />
                        {won ? <span className="text-center text-xs text-charcoal-600/50">—</span>
                          : <input className="input py-1 text-right text-sm" type="number" min={1} max={365} placeholder="∞" disabled={dis} value={st.maxDays ?? ''} onChange={(e) => setStage(p.key, i, { maxDays: e.target.value === '' ? null : Number(e.target.value) })} />}
                        {canEdit && !won && !lastNew
                          ? <button type="button" onClick={() => { if (window.confirm(`Διαγραφή του σταδίου «${st.label}»; Τα leads του θα φαίνονται στο στάδιο με την ίδια σημασία ή στο προηγούμενο.`)) removeStage(p.key, i); }} className="text-charcoal-600/40 hover:text-signal-danger" aria-label="Διαγραφή σταδίου"><Trash2 size={14} /></button>
                          : <span />}
                      </div>
                    );
                  })}
                  {canEdit && p.stages.length < 20 && <button type="button" onClick={() => addStage(p.key)} className="btn-ghost mt-2 text-xs"><Plus size={13} /> Στάδιο</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="panel space-y-2 p-5">
        <h4>Λόγοι απώλειας</h4>
        <p className="text-xs text-charcoal-600/60">Εμφανίζονται όταν κλείνει ένα lead και μετρούν στο «Γιατί χάνονται». Κάθε λόγος οδηγεί σε «Χάθηκε», «Για αργότερα» ή «Χωρίς απάντηση».</p>
        {v.lostReasons.map((r, i) => (
          <div key={r.key} className="grid grid-cols-[1fr_170px_auto] items-center gap-2">
            <input className="input py-1 text-sm" disabled={dis} value={r.label} onChange={(e) => patch({ lostReasons: v.lostReasons.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            <select className="input py-1 text-sm" disabled={dis} value={r.status} onChange={(e) => patch({ lostReasons: v.lostReasons.map((x, j) => (j === i ? { ...x, status: e.target.value as any } : x)) })}>
              <option value="lost">Χάθηκε</option><option value="nurture">Για αργότερα</option><option value="no_response">Χωρίς απάντηση</option>
            </select>
            {canEdit && <button type="button" onClick={() => patch({ lostReasons: v.lostReasons.filter((_, j) => j !== i) })} className="text-charcoal-600/40 hover:text-signal-danger"><Trash2 size={14} /></button>}
          </div>
        ))}
        {canEdit && <button type="button" onClick={() => patch({ lostReasons: [...v.lostReasons, { key: slugKey('reason', v.lostReasons.map((x) => x.key)), label: 'Νέος λόγος', status: 'lost' }] })} className="btn-ghost text-xs"><Plus size={13} /> Λόγος</button>}
      </div>

      <div className="panel space-y-2 p-5">
        <h4>Πηγές leads</h4>
        <div className="flex flex-wrap gap-1">{v.sources.map((s) => <span key={s} className="badge-neutral inline-flex items-center gap-1">{s}{canEdit && <button type="button" onClick={() => patch({ sources: v.sources.filter((x) => x !== s) })}><X size={11} /></button>}</span>)}</div>
        {canEdit && <div className="flex max-w-sm gap-2"><input className="input py-1 text-sm" value={src} placeholder="Νέα πηγή" onChange={(e) => setSrc(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && src.trim()) { e.preventDefault(); patch({ sources: [...v.sources, src.trim()] }); setSrc(''); } }} /><button type="button" onClick={() => { if (src.trim()) { patch({ sources: [...v.sources, src.trim()] }); setSrc(''); } }} className="btn-secondary px-2 py-1 text-xs"><Plus size={12} /></button></div>}
      </div>

      <div className="panel space-y-3 p-5">
        <h4 className="flex items-center gap-2"><FileText size={15} /> Τιμολόγιο προμήθειας όταν κλείνει μια πώληση</h4>
        <div className="space-y-1 text-sm">
          {([['off', 'Τίποτα'], ['prepare', 'Ετοιμάζεται για έλεγχο — ειδοποίηση με έτοιμο τιμολόγιο (προτείνεται)'], ['auto', 'Εκδίδεται αυτόματα — αριθμημένο, οριστικό']] as const).map(([k, l]) => (
            <label key={k} className="flex items-center gap-2"><input type="radio" disabled={dis} checked={c.mode === k} onChange={() => setC({ mode: k })} /> {l}</label>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><Lbl>Προμήθεια % (όταν η μονάδα δεν έχει δική της)</Lbl><input className="input py-1.5 text-sm" type="number" step="0.1" min={0} max={50} disabled={dis} value={c.defaultPct} onChange={(e) => setC({ defaultPct: Number(e.target.value) })} /></label>
          <label className="block"><Lbl>ΦΠΑ</Lbl><select className="input py-1.5 text-sm" disabled={dis} value={c.vatRate ?? ''} onChange={(e) => setC({ vatRate: e.target.value === '' ? null : Number(e.target.value) })}><option value="">Προεπιλογή τιμολογίων</option>{vatRates.map((r) => <option key={r} value={r}>{r}%</option>)}</select></label>
          <label className="block"><Lbl>Τιμολογείται σε</Lbl><select className="input py-1.5 text-sm" disabled={dis} value={c.billTo} onChange={(e) => setC({ billTo: e.target.value as any })}><option value="buyer">Τον αγοραστή</option><option value="fixed">Σταθερό πελάτη (π.χ. ο developer)</option></select></label>
        </div>
        {c.billTo === 'fixed' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <input className="input py-1.5 text-sm" disabled={dis} placeholder="Επωνυμία" value={c.fixed.name} onChange={(e) => setC({ fixed: { ...c.fixed, name: e.target.value } })} />
            <input className="input py-1.5 text-sm" disabled={dis} placeholder="ΑΦΜ" value={c.fixed.vatNo} onChange={(e) => setC({ fixed: { ...c.fixed, vatNo: e.target.value } })} />
            <input className="input py-1.5 text-sm" disabled={dis} placeholder="Διεύθυνση" value={c.fixed.address} onChange={(e) => setC({ fixed: { ...c.fixed, address: e.target.value } })} />
            <input className="input py-1.5 text-sm" disabled={dis} placeholder="Email" value={c.fixed.email} onChange={(e) => setC({ fixed: { ...c.fixed, email: e.target.value } })} />
          </div>
        )}
        <p className="text-[11px] text-charcoal-600/60">Η βάση είναι η τιμή του συμβολαίου (ή της μονάδας). Η ειδοποίηση πάει στον υπεύθυνο πωλητή και στους admins/οικονομικό.</p>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="pipelines" />}
        </div>
      )}
    </div>
  );
}
