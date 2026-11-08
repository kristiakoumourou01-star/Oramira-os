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
import { Tabs, type TabDef } from '@/components/ui/Tabs';
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

  const hrAlerts = await computeHrAlerts(supabase);
  const teamScores = await buildTeamPerformance(supabase, INTERNAL_ROLES);

  const payslipRows: PayslipRow[] = (payslips ?? []).map((p: any) => ({ id: p.id, employee: p.profiles?.full_name ?? null, period: p.period, gross_amount: p.gross_amount, net_amount: p.net_amount, employer_cost: p.employer_cost, status: p.status, payment_date: p.payment_date }));
  const contractRows: ContractRow[] = (contracts ?? []).map((c: any) => ({ id: c.id, employee: c.profiles?.full_name ?? null, type: c.type, title: c.title, status: c.status, start_date: c.start_date, expiry_date: c.expiry_date }));
  const commissionRows: CommissionRow[] = (commissions ?? []).map((c: any) => ({ id: c.id, employee: c.profiles?.full_name ?? null, base_value: c.base_value, commission_pct: c.commission_pct, amount: c.amount, status: c.status, created_at: c.created_at }));
  const emps = (employees ?? []) as Employee[];

  const tabs: TabDef[] = [
    {
      id: 'team', label: 'Team Score', content: (
        <Panel><TeamPerformance scores={teamScores} /></Panel>
      ),
    },
    {
      id: 'verification', label: 'Employee Verification', content: (
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
      id: 'salary', label: 'Salary Management', content: (
        <div className="space-y-4">
          <PayrollAdmin employees={emps} />
          <PayrollApprovals payslips={payslipRows} />
          <CommissionsAdmin commissions={commissionRows} />
        </div>
      ),
    },
    {
      id: 'intelligence',
      label: hrAlerts.filter((a) => a.severity === 'high').length > 0 ? `Intelligence · ${hrAlerts.filter((a) => a.severity === 'high').length}` : 'Intelligence',
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
    { id: 'contracts', label: 'Contracts', content: <ContractsAdmin employees={emps} contracts={contractRows} /> },
    {
      id: 'payslips', label: 'Payslips', content: (
        <Panel>{payslipRows.length === 0 ? <p className="text-sm text-charcoal-600/70">No payslips yet.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs uppercase tracking-wide text-charcoal-600/50"><th className="pb-2">Employee</th><th className="pb-2">Period</th><th className="pb-2 text-right">Net</th><th className="pb-2 text-right">Status</th></tr></thead>
            <tbody>{payslipRows.map((p) => (<tr key={p.id} className="border-t border-stone-line"><td className="py-2 text-charcoal">{p.employee ?? '—'}</td><td className="py-2 text-charcoal-600">{p.period}</td><td className="py-2 text-right figure text-charcoal">{p.net_amount != null ? `${formatCurrency(Number(p.net_amount))}` : '—'}</td><td className="py-2 text-right"><span className={p.status === 'approved' ? 'badge-forest' : 'badge-neutral'}>{p.status}</span></td></tr>))}</tbody>
          </table>
        )}</Panel>
      ),
    },
    { id: 'leave', label: 'Leave', content: <LeaveManager me={me.id} canEdit={canEditHr} employees={emps} balances={((balances ?? []) as any[]).map((b) => ({ ...b, total_days: Number(b.total_days ?? 0), used_days: Number(b.used_days ?? 0) }))} requests={((allLeave ?? []) as any[]).map((r) => ({ ...r, employee: r.profiles?.full_name ?? null }))} /> },
    {
      id: 'benefits', label: 'Benefits', content: (
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
      <WorkspaceHeader eyebrow="Workspace" title="HR" action={<EmployeeVerification />} />
      <Tabs tabs={tabs} initial={searchParams?.tab} />
    </div>
  );
}
