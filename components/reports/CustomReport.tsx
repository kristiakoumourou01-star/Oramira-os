'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Search, Megaphone, FolderPlus, Columns3 } from 'lucide-react';
import { COLUMNS, DEFAULT_COLUMNS, OPS, evaluate, type Condition, type CustomRow, type FieldDef, type ReportDef } from '@/lib/custom-report-shared';
import { saveReportTemplate, deleteReportTemplate } from '@/app/actions/report-templates';
import { createContactGroup } from '@/app/actions/contacts-hub';
import { DataReportView } from '@/components/reports/DataReportView';
import type { DataReport } from '@/lib/data-reports';

const eur = (n: number) => `€${Math.round(n).toLocaleString('el-GR')}`;

/**
 * Custom report πελατών — όπως το «Custom member report» του FitnessCRM:
 * στοιβάζεις συνθήκες (ιδιότητα, ομάδα, budget, έργο, περιοχή, κράτηση,
 * υπόλοιπο…) και τρέχεις την αναφορά για την ακριβή λίστα πελατών.
 */
export function CustomReport({ rows, fields, templates, canExport }: { rows: CustomRow[]; fields: FieldDef[]; templates: { id: string; name: string; definition: any }[]; canExport: boolean }) {
  const router = useRouter();
  const [def, setDef] = useState<ReportDef>({ match: 'all', conditions: [{ field: 'roles', op: 'has', value: 'buyer' }], columns: DEFAULT_COLUMNS });
  const [ran, setRan] = useState<ReportDef | null>(null);
  const [per, setPer] = useState(25);
  const [tpl, setTpl] = useState('');
  const [colsOpen, setColsOpen] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fieldOf = (k: string) => fields.find((f) => f.key === k);
  const setCond = (i: number, p: Partial<Condition>) => setDef((d) => ({ ...d, conditions: d.conditions.map((c, j) => (j === i ? { ...c, ...p } : c)) }));
  const add = (k: string) => { const f = fieldOf(k); if (!f) return; setDef((d) => ({ ...d, conditions: [...d.conditions, { field: k, op: OPS[f.type][0][0], value: f.options?.[0]?.[0] ?? '' }] })); };
  const result = useMemo(() => (ran ? evaluate(rows, ran, fields) : []), [ran, rows, fields]);

  const report: DataReport | null = useMemo(() => {
    if (!ran) return null;
    const label = (k: string, v: string) => fieldOf(k)?.options?.find((o) => o[0] === v)?.[1] ?? v;
    const fmt = (k: string, v: any): string | number => {
      if (Array.isArray(v)) return v.map((x) => label(k, String(x))).join(', ');
      if (['budget', 'value', 'paid', 'balance'].includes(k)) return v ? eur(Number(v)) : '';
      if (k === 'optIn') return v ? 'Ναι' : 'Όχι';
      if (k === 'createdAt' || k === 'lastContactAt') return v ? new Date(v).toLocaleDateString('el-GR') : '';
      if (['status', 'source', 'language', 'buyerType'].includes(k)) return v ? label(k, String(v)) : '';
      return v ?? '';
    };
    const cols = COLUMNS.filter(([k]) => ran.columns.includes(k));
    return {
      columns: cols.map(([key, l]) => ({ key, label: l, align: ['budget', 'value', 'paid', 'balance', 'viewings', 'reservations', 'contracts'].includes(key) ? 'right' as const : undefined })),
      rows: result.map((r) => Object.fromEntries(cols.map(([k]) => [k, fmt(k, (r as any)[k])]))),
      summary: [
        { label: 'Πελάτες', value: String(result.length) },
        { label: 'Με email', value: String(result.filter((r) => r.email).length) },
        { label: 'Με συγκατάθεση marketing', value: String(result.filter((r) => r.optIn).length) },
        { label: 'Συνολικό budget', value: eur(result.reduce((s, r) => s + r.budget, 0)) },
        { label: 'Υπόλοιπο προς είσπραξη', value: eur(result.reduce((s, r) => s + r.balance, 0)) },
      ],
      note: `${ran.conditions.length} συνθήκ${ran.conditions.length === 1 ? 'η' : 'ες'} · ${ran.match === 'all' ? 'όλες' : 'οποιαδήποτε'}`,
    };
  }, [ran, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTpl = (id: string) => { setTpl(id); const t = templates.find((x) => x.id === id); if (t?.definition?.conditions) { setDef({ match: t.definition.match === 'any' ? 'any' : 'all', conditions: t.definition.conditions, columns: t.definition.columns ?? DEFAULT_COLUMNS }); setRan(null); } };
  const saveTpl = () => { const n = prompt('Όνομα προτύπου (π.χ. «Επενδυτές με budget 500k+»):'); if (!n) return; start(async () => { const r = await saveReportTemplate(n, def); setMsg(r.ok ? { ok: true, text: `Αποθηκεύτηκε το πρότυπο «${n}».` } : { ok: false, text: r.error }); if (r.ok) router.refresh(); }); };
  const delTpl = () => { if (!tpl || !confirm('Διαγραφή του προτύπου;')) return; start(async () => { const r = await deleteReportTemplate(tpl); setMsg(r.ok ? { ok: true, text: 'Το πρότυπο διαγράφηκε.' } : { ok: false, text: r.error }); setTpl(''); router.refresh(); }); };
  const toGroup = () => { const n = prompt(`Όνομα νέας ομάδας με τους ${result.length} πελάτες:`); if (!n) return; start(async () => { const r = await createContactGroup({ name: n, memberIds: result.map((x) => x.id) }); setMsg(r.ok ? { ok: true, text: `Δημιουργήθηκε η ομάδα «${n}» με ${result.length} πελάτες — τη βρίσκετε στους Πελάτες → Ομάδες και στο Marketing.` } : { ok: false, text: r.error }); }); };
  const groups = Array.from(new Set(fields.map((f) => f.group)));
  const used = new Set(def.conditions.map((c) => c.field));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-2xl text-charcoal">Custom report πελατών</h2>
        <p className="text-[14px] text-charcoal-600">Στοιβάξτε συνθήκες — ιδιότητα, ομάδα, budget, έργο, περιοχή, κράτηση, υπόλοιπο — και τρέξτε την αναφορά για την ακριβή λίστα πελατών.</p>
      </div>
      <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
        <div className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal-600">
          <span>Πελάτες που ταιριάζουν σε</span>
          <select value={def.match} onChange={(e) => setDef((d) => ({ ...d, match: e.target.value as 'all' | 'any' }))} className="input h-9 w-auto py-1 text-sm"><option value="all">ΟΛΕΣ τις συνθήκες</option><option value="any">ΟΠΟΙΑΔΗΠΟΤΕ συνθήκη</option></select>
          <span className="ml-auto rounded-full border border-stone-line px-2.5 py-0.5 text-[12px] font-medium text-charcoal">{def.conditions.length} συνθήκ{def.conditions.length === 1 ? 'η' : 'ες'}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value={tpl} onChange={(e) => loadTpl(e.target.value)} className="input h-9 w-auto min-w-[200px] py-1 text-sm"><option value="">Φόρτωση προτύπου…</option>{templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
          <button type="button" onClick={saveTpl} disabled={pending} className="rounded-lg border border-stone-line px-3 py-1.5 text-[13px] font-medium text-charcoal hover:border-forest/40">Αποθήκευση ως πρότυπο</button>
          {tpl && <button type="button" onClick={delTpl} className="text-[13px] text-charcoal-600 hover:text-signal-danger">Διαγραφή προτύπου</button>}
        </div>

        <div className="mt-4 space-y-2">
          {def.conditions.map((c, i) => {
            const f = fieldOf(c.field);
            const ops = f ? OPS[f.type] : [];
            const needsValue = f && f.type !== 'bool' && c.op !== 'empty';
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-line bg-stone-50/50 p-2.5">
                <select value={c.field} onChange={(e) => { const nf = fieldOf(e.target.value); setCond(i, { field: e.target.value, op: nf ? OPS[nf.type][0][0] : '', value: nf?.options?.[0]?.[0] ?? '' }); }} className="input h-9 w-auto min-w-[220px] py-1 text-sm">
                  {groups.map((g) => <optgroup key={g} label={g}>{fields.filter((x) => x.group === g).map((x) => <option key={x.key} value={x.key}>{g} · {x.label}</option>)}</optgroup>)}
                </select>
                <select value={c.op} onChange={(e) => setCond(i, { op: e.target.value })} className="input h-9 w-auto min-w-[130px] py-1 text-sm">{ops.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                {needsValue && (f!.options
                  ? <select value={c.value} onChange={(e) => setCond(i, { value: e.target.value })} className="input h-9 min-w-[180px] flex-1 py-1 text-sm">{f!.options.length === 0 && <option value="">—</option>}{f!.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                  : <input value={c.value} onChange={(e) => setCond(i, { value: e.target.value })} type={f!.type === 'date' ? 'date' : ['number', 'money', 'days'].includes(f!.type) ? 'number' : 'text'} className="input h-9 min-w-[160px] flex-1 py-1 text-sm" placeholder={f!.type === 'money' ? 'π.χ. 500000' : f!.type === 'days' ? 'π.χ. 30' : ''} />)}
                <button type="button" onClick={() => setDef((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-signal-danger hover:bg-rose-50" aria-label="Αφαίρεση"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select value="" onChange={(e) => e.target.value && add(e.target.value)} className="input h-9 w-auto min-w-[220px] py-1 text-sm">
            <option value="">Προσθήκη συνθήκης…</option>
            {groups.map((g) => <optgroup key={g} label={g}>{fields.filter((x) => x.group === g).map((x) => <option key={x.key} value={x.key}>{x.label}{used.has(x.key) ? ' ✓' : ''}</option>)}</optgroup>)}
          </select>
          <span className="text-[12px] text-charcoal-600">{fields.length} διαθέσιμες συνθήκες</span>
          <div className="relative">
            <button type="button" onClick={() => setColsOpen((o) => !o)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-sm font-medium text-charcoal hover:bg-stone-200"><Columns3 size={15} /> Στήλες ({def.columns.length})</button>
            {colsOpen && <div className="absolute left-0 top-10 z-20 grid max-h-80 w-64 overflow-y-auto rounded-xl border border-stone-line bg-white p-2 shadow-overlay" onMouseLeave={() => setColsOpen(false)}>
              {COLUMNS.map(([k, l]) => <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-stone-50"><input type="checkbox" checked={def.columns.includes(k)} onChange={() => setDef((d) => ({ ...d, columns: d.columns.includes(k) ? d.columns.filter((x) => x !== k) : [...d.columns, k] }))} /> {l}</label>)}
            </div>}
          </div>
          <span className="ml-auto flex items-center gap-2">
            <select value={per} onChange={(e) => setPer(Number(e.target.value))} className="input h-9 w-auto py-1 text-sm">{[25, 50, 100, 1000].map((n) => <option key={n} value={n}>{n === 1000 ? 'Όλοι' : `${n} ανά σελίδα`}</option>)}</select>
            <button type="button" onClick={() => setRan({ ...def })} className="btn-primary text-sm"><Search size={15} /> Εκτέλεση αναφοράς</button>
          </span>
        </div>
      </div>

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {report && (
        <div className="space-y-3">
          {result.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={toGroup} disabled={pending} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-1.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><FolderPlus size={14} /> Αποθήκευση ως ομάδα</button>
              <Link href={`/marketing?tab=email&ids=${result.slice(0, 300).map((r) => r.id).join(',')}`} className="inline-flex items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 py-1.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><Megaphone size={14} /> Campaign σε αυτούς</Link>
            </div>
          )}
          <DataReportView report={report} title="Custom report πελατών" canExport={canExport} pageSize={per >= 1000 ? undefined : per} />
        </div>
      )}
    </div>
  );
}
