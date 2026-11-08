'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createEmployeeInvite } from '@/app/actions/users';
import { INTERNAL_ROLES, ROLE_LABEL, type AppRole } from '@/lib/permissions';
import { UserPlus, IdCard, ShieldCheck, CalendarClock, FileText, Send, ChevronLeft, ChevronRight, Check, Paperclip } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { PhoneInput } from '@/components/ui/PhoneInput';

const MODULES = [
  { key: 'leads', label: 'Sales' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'property', label: 'Property Management' },
  { key: 'financials', label: 'Financials' },
  { key: 'hr', label: 'HR' },
  { key: 'operations', label: 'Operations' },
  { key: 'deals', label: 'Deal Analyzer' },
];
const BENEFITS = [
  { key: 'health_insurance', label: 'Health insurance' },
  { key: 'company_car', label: 'Company car' },
  { key: 'fuel_allowance', label: 'Fuel allowance' },
  { key: 'phone_allowance', label: 'Phone allowance' },
  { key: 'bonus_eligible', label: 'Bonus eligible' },
  { key: 'commission_eligible', label: 'Commission eligible' },
];
const POSITIONS = ['Real Estate Agent', 'Sales Manager', 'Construction Manager', 'Finance Officer', 'Director', 'Admin Assistant'];
const STEPS = [
  { n: 1, label: 'Basic info', icon: IdCard },
  { n: 2, label: 'Access control', icon: ShieldCheck },
  { n: 3, label: 'Employment setup', icon: CalendarClock },
  { n: 4, label: 'Contract', icon: FileText },
  { n: 5, label: 'Send invite', icon: Send },
];

interface State {
  fullName: string; email: string; phone: string; idPassport: string; address: string; emergencyContact: string;
  role: AppRole; position: string; department: string;
  moduleAccess: string[];
  startDate: string; contractType: string; contractStatus: string; workSchedule: string;
  annualLeaveDays: string; sickLeaveDays: string; specialLeaveDays: string; unpaidLeaveDays: string;
  benefits: Record<string, boolean>;
  agreedSalary: string; salaryFrequency: string; commissionPct: string; bonusStructure: string;
  contractTitle: string; contractFileType: string; cStart: string; cExpiry: string; cRenewal: string; cProbation: string;
  contractPath: string; contractBucket: string;
  files: { path: string; name: string; type: string }[];
  cMonths: string;
  cActive: boolean;
}
const initial: State = {
  fullName: '', email: '', phone: '', idPassport: '', address: '', emergencyContact: '',
  role: 'sales', position: '', department: '',
  moduleAccess: ['leads'],
  startDate: '', contractType: 'full_time', contractStatus: 'active', workSchedule: '5_day',
  annualLeaveDays: '', sickLeaveDays: '', specialLeaveDays: '', unpaidLeaveDays: '',
  benefits: {},
  agreedSalary: '', salaryFrequency: 'monthly', commissionPct: '', bonusStructure: '',
  contractTitle: 'Employment contract', contractFileType: 'contract', cStart: '', cExpiry: '', cRenewal: '', cProbation: '',
  contractPath: '', contractBucket: '',
  files: [],
  cMonths: '12',
  cActive: true,
};

/** Λήξη = έναρξη + διάρκεια − 1 μέρα (π.χ. 08/11/2026 + 12 μήνες → 07/11/2027). */
function endOf(start: string, months: string): string {
  const m = Number(months);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !m) return '';
  const [y, mo, d] = start.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + m, d));
  if (t.getUTCDate() !== d) t.setUTCDate(0); // 31/1 + 1 μήνας → 28/2
  t.setUTCDate(t.getUTCDate() - 1);
  return t.toISOString().slice(0, 10);
}
/** Ίδια μέρα μετά από Ν μήνες (επέτειος), π.χ. 08/11/2026 + 12 → 08/11/2027. */
function plusMonths(start: string, months: string): string { const e = endOf(start, months); if (!e) return ''; const t = new Date(`${e}T00:00:00Z`); t.setUTCDate(t.getUTCDate() + 1); return t.toISOString().slice(0, 10); }
/** Ανανέωση = έναρξη + διάρκεια· δοκιμαστική = έναρξη + 6 μήνες. Η λήξη ΔΕΝ μπαίνει αυτόματα (μόνο αν τερματιστεί η συνεργασία). */
const withDates = (start: string, months: string) => ({ cStart: start, cMonths: months, cRenewal: plusMonths(start, months), cProbation: plusMonths(start, '6') });

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block text-xs text-charcoal-600/70">{label}<div className="mt-1">{children}</div></label>
);
const Card = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="rounded-lg border border-stone-line p-4">
    <p className="eyebrow mb-3">{title}</p>
    {children}
  </div>
);

export function EmployeeVerification() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [s, setS] = useState<State>(initial);
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [result, setResult] = useState<{ link: string; emailSent: boolean } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }));
  const toggleModule = (k: string) => set({ moduleAccess: s.moduleAccess.includes(k) ? s.moduleAccess.filter((m) => m !== k) : [...s.moduleAccess, k] });
  const toggleBenefit = (k: string) => set({ benefits: { ...s.benefits, [k]: !s.benefits[k] } });

  const [upErr, setUpErr] = useState<string | null>(null);
  const [docType, setDocType] = useState('contract');
  async function uploadTo(file: File): Promise<string | null> {
    setUploading(true); setUpErr(null);
    const supabase = createSupabaseBrowserClient();
    const safe = file.name.normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80);
    const path = `invites/${(s.email || 'pending').toLowerCase()}/${crypto.randomUUID()}-${safe}`;
    const { error } = await supabase.storage.from('contracts').upload(path, file, { upsert: false });
    setUploading(false);
    if (error) { setUpErr(`Δεν ανέβηκε το «${file.name}»: ${error.message}`); return null; }
    return path;
  }
  async function uploadContract(file: File) {
    const path = await uploadTo(file);
    if (path) set({ contractPath: path, contractBucket: 'contracts' });
  }
  async function uploadFiles(list: FileList) {
    for (const f of Array.from(list)) {
      if (f.size > 20 * 1024 * 1024) { setUpErr(`Το «${f.name}» είναι πάνω από 20MB.`); continue; }
      const path = await uploadTo(f);
      if (path) setS((p) => ({ ...p, files: [...p.files, { path, name: f.name, type: docType }] }));
    }
  }

  function submit() {
    startTransition(async () => {
      const res = await createEmployeeInvite({
        email: s.email, fullName: s.fullName, phone: s.phone || undefined, idPassport: s.idPassport || undefined,
        address: s.address || undefined, emergencyContact: s.emergencyContact || undefined,
        role: s.role, position: s.position || undefined, department: s.department || undefined,
        moduleAccess: s.moduleAccess,
        startDate: s.startDate || undefined, contractType: s.contractType, contractStatus: s.contractStatus, workSchedule: s.workSchedule,
        annualLeaveDays: s.annualLeaveDays ? Number(s.annualLeaveDays) : undefined,
        sickLeaveDays: s.sickLeaveDays ? Number(s.sickLeaveDays) : undefined,
        specialLeaveDays: s.specialLeaveDays ? Number(s.specialLeaveDays) : undefined,
        unpaidLeaveDays: s.unpaidLeaveDays ? Number(s.unpaidLeaveDays) : undefined,
        benefits: s.benefits,
        agreedSalary: s.agreedSalary ? Number(s.agreedSalary) : undefined, salaryBasis: 'gross',
        salaryFrequency: s.salaryFrequency, commissionPct: s.commissionPct ? Number(s.commissionPct) : undefined,
        bonusStructure: s.bonusStructure || undefined,
        contracts: ((s.contractTitle && (s.contractPath || s.cStart || !s.files.length)) || s.contractPath || s.cStart ? [{
          type: s.contractFileType, title: s.contractTitle, start_date: s.cStart || undefined, expiry_date: s.cExpiry || undefined,
          renewal_date: s.cRenewal || undefined, probation_end_date: s.cProbation || undefined,
          storage_path: s.contractPath || undefined, bucket: s.contractBucket || undefined,
        }] : []).concat(s.files.map((f) => ({
          type: f.type, title: f.name, start_date: f.type === 'contract' ? (s.cStart || s.startDate || undefined) : undefined,
          expiry_date: undefined, renewal_date: undefined, probation_end_date: undefined,
          storage_path: f.path, bucket: 'contracts',
        }))),
      });
      setResult(res ?? null);
      setDone(true);
      router.refresh();
    });
  }
  function reset() { setS(initial); setStep(1); setDone(false); setOpen(false); setResult(null); setCopied(false); }

  if (!open) return <button onClick={() => setOpen(true)} className="btn-primary"><UserPlus size={15} strokeWidth={1.75} /> Verify & invite employee</button>;
  const canContinue = step === 1 ? !!(s.fullName && s.email) : true;

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-md bg-white shadow-overlay">
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4">
          <div><p className="eyebrow">Employee Verification</p><h3 className="text-lg">{done ? 'Invite sent' : STEPS[step - 1].label}</h3></div>
          <button onClick={reset} className="text-charcoal-600 hover:text-charcoal">✕</button>
        </div>

        {!done && (
          <div className="flex flex-wrap gap-1.5 border-b border-stone-line px-6 py-3">
            {STEPS.map((st) => (
              <button key={st.n} onClick={() => setStep(st.n)} className={`flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium ${step === st.n ? 'bg-forest text-stone-100' : step > st.n ? 'bg-sand-100 text-forest' : 'bg-sand-100 text-charcoal-600/60'}`}>
                {step > st.n ? <Check size={11} /> : <st.icon size={11} />} {st.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {done ? (
            <div className="py-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-forest/10 text-forest"><Check size={22} /></div>
              <p className="text-sm text-charcoal">{result?.emailSent ? <>Invite emailed to <strong>{s.email}</strong>.</> : <>The invite was created, but <strong>no email was sent</strong> (email sending is not set up yet). Send the activation link below to <strong>{s.fullName || s.email}</strong> yourself.</>} The full verification profile activates when they accept.</p>
              {result?.link && (
                <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
                  <input readOnly value={result.link} className="input text-xs" onFocus={(e) => e.target.select()} />
                  <div className="flex flex-wrap justify-center gap-2">
                    <button type="button" onClick={() => { void navigator.clipboard?.writeText(result.link); setCopied(true); }} className="btn-secondary text-sm">{copied ? 'Copied ✓' : 'Copy link'}</button>
                    {s.phone && <a href={`https://wa.me/${s.phone.replace(/[^\d]/g, '').replace(/^(\d{8})$/, '357$1')}?text=${encodeURIComponent(`Welcome to Oramira! Activate your account: ${result.link}`)}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm">Send via WhatsApp</a>}
                    <a href={`mailto:${s.email}?subject=${encodeURIComponent('Your Oramira OS access')}&body=${encodeURIComponent(`Welcome to the team! Activate your account: ${result.link}`)}`} className="btn-secondary text-sm">Open in email</a>
                  </div>
                </div>
              )}
              <button onClick={reset} className="btn-primary mt-4">Done</button>
            </div>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-4">
                  <Card title="Basic info">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Full name"><input value={s.fullName} onChange={(e) => set({ fullName: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Email"><input type="email" value={s.email} onChange={(e) => set({ email: e.target.value })} className="input text-sm" /></Field>
                      <Field label="System role"><select value={s.role} onChange={(e) => set({ role: e.target.value as AppRole })} className="input text-sm">{INTERNAL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select></Field>
                      <Field label="Position"><input list="positions" value={s.position} onChange={(e) => set({ position: e.target.value })} placeholder="e.g. Real Estate Agent" className="input text-sm" /><datalist id="positions">{POSITIONS.map((p) => <option key={p} value={p} />)}</datalist></Field>
                    </div>
                  </Card>
                  <Card title="Additional details (optional)">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Phone"><PhoneInput value={s.phone} onChange={(v) => set({ phone: v })} /></Field>
                      <Field label="ID / Passport"><input value={s.idPassport} onChange={(e) => set({ idPassport: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Address"><input value={s.address} onChange={(e) => set({ address: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Emergency contact"><input value={s.emergencyContact} onChange={(e) => set({ emergencyContact: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Department"><input value={s.department} onChange={(e) => set({ department: e.target.value })} placeholder="e.g. Sales" className="input text-sm" /></Field>
                      <Field label="Starting date"><input type="date" value={s.startDate} onChange={(e) => set({ startDate: e.target.value, ...(!s.cStart || s.cStart === s.startDate ? withDates(e.target.value, s.cMonths) : {}) })} className="input text-sm" /></Field>
                    </div>
                  </Card>
                  <Card title="Documents (contract, ID, certificates)">
                    <div className="flex flex-wrap items-center gap-2">
                      <select value={docType} onChange={(e) => setDocType(e.target.value)} className="input w-auto text-sm" aria-label="Document type">
                        <option value="contract">Employment contract</option><option value="id">ID / Passport copy</option><option value="nda">NDA</option><option value="certificate">Certificate</option><option value="other">Other</option>
                      </select>
                      <label className="flex flex-1 cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2 text-sm text-charcoal-600/80 hover:bg-sand-100">
                        <Paperclip size={15} strokeWidth={1.75} /> {uploading ? 'Uploading…' : 'Upload files (PDF, Word, images — up to 20MB each)'}
                        <input type="file" multiple accept="application/pdf,image/*,.doc,.docx" className="hidden" disabled={uploading} onChange={(e) => { if (e.target.files?.length) void uploadFiles(e.target.files); e.target.value = ''; }} />
                      </label>
                    </div>
                    {upErr && <p className="mt-2 text-xs text-signal-danger">{upErr}</p>}
                    {s.files.length > 0 && (
                      <ul className="mt-3 space-y-1 text-sm">
                        {s.files.map((f, i) => (
                          <li key={f.path} className="flex items-center justify-between gap-2 rounded bg-sand-100/60 px-2 py-1">
                            <span className="truncate"><FileText size={13} className="mr-1 inline" />{f.name} <span className="text-xs text-charcoal-600/60">· {f.type}</span></span>
                            <button type="button" onClick={() => set({ files: s.files.filter((_, j) => j !== i) })} className="text-xs text-charcoal-600/60 hover:text-signal-danger">Remove</button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!s.email && <p className="mt-2 text-[11px] text-charcoal-600/50">Tip: fill in the email first so the files are filed under this employee.</p>}
                  </Card>
                </div>
              )}

              {step === 2 && (
                <Card title="Workspace access — role + manual grants">
                  <p className="mb-3 text-xs text-charcoal-600/60">Admin decides exactly what this employee can access, independent of their system role.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MODULES.map((m) => {
                      const on = s.moduleAccess.includes(m.key);
                      return (
                        <button key={m.key} onClick={() => toggleModule(m.key)} className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm ${on ? 'border-forest bg-forest/5' : 'border-stone-line'}`}>
                          <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>{on && <Check size={11} />}</span>
                          {m.label}
                        </button>
                      );
                    })}
                  </div>
                </Card>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <Card title="Employment">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Start date"><input type="date" value={s.startDate} onChange={(e) => set({ startDate: e.target.value, ...(!s.cStart || s.cStart === s.startDate ? withDates(e.target.value, s.cMonths) : {}) })} className="input text-sm" /></Field>
                      <Field label="Work schedule"><select value={s.workSchedule} onChange={(e) => set({ workSchedule: e.target.value })} className="input text-sm"><option value="5_day">5-day week</option><option value="6_day">6-day week</option></select></Field>
                    </div>
                  </Card>
                  <Card title="Leave entitlement">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Annual leave (days)"><input type="number" value={s.annualLeaveDays} onChange={(e) => set({ annualLeaveDays: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Sick leave (days)"><input type="number" value={s.sickLeaveDays} onChange={(e) => set({ sickLeaveDays: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Special leave (days)"><input type="number" value={s.specialLeaveDays} onChange={(e) => set({ specialLeaveDays: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Unpaid leave (days)"><input type="number" value={s.unpaidLeaveDays} onChange={(e) => set({ unpaidLeaveDays: e.target.value })} className="input text-sm" /></Field>
                    </div>
                  </Card>
                  <Card title="Salary master">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Gross salary (€)"><input type="number" value={s.agreedSalary} onChange={(e) => set({ agreedSalary: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Frequency"><select value={s.salaryFrequency} onChange={(e) => set({ salaryFrequency: e.target.value })} className="input text-sm"><option value="monthly">Monthly</option><option value="biweekly">Bi-weekly</option><option value="weekly">Weekly</option></select></Field>
                      <Field label="Commission %"><input type="number" value={s.commissionPct} onChange={(e) => set({ commissionPct: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Bonus structure"><input value={s.bonusStructure} onChange={(e) => set({ bonusStructure: e.target.value })} placeholder="e.g. 1 month on target" className="input text-sm" /></Field>
                    </div>
                    <p className="mt-2 text-xs text-charcoal-600/50">All monthly payroll originates from this gross figure.</p>
                  </Card>
                  <Card title="Benefits">
                    <div className="grid grid-cols-2 gap-2">
                      {BENEFITS.map((b) => {
                        const on = !!s.benefits[b.key];
                        return (
                          <button key={b.key} onClick={() => toggleBenefit(b.key)} className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-sm ${on ? 'border-forest bg-forest/5' : 'border-stone-line'}`}>
                            <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>{on && <Check size={11} />}</span>
                            {b.label}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {step === 4 && (
                <Card title="Employment contract">
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Document type"><select value={s.contractFileType} onChange={(e) => set({ contractFileType: e.target.value })} className="input text-sm"><option value="contract">Employment contract</option><option value="nda">NDA</option><option value="agreement">Internal agreement</option><option value="amendment">Amendment</option></select></Field>
                    <Field label="Title"><input value={s.contractTitle} onChange={(e) => set({ contractTitle: e.target.value })} className="input text-sm" /></Field>
                    <Field label="Contract status"><select value={s.contractStatus} onChange={(e) => set({ contractStatus: e.target.value })} className="input text-sm"><option value="active">Active</option><option value="probation">Probation</option><option value="pending">Pending</option><option value="terminated">Terminated</option></select></Field>
                    <Field label="Contract type"><select value={s.contractType} onChange={(e) => set({ contractType: e.target.value })} className="input text-sm"><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="fixed_term">Fixed-term</option><option value="contractor">Contractor</option></select></Field>
                    <Field label="Start date"><input type="date" value={s.cStart} onChange={(e) => set(withDates(e.target.value, s.cMonths))} className="input text-sm" /></Field>
                    <Field label="Renewal every"><select value={s.cMonths} onChange={(e) => set(e.target.value ? withDates(s.cStart, e.target.value) : { cMonths: '', cRenewal: '', cProbation: plusMonths(s.cStart, '6') })} className="input text-sm">
                      <option value="3">3 months</option><option value="6">6 months</option><option value="12">1 year</option><option value="24">2 years</option><option value="36">3 years</option><option value="">Indefinite (no renewal)</option>
                    </select></Field>
                    <Field label="Renewal date (auto)"><input type="date" value={s.cRenewal} onChange={(e) => set({ cRenewal: e.target.value })} className="input text-sm" /></Field>
                    <div className="block text-xs text-charcoal-600/70">
                      <span className="flex items-center justify-between">Expiry / end date
                        <label className="flex items-center gap-1.5 text-charcoal"><input type="checkbox" checked={s.cActive} onChange={(e) => set({ cActive: e.target.checked, cExpiry: e.target.checked ? '' : s.cExpiry, contractStatus: e.target.checked ? (s.contractStatus === 'terminated' ? 'active' : s.contractStatus) : 'terminated' })} /> Active — no end date</label>
                      </span>
                      <div className="mt-1"><input type="date" value={s.cExpiry} disabled={s.cActive} onChange={(e) => set({ cExpiry: e.target.value })} className="input text-sm disabled:opacity-50" placeholder="Only if the cooperation ended" /></div>
                    </div>
                    <Field label="Probation end (auto = 6 months)"><input type="date" value={s.cProbation} onChange={(e) => set({ cProbation: e.target.value })} className="input text-sm" /></Field>
                  </div>
                  <label className="mt-3 flex cursor-pointer items-center gap-2 rounded border border-dashed border-stone-line px-3 py-2 text-sm text-charcoal-600/80 hover:bg-sand-100">
                    <Paperclip size={15} strokeWidth={1.75} /> {uploading ? 'Uploading…' : s.contractPath ? 'File attached ✓' : 'Attach contract file (PDF)'}
                    <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadContract(f); }} />
                  </label>
                </Card>
              )}

              {step === 5 && (
                <Card title="Review">
                  <div className="space-y-2 text-sm">
                    <Review k="Name" v={s.fullName} />
                    <Review k="Email" v={s.email} />
                    <Review k="Role / position" v={`${ROLE_LABEL[s.role]}${s.position ? ` · ${s.position}` : ''}`} />
                    <Review k="Access" v={s.moduleAccess.map((m) => MODULES.find((x) => x.key === m)?.label ?? m).join(', ') || 'None'} />
                    <Review k="Work schedule" v={s.workSchedule === '6_day' ? '6-day' : '5-day'} />
                    <Review k="Leave" v={`${s.annualLeaveDays || 0} annual · ${s.sickLeaveDays || 0} sick`} />
                    <Review k="Benefits" v={Object.keys(s.benefits).filter((k) => s.benefits[k]).map((k) => BENEFITS.find((b) => b.key === k)?.label).join(', ') || 'None'} />
                    <Review k="Gross salary" v={s.agreedSalary ? `${formatCurrency(Number(s.agreedSalary))} / ${s.salaryFrequency}` : '—'} />
                    <Review k="Starting date" v={s.startDate || '—'} />
                    <Review k="Contract" v={s.contractTitle ? `${s.contractTitle}${s.contractPath ? ' (file attached)' : ''}` : '—'} />
                    <Review k="Documents" v={s.files.map((f) => f.name).join(', ') || '—'} />
                  </div>
                  <p className="pt-3 text-xs text-charcoal-600/50">Sending the invite emails the employee an activation link. On acceptance this full profile becomes active.</p>
                </Card>
              )}
            </>
          )}
        </div>

        {!done && (
          <div className="flex items-center justify-between border-t border-stone-line px-6 py-4">
            <button onClick={() => setStep((n) => Math.max(1, n - 1))} disabled={step === 1} className="btn-ghost text-sm disabled:opacity-40"><ChevronLeft size={14} /> Back</button>
            {step < 5 ? (
              <button onClick={() => setStep((n) => Math.min(5, n + 1))} disabled={!canContinue} className="btn-primary text-sm disabled:opacity-50">Next <ChevronRight size={14} /></button>
            ) : (
              <button onClick={submit} disabled={isPending || !s.fullName || !s.email} className="btn-primary text-sm">{isPending ? 'Sending…' : <>Send invite <Send size={14} /></>}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const Review = ({ k, v }: { k: string; v: string }) => (
  <div className="flex justify-between gap-3 border-b border-stone-line pb-1.5"><span className="text-charcoal-600/70">{k}</span><span className="text-charcoal text-right">{v}</span></div>
);
