'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { generatePayslip, setLeaveBalance } from '@/app/actions/hr';

export interface Employee { id: string; full_name: string | null }

/** HR: generate a payslip (via the Cyprus payroll engine) and set leave allowance. */
export function PayrollAdmin({ employees }: { employees: Employee[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const year = new Date().getFullYear();

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="panel p-6">
        <h4 className="mb-1">Generate payslip</h4>
        <p className="mb-4 text-xs text-charcoal-600/60">Grosses up the employee&apos;s agreed salary and computes Cyprus deductions automatically.</p>
        <form
          action={(fd) => {
            const profileId = String(fd.get('employee'));
            if (!profileId) return;
            startTransition(async () => {
              await generatePayslip({
                profileId,
                period: String(fd.get('period')),
                paymentDate: String(fd.get('paymentDate') || '') || undefined,
                bonus: Number(fd.get('bonus')) || undefined,
                commission: Number(fd.get('commission')) || undefined,
                advances: Number(fd.get('advances')) || undefined,
                otherDeductions: Number(fd.get('otherDeductions')) || undefined,
              });
              router.refresh();
            });
          }}
          className="space-y-3"
        >
          <select name="employee" required className="input">
            <option value="">Select employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? 'Employee'}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input name="period" required placeholder="Period (2026-06)" className="input" />
            <input name="paymentDate" type="date" className="input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input name="bonus" type="number" placeholder="Bonus (€)" className="input" />
            <input name="commission" type="number" placeholder="Commission (€)" className="input" />
            <input name="advances" type="number" placeholder="Advances (€)" className="input" />
            <input name="otherDeductions" type="number" placeholder="Other deductions (€)" className="input" />
          </div>
          <button type="submit" disabled={isPending} className="btn-primary w-full">Generate draft payslip</button>
        </form>
      </div>

      <div className="panel p-6">
        <h4 className="mb-4">Set leave allowance ({year})</h4>
        <form
          action={(fd) => {
            const profileId = String(fd.get('employee'));
            if (!profileId) return;
            startTransition(async () => {
              await setLeaveBalance({ profileId, leaveType: String(fd.get('type')), year, totalDays: Number(fd.get('days')) || 0 });
              router.refresh();
            });
          }}
          className="space-y-3"
        >
          <select name="employee" required className="input">
            <option value="">Select employee…</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? 'Employee'}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <select name="type" defaultValue="annual" className="input capitalize">
              {['annual', 'sick', 'unpaid'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input name="days" type="number" placeholder="Total days" className="input" />
          </div>
          <button type="submit" disabled={isPending} className="btn-secondary w-full">Set allowance</button>
        </form>
      </div>
    </div>
  );
}
