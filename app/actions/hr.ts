'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireProfile, requirePermission } from '@/lib/auth';
import { notifyUser } from '@/lib/notifications';
import { computePayroll, resolveGross } from '@/lib/payroll';
import { renderPayslipPdf } from '@/lib/payslip-pdf';
import { revalidatePath } from 'next/cache';
import { formatCurrency } from '@/lib/format';

const DAY = 24 * 60 * 60 * 1000;
function inclusiveDays(start: string, end: string): number {
  const d = Math.round((new Date(end).getTime() - new Date(start).getTime()) / DAY) + 1;
  return Math.max(1, d);
}

/** Employee submits a leave request (their own). */
export async function requestLeave(params: { leaveType: string; startDate: string; endDate: string; reason?: string }) {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  await supabase.from('leave_requests').insert({
    profile_id: profile.id,
    leave_type: params.leaveType,
    start_date: params.startDate,
    end_date: params.endDate,
    days: inclusiveDays(params.startDate, params.endDate),
    reason: params.reason ?? null,
  });
  revalidatePath('/dashboard');
  revalidatePath('/hr');
}

/** HR/admin approves or rejects a leave request; on approval, draws down the balance. */
export async function decideLeave(requestId: string, decision: 'approved' | 'rejected') {
  const profile = await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();

  const { data: req } = await supabase.from('leave_requests').select('id, profile_id, leave_type, days, start_date').eq('id', requestId).single();
  await supabase.from('leave_requests').update({ status: decision, decided_by: profile.id, decided_at: new Date().toISOString() }).eq('id', requestId);

  if (decision === 'approved' && req) {
    const year = new Date(req.start_date).getFullYear();
    const { data: bal } = await supabase
      .from('leave_balances')
      .select('id, used_days')
      .eq('profile_id', req.profile_id).eq('leave_type', req.leave_type).eq('year', year)
      .maybeSingle();
    if (bal) {
      await supabase.from('leave_balances').update({ used_days: Number(bal.used_days) + Number(req.days ?? 0) }).eq('id', bal.id);
    } else {
      await supabase.from('leave_balances').insert({ profile_id: req.profile_id, leave_type: req.leave_type, year, used_days: req.days ?? 0 });
    }
  }
  if (req) {
    await notifyUser({
      userId: req.profile_id,
      title: `Leave request ${decision}`,
      body: `Your ${req.leave_type} leave request was ${decision}.`,
      link: '/dashboard',
      event: 'leave_decision',
    });
  }
  revalidatePath('/hr');
  revalidatePath('/dashboard');
}

/** HR/admin sets an employee's leave allowance for a year. */
export async function setLeaveBalance(params: { profileId: string; leaveType: string; year: number; totalDays: number }) {
  await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase
    .from('leave_balances')
    .upsert({ profile_id: params.profileId, leave_type: params.leaveType, year: params.year, total_days: params.totalDays }, { onConflict: 'profile_id,leave_type,year' });
  revalidatePath('/hr');
}

/**
 * Generate a payslip via the Cyprus payroll engine. Grosses up the employee's
 * agreed salary (net or gross), applies bonuses/commission/advances/deductions,
 * and stores the full breakdown. Created as a draft until payroll is approved.
 */
export async function generatePayslip(params: {
  profileId: string;
  period: string;
  paymentDate?: string;
  bonus?: number;
  commission?: number;
  advances?: number;
  otherDeductions?: number;
}) {
  await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: emp } = await supabase.from('profiles').select('agreed_salary, salary_basis').eq('id', params.profileId).single();

  const gross = resolveGross(Number(emp?.agreed_salary ?? 0), (emp?.salary_basis as 'net' | 'gross') ?? 'gross');
  const b = computePayroll(gross, {
    bonus: params.bonus, commission: params.commission, advances: params.advances, otherDeductions: params.otherDeductions,
  });

  await supabase.from('payslips').insert({
    profile_id: params.profileId,
    period: params.period,
    payment_date: params.paymentDate ?? null,
    gross_amount: b.grossPay,
    net_amount: b.netPayable,
    employer_cost: b.employerCost,
    total_deductions: b.totalDeductions,
    bonus: b.bonus,
    commission: b.commission,
    advances: b.advances,
    breakdown: b as any,
    status: 'draft',
  });
  revalidatePath('/hr');
}

/**
 * Approve a payslip / payroll run — locks it, renders a real PDF, stores it in
 * the private hr-documents bucket, records the path, and notifies the employee.
 */
export async function approvePayroll(payslipId: string) {
  const profile = await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: slip } = await supabase
    .from('payslips')
    .select('profile_id, period, payment_date, currency, breakdown, profiles(full_name, job_title, department)')
    .eq('id', payslipId)
    .single();

  let pdfPath: string | null = null;
  if (slip) {
    const emp = (slip as any).profiles ?? {};
    try {
      const bytes = await renderPayslipPdf({
        employeeName: emp.full_name ?? 'Employee',
        position: emp.job_title ?? '',
        department: emp.department ?? '',
        period: slip.period,
        paymentDate: slip.payment_date,
        currency: slip.currency,
        b: slip.breakdown ?? {},
      });
      const path = `${slip.profile_id}/${payslipId}.pdf`;
      const svc = createSupabaseServiceRoleClient();
      const { error } = await svc.storage
        .from('hr-documents')
        .upload(path, Buffer.from(bytes), { contentType: 'application/pdf', upsert: true });
      if (!error) pdfPath = path;
    } catch (e) {
      console.error('payslip pdf render/upload failed', e);
    }
  }

  await supabase
    .from('payslips')
    .update({ status: 'approved', approved_by: profile.id, approved_at: new Date().toISOString(), ...(pdfPath ? { pdf_path: pdfPath } : {}) })
    .eq('id', payslipId);
  if (slip) await notifyUser({ userId: slip.profile_id, title: 'Payslip available', body: `Your payslip for ${slip.period} is ready to download.`, link: '/dashboard', event: 'payslip_ready' });
  revalidatePath('/hr');
  revalidatePath('/dashboard');
}

/**
 * Return a short-lived signed download URL for a payslip PDF. RLS on the
 * payslips table gates who may read the row (owner or HR); the file itself
 * lives in a private bucket and is signed with the service role.
 */
export async function payslipDownloadUrl(payslipId: string): Promise<string | null> {
  await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: slip } = await supabase.from('payslips').select('pdf_path').eq('id', payslipId).maybeSingle();
  if (!slip?.pdf_path) return null; // RLS null = not owner/HR, or PDF not generated
  const svc = createSupabaseServiceRoleClient();
  const { data } = await svc.storage.from('hr-documents').createSignedUrl(slip.pdf_path, 120, { download: true });
  return data?.signedUrl ?? null;
}

/** Record an employment document (contract / amendment / NDA / agreement). The
 *  file is uploaded client-side; here we record the document + contract row. */
export async function addContract(params: {
  profileId: string;
  type: string;
  title: string;
  storagePath?: string;
  startDate?: string;
  expiryDate?: string;
  probationEndDate?: string;
  renewalDate?: string;
}) {
  const profile = await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();

  let documentId: string | null = null;
  if (params.storagePath) {
    const { data: doc } = await supabase
      .from('documents')
      .insert({ category: 'contract', storage_path: params.storagePath, bucket: 'contracts', entity_type: 'profile', entity_id: params.profileId, title: params.title, uploaded_by: profile.id })
      .select('id')
      .single();
    documentId = doc?.id ?? null;
  }

  await supabase.from('employee_contracts').insert({
    profile_id: params.profileId,
    type: params.type,
    title: params.title,
    document_id: documentId,
    start_date: params.startDate ?? null,
    expiry_date: params.expiryDate ?? null,
    probation_end_date: params.probationEndDate ?? null,
    renewal_date: params.renewalDate ?? null,
    created_by: profile.id,
  });
  revalidatePath('/hr');
}

/** HR marks a sales commission as paid (or reverts it to pending). */
export async function setCommissionStatus(id: string, status: 'pending' | 'paid') {
  await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();
  const { data: row } = await supabase
    .from('commissions')
    .update({ status, paid_at: status === 'paid' ? new Date().toISOString() : null })
    .eq('id', id)
    .select('profile_id, amount')
    .maybeSingle();
  if (row && status === 'paid') {
    await notifyUser({ userId: row.profile_id, title: 'Commission paid', body: `A commission of ${formatCurrency(Number(row.amount ?? 0))} has been marked paid.`, link: '/dashboard', event: 'commission_paid' });
  }
  revalidatePath('/hr');
  revalidatePath('/dashboard');
}

export async function setContractStatus(id: string, status: 'active' | 'inactive') {
  await requirePermission('hr', 'edit');
  const supabase = await createSupabaseServerClient();
  await supabase.from('employee_contracts').update({ status }).eq('id', id);
  revalidatePath('/hr');
}
