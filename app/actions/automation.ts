'use server';

import { requireRole } from '@/lib/auth';
import { runJob } from '@/lib/automations';
import { revalidatePath } from 'next/cache';

/**
 * Manual "run now" for an automation job, from the Automation Center. Staff
 * only; the run itself uses the service-role engine and is recorded in
 * automation_runs just like a cron run (triggered_by = 'manual').
 */
export async function runJobManual(key: string) {
  await requireRole(['admin', 'sales', 'management']);
  const result = await runJob(key, 'manual');
  revalidatePath('/automation');
  return result;
}
