'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileSpreadsheet, Download, Upload, X, AlertTriangle, CheckCircle2, Undo2, ArrowLeft } from 'lucide-react';
import { importUnits, undoImport, listImportBatches, type ImportBatch, type ImportResult } from '@/app/actions/unit-import';
import { readSpreadsheet, type Sheet } from '@/lib/xlsx-read';
import { buildXlsx } from '@/lib/xlsx-write';
import { autoMap, guessHeaderRow, importTargets, parseImport, templateSheets, STATUS_LABEL, type UnitStatus } from '@/lib/unit-import-shared';
import type { UnitFormsSettings } from '@/lib/unit-forms-shared';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '' : String(v));

/** Projects → έργο → «Εισαγωγή από Excel»: file → column mapping → preview → import (with undo). */
export function UnitImport({ projectId, projectName, cfg, existingNumbers }: { projectId: string; projectName: string; cfg: UnitFormsSettings; existingNumbers: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [mapping, setMapping] = useState<string[]>([]);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [batches, setBatches] = useState<ImportBatch[] | null>(null);
  const [undoMsg, setUndoMsg] = useState<string | null>(null);

  const targets = useMemo(() => importTargets(cfg), [cfg]);
  const rows = useMemo(() => sheets[sheetIdx]?.rows ?? [], [sheets, sheetIdx]);
  const headers = rows[headerRow] ?? [];
  const parsed = useMemo(() => (mapping.length ? parseImport(rows, headerRow, mapping, cfg) : null), [rows, headerRow, mapping, cfg]);
  const existing = useMemo(() => new Set(existingNumbers.map((n) => n.toLowerCase())), [existingNumbers]);
  const nUpdate = parsed ? parsed.units.filter((u) => existing.has(u.unit_number.toLowerCase())).length : 0;
  const nNew = parsed ? parsed.units.length - nUpdate : 0;
  const errors = parsed?.issues.filter((i) => i.level === 'error') ?? [];
  const warns = parsed?.issues.filter((i) => i.level === 'warn') ?? [];
  const numberMapped = mapping.includes('unit_number');
  const willWrite = nNew + (updateExisting ? nUpdate : 0);

  const reset = () => { setSheets([]); setMapping([]); setFileName(''); setErr(null); setResult(null); setUndoMsg(null); };
  const openModal = () => {
    reset(); setOpen(true);
    start(async () => setBatches(await listImportBatches(projectId)));
  };
  const close = () => { setOpen(false); if (result || undoMsg) router.refresh(); };

  const pick = async (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (f.size > 15 * 1024 * 1024) { setErr('Το αρχείο είναι πάνω από 15 MB.'); return; }
    try {
      const sh = (await readSpreadsheet(f)).filter((s) => s.rows.some((r) => r.some((c) => c !== null)));
      if (!sh.length) { setErr('Το αρχείο είναι άδειο.'); return; }
      setFileName(f.name); setSheets(sh); selectSheet(sh, 0);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Το αρχείο δεν διαβάστηκε.'); }
  };
  const selectSheet = (sh: Sheet[], i: number) => {
    const h = guessHeaderRow(sh[i].rows);
    setSheetIdx(i); setHeaderRow(h); setMapping(autoMap(sh[i].rows[h] ?? [], targets));
  };
  const changeHeader = (h: number) => { setHeaderRow(h); setMapping(autoMap(rows[h] ?? [], targets)); };
  const setCol = (i: number, key: string) => setMapping((m) => m.map((k, j) => (j === i ? key : key && k === key ? '' : k)));

  const template = () => {
    const bytes = buildXlsx(templateSheets(cfg));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url; a.download = 'protypo-monades.xlsx'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const run = () => start(async () => {
    if (!parsed) return;
    setErr(null);
    const r = await importUnits({ projectId, fileName, units: parsed.units, updateExisting });
    if (r.ok) { setResult(r); setBatches(await listImportBatches(projectId)); } else setErr(r.error);
  });
  const undo = (id: string) => {
    if (!window.confirm('Αναίρεση αυτής της εισαγωγής; Οι νέες μονάδες της διαγράφονται και οι αλλαγμένες παίρνουν πίσω τις παλιές τιμές.')) return;
    start(async () => {
      const r = await undoImport(id);
      if (!r.ok) { setErr(r.error); return; }
      setUndoMsg(`Αναιρέθηκε: ${r.deleted} μονάδες διαγράφηκαν, ${r.restored} επανήλθαν${r.kept ? `, ${r.kept} κρατήθηκαν (έχουν ήδη κράτηση, αγοραστή ή έγγραφα)` : ''}.`);
      setResult(null);
      setBatches(await listImportBatches(projectId));
    });
  };

  const label = (key: string) => targets.find((t) => t.key === key)?.el ?? key;
  const stepMap = sheets.length > 0 && !result;

  return (
    <>
      <button type="button" onClick={openModal} className="btn-secondary px-3 py-1.5 text-sm"><FileSpreadsheet size={14} /> Εισαγωγή από Excel</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8" onClick={close}>
          <div className="panel w-full max-w-5xl space-y-4 p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xl">Εισαγωγή μονάδων</h3>
                <p className="text-xs text-charcoal-600/70">{projectName}{fileName ? ` · ${fileName}` : ''}</p>
              </div>
              <button type="button" onClick={close} className="text-charcoal-600/60 hover:text-charcoal"><X size={20} /></button>
            </div>

            {err && <p className="flex items-start gap-2 rounded-md bg-red-50 px-3 py-2 text-sm text-signal-danger"><AlertTriangle size={15} className="mt-0.5 shrink-0" /> {err}</p>}
            {undoMsg && <p className="flex items-start gap-2 rounded-md bg-sand-100 px-3 py-2 text-sm"><Undo2 size={15} className="mt-0.5 shrink-0" /> {undoMsg}</p>}

            {result ? (
              <div className="space-y-3">
                <p className="flex items-center gap-2 text-lg text-signal-success"><CheckCircle2 size={20} /> Η εισαγωγή ολοκληρώθηκε</p>
                <ul className="space-y-1 text-sm">
                  <li><b>{result.created}</b> νέες μονάδες</li>
                  <li><b>{result.updated}</b> μονάδες ενημερώθηκαν</li>
                  {result.skipped > 0 && <li><b>{result.skipped}</b> έμειναν ως είχαν (υπάρχουν ήδη ή δεν άλλαξε τίποτα)</li>}
                  {result.buildingsCreated > 0 && <li><b>{result.buildingsCreated}</b> νέα κτίρια</li>}
                </ul>
                {result.note && <p className="text-sm text-champagne-600">{result.note}</p>}
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={close} className="btn-primary">Κλείσιμο</button>
                  {result.batchId && <button type="button" disabled={pending} onClick={() => undo(result.batchId!)} className="btn-secondary"><Undo2 size={14} /> Αναίρεση</button>}
                </div>
              </div>
            ) : !stepMap ? (
              <div className="space-y-4">
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-stone-line bg-sand-100/50 px-4 py-10 text-center hover:border-forest/40"
                  onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); pick(e.dataTransfer.files?.[0]); }}>
                  <Upload size={26} className="text-olive" />
                  <span className="text-sm font-medium">Επιλέξτε ή σύρετε εδώ ένα αρχείο Excel (.xlsx) ή CSV</span>
                  <span className="text-xs text-charcoal-600/70">Μία γραμμή ανά μονάδα, με επικεφαλίδες στην πρώτη γραμμή. Οι στήλες αντιστοιχίζονται στο επόμενο βήμα.</span>
                  <input type="file" accept=".xlsx,.csv,.txt,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
                </label>
                <button type="button" onClick={template} className="btn-secondary px-3 py-1.5 text-xs"><Download size={13} /> Κατεβάστε το πρότυπο Excel</button>
                {batches && batches.length > 0 && (
                  <div>
                    <p className="eyebrow mb-2">Τελευταίες εισαγωγές</p>
                    <div className="divide-y divide-stone-line rounded-md border border-stone-line text-sm">
                      {batches.map((b) => (
                        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                          <span>
                            {formatDateTime(b.createdAt)} · {b.fileName ?? 'αρχείο'} · {b.created} νέες, {b.updated} ενημερώσεις
                            {b.undoneAt && <span className="ml-1 text-xs text-charcoal-600/60">(αναιρέθηκε{b.undoNote ? ` — ${b.undoNote}` : ''})</span>}
                          </span>
                          {!b.undoneAt && <button type="button" disabled={pending} onClick={() => undo(b.id)} className="text-xs text-charcoal-600/70 hover:text-signal-danger"><Undo2 size={12} className="mr-1 inline" />Αναίρεση</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-end gap-3">
                  {sheets.length > 1 && (
                    <label className="block">
                      <span className="eyebrow mb-1 block">Φύλλο</span>
                      <select className="input w-auto" value={sheetIdx} onChange={(e) => selectSheet(sheets, Number(e.target.value))}>
                        {sheets.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="block">
                    <span className="eyebrow mb-1 block">Επικεφαλίδες στη γραμμή</span>
                    <select className="input w-auto" value={headerRow} onChange={(e) => changeHeader(Number(e.target.value))}>
                      {rows.slice(0, 15).map((_, i) => <option key={i} value={i}>{i + 1}</option>)}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 pb-2 text-sm">
                    <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} />
                    Ενημέρωση μονάδων που υπάρχουν ήδη (ίδιος αριθμός)
                  </label>
                </div>

                <div className="overflow-x-auto rounded-md border border-stone-line">
                  <table className="w-full text-sm">
                    <thead className="bg-sand-100 text-left text-xs text-charcoal-600">
                      <tr><th className="px-3 py-2">Στήλη στο αρχείο</th><th className="px-3 py-2">Παράδειγμα</th><th className="px-3 py-2">Πάει στο πεδίο</th></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-line">
                      {headers.map((h, i) => (
                        <tr key={i} className={mapping[i] ? '' : 'text-charcoal-600/60'}>
                          <td className="px-3 py-1.5 font-medium">{show(h) || `Στήλη ${i + 1}`}</td>
                          <td className="max-w-[220px] truncate px-3 py-1.5 text-xs">{rows.slice(headerRow + 1, headerRow + 4).map((r) => show(r[i])).filter(Boolean).join(' · ')}</td>
                          <td className="px-3 py-1.5">
                            <select className="input py-1 text-sm" value={mapping[i] ?? ''} onChange={(e) => setCol(i, e.target.value)}>
                              <option value="">— Να αγνοηθεί —</option>
                              {targets.map((t) => <option key={t.key} value={t.key}>{t.el}{t.kind === 'cf' ? ' (δικό σας πεδίο)' : ''}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!numberMapped ? (
                  <p className="flex items-center gap-2 text-sm text-signal-danger"><AlertTriangle size={15} /> Διαλέξτε ποια στήλη έχει τον «Αριθμό μονάδας» — είναι υποχρεωτικός.</p>
                ) : parsed && (
                  <>
                    <div className="flex flex-wrap gap-2 text-sm">
                      <span className="badge-neutral">{nNew} νέες</span>
                      <span className="badge-neutral">{nUpdate} υπάρχουν ήδη{updateExisting ? ' → ενημέρωση' : ' → παραλείπονται'}</span>
                      {errors.length > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-signal-danger">{errors.length} γραμμές με λάθος (δεν θα περάσουν)</span>}
                      {warns.length > 0 && <span className="rounded-full bg-champagne-50 px-2 py-0.5 text-xs text-champagne-600">{warns.length} προειδοποιήσεις</span>}
                    </div>

                    {parsed.issues.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-md border border-stone-line bg-white px-3 py-2 text-xs">
                        {parsed.issues.slice(0, 100).map((i, k) => (
                          <p key={k} className={i.level === 'error' ? 'text-signal-danger' : 'text-champagne-600'}>
                            Γραμμή {i.row}{i.column ? ` · ${i.column}` : ''}: {i.msg}
                          </p>
                        ))}
                        {parsed.issues.length > 100 && <p className="text-charcoal-600/60">…και {parsed.issues.length - 100} ακόμη.</p>}
                      </div>
                    )}

                    {parsed.units.length > 0 && (
                      <div>
                        <p className="eyebrow mb-1">Προεπισκόπηση (πρώτες {Math.min(8, parsed.units.length)} από {parsed.units.length})</p>
                        <div className="overflow-x-auto rounded-md border border-stone-line">
                          <table className="w-full text-xs">
                            <thead className="bg-sand-100 text-left text-charcoal-600">
                              <tr>
                                <th className="px-2 py-1.5"></th><th className="px-2 py-1.5">Αρ.</th><th className="px-2 py-1.5">Κτίριο</th><th className="px-2 py-1.5">Τύπος</th>
                                <th className="px-2 py-1.5">Όροφος</th><th className="px-2 py-1.5">Υ/Δ</th><th className="px-2 py-1.5">m²</th><th className="px-2 py-1.5">Τιμή</th><th className="px-2 py-1.5">Κατάσταση</th><th className="px-2 py-1.5">Άλλα πεδία</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-line">
                              {parsed.units.slice(0, 8).map((u) => {
                                const v = u.values;
                                const others = [...Object.keys(v).filter((k) => !['type', 'floor', 'bedrooms', 'sqm', 'price', 'status'].includes(k)).map(label), ...Object.keys(u.custom).map((k) => label(`cf:${k}`))];
                                return (
                                  <tr key={u.row}>
                                    <td className="px-2 py-1 text-charcoal-600/60">{existing.has(u.unit_number.toLowerCase()) ? 'ενημ.' : 'νέα'}</td>
                                    <td className="px-2 py-1 font-medium">{u.unit_number}</td>
                                    <td className="px-2 py-1">{u.building ?? ''}</td>
                                    <td className="px-2 py-1">{show(v.type)}</td>
                                    <td className="px-2 py-1">{show(v.floor)}</td>
                                    <td className="px-2 py-1">{show(v.bedrooms)}</td>
                                    <td className="px-2 py-1">{typeof v.sqm === 'number' ? formatNumber(v.sqm) : ''}</td>
                                    <td className="px-2 py-1">{typeof v.price === 'number' ? formatCurrency(v.price) : ''}</td>
                                    <td className="px-2 py-1">{v.status ? STATUS_LABEL[v.status as UnitStatus] : ''}</td>
                                    <td className="max-w-[200px] truncate px-2 py-1 text-charcoal-600/70">{others.join(', ')}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={reset} className="btn-secondary"><ArrowLeft size={14} /> Άλλο αρχείο</button>
                  <button type="button" disabled={pending || !numberMapped || !willWrite} onClick={run} className="btn-primary">
                    {pending ? 'Εισαγωγή…' : `Εισαγωγή ${willWrite} μονάδων`}
                  </button>
                  {numberMapped && parsed && !willWrite && <span className="text-xs text-charcoal-600/70">Δεν υπάρχει κάτι να γραφτεί.</span>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
