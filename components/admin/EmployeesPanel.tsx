'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Columns3, Search, X, Pencil, FileText, Eye, Upload, Users, UserMinus, CalendarClock, Plane, Phone, Mail } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { Briefing, SideStat, Pager } from '@/components/ui/SidePanel';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { getDocumentUrl } from '@/app/actions/storage';
import { getEmployeeDocUploadUrl, recordEmployeeDoc } from '@/app/actions/hr-docs';
import { saveEmployeeRecord, type EmployeeRecordInput } from '@/app/actions/employees';
import { DOC_KIND_EL, EMPLOYMENT_TYPES, EMPLOYMENT_TYPE_EL, EMPTY_HR, isTerminated, type EmployeeDoc, type EmployeeHr } from '@/lib/staff-shared';
import { formatCurrency } from '@/lib/format';

export interface EmployeeRowIn { id: string; full_name: string | null; role: string; is_active: boolean; email?: string | null; hr?: EmployeeHr; roleLabel: string; self: boolean; mustChangePassword?: boolean }

const ddmmyyyy = (iso: string | null | undefined) => { if (!iso) return '—'; const d = iso.slice(0, 10).split('-'); return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : '—'; };
const COLS: [string, string][] = [
  ['job', 'Θέση'], ['dept', 'Τμήμα'], ['email', 'E-mail'], ['mobile', 'Κινητό'], ['role', 'Ρόλος'], ['type', 'Απασχόληση'],
  ['start', 'Πρώτη μέρα'], ['end', 'Τερματισμός'], ['contract', 'Σύμβαση'], ['status', 'Κατάσταση'],
  ['dob', 'Ημ. γέννησης'], ['nationality', 'Υπηκοότητα'], ['idp', 'Ταυτότητα / Διαβατήριο'], ['si', 'Κοιν. ασφαλίσεις'], ['address', 'Διεύθυνση'], ['salary', 'Μισθός'], ['docs', 'Έγγραφα'],
];
const DEFAULT_COLS = ['job', 'dept', 'email', 'mobile', 'role', 'start', 'end', 'contract', 'status'];
const LS = 'oramira:staff-cols-v1';
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-stone-100 hover:text-charcoal';

/**
 * Staff → Υπάλληλοι, όπως οι Πελάτες στο FitnessCRM: οργανωμένος πίνακας με
 * στήλες που διαλέγετε (πρώτη μέρα, τερματισμός, σύμβαση, προσωπικά στοιχεία…),
 * γρήγορη προβολή με όλα τα στοιχεία και τα έγγραφα, και επεξεργασία καρτέλας.
 */
export function EmployeesPanel({ rows, actions, toolbar, canEdit, canEditDocs, msg }: {
  rows: EmployeeRowIn[]; actions: (id: string) => React.ReactNode; toolbar?: React.ReactNode; canEdit: boolean; canEditDocs: boolean; msg?: React.ReactNode;
}) {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'active' | 'terminated' | 'inactive' | ''>('active');
  const [dept, setDept] = useState('');
  const [role, setRole] = useState('');
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);
  const [cols, setCols] = useState<string[]>(() => { try { const v = JSON.parse(localStorage.getItem(LS) ?? 'null'); if (Array.isArray(v)) return v; } catch { /* */ } return DEFAULT_COLS; });
  const [colsOpen, setColsOpen] = useState(false);
  const [view, setView] = useState<EmployeeRowIn | null>(null);
  const [edit, setEdit] = useState<EmployeeRowIn | null>(null);
  const has = (k: string) => cols.includes(k);
  const toggleCol = (k: string) => { const n = has(k) ? cols.filter((x) => x !== k) : [...cols, k]; setCols(n); try { localStorage.setItem(LS, JSON.stringify(n)); } catch { /* */ } };

  const depts = useMemo(() => [...new Set(rows.map((r) => r.hr?.department).filter(Boolean) as string[])].sort(), [rows]);
  const roles = useMemo(() => [...new Set(rows.map((r) => r.roleLabel))].sort(), [rows]);
  const list = rows.filter((r) => {
    const hr = r.hr ?? EMPTY_HR;
    const term = isTerminated(hr);
    if (status === 'active' && (term || !r.is_active)) return false;
    if (status === 'terminated' && !term) return false;
    if (status === 'inactive' && r.is_active) return false;
    if (dept && hr.department !== dept) return false;
    if (role && r.roleLabel !== role) return false;
    const t = q.trim().toLowerCase();
    return !t || [r.full_name, r.email, hr.phone, hr.jobTitle, hr.department, hr.idPassport].some((x) => (x ?? '').toLowerCase().includes(t));
  }).sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? '', 'el'));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = list.slice(pg * per, pg * per + per);

  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const activeN = rows.filter((r) => r.is_active && !isTerminated(r.hr ?? EMPTY_HR)).length;
  const terminatedN = rows.filter((r) => isTerminated(r.hr ?? EMPTY_HR)).length;
  const expiring = rows.filter((r) => r.hr?.contractExpiry && r.hr.contractExpiry >= today && r.hr.contractExpiry <= in30);
  const noContract = rows.filter((r) => r.is_active && !isTerminated(r.hr ?? EMPTY_HR) && !r.hr?.contract).length;
  const newThisMonth = rows.filter((r) => (r.hr?.startDate ?? '') >= monthStart).length;
  const onLeave = rows.filter((r) => r.hr?.onLeaveToday).length;
  const chip = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`;

  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal-600">
            <span>Εμφάνιση</span>
            <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            <span>εγγραφές</span>
            <div className="relative">
              <button type="button" onClick={() => setColsOpen((o) => !o)} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-stone-100 px-2.5 text-[13px] font-medium text-charcoal transition-colors hover:bg-stone-200"><Columns3 size={14} /> Στήλες</button>
              {colsOpen && (
                <div className="anim-pop absolute left-0 top-[calc(100%+4px)] z-40 w-60 rounded-lg bg-white p-1 shadow-md ring-1 ring-charcoal/10">
                  {COLS.map(([k, l]) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-charcoal hover:bg-stone-100">
                      <input type="checkbox" checked={has(k)} onChange={() => toggleCol(k)} /> {l}
                    </label>
                  ))}
                  <button type="button" onClick={() => { setCols(DEFAULT_COLS); try { localStorage.removeItem(LS); } catch { /* */ } }} className="mt-1 w-full border-t border-stone-line px-2 py-1.5 text-left text-sm text-charcoal hover:bg-stone-50">↺ Επαναφορά</button>
                </div>
              )}
            </div>
            <span className="ml-auto flex flex-wrap gap-2">{toolbar}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setStatus(status === 'active' ? '' : 'active'); setPageNo(0); }} className={chip(status === 'active')}><Users size={13} /> {activeN} ενεργοί</button>
            <button type="button" onClick={() => { setStatus(status === 'terminated' ? '' : 'terminated'); setPageNo(0); }} className={chip(status === 'terminated')}><UserMinus size={13} /> {terminatedN} τερματισμένοι</button>
            <PopSelect width="min-w-[140px]" ariaLabel="Κατάσταση" value={status} onChange={(v) => { setStatus(v as typeof status); setPageNo(0); }} options={[['', 'Όλοι'], ['active', 'Ενεργοί'], ['terminated', 'Τερματισμένοι'], ['inactive', 'Χωρίς πρόσβαση']]} />
            {depts.length > 0 && <PopSelect searchable width="min-w-[140px]" ariaLabel="Τμήμα" value={dept} onChange={(v) => { setDept(v); setPageNo(0); }} options={[['', 'Όλα τα τμήματα'], ...depts.map((d) => [d, d] as [string, string])]} />}
            <PopSelect width="min-w-[140px]" ariaLabel="Ρόλος" value={role} onChange={(v) => { setRole(v); setPageNo(0); }} options={[['', 'Όλοι οι ρόλοι'], ...roles.map((r) => [r, r] as [string, string])]} />
            <label className="relative w-full sm:ml-auto sm:w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} placeholder="Όνομα, θέση, τηλέφωνο…" className="input h-8 py-1 pl-8 text-[13px]" />
            </label>
          </div>
          {msg}
        </div>

        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr>
              <th>Ονοματεπώνυμο</th>
              {COLS.filter(([k]) => has(k)).map(([k, l]) => <th key={k}>{l}</th>)}
              <th className="text-right">Ενέργειες</th>
            </tr></thead>
            <tbody>
              {page.map((r) => {
                const hr = r.hr ?? EMPTY_HR;
                const term = isTerminated(hr);
                return (
                  <tr key={r.id} onClick={() => setView(r)} className="cursor-pointer">
                    <td className="o-strong" data-no-tr><span className="block max-w-[180px] truncate" title={r.full_name ?? ''}>{r.full_name ?? '—'}{r.self && <span className="ml-1 font-normal text-charcoal-600">(εσείς)</span>}</span></td>
                    {has('job') && <td><span className="block max-w-[150px] truncate">{hr.jobTitle || '—'}</span></td>}
                    {has('dept') && <td>{hr.department || '—'}</td>}
                    {has('email') && <td data-no-tr><span className="block max-w-[180px] truncate" title={r.email ?? ''}>{r.email || '—'}</span></td>}
                    {has('mobile') && <td data-no-tr>{hr.phone || '—'}</td>}
                    {has('role') && <td>{r.roleLabel}</td>}
                    {has('type') && <td>{hr.employmentType ? EMPLOYMENT_TYPE_EL[hr.employmentType] ?? hr.employmentType : '—'}</td>}
                    {has('start') && <td>{ddmmyyyy(hr.startDate)}</td>}
                    {has('end') && <td className={hr.endDate ? 'font-medium text-charcoal' : ''} title={hr.terminationReason ?? ''}>{ddmmyyyy(hr.endDate)}</td>}
                    {has('contract') && <td onClick={(e) => e.stopPropagation()}>{hr.contract ? <DocLink doc={hr.contract} label="Προβολή" /> : <span>—</span>}</td>}
                    {has('status') && <td><StatusPill active={r.is_active} terminated={term} onLeave={hr.onLeaveToday} /></td>}
                    {has('dob') && <td>{ddmmyyyy(hr.dateOfBirth)}</td>}
                    {has('nationality') && <td>{hr.nationality || '—'}</td>}
                    {has('idp') && <td data-no-tr>{hr.idPassport || '—'}</td>}
                    {has('si') && <td data-no-tr>{hr.socialInsuranceNo || '—'}</td>}
                    {has('address') && <td><span className="block max-w-[180px] truncate" title={hr.address ?? ''}>{hr.address || '—'}</span></td>}
                    {has('salary') && <td>{hr.agreedSalary != null ? formatCurrency(hr.agreedSalary) : '—'}</td>}
                    {has('docs') && <td>{hr.docs.length}</td>}
                    <td onClick={(e) => e.stopPropagation()}>
                      <span className="flex justify-end gap-0.5">
                        <button type="button" onClick={() => setView(r)} title="Προβολή καρτέλας" aria-label="Προβολή καρτέλας" className={iconBtn}><Eye size={15} /></button>
                        {canEdit && <button type="button" onClick={() => setEdit(r)} title="Επεξεργασία καρτέλας" aria-label="Επεξεργασία καρτέλας" className={iconBtn}><Pencil size={15} /></button>}
                        {actions(r.id)}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={20} className="py-10 text-center text-sm text-charcoal-600">Κανένας υπάλληλος με αυτά τα φίλτρα.</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager from={list.length ? pg * per + 1 : 0} to={Math.min(list.length, pg * per + per)} total={list.length} page={pg} pages={pages} onPage={setPageNo} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-1">
        <Briefing tag="Ομάδα" title="Η ομάδα σας με μια ματιά." text="Ποιος δουλεύει, ποιος έφυγε, ποιες συμβάσεις λήγουν και ποιοι δεν έχουν ακόμη σύμβαση στο αρχείο."
          metrics={[['Ενεργοί', activeN, 'σήμερα'], ['Νέοι', newThisMonth, 'αυτόν τον μήνα'], ['Σε άδεια', onLeave, 'σήμερα']]} />
        <SideStat icon={CalendarClock} label="Συμβάσεις που λήγουν" value={expiring.length} note={expiring.length ? expiring.slice(0, 3).map((r) => `${r.full_name} · ${ddmmyyyy(r.hr?.contractExpiry)}`).join(' · ') : 'Καμία τις επόμενες 30 ημέρες.'} />
        <SideStat icon={FileText} label="Χωρίς σύμβαση στο αρχείο" value={noContract} note="Ενεργοί υπάλληλοι χωρίς ανεβασμένη σύμβαση." />
        <SideStat icon={Plane} label="Σε άδεια σήμερα" value={onLeave} note="Με εγκεκριμένη άδεια για σήμερα." />
      </div>

      {view && <QuickView r={view} canEdit={canEdit} canEditDocs={canEditDocs} onClose={() => setView(null)} onEdit={() => { setEdit(view); setView(null); }} />}
      {edit && <EditDialog r={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function StatusPill({ active, terminated, onLeave }: { active: boolean; terminated: boolean; onLeave: boolean }) {
  if (terminated) return <span className="rounded-full border border-stone-line px-2 py-0.5 text-[11px] font-medium text-charcoal-600">Τερματισμένος</span>;
  if (!active) return <span className="rounded-full border border-stone-line px-2 py-0.5 text-[11px] font-medium text-charcoal-600">Χωρίς πρόσβαση</span>;
  if (onLeave) return <span className="rounded-full border border-forest/30 bg-forest/[0.06] px-2 py-0.5 text-[11px] font-medium text-forest">Σε άδεια</span>;
  return <span className="rounded-full border border-forest/30 bg-forest/[0.08] px-2 py-0.5 text-[11px] font-medium text-forest">Ενεργός</span>;
}

function DocLink({ doc, label }: { doc: EmployeeDoc; label?: string }) {
  const [pending, start] = useTransition();
  const open = () => start(async () => { try { const url = await getDocumentUrl(doc.bucket as any, doc.path); window.open(url, '_blank', 'noopener'); } catch { alert('Το έγγραφο δεν άνοιξε.'); } });
  return <button type="button" disabled={pending} onClick={open} className="inline-flex items-center gap-1 rounded-full border border-forest/30 px-2 py-0.5 text-[11px] font-medium text-forest transition-colors hover:bg-forest/[0.06]"><FileText size={12} /> {pending ? '…' : label ?? doc.title}</button>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">{label}</p><p className="mt-0.5 break-words text-[14px] text-charcoal">{value || '—'}</p></div>;
}

function QuickView({ r, canEdit, canEditDocs, onClose, onEdit }: { r: EmployeeRowIn; canEdit: boolean; canEditDocs: boolean; onClose: () => void; onEdit: () => void }) {
  const hr = r.hr ?? EMPTY_HR;
  const term = isTerminated(hr);
  const router = useRouter();
  const [kind, setKind] = useState('contract');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true); setErr(null);
    const sb = createSupabaseBrowserClient();
    for (const f of Array.from(files)) {
      const u = await getEmployeeDocUploadUrl(r.id, f.name, f.size);
      if (!u.ok) { setErr(u.error); continue; }
      const { error } = await sb.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || undefined });
      if (error) { setErr(error.message); continue; }
      const res = await recordEmployeeDoc({ profileId: r.id, path: u.path, title: f.name, kind });
      if (!res.ok) setErr(res.error);
    }
    setBusy(false);
    if (file.current) file.current.value = '';
    router.refresh();
    onClose();
  };
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="anim-fade absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="anim-pop relative flex h-full w-full max-w-[520px] flex-col overflow-y-auto bg-white shadow-overlay">
        <div className="flex items-start justify-between gap-3 border-b border-stone-line p-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-forest/[0.09] text-[15px] font-semibold text-forest">{(r.full_name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-semibold text-charcoal" data-no-tr>{r.full_name ?? '—'}</p>
              <p className="truncate text-[13px] text-charcoal-600">{[hr.jobTitle, hr.department, r.roleLabel].filter(Boolean).join(' · ')}</p>
              <div className="mt-1"><StatusPill active={r.is_active} terminated={term} onLeave={hr.onLeaveToday} /></div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className={iconBtn}><X size={17} /></button>
        </div>
        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {hr.phone && <a href={`tel:${hr.phone}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Phone size={14} /> Κλήση</a>}
            {r.email && <a href={`mailto:${r.email}`} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Mail size={14} /> Email</a>}
            {canEdit && <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90"><Pencil size={14} /> Επεξεργασία</button>}
          </div>
          <Section title="Εργασία">
            <Info label="Πρώτη μέρα" value={ddmmyyyy(hr.startDate)} />
            <Info label="Τερματισμός" value={ddmmyyyy(hr.endDate)} />
            <Info label="Απασχόληση" value={hr.employmentType ? EMPLOYMENT_TYPE_EL[hr.employmentType] ?? hr.employmentType : null} />
            <Info label="Λήξη σύμβασης" value={hr.contractExpiry ? ddmmyyyy(hr.contractExpiry) : null} />
            <Info label="Μισθός" value={hr.agreedSalary != null ? `${formatCurrency(hr.agreedSalary)}${hr.salaryFrequency ? ` · ${hr.salaryFrequency === 'monthly' ? 'μηνιαίος' : hr.salaryFrequency === 'weekly' ? 'εβδομαδιαίος' : hr.salaryFrequency}` : ''}` : null} />
            <Info label="Στο σύστημα από" value={ddmmyyyy(hr.createdAt)} />
            {hr.endDate && <div className="col-span-2"><Info label="Λόγος τερματισμού" value={hr.terminationReason} /></div>}
          </Section>
          <Section title="Προσωπικά στοιχεία">
            <Info label="E-mail εργασίας" value={r.email} />
            <Info label="Προσωπικό e-mail" value={hr.personalEmail} />
            <Info label="Κινητό" value={hr.phone} />
            <Info label="Ημ. γέννησης" value={hr.dateOfBirth ? ddmmyyyy(hr.dateOfBirth) : null} />
            <Info label="Υπηκοότητα" value={hr.nationality} />
            <Info label="Ταυτότητα / Διαβατήριο" value={hr.idPassport} />
            <Info label="Κοιν. ασφαλίσεις" value={hr.socialInsuranceNo} />
            <Info label="Επαφή έκτακτης ανάγκης" value={hr.emergencyContact} />
            <div className="col-span-2"><Info label="Διεύθυνση" value={hr.address} /></div>
          </Section>
          <div className="rounded-xl border border-stone-line p-4">
            <p className="mb-3 text-[15px] font-semibold text-charcoal">Έγγραφα ({hr.docs.length})</p>
            {hr.docs.length === 0 ? <p className="text-[13px] text-charcoal-600">Δεν έχει ανέβει κανένα έγγραφο.</p> : (
              <ul className="divide-y divide-stone-line">
                {hr.docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 py-2 text-[13px]">
                    <span className="min-w-0"><span className="block truncate font-medium text-charcoal" data-no-tr>{d.title}</span><span className="text-charcoal-600">{DOC_KIND_EL[d.kind] ?? d.kind} · {ddmmyyyy(d.createdAt)}{d.expires ? ` · λήξη ${ddmmyyyy(d.expires)}` : ''}</span></span>
                    <DocLink doc={d} label="Προβολή" />
                  </li>
                ))}
              </ul>
            )}
            {canEditDocs && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-line pt-3">
                <PopSelect width="min-w-[170px]" ariaLabel="Τύπος εγγράφου" value={kind} onChange={setKind} options={Object.entries(DOC_KIND_EL) as [string, string][]} />
                <input ref={file} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
                <button type="button" disabled={busy} onClick={() => file.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line px-3 text-[13px] text-charcoal hover:border-forest/30"><Upload size={14} /> {busy ? 'Ανέβασμα…' : 'Ανέβασμα'}</button>
                {err && <p className="w-full text-[13px] text-signal-danger">{err}</p>}
              </div>
            )}
          </div>
          {hr.hrNotes && <div className="rounded-xl border border-stone-line p-4"><p className="mb-1 text-[15px] font-semibold text-charcoal">Σημειώσεις HR</p><p className="whitespace-pre-wrap text-[14px] text-charcoal">{hr.hrNotes}</p></div>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-xl border border-stone-line p-4"><p className="mb-3 text-[15px] font-semibold text-charcoal">{title}</p><div className="grid grid-cols-2 gap-x-4 gap-y-3">{children}</div></div>;
}

function EditDialog({ r, onClose }: { r: EmployeeRowIn; onClose: () => void }) {
  const hr = r.hr ?? EMPTY_HR;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState<EmployeeRecordInput>({
    fullName: r.full_name ?? '', jobTitle: hr.jobTitle ?? '', department: hr.department ?? '', phone: hr.phone ?? '', personalEmail: hr.personalEmail ?? '',
    employmentType: hr.employmentType ?? '', startDate: hr.startDate ?? '', endDate: hr.endDate ?? '', terminationReason: hr.terminationReason ?? '',
    dateOfBirth: hr.dateOfBirth ?? '', nationality: hr.nationality ?? '', idPassport: hr.idPassport ?? '', socialInsuranceNo: hr.socialInsuranceNo ?? '',
    address: hr.address ?? '', emergencyContact: hr.emergencyContact ?? '', agreedSalary: hr.agreedSalary != null ? String(hr.agreedSalary) : '', salaryFrequency: hr.salaryFrequency ?? 'monthly', hrNotes: hr.hrNotes ?? '',
  });
  const set = (k: keyof EmployeeRecordInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const save = () => start(async () => { const res = await saveEmployeeRecord(r.id, f); if (!res.ok) { setErr(res.error); return; } router.refresh(); onClose(); });
  const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
  const field = (k: keyof EmployeeRecordInput, label: string, type = 'text', span = false) => (
    <label className={`block ${span ? 'sm:col-span-2' : ''}`}><span className={lbl}>{label}</span><input type={type} className="input text-sm" value={(f[k] as string) ?? ''} onChange={set(k)} /></label>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="anim-zoom my-6 w-full max-w-2xl rounded-2xl bg-white shadow-overlay">
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-4">
          <p className="text-[17px] font-semibold text-charcoal">Καρτέλα υπαλλήλου · <span data-no-tr>{r.full_name}</span></p>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className={iconBtn}><X size={17} /></button>
        </div>
        <div className="space-y-5 p-5">
          <div>
            <p className="mb-2 text-[14px] font-semibold text-charcoal">Εργασία</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('fullName', 'Ονοματεπώνυμο', 'text', true)}
              {field('jobTitle', 'Θέση')}
              {field('department', 'Τμήμα')}
              <div><span className={lbl}>Απασχόληση</span><PopSelect width="w-full" value={f.employmentType ?? ''} onChange={(v) => setF((x) => ({ ...x, employmentType: v }))} options={[['', '—'], ...EMPLOYMENT_TYPES]} /></div>
              {field('startDate', 'Πρώτη μέρα εργασίας', 'date')}
              {field('agreedSalary', 'Μισθός (€)')}
              <div><span className={lbl}>Συχνότητα μισθού</span><PopSelect width="w-full" value={f.salaryFrequency ?? ''} onChange={(v) => setF((x) => ({ ...x, salaryFrequency: v }))} options={[['monthly', 'Μηνιαίος'], ['biweekly', 'Ανά 2 εβδομάδες'], ['weekly', 'Εβδομαδιαίος'], ['hourly', 'Ωριαίος']]} /></div>
            </div>
          </div>
          <div className="rounded-xl border border-stone-line bg-stone-50/60 p-4">
            <p className="mb-2 text-[14px] font-semibold text-charcoal">Τερματισμός εργασίας</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('endDate', 'Τελευταία μέρα', 'date')}
              <label className="block sm:col-span-2"><span className={lbl}>Λόγος</span><textarea rows={2} className="input text-sm" value={f.terminationReason ?? ''} onChange={set('terminationReason')} placeholder="π.χ. παραίτηση, λήξη σύμβασης…" /></label>
            </div>
            <p className="mt-2 text-[12px] text-charcoal-600">Αφήστε κενό όσο ο υπάλληλος δουλεύει. Για να κλείσει και η πρόσβασή του στην πλατφόρμα, χρησιμοποιήστε την «Απενεργοποίηση».</p>
          </div>
          <div>
            <p className="mb-2 text-[14px] font-semibold text-charcoal">Προσωπικά στοιχεία</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {field('phone', 'Κινητό')}
              {field('personalEmail', 'Προσωπικό e-mail', 'email')}
              {field('dateOfBirth', 'Ημ. γέννησης', 'date')}
              {field('nationality', 'Υπηκοότητα')}
              {field('idPassport', 'Ταυτότητα / Διαβατήριο')}
              {field('socialInsuranceNo', 'Αρ. κοιν. ασφαλίσεων')}
              {field('address', 'Διεύθυνση', 'text', true)}
              {field('emergencyContact', 'Επαφή έκτακτης ανάγκης', 'text', true)}
              <label className="block sm:col-span-2"><span className={lbl}>Σημειώσεις HR</span><textarea rows={3} className="input text-sm" value={f.hrNotes ?? ''} onChange={set('hrNotes')} /></label>
            </div>
          </div>
          {err && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-5 py-4">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[10px] border border-stone-line px-4 text-[14px] text-charcoal hover:border-forest/30">Άκυρο</button>
          <button type="button" disabled={pending} onClick={save} className="inline-flex h-9 items-center rounded-[10px] bg-forest px-4 text-[14px] font-medium text-white hover:bg-forest/90">{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
        </div>
      </div>
    </div>
  );
}
