'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, FileText } from 'lucide-react';
import { approvePayroll } from '@/app/actions/hr';
import { formatCurrency } from '@/lib/format';

export interface PayslipRow {
  id: string;
  employee: string | null;
  period: string;
  gross_amount: number | null;
  net_amount: number | null;
  employer_cost: number | null;
  status: string;
  payment_date: string | null;
}

const STATUS_CLASS: Record<string, string> = { draft: 'badge-champagne', approved: 'badge-forest', paid: 'badge-forest' };

export function PayrollApprovals({ payslips }: { payslips: PayslipRow[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (payslips.length === 0) return <p className="text-sm text-charcoal-600/70">No payslips generated yet.</p>;

  return (
    <div className="panel overflow-hidden">
      <table className="table-base w-full">
        <thead><tr><th>Employee</th><th>Period</th><th>Gross</th><th>Net payable</th><th>Employer cost</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {payslips.map((p) => (
            <tr key={p.id} className="hover:bg-stone/60">
              <td className="font-medium text-charcoal">{p.employee ?? 'Employee'}</td>
              <td className="figure text-charcoal-600">{p.period}</td>
              <td className="figure">{formatCurrency(p.gross_amount)}</td>
              <td className="figure">{formatCurrency(p.net_amount)}</td>
              <td className="figure text-charcoal-600">{formatCurrency(p.employer_cost)}</td>
              <td><span className={STATUS_CLASS[p.status] ?? 'badge-neutral'}>{p.status}</span></td>
              <td className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <Link href={`/payslips/${p.id}`} className="btn-ghost text-xs"><FileText size={13} strokeWidth={1.75} /> View</Link>
                  {p.status === 'draft' && (
                    <button onClick={() => startTransition(async () => { await approvePayroll(p.id); router.refresh(); })} disabled={isPending} className="btn-ghost text-xs text-signal-success">
                      <Check size={13} strokeWidth={1.75} /> Approve
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
