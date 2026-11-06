import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PrintButton } from '@/components/hr/PrintButton';
import { DownloadPayslipButton } from '@/components/hr/DownloadPayslipButton';
import { PayslipDocument, type PayslipEmployee } from '@/components/hr/PayslipDocument';

/**
 * Standalone payslip view (outside the app chrome so print → PDF is clean).
 * RLS returns the row only to its owner or HR.
 */
export default async function PayslipPage({ params }: { params: { id: string } }) {
  await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: slip } = await supabase
    .from('payslips')
    .select(
      `id, period, payment_date, status, currency, breakdown,
       profiles(full_name, job_title, department, employment_start_date, agreed_salary, salary_basis, commission_pct, work_schedule)`
    )
    .eq('id', params.id)
    .maybeSingle();
  if (!slip) notFound(); // RLS returns null if not yours / not HR

  const emp = (slip as any).profiles as PayslipEmployee;

  return (
    <div className="min-h-screen bg-stone p-8">
      <div className="mx-auto mb-4 flex max-w-4xl items-center justify-between print:hidden">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-charcoal-600/70 hover:text-forest">
          <ArrowLeft size={14} strokeWidth={1.75} /> Back
        </Link>
        <div className="flex items-center gap-2">
          {slip.status === 'approved' && <DownloadPayslipButton payslipId={slip.id} />}
          <PrintButton />
        </div>
      </div>

      <div className="mx-auto max-w-4xl rounded-md border border-stone-line shadow-soft print:border-0 print:shadow-none">
        <PayslipDocument
          employee={emp}
          period={slip.period}
          paymentDate={slip.payment_date}
          status={slip.status}
          currency={slip.currency}
          b={slip.breakdown ?? {}}
        />
      </div>
    </div>
  );
}
