'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trash2, Search, Megaphone, FolderPlus, Columns3 } from 'lucide-react';
import { COLUMNS, DEFAULT_COLUMNS, OPS, evaluate, type Condition, type CustomRow, type FieldDef, type ReportDef } from '@/lib/custom-report-shared';
import { saveReportTemplate, deleteReportTemplate } from '@/app/actions/report-templates';
import { createContactGroup } from '@/app/actions/contacts-hub';
import { DataReportView } from '@/components/reports/DataReportView';
import { PopSelect } from '@/components/ui/PopSelect';
import { SummaryTiles, CallListButton } from '@/components/reports/ReportParts';
import { CallListDialog } from '@/components/tasks/TeamTasks';
import type { DataReport } from '@/lib/reports-shared';
import { formatCurrency, formatDate } from '@/lib/format';

const eur = (n: number) => formatCurrency(n);

/**
 * Custom report πελατών — όπως το «Custom member report» του FitnessCRM:
 * στοιβάζεις συνθήκες (ιδιότητα, ομάδα, budget, έργο, περιοχή, κράτηση,
 * υπόλοιπο…) και τρέχεις την αναφορά για την ακριβή λίστα πελατών.
 */
export function CustomReport({ rows, fields, templates, canExport, staff, me }: { rows: CustomRow[]; fields: FieldDef[]; templates: { id: string; name: string; definition: any }[]; canExport: boolean; staff: { id: string; name: string }[]; me: string }) {
  const router = useRouter();
  const [def, setDef] = useState<ReportDef>({ match: 'all', conditions: [{ field: 'roles', op: 'has', value: 'buyer' }], columns: DEFAULT_COLUMNS });
  const [ran, setRan] = useState<ReportDef | null>(null);
  const [callDlg, setCallDlg] = useState(false);
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
      if (k === 'createdAt' || k === 'lastContactAt') return v ? formatDate(v) : '';
      if (['status', 'source', 'language', 'buyerType', 'kycStatus'].includes(k)) return v ? label(k, String(v)) : '';
      return v ?? '';
    };
    const cols = COLUMNS.filter(([k]) => ran.columns.includes(k));
    return {
      columns: cols.map(([key, l]) => ({ key, label: l, data: ['name', 'email', 'phone', 'groups', 'tags', 'ownerName', 'projects', 'areas', 'units', 'ownedProjects', 'nationality', 'city', 'country'].includes(key), align: ['budget', 'value', 'paid', 'balance', 'viewings', 'reservations', 'contracts', 'age'].includes(key) ? 'right' as const : undefined })),
      rows: result.map((r) => Object.fromEntries(cols.map(([k]) => [k, fmt(k, (r as any)[k])]))),
      summary: [
        { label: 'Πελάτες', value: String(result.length) },
        { label: 'Με email', value: String(result.filter((r) => r.email).length) },
        { label: 'Με συγκατάθεση marketing', value: String(result.filter((r) => r.optIn).length) },
        { label: 'Συνολικό budget', value: eur(result.reduce((s, r) => s + r.budget, 0)) },
        { label: 'Υπόλοιπο προς είσπραξη', value: eur(result.reduce((s, r) => s + r.balance, 0)) },
      ],

    };
  }, [ran, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadTpl = (id: string) => { setTpl(id); const t = templates.find((x) => x.id === id); if (t?.definition?.conditions) { setDef({ match: t.definition.match === 'any' ? 'any' : 'all', conditions: t.definition.conditions, columns: t.definition.columns ?? DEFAULT_COLUMNS }); setRan(null); } };
  const saveTpl = () => { const n = prompt('Όνομα προτύπου (π.χ. «Επενδυτές με budget 500k+»):'); if (!n) return; start(async () => { const r = await saveReportTemplate(n, def); setMsg(r.ok ? { ok: true, text: `Αποθηκεύτηκε το πρότυπο «${n}».` } : { ok: false, text: r.error }); if (r.ok) router.refresh(); }); };
  const delTpl = () => { if (!tpl || !confirm('Διαγραφή του προτύπου;')) return; start(async () => { const r = await deleteReportTemplate(tpl); setMsg(r.ok ? { ok: true, text: 'Το πρότυπο διαγράφηκε.' } : { ok: false, text: r.error }); setTpl(''); router.refresh(); }); };
  const toGroup = () => { const n = prompt(`Όνομα νέας ομάδας με τους ${result.length} πελάτες:`); if (!n) return; start(async () => { const r = await createContactGroup({ name: n, memberIds: result.map((x) => x.id) }); setMsg(r.ok ? { ok: true, text: `Δημιουργήθηκε η ομάδα «${n}» με ${result.length} πελάτες — τη βρίσκετε στους Πελάτες → Ομάδες και στο Marketing.` } : { ok: false, text: r.error }); }); };
  const used = new Set(def.conditions.map((c) => c.field));
  const fieldOpts: [string, string][] = fields.map((x) => [x.key, `${x.group} · ${x.label}`]);
  const label = (c: Condition) => fieldOf(c.field);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
          <span>Πελάτες που ταιριάζουν σε</span>
          <PopSelect ariaLabel="Ταίριασμα" width="min-w-[110px]" value={def.match} onChange={(v) => setDef((d) => ({ ...d, match: v === 'any' ? 'any' : 'all' }))} options={[['all', 'ΟΛΕΣ'], ['any', 'ΟΠΟΙΑΔΗΠΟΤΕ']]} />
          <span>τις συνθήκες</span>
          <span className="rounded-full border border-stone-line px-2.5 py-0.5 text-[12px] font-medium text-charcoal">{def.conditions.length === 1 ? '1 συνθήκη' : `${def.conditions.length} συνθήκες`}</span>
          <span className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <PopSelect searchable ariaLabel="Πρότυπο" width="min-w-[180px]" value={tpl} onChange={loadTpl} options={[['', 'Φόρτωση προτύπου…'], ...templates.map((t) => [t.id, t.name] as [string, string])]} />
            <button type="button" onClick={saveTpl} disabled={pending} className="inline-flex h-8 items-center rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40">Αποθήκευση ως πρότυπο</button>
            {tpl && <button type="button" onClick={delTpl} aria-label="Διαγραφή προτύπου" title="Διαγραφή προτύπου" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button>}
          </span>
        </div>

        <div className="space-y-2 border-t border-stone-line p-4 sm:p-5">
          {def.conditions.length === 0 && <p className="text-[13px] text-charcoal-600">Χωρίς συνθήκες — η αναφορά δείχνει όλους τους πελάτες.</p>}
          {def.conditions.map((c, i) => {
            const f = label(c);
            const ops = f ? OPS[f.type] : [];
            const needsValue = f && f.type !== 'bool' && c.op !== 'empty';
            return (
              <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-line bg-stone-50/60 p-2.5">
                <PopSelect searchable ariaLabel="Πεδίο" width="w-full sm:w-[260px]" className="w-full sm:w-auto" value={c.field} onChange={(v) => { const nf = fieldOf(v); setCond(i, { field: v, op: nf ? OPS[nf.type][0][0] : '', value: nf?.options?.[0]?.[0] ?? '' }); }} options={fieldOpts} />
                <PopSelect ariaLabel="Τελεστής" width="min-w-[140px]" value={c.op} onChange={(v) => setCond(i, { op: v })} options={ops} />
                {needsValue && (f!.options
                  ? <PopSelect searchable ariaLabel="Τιμή" width="min-w-[170px]" value={c.value} onChange={(v) => setCond(i, { value: v })} options={f!.options.length ? f!.options : [['', '—']]} />
                  : <input value={c.value} onChange={(e) => setCond(i, { value: e.target.value })} type={f!.type === 'date' ? 'date' : ['number', 'money', 'days'].includes(f!.type) ? 'number' : 'text'} className="input h-8 min-w-[140px] flex-1 py-1 text-[13px]" placeholder={f!.type === 'money' ? 'π.χ. 500000' : f!.type === 'days' ? 'π.χ. 30' : ''} />)}
                <button type="button" onClick={() => setDef((d) => ({ ...d, conditions: d.conditions.filter((_, j) => j !== i) }))} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger" aria-label="Αφαίρεση"><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-stone-line p-4 text-[13px] text-charcoal-600 sm:p-5">
          <PopSelect searchable ariaLabel="Προσθήκη συνθήκης" width="min-w-[220px]" value="" placeholder="+ Προσθήκη συνθήκης…" onChange={(v) => v && add(v)} options={fieldOpts.map(([k, l]) => [k, used.has(k) ? `${l} ✓` : l] as [string, string])} />
          <span>{`${fields.length} διαθέσιμες συνθήκες`}</span>
          <div className="relative">
            <button type="button" onClick={() => setColsOpen((o) => !o)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><Columns3 size={14} /> {`Στήλες (${def.columns.length})`}</button>
            {colsOpen && <div className="absolute left-0 top-10 z-20 grid max-h-80 w-64 overflow-y-auto rounded-xl border border-stone-line bg-white p-2 shadow-overlay" onMouseLeave={() => setColsOpen(false)}>
              {COLUMNS.map(([k, l]) => <label key={k} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-charcoal hover:bg-stone-50"><input type="checkbox" checked={def.columns.includes(k)} onChange={() => setDef((d) => ({ ...d, columns: d.columns.includes(k) ? d.columns.filter((x) => x !== k) : [...d.columns, k] }))} /> {l}</label>)}
            </div>}
          </div>
          <span className="flex items-center gap-2 sm:ml-auto">
            <span>Προβάλλονται</span>
            <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => setPer(Number(v))} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            <button type="button" onClick={() => setRan({ ...def })} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[14px] font-medium text-white hover:bg-forest/90"><Search size={15} /> Εκτέλεση αναφοράς</button>
          </span>
        </div>
      </div>

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {report && (
        <div className="space-y-3">
          <SummaryTiles items={report.summary.slice(0, 4)} />
          {result.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              <CallListButton onClick={() => setCallDlg(true)} />
              <button type="button" onClick={toGroup} disabled={pending} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><FolderPlus size={14} /> Αποθήκευση ως ομάδα</button>
              <Link href={`/marketing?tab=campaigns&ids=${result.slice(0, 300).map((r) => r.id).join(',')}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[13px] font-medium text-charcoal hover:border-forest/40"><Megaphone size={14} /> Καμπάνια σε αυτούς</Link>
            </div>
          )}
          <DataReportView key={`${per}-${JSON.stringify(ran)}`} report={report} title="Custom report πελατών" canExport={canExport} pageSize={per} />
        </div>
      )}
      {callDlg && <CallListDialog staff={staff} me={me} fixed={{ ids: result.map((r) => r.id), label: tpl ? `Αναφορά: ${templates.find((t) => t.id === tpl)?.name ?? ''}` : 'Custom report πελατών' }} onClose={() => setCallDlg(false)} onDone={(t, ok = true) => { setCallDlg(false); setMsg({ ok, text: t }); }} />}
    </div>
  );
}
