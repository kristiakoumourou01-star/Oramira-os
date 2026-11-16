import { createSupabaseServerClient } from '@/lib/supabase/server';
import { EMPTY_HR, type EmployeeDoc, type EmployeeHr } from '@/lib/staff-shared';

/** Φορτώνει τα στοιχεία HR, τα έγγραφα και τις άδειες για τους υπαλλήλους. Δεν σπάει ποτέ: ό,τι λείπει απλώς δεν εμφανίζεται. */
export async function loadEmployeeHr(ids: string[]): Promise<Map<string, EmployeeHr>> {
  const out = new Map<string, EmployeeHr>();
  if (!ids.length) return out;
  const db = (await createSupabaseServerClient()) as any;
  const today = new Date().toISOString().slice(0, 10);
  const [prof, docs, contracts, leave] = await Promise.all([
    db.from('profiles').select('id, created_at, job_title, department, phone, personal_email, employment_type, employment_start_date, employment_end_date, termination_reason, date_of_birth, nationality, id_passport, social_insurance_no, address, emergency_contact, agreed_salary, salary_frequency, hr_notes').in('id', ids),
    db.from('documents').select('id, entity_id, title, description, category, bucket, storage_path, created_at').eq('entity_type', 'profile').in('entity_id', ids).order('created_at', { ascending: false }),
    db.from('employee_contracts').select('profile_id, expiry_date, status').eq('status', 'active').in('profile_id', ids),
    db.from('leave_requests').select('profile_id').eq('status', 'approved').lte('start_date', today).gte('end_date', today).in('profile_id', ids),
  ]);
  let rows: any[] = prof.data ?? [];
  if (prof.error) {
    // Χωρίς το migration 0085: φέρνουμε ό,τι υπάρχει.
    const { data } = await db.from('profiles').select('id, created_at, job_title, department, phone, employment_start_date, id_passport, address, emergency_contact, agreed_salary, salary_frequency').in('id', ids);
    rows = data ?? [];
  }
  const docsBy = new Map<string, EmployeeDoc[]>();
  for (const d of (docs.data ?? []) as any[]) {
    const desc = String(d.description ?? '');
    const kind = desc.split('|')[0] || (d.category === 'contract' ? 'contract' : 'other');
    const expires = /λήξη:(\d{4}-\d{2}-\d{2})/.exec(desc)?.[1] ?? null;
    const list = docsBy.get(d.entity_id) ?? [];
    list.push({ id: d.id, title: d.title ?? 'Έγγραφο', kind: d.category === 'contract' && kind === 'other' ? 'contract' : kind, bucket: d.bucket, path: d.storage_path, createdAt: d.created_at, expires });
    docsBy.set(d.entity_id, list);
  }
  const expiry = new Map<string, string>();
  for (const c of (contracts.data ?? []) as any[]) if (c.expiry_date && (!expiry.get(c.profile_id) || c.expiry_date > expiry.get(c.profile_id)!)) expiry.set(c.profile_id, c.expiry_date);
  const onLeave = new Set(((leave.data ?? []) as any[]).map((l) => l.profile_id));
  for (const r of rows) {
    const list = docsBy.get(r.id) ?? [];
    out.set(r.id, {
      ...EMPTY_HR,
      jobTitle: r.job_title ?? null, department: r.department ?? null, phone: r.phone ?? null, personalEmail: r.personal_email ?? null,
      employmentType: r.employment_type ?? null, startDate: r.employment_start_date ?? null, endDate: r.employment_end_date ?? null, terminationReason: r.termination_reason ?? null,
      dateOfBirth: r.date_of_birth ?? null, nationality: r.nationality ?? null, idPassport: r.id_passport ?? null, socialInsuranceNo: r.social_insurance_no ?? null,
      address: r.address ?? null, emergencyContact: r.emergency_contact ?? null, agreedSalary: r.agreed_salary != null ? Number(r.agreed_salary) : null,
      salaryFrequency: r.salary_frequency ?? null, hrNotes: r.hr_notes ?? null, createdAt: r.created_at ?? null,
      docs: list, contract: list.find((d) => d.kind === 'contract') ?? null, contractExpiry: expiry.get(r.id) ?? null, onLeaveToday: onLeave.has(r.id),
    });
  }
  return out;
}
