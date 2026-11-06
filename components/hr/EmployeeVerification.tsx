'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { createEmployeeInvite } from '@/app/actions/users';
import { INTERNAL_ROLES, ROLE_LABEL, type AppRole } from '@/lib/permissions';
import { UserPlus, IdCard, ShieldCheck, CalendarClock, FileText, Send, ChevronLeft, ChevronRight, Check, Paperclip } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

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
};

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
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }));
  const toggleModule = (k: string) => set({ moduleAccess: s.moduleAccess.includes(k) ? s.moduleAccess.filter((m) => m !== k) : [...s.moduleAccess, k] });
  const toggleBenefit = (k: string) => set({ benefits: { ...s.benefits, [k]: !s.benefits[k] } });

  async function uploadContract(file: File) {
    setUploading(true);
    const supabase = createSupabaseBrowserClient();
    const path = `invites/${s.email || 'pending'}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage.from('contracts').upload(path, file, { upsert: false });
    setUploading(false);
    if (!error) set({ contractPath: path, contractBucket: 'contracts' });
  }

  function submit() {
    startTransition(async () => {
      await createEmployeeInvite({
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
        contracts: (s.contractTitle || s.contractPath || s.cStart) ? [{
          type: s.contractFileType, title: s.contractTitle, start_date: s.cStart || undefined, expiry_date: s.cExpiry || undefined,
          renewal_date: s.cRenewal || undefined, probation_end_date: s.cProbation || undefined,
          storage_path: s.contractPath || undefined, bucket: s.contractBucket || undefined,
        }] : [],
      });
      setDone(true);
      router.refresh();
    });
  }
  function reset() { setS(initial); setStep(1); setDone(false); setOpen(false); }

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
              <p className="text-sm text-charcoal">Invite emailed to <strong>{s.email}</strong>. The full verification profile activates when they accept.</p>
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
                      <Field label="Phone"><input value={s.phone} onChange={(e) => set({ phone: e.target.value })} className="input text-sm" /></Field>
                      <Field label="ID / Passport"><input value={s.idPassport} onChange={(e) => set({ idPassport: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Address"><input value={s.address} onChange={(e) => set({ address: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Emergency contact"><input value={s.emergencyContact} onChange={(e) => set({ emergencyContact: e.target.value })} className="input text-sm" /></Field>
                      <Field label="Department"><input value={s.department} onChange={(e) => set({ department: e.target.value })} placeholder="e.g. Sales" className="input text-sm" /></Field>
                    </div>
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
                      <Field label="Start date"><input type="date" value={s.startDate} onChange={(e) => set({ startDate: e.target.value })} className="input text-sm" /></Field>
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
                    <Field label="Contract status"><select value={s.contractStatus} onChange={(e) => set({ contractStatus: e.target.value })} className="input text-sm"><option value="active">Active</option><option value="probation">Probation</option><option value="pending">Pending</option></select></Field>
                    <Field label="Contract type"><select value={s.contractType} onChange={(e) => set({ contractType: e.target.value })} className="input text-sm"><option value="full_time">Full-time</option><option value="part_time">Part-time</option><option value="fixed_term">Fixed-term</option><option value="contractor">Contractor</option></select></Field>
                    <Field label="Start date"><input type="date" value={s.cStart} onChange={(e) => set({ cStart: e.target.value })} className="input text-sm" /></Field>
                    <Field label="Expiry date"><input type="date" value={s.cExpiry} onChange={(e) => set({ cExpiry: e.target.value })} className="input text-sm" /></Field>
                    <Field label="Renewal date"><input type="date" value={s.cRenewal} onChange={(e) => set({ cRenewal: e.target.value })} className="input text-sm" /></Field>
                    <Field label="Probation end"><input type="date" value={s.cProbation} onChange={(e) => set({ cProbation: e.target.value })} className="input text-sm" /></Field>
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
                    <Review k="Contract" v={s.contractTitle ? `${s.contractTitle}${s.contractPath ? ' (file attached)' : ''}` : '—'} />
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
