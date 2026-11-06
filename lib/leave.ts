/**
 * Leave entitlement & balance logic.
 *
 * Entitlements are configured as *5-day-week equivalents* (e.g. Cyprus statutory
 * minimum is 20 working days = 4 weeks). For a 6-day work week the same 4 weeks
 * is 24 working days, so we scale the configured figure by workDays/5.
 */

export type WorkSchedule = '5_day' | '6_day' | string | null;

export function workDaysPerWeek(schedule: WorkSchedule): number {
  return schedule === '6_day' ? 6 : 5;
}

/** Scale a 5-day-week entitlement to the employee's actual work week. */
export function adjustEntitlement(baseDays: number, schedule: WorkSchedule): number {
  const wd = workDaysPerWeek(schedule);
  return Math.round((baseDays / 5) * wd);
}

export interface LeaveLine {
  type: string;
  label: string;
  entitled: number | null; // null = no fixed allowance (e.g. unpaid)
  used: number;
  pending: number;
  remaining: number | null;
}

export interface LeaveBalanceRow {
  leave_type: string;
  total_days: number | null;
  used_days: number | null;
}

export interface LeaveRequestRow {
  leave_type: string;
  days: number | null;
  status: string;
}

const LABELS: Record<string, string> = {
  annual: 'Annual leave',
  sick: 'Sick leave',
  unpaid: 'Unpaid leave',
};

/**
 * Build a per-type leave summary for an employee for a given year.
 * Entitlement comes from a stored balance row if present, otherwise from the
 * profile defaults (annual_leave_days / sick_leave_days), scaled to the work week.
 */
export function computeLeaveSummary(args: {
  workSchedule: WorkSchedule;
  annualLeaveDays?: number | null;
  sickLeaveDays?: number | null;
  balances: LeaveBalanceRow[];
  requests: LeaveRequestRow[];
}): LeaveLine[] {
  const { workSchedule, balances, requests } = args;

  const balByType = new Map(balances.map((b) => [b.leave_type, b]));
  const types = new Set<string>(['annual', 'sick', 'unpaid']);
  balances.forEach((b) => types.add(b.leave_type));
  requests.forEach((r) => types.add(r.leave_type));

  const pendingByType = new Map<string, number>();
  const usedFromRequests = new Map<string, number>();
  for (const r of requests) {
    if (r.status === 'pending') pendingByType.set(r.leave_type, (pendingByType.get(r.leave_type) ?? 0) + Number(r.days ?? 0));
  }

  const lines: LeaveLine[] = [];
  for (const type of types) {
    const bal = balByType.get(type);
    const used = Number(bal?.used_days ?? 0);
    const pending = pendingByType.get(type) ?? 0;

    let entitled: number | null = null;
    if (type === 'annual') {
      const base = bal?.total_days != null ? Number(bal.total_days) : Number(args.annualLeaveDays ?? 0);
      entitled = bal?.total_days != null ? base : adjustEntitlement(base, workSchedule);
    } else if (type === 'sick') {
      const base = bal?.total_days != null ? Number(bal.total_days) : Number(args.sickLeaveDays ?? 0);
      entitled = bal?.total_days != null ? base : adjustEntitlement(base, workSchedule);
    } else if (bal?.total_days != null) {
      entitled = Number(bal.total_days);
    }

    lines.push({
      type,
      label: LABELS[type] ?? type,
      entitled,
      used,
      pending,
      remaining: entitled == null ? null : Math.max(0, entitled - used - pending),
    });
  }

  // stable order: annual, sick, unpaid, then any custom
  const order = ['annual', 'sick', 'unpaid'];
  return lines.sort((a, b) => {
    const ai = order.indexOf(a.type), bi = order.indexOf(b.type);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });
}
