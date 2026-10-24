import { PAYROLL_RATES } from '@/lib/payroll';
import { formatDate, formatDecimal } from '@/lib/format';

/** A row's monthly + annualised (×12) figures. */
function Row({ label, period, hideYearly }: { label: string; period: number; hideYearly?: boolean }) {
  const fmt = (n: number) => formatDecimal(n);
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-stone-line/70 py-1 text-[12px]">
      <span className="text-charcoal-600">{label}</span>
      <span className="figure w-20 text-right text-charcoal">{fmt(period)}</span>
      <span className="figure w-20 text-right text-charcoal-600/70">{hideYearly ? '' : fmt(period * 12)}</span>
    </div>
  );
}

function ColHeader({ title }: { title: string }) {
  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b-2 border-charcoal/30 pb-1 text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal-600/70">
      <span>{title}</span>
      <span className="w-20 text-right">Period</span>
      <span className="w-20 text-right">Yearly</span>
    </div>
  );
}

export interface PayslipEmployee {
  full_name: string | null;
  job_title: string | null;
  department: string | null;
  employment_start_date: string | null;
  agreed_salary: number | null;
  salary_basis: string | null;
  commission_pct: number | null;
  work_schedule: string | null;
}

/**
 * Cyprus-format payslip document — Earnings · Deductions · Contributions ·
 * Information, with monthly + annualised figures and the Net Salary box.
 * Rendered from the stored payroll breakdown; print-to-PDF friendly.
 */
export function PayslipDocument({
  employee,
  period,
  paymentDate,
  status,
  currency,
  b,
}: {
  employee: PayslipEmployee;
  period: string;
  paymentDate: string | null;
  status: string;
  currency: string;
  b: any; // PayrollBreakdown (stored jsonb)
}) {
  const sym = currency === 'EUR' ? '€' : '';
  const fmt = (n: number) => `${sym}${formatDecimal(Number(n ?? 0))}`;
  const insurable = Math.min(b.grossPay ?? 0, PAYROLL_RATES.socialInsurance.monthlyCap);
  const deductionsTotal = (b.totalDeductions ?? 0) + (b.advances ?? 0);
  const net = (b.grossPay ?? 0) - deductionsTotal;

  return (
    <div className="mx-auto max-w-4xl bg-white p-8 text-charcoal">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between border-b-2 border-forest pb-4">
        <div>
          <p className="font-display text-2xl text-forest">Oramira</p>
          <p className="text-xs uppercase tracking-eyebrow text-charcoal-600/60">Payslip</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium text-charcoal">{employee.full_name ?? '—'}</p>
          <p className="text-charcoal-600/70">{employee.job_title ?? ''}{employee.department ? ` · ${employee.department}` : ''}</p>
          {employee.employment_start_date && <p className="text-xs text-charcoal-600/60">Since {formatDate(employee.employment_start_date)}</p>}
        </div>
      </div>

      <div className="mb-5 flex items-center justify-between text-sm">
        <span className="text-charcoal-600/70">Period: <span className="figure text-charcoal">{period}</span></span>
        {status !== 'approved' && <span className="border-signal-warning/30 bg-champagne-50 text-signal-warning badge uppercase">{status}</span>}
        <span className="text-charcoal-600/70">Payment date: <span className="figure text-charcoal">{paymentDate ? formatDate(paymentDate) : '—'}</span></span>
      </div>

      {/* Four columns */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        <div>
          <ColHeader title="Earnings" />
          <Row label="Basic salary" period={b.baseGross ?? 0} />
          {(b.bonus ?? 0) > 0 && <Row label="Bonus" period={b.bonus} />}
          {(b.commission ?? 0) > 0 && <Row label="Commission" period={b.commission} />}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t-2 border-charcoal/30 py-1.5 text-[12px] font-semibold">
            <span>Total earnings</span><span className="figure w-20 text-right">{fmt(b.grossPay ?? 0)}</span><span className="figure w-20 text-right text-charcoal-600/70">{fmt((b.grossPay ?? 0) * 12)}</span>
          </div>
          <Row label="Insurable earnings" period={insurable} hideYearly />
        </div>

        <div>
          <ColHeader title="Deductions" />
          <Row label="Social Insurance" period={b.socialInsuranceEmployee ?? 0} />
          <Row label="GESY" period={b.gesyEmployee ?? 0} />
          <Row label="Income Tax (PAYE)" period={b.paye ?? 0} />
          {(b.otherDeductions ?? 0) > 0 && <Row label="Other deductions" period={b.otherDeductions} />}
          {(b.advances ?? 0) > 0 && <Row label="Advances" period={b.advances} />}
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t-2 border-charcoal/30 py-1.5 text-[12px] font-semibold">
            <span>Total deductions</span><span className="figure w-20 text-right">{fmt(deductionsTotal)}</span><span className="figure w-20 text-right text-charcoal-600/70">{fmt(deductionsTotal * 12)}</span>
          </div>
        </div>

        <div>
          <ColHeader title="Employer contributions" />
          <Row label="Social Insurance" period={b.socialInsuranceEmployer ?? 0} />
          <Row label="GESY" period={b.gesyEmployer ?? 0} />
          <Row label="Redundancy Fund" period={b.redundancy ?? 0} />
          <Row label="Social Cohesion" period={b.socialCohesion ?? 0} />
          <Row label="Industrial Training" period={b.training ?? 0} />
          <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-t-2 border-charcoal/30 py-1.5 text-[12px] font-semibold">
            <span>Total contributions</span><span className="figure w-20 text-right">{fmt(b.employerContributions ?? 0)}</span><span className="figure w-20 text-right text-charcoal-600/70">{fmt((b.employerContributions ?? 0) * 12)}</span>
          </div>
          <div className="mt-1 grid grid-cols-[1fr_auto] gap-2 py-1 text-[12px] font-semibold text-forest">
            <span>Company cost</span><span className="figure text-right">{fmt(b.employerCost ?? 0)}</span>
          </div>
        </div>

        <div>
          <p className="border-b-2 border-charcoal/30 pb-1 text-[10px] font-semibold uppercase tracking-eyebrow text-charcoal-600/70">Information</p>
          <div className="space-y-1.5 pt-2 text-[12px]">
            <div className="flex justify-between"><span className="text-charcoal-600">Agreed salary</span><span className="figure">{fmt(employee.agreed_salary ?? 0)} {employee.salary_basis ? `(${employee.salary_basis})` : ''}</span></div>
            <div className="flex justify-between"><span className="text-charcoal-600">Work schedule</span><span className="capitalize">{employee.work_schedule?.replace('_', '-') ?? '—'}</span></div>
            {employee.commission_pct != null && <div className="flex justify-between"><span className="text-charcoal-600">Commission</span><span className="figure">{employee.commission_pct}%</span></div>}
          </div>
        </div>
      </div>

      {/* Net salary box */}
      <div className="mt-8 flex items-center justify-end gap-4">
        <span className="text-sm uppercase tracking-eyebrow text-charcoal-600/70">Net salary</span>
        <span className="figure border-2 border-charcoal/40 bg-stone px-6 py-2 text-2xl font-semibold text-forest">{fmt(net)}</span>
      </div>

      <p className="mt-6 text-[10px] text-charcoal-600/50">
        Indicative computation based on standard Cyprus rates (Social Insurance, GESY, PAYE). Verify against current legislation before disbursement.
      </p>
    </div>
  );
}
