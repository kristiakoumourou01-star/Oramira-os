import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

/**
 * Leave → availability bridge.
 *
 * Approved leave must remove an employee from the booking system entirely for
 * those days: their public/agent availability hides the day, and no viewing can
 * be scheduled on it — not even by an admin. We express leave as full-day busy
 * blocks (so the pure availability engine excludes it with zero changes) plus a
 * hard isOnLeave() guard at every booking-creation path.
 *
 * Reads use the service-role client (team schedules, cross-user) and are
 * resilient: any error — missing table, schema drift — degrades to "not on
 * leave" / no blocks, so leave enforcement can never break booking itself.
 *
 * Dates in leave_requests are plain calendar dates; we treat a leave day as the
 * whole UTC day, which safely contains Cyprus working hours (09:00–19:00 EET =
 * 06:00–17:00 UTC).
 */

export interface LeaveBlock { start: string; end: string }

/** Approved-leave days as full-day busy blocks overlapping [timeMin, timeMax]. */
export async function getApprovedLeaveBlocks(profileId: string, timeMinISO: string, timeMaxISO: string): Promise<LeaveBlock[]> {
  try {
    const svc = createSupabaseServiceRoleClient();
    const minDate = timeMinISO.slice(0, 10);
    const maxDate = timeMaxISO.slice(0, 10);
    const { data } = await svc
      .from('leave_requests')
      .select('start_date, end_date')
      .eq('profile_id', profileId)
      .eq('status', 'approved')
      .lte('start_date', maxDate)
      .gte('end_date', minDate);
    return (data ?? []).map((r: any) => ({
      start: `${r.start_date}T00:00:00.000Z`,
      end: `${r.end_date}T23:59:59.999Z`,
    }));
  } catch {
    return [];
  }
}

/** True if the employee is on approved leave on the calendar day of `whenISO`. */
export async function isOnLeave(profileId: string, whenISO: string): Promise<boolean> {
  try {
    const svc = createSupabaseServiceRoleClient();
    const date = whenISO.slice(0, 10);
    const { data } = await svc
      .from('leave_requests')
      .select('id')
      .eq('profile_id', profileId)
      .eq('status', 'approved')
      .lte('start_date', date)
      .gte('end_date', date)
      .limit(1);
    return (data?.length ?? 0) > 0;
  } catch {
    return false;
  }
}
