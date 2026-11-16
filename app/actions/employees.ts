'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';

type R = { ok: true } | { ok: false; error: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface EmployeeRecordInput {
  fullName?: string; jobTitle?: string; department?: string; phone?: string; personalEmail?: string;
  employmentType?: string; startDate?: string; endDate?: string; terminationReason?: string;
  dateOfBirth?: string; nationality?: string; idPassport?: string; socialInsuranceNo?: string;
  address?: string; emergencyContact?: string; agreedSalary?: string; salaryFrequency?: string; hrNotes?: string;
}

const txt = (v: unknown, max = 200) => { const s = String(v ?? '').trim().slice(0, max); return s || null; };
const day = (v: unknown) => { const s = String(v ?? '').trim(); return DATE.test(s) ? s : null; };

/** Αποθήκευση της καρτέλας υπαλλήλου (Staff → Υπάλληλοι). */
export async function saveEmployeeRecord(profileId: string, input: EmployeeRecordInput): Promise<R> {
  await requirePermission('users', 'edit');
  if (!UUID.test(profileId)) return { ok: false, error: 'Άγνωστος υπάλληλος.' };
  const start = day(input.startDate), end = day(input.endDate);
  if (start && end && end < start) return { ok: false, error: 'Η ημερομηνία τερματισμού είναι πριν την έναρξη.' };
  const salary = String(input.agreedSalary ?? '').replace(',', '.').trim();
  const row: Record<string, unknown> = {
    job_title: txt(input.jobTitle, 120), department: txt(input.department, 120), phone: txt(input.phone, 40), personal_email: txt(input.personalEmail, 160),
    employment_type: txt(input.employmentType, 40), employment_start_date: start, employment_end_date: end, termination_reason: end ? txt(input.terminationReason, 500) : null,
    date_of_birth: day(input.dateOfBirth), nationality: txt(input.nationality, 80), id_passport: txt(input.idPassport, 60), social_insurance_no: txt(input.socialInsuranceNo, 60),
    address: txt(input.address, 300), emergency_contact: txt(input.emergencyContact, 200), agreed_salary: salary && !isNaN(Number(salary)) ? Number(salary) : null,
    salary_frequency: txt(input.salaryFrequency, 20), hr_notes: txt(input.hrNotes, 4000),
  };
  const name = txt(input.fullName, 120);
  if (name) row.full_name = name;
  const svc = createSupabaseServiceRoleClient() as any;
  const { error } = await svc.from('profiles').update(row).eq('id', profileId);
  if (error) return { ok: false, error: /column/i.test(error.message) ? 'Λείπει το migration 0085 στη βάση.' : error.message };
  await logActivity({ entityType: 'profile', entityId: profileId, action: 'updated', metadata: { section: 'employee_record' } });
  revalidatePath('/settings/users');
  revalidatePath('/hr');
  return { ok: true };
}
