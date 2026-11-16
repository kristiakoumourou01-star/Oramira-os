import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { INTERNAL_ROLES } from '@/lib/permissions';
import { LeaveManager } from '@/components/hr/LeaveManager';
import { effectiveCan } from '@/lib/permissions';
import { PayrollAdmin, type Employee } from '@/components/hr/PayrollAdmin';
import { PayrollApprovals, type PayslipRow } from '@/components/hr/PayrollApprovals';
import { ContractsAdmin, type ContractRow } from '@/components/hr/ContractsAdmin';
import { CommissionsAdmin, type CommissionRow } from '@/components/hr/CommissionsAdmin';
import { EmployeeVerification } from '@/components/hr/EmployeeVerification';
import { HrIntelligence } from '@/components/hr/HrIntelligence';
import { TeamPerformance } from '@/components/hr/TeamPerformance';
import { computeHrAlerts } from '@/lib/hr-intelligence';
import { buildTeamPerformance } from '@/lib/team-performance';
import { HubTabs, type HubTabDef } from '@/components/ui/HubTabs';
import { EmployeeDocuments, type EmpDoc } from '@/components/hr/EmployeeDocuments';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';
import { UserPlus } from 'lucide-react';
import { formatCurrency } from '@/lib/format';

const BENEFIT_LABEL: Record<string, string> = {
  health_insurance: 'Health insurance', company_car: 'Company car', fuel_allowance: 'Fuel allowance',
  phone_allowance: 'Phone allowance', bonus_eligible: 'Bonus eligible', commission_eligible: 'Commission eligible',
};
const Panel = ({ children }: { children: React.ReactNode }) => <div className="panel p-6">{children}</div>;

export default async function HRWorkspacePage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await requirePermission('hr');
  const supabase = await createSupabaseServerClient();
  const canEditHr = effectiveCan(me.role, me.moduleAccess, 'hr', 'edit', me.permissions);
  const [{ data: allLeave }, { data: balances }] = await Promise.all([
    supabase.from('leave_requests').select('id, profile_id, leave_type, start_date, end_date, days, reason, status, created_at, profiles!leave_requests_profile_id_fkey(full_name)').order('start_date', { ascending: false }).limit(1000),
    supabase.from('leave_balances').select('profile_id, leave_type, year, total_days, used_days'),
  ]);

  const [{ data: pending }, { data: employees }, { data: payslips }, { data: contracts }, { data: commissions }, { data: staff }] = await Promise.all([
    supabase.from('leave_requests').select('id').eq('status', 'pending').order('created_at', { ascending: false }),
    supabase.from('profiles').select('id, full_name').in('role', INTERNAL_ROLES).order('full_name'),
    supabase.from('payslips').select('id, period, gross_amount, net_amount, employer_cost, status, payment_date, profiles(full_name)').order('issued_at', { ascending: false }).limit(50),
    supabase.from('employee_contracts').select('id, type, title, status, start_date, expiry_date, profiles(full_name)').order('created_at', { ascending: false }),
    supabase.from('commissions').select('id, base_value, commission_pct, amount, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(50),
    supabase.from('profiles').select('id, full_name, job_title, benefits').in('role', INTERNAL_ROLES).order('full_name'),
  ]);

  const { data: docRows } = await (supabase as any).from('documents').select('id, entity_id, title, description, notes, bucket, storage_path, created_at, uploader:uploaded_by(full_name)').eq('entity_type', 'profile').order('created_at', { ascending: false }).limit(2000);
  const empName = new Map(((employees ?? []) as any[]).map((e) => [e.id, e.full_name ?? '—']));
  const empDocs: EmpDoc[] = ((docRows ?? []) as any[]).map((d) => {
    const [kind, exp] = String(d.description ?? '').split('|');
    return { id: d.id, profileId: d.entity_id, employee: empName.get(d.entity_id) ?? '—', title: d.title ?? 'Έγγραφο', kind: kind || 'other', expires: exp?.startsWith('λήξη:') ? exp.slice(5) : null, notes: d.notes, bucket: d.bucket, path: d.storage_path, createdAt: d.created_at, uploader: d.uploader?.full_name ?? null };
  });
  const hrAlerts = await computeHrAlerts(supabase);
  const teamScores = await buildTeamPerformance(supabase, INTERNAL_ROLES);

  const payslipRows: PayslipRow[] = (payslips ?? []).map((p: any) => ({ id: p.id, employee: p.profiles?.full_name ?? null, period: p.period, gross_amount: p.gross_amount, net_amount: p.net_amount, employer_cost: p.employer_cost, status: p.status, payment_date: p.payment_date }));
  const contractRows: ContractRow[] = (contracts ?? []).map((c: any) => ({ id: c.id, employee: c.profiles?.full_name ?? null, type: c.type, title: c.title, status: c.status, start_date: c.start_date, expiry_date: c.expiry_date }));
  const commissionRows: CommissionRow[] = (commissions ?? []).map((c: any) => ({ id: c.id, employee: c.profiles?.full_name ?? null, base_value: c.base_value, commission_pct: c.commission_pct, amount: c.amount, status: c.status, created_at: c.created_at }));
  const emps = (employees ?? []) as Employee[];

  const pendingCount = (pending ?? []).length;
  const benefitCount = ((staff ?? []) as any[]).filter((e) => Object.values(e.benefits ?? {}).some(Boolean)).length;
  const tabs: HubTabDef[] = [
    {
      id: 'team', label: 'Υπάλληλοι', icon: 'Users', value: emps.length, sub: 'Απόδοση και βαθμολογία ομάδας', content: (
        <Panel><TeamPerformance scores={teamScores} /></Panel>
      ),
    },
    {
      id: 'verification', label: 'Νέος υπάλληλος', icon: 'UserPlus', sub: 'Πρόσληψη, επαλήθευση και πρόσκληση', content: (
        <Panel>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="mb-1 text-sm text-charcoal-600/80">The master employee system. Verify a new hire end-to-end — identity, role, manual access, employment, leave, benefits, salary, and contract — then send the activation invite.</p>
              <p className="text-xs text-charcoal-600/50">Flow: Invite → Verification → Contract → Salary → Permissions → Active. Payroll, permissions, and leave all originate here.</p>
            </div>
            <UserPlus size={20} className="shrink-0 text-olive" strokeWidth={1.75} />
          </div>
        </Panel>
      ),
    },
    {
      id: 'salary', label: 'Μισθοδοσία', icon: 'Wallet', value: payslipRows.length, sub: 'Μισθοί, εγκρίσεις και προμήθειες', content: (
        <div className="space-y-4">
          <PayrollAdmin employees={emps} />
          <PayrollApprovals payslips={payslipRows} />
          <CommissionsAdmin commissions={commissionRows} />
        </div>
      ),
    },
    {
      id: 'intelligence', label: 'Ειδοποιήσεις HR', icon: 'ShieldAlert', value: hrAlerts.filter((a) => a.severity === 'high').length, sub: 'Κίνδυνοι και ειδοποιήσεις HR',
      content: (
        <Panel>
          <div className="mb-4">
            <p className="text-sm font-medium text-charcoal">HR Intelligence</p>
            <p className="text-xs text-charcoal-600/50">Automatic risk & anomaly detection across contracts, payroll, leave, commissions and reviews.</p>
          </div>
          <HrIntelligence alerts={hrAlerts} />
        </Panel>
      ),
    },
    { id: 'contracts', label: 'Συμβάσεις', icon: 'FileSignature', value: contractRows.length, sub: 'Συμβάσεις εργασίας και λήξεις', content: <ContractsAdmin employees={emps} contracts={contractRows} /> },
    {
      id: 'payslips', label: 'Εκκαθαριστικά', icon: 'Receipt', value: payslipRows.length, sub: 'Εκκαθαριστικά ανά μήνα', content: (
        <div className="overflow-hidden rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">{payslipRows.length === 0 ? <p className="p-6 text-sm text-charcoal-600/70">Δεν υπάρχουν ακόμη εκκαθαριστικά.</p> : (
          <div className="overflow-x-auto"><table className="o-table"><thead><tr><th>Υπάλληλος</th><th>Περίοδος</th><th className="text-right">Καθαρό</th><th className="text-right">Κατάσταση</th></tr></thead>
            <tbody>{payslipRows.map((p) => (<tr key={p.id}><td className="o-strong" data-no-tr>{p.employee ?? '—'}</td><td>{p.period}</td><td className="text-right tabular-nums">{p.net_amount != null ? `${formatCurrency(Number(p.net_amount))}` : '—'}</td><td className="text-right"><span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${p.status === 'approved' || p.status === 'paid' ? 'border-forest/30 bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal'}`}>{({ draft: 'Πρόχειρο', approved: 'Εγκρίθηκε', paid: 'Πληρώθηκε' } as Record<string, string>)[p.status] ?? p.status}</span></td></tr>))}</tbody>
          </table></div>
        )}</div>
      ),
    },
    { id: 'documents', label: 'Έγγραφα', icon: 'FolderOpen', value: empDocs.length, sub: 'Ταυτότητες, συμβάσεις, πιστοποιητικά', content: <EmployeeDocuments docs={empDocs} employees={emps.map((e: any) => ({ id: e.id, name: e.full_name ?? '—' }))} canEdit={canEditHr} /> },
    { id: 'leave', label: 'Άδειες', icon: 'Plane', value: pendingCount, sub: pendingCount ? `${pendingCount} περιμένουν έγκριση` : 'Αιτήματα και υπόλοιπα', content: <LeaveManager me={me.id} canEdit={canEditHr} employees={emps} balances={((balances ?? []) as any[]).map((b) => ({ ...b, total_days: Number(b.total_days ?? 0), used_days: Number(b.used_days ?? 0) }))} requests={((allLeave ?? []) as any[]).map((r) => ({ ...r, employee: r.profiles?.full_name ?? null }))} /> },
    {
      id: 'benefits', label: 'Benefits', icon: 'Gift', value: benefitCount, sub: 'Παροχές υπαλλήλων', content: (
        <Panel>
          <ul className="divide-y divide-stone-line">
            {(staff ?? []).map((e: any) => {
              const b = (e.benefits ?? {}) as Record<string, boolean>;
              const active = Object.keys(b).filter((k) => b[k]);
              return (
                <li key={e.id} className="flex items-start justify-between gap-3 py-3">
                  <div><p className="text-sm font-medium text-charcoal">{e.full_name ?? 'Employee'}</p><p className="text-xs text-charcoal-600/50">{e.job_title ?? '—'}</p></div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {active.length === 0 ? <span className="text-xs text-charcoal-600/50">No benefits</span> : active.map((k) => <span key={k} className="badge-neutral">{BENEFIT_LABEL[k] ?? k}</span>)}
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Ομάδα" title="Ομάδα & HR" description="Υπάλληλοι, άδειες, μισθοδοσία, συμβάσεις, έγγραφα και παροχές από ένα σημείο." action={<EmployeeVerification />} />
      <HubTabs tabs={[tabs.find((t) => t.id === 'team')!, tabs.find((t) => t.id === 'leave')!, tabs.find((t) => t.id === 'salary')!, tabs.find((t) => t.id === 'contracts')!, tabs.find((t) => t.id === 'documents')!, tabs.find((t) => t.id === 'benefits')!, tabs.find((t) => t.id === 'payslips')!, tabs.find((t) => t.id === 'intelligence')!, tabs.find((t) => t.id === 'verification')!]} initial={searchParams?.tab} cols={3} />
    </div>
  );
}
