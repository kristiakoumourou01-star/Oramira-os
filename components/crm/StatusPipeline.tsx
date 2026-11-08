'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, RotateCcw, Trophy, Clock, AlertTriangle, FileText } from 'lucide-react';
import { updateLeadStatus } from '@/app/actions/leads';
import {
  DEFAULT_PIPELINE_SETTINGS, STATUS_EL, daysSince, lateBy, stageIndex,
  type LostReason, type PipelineDef,
} from '@/lib/pipeline-shared';

/**
 * Πορεία ενός lead στο pipeline του: τα στάδια με τα δικά σας ονόματα, πόσες
 * μέρες είναι στο τρέχον (κόκκινο όταν περάσει το όριο), «Κλείσιμο (Won)» και
 * κλείσιμο με λόγο απώλειας από τις Ρυθμίσεις.
 */
export function StatusPipeline({ leadId, currentStatus, currentStage = null, pipeline = DEFAULT_PIPELINE_SETTINGS.pipelines[0], lostReasons = DEFAULT_PIPELINE_SETTINGS.lostReasons, stageEnteredAt = null, lostReason = null, lostNote = null, commissionInvoiceId = null, onChange }: {
  leadId: string; currentStatus: string; currentStage?: string | null; pipeline?: PipelineDef; onChange?: () => void; lostReasons?: LostReason[]; stageEnteredAt?: string | null;
  lostReason?: string | null; lostNote?: string | null; commissionInvoiceId?: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [closing, setClosing] = useState(false);
  const [detail, setDetail] = useState('');
  const set = (status: string, why?: string, key?: string, stage?: string) => start(async () => { await updateLeadStatus(leadId, status, why, key, stage ?? null); router.refresh(); onChange?.(); });

  const working = pipeline.stages.filter((s) => s.status !== 'won');
  const idx = stageIndex(pipeline, currentStatus, currentStage);
  const stage = idx >= 0 ? pipeline.stages[idx] : null;
  const days = daysSince(stageEnteredAt);
  const late = lateBy(pipeline, currentStatus, stageEnteredAt, Date.now(), currentStage);

  if (currentStatus === 'won') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-forest/20 bg-forest/[0.05] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white"><Trophy size={16} /></span>
          <div>
            <p className="text-sm font-semibold text-charcoal">{pipeline.stages.find((s) => s.status === 'won')?.label ?? 'Κλείσιμο'} 🎉</p>
            <p className="text-xs text-charcoal-600/70">{days !== null ? `Έκλεισε πριν από ${days} μέρες.` : 'Η πώληση έκλεισε.'}</p>
          </div>
        </div>
        {commissionInvoiceId
          ? <Link href={`/financials/invoices/${commissionInvoiceId}`} className="inline-flex items-center gap-1 text-xs text-forest hover:underline"><FileText size={13} /> Τιμολόγιο προμήθειας</Link>
          : <Link href={`/financials/invoices/new?lead=${leadId}`} className="btn-secondary px-3 py-1.5 text-xs"><FileText size={13} /> Έκδοση τιμολογίου προμήθειας</Link>}
      </div>
    );
  }

  if (idx < 0) {
    const reason = lostReasons.find((r) => r.key === lostReason)?.label;
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-line bg-sand-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-charcoal">Το lead έκλεισε — <span className={currentStatus === 'lost' ? 'text-signal-danger' : 'text-charcoal-600'}>{reason ?? STATUS_EL[currentStatus] ?? currentStatus}</span></p>
          <p className="text-xs text-charcoal-600/60">{lostNote && lostNote !== reason ? lostNote : reason ? STATUS_EL[currentStatus] ?? currentStatus : 'Ο λόγος είναι στο ιστορικό.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-charcoal-600/60">Επαναφορά σε:</span>
          <select className="input w-auto py-1 text-xs" disabled={pending} defaultValue="" onChange={(e) => { const st = working.find((x) => x.key === e.target.value); if (st) set(st.status, undefined, undefined, st.key); }} aria-label="Επαναφορά σε στάδιο">
            <option value="" disabled>Στάδιο…</option>{working.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
          </select>
          <button type="button" disabled={pending} onClick={() => set(working[1]?.status ?? 'contacted', undefined, undefined, working[1]?.key)} className="btn-ghost inline-flex items-center gap-1.5 text-xs"><RotateCcw size={13} /> {working[1]?.label ?? 'Επαναφορά'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {working.map((s, i) => (
          <button key={s.key} type="button" disabled={pending} onClick={() => set(s.status, undefined, undefined, s.key)}
            title={`${s.label} · πιθανότητα ${s.probability}%${s.maxDays ? ` · έως ${s.maxDays} μέρες` : ''}`}
            className={`flex-1 truncate rounded px-1.5 py-2 text-center text-xs font-medium transition-colors ${i <= idx ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'} ${i === idx && late ? 'ring-2 ring-signal-danger ring-offset-1' : ''}`}>
            {s.label}
          </button>
        ))}
      </div>

      {stage && (
        <p className={`flex flex-wrap items-center gap-1.5 text-xs ${late ? 'text-signal-danger' : 'text-charcoal-600/75'}`}>
          {late ? <AlertTriangle size={12} /> : <Clock size={12} />}
          <span className="font-medium">{stage.label}</span>
          {days !== null && <>· {days === 0 ? 'από σήμερα' : `${days} ${days === 1 ? 'μέρα' : 'μέρες'}`}</>}
          {stage.maxDays && <>· όριο {stage.maxDays}</>}
          {late ? <>· καθυστέρηση {late} {late === 1 ? 'μέρα' : 'μέρες'}</> : null}
          <span className="text-charcoal-600/50">· πιθανότητα {stage.probability}% · {pipeline.name}</span>
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" disabled={pending} onClick={() => { if (window.confirm('Κλείσιμο της πώλησης (Won);')) set('won', undefined, undefined, pipeline.stages.find((x) => x.status === 'won')?.key); }} className="inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-xs font-medium text-white hover:bg-forest-deep">
          <Trophy size={12} /> Κλείσιμο (Won)
        </button>
        {lostReasons.filter((r) => r.quick).map((r) => (
          <button key={r.key} type="button" disabled={pending} onClick={() => set(r.status, r.label, r.key)} title={`${r.label} → ${STATUS_EL[r.status] ?? r.status}`}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${r.status === 'lost' ? 'border-signal-danger/30 text-signal-danger hover:bg-signal-danger hover:text-white' : 'border-stone-line text-charcoal-600 hover:border-champagne hover:bg-champagne-50'}`}>
            <X size={12} /> {r.label}
          </button>
        ))}
        {!closing && <button type="button" disabled={pending} onClick={() => setClosing(true)} className="text-xs font-medium text-charcoal-600/70 underline-offset-2 hover:text-signal-danger hover:underline">{lostReasons.some((r) => r.quick) ? 'Άλλος λόγος…' : 'Δεν προχωρά; Κλείσιμο με λόγο'}</button>}
      </div>

      {closing && (
        <div className="space-y-3 rounded-lg border border-stone-line bg-white p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-charcoal">Γιατί κλείνει;</p>
            <button type="button" onClick={() => { setClosing(false); setDetail(''); }} className="text-charcoal-600/50 hover:text-charcoal"><X size={15} /></button>
          </div>
          <input type="text" value={detail} onChange={(e) => setDetail(e.target.value)} maxLength={500}
            placeholder="Λεπτομέρεια (προαιρετικό) — π.χ. ήθελε 3 υπνοδωμάτια, είχαμε μόνο 2"
            className="w-full rounded-md border border-stone-line bg-sand-50 px-3 py-2 text-xs focus:border-forest focus:outline-none" />
          <div className="grid gap-2 sm:grid-cols-2">
            {lostReasons.map((r) => (
              <button key={r.key} type="button" disabled={pending} onClick={() => { set(r.status, detail.trim() ? `${r.label} — ${detail.trim()}` : r.label, r.key); setClosing(false); setDetail(''); }}
                className={`rounded-md border px-3 py-2 text-left text-xs font-medium transition-colors ${r.status === 'lost' ? 'border-stone-line hover:border-signal-danger/40 hover:bg-signal-danger/[0.04] hover:text-signal-danger' : 'border-stone-line hover:border-champagne/60 hover:bg-champagne-50/60'}`}>
                {r.label}<span className="block text-[10px] font-normal text-charcoal-600/60">{STATUS_EL[r.status]}</span>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-charcoal-600/50">Ο λόγος μετρά στα στατιστικά απωλειών και κλείνουν οι ανοιχτές εργασίες του lead.</p>
        </div>
      )}
    </div>
  );
}
