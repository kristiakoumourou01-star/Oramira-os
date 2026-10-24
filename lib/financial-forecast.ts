import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { formatCurrency } from '@/lib/format';

/**
 * Financial forecasting — a forward look over the next 30/60/90 days built from
 * the live ledger: scheduled receivables, projected new closings from the
 * reservation pipeline, payroll run-rate, contractor obligations, VAT exposure,
 * and the resulting net cashflow. Management-grade indicative figures (not a
 * statutory forecast); every assumption is surfaced alongside the numbers.
 */

type Client = SupabaseClient<Database>;
const DAY = 24 * 60 * 60 * 1000;
const VAT_RATE = 0.19;              // Cyprus standard VAT
const RESERVATION_CONVERSION = 0.75; // share of active reservations expected to close
const CONTRACTOR_TERMS_DAYS = 14;    // invoice → payment

export interface ForecastHorizon {
  days: number;
  projectedClosingsCount: number;
  projectedClosingsValue: number;
  receivables: number;        // scheduled contract payments outstanding & due
  projectedCommissions: number;
  payroll: number;
  contractor: number;
  vat: number;
  inflows: number;
  outflows: number;
  net: number;
}
export interface FinancialForecast {
  horizons: ForecastHorizon[];
  monthlyPayroll: number;
  pendingCommissions: number;
  openContractor: number;
  activeReservations: number;
  assumptions: string[];
}

const HORIZONS = [30, 60, 90];

export async function buildFinancialForecast(supabase: Client): Promise<FinancialForecast> {
  const now = Date.now();

  const [{ data: reservations }, { data: schedules }, { data: payments }, { data: commissions }, { data: payslips }, { data: invoices }, { data: staff }] = await Promise.all([
    supabase.from('reservations').select('id, status, deposit_amount, expires_at, units(price)').eq('status', 'active'),
    supabase.from('payment_schedules').select('id, amount, due_date').not('due_date', 'is', null),
    supabase.from('payments').select('payment_schedule_id, amount_paid'),
    supabase.from('commissions').select('amount, commission_pct, status'),
    supabase.from('payslips').select('profile_id, employer_cost, gross_amount, issued_at').order('issued_at', { ascending: false }),
    supabase.from('contractor_invoices').select('amount, status, submitted_at').not('status', 'in', '("paid","rejected","cancelled")'),
    supabase.from('profiles').select('id').in('role', ['admin', 'sales', 'management', 'finance', 'property', 'hr']),
  ]);

  // Outstanding per schedule = scheduled amount − payments already applied.
  const paidBySchedule = new Map<string, number>();
  for (const p of payments ?? []) { if (p.payment_schedule_id) paidBySchedule.set(p.payment_schedule_id, (paidBySchedule.get(p.payment_schedule_id) ?? 0) + Number(p.amount_paid ?? 0)); }

  // Monthly payroll run-rate = latest payslip (employer_cost, else gross) per employee.
  const seen = new Set<string>();
  let monthlyPayroll = 0;
  for (const ps of payslips ?? []) {
    if (seen.has(ps.profile_id)) continue;
    seen.add(ps.profile_id);
    monthlyPayroll += Number(ps.employer_cost ?? ps.gross_amount ?? 0);
  }

  const pendingCommissions = (commissions ?? []).filter((c) => c.status !== 'paid').reduce((s, c) => s + Number(c.amount ?? 0), 0);
  const avgCommissionPct = (() => {
    const withPct = (commissions ?? []).filter((c) => c.commission_pct != null);
    return withPct.length ? withPct.reduce((s, c) => s + Number(c.commission_pct), 0) / withPct.length : 2.5;
  })();
  const openContractor = (invoices ?? []).reduce((s, i) => s + Number(i.amount ?? 0), 0);

  const horizons: ForecastHorizon[] = HORIZONS.map((days) => {
    const horizon = now + days * DAY;
    const months = days / 30;

    // Inflow · scheduled receivables due within the horizon (incl. overdue).
    const receivables = (schedules ?? []).reduce((s, sc) => {
      if (!sc.due_date || new Date(sc.due_date).getTime() > horizon) return s;
      const outstanding = Number(sc.amount ?? 0) - (paidBySchedule.get(sc.id) ?? 0);
      return s + Math.max(0, outstanding);
    }, 0);

    // Inflow · projected NEW closings from reservations expiring within the horizon.
    const closing = (reservations ?? []).filter((r) => r.expires_at && new Date(r.expires_at).getTime() <= horizon);
    const projectedClosingsValue = closing.reduce((s, r) => s + Number((r as any).units?.price ?? r.deposit_amount ?? 0), 0) * RESERVATION_CONVERSION;
    const projectedClosingsCount = Math.round(closing.length * RESERVATION_CONVERSION);
    const projectedCommissions = projectedClosingsValue * (avgCommissionPct / 100);

    // Outflow · payroll over the window.
    const payroll = monthlyPayroll * months;

    // Outflow · contractor invoices whose payment term falls within the horizon.
    const contractor = (invoices ?? []).reduce((s, i) => {
      const due = new Date(i.submitted_at).getTime() + CONTRACTOR_TERMS_DAYS * DAY;
      return due <= horizon ? s + Number(i.amount ?? 0) : s;
    }, 0);

    // VAT exposure · output-VAT component of cash expected in the window.
    const vat = (receivables + projectedClosingsValue) * (VAT_RATE / (1 + VAT_RATE));

    const inflows = receivables + projectedClosingsValue;
    const outflows = payroll + contractor + projectedCommissions + vat;
    return {
      days, projectedClosingsCount, projectedClosingsValue, receivables, projectedCommissions,
      payroll, contractor, vat, inflows, outflows, net: inflows - outflows,
    };
  });

  return {
    horizons, monthlyPayroll, pendingCommissions, openContractor,
    activeReservations: (reservations ?? []).length,
    assumptions: [
      `${Math.round(RESERVATION_CONVERSION * 100)}% of active reservations assumed to close`,
      `Payroll projected at the latest run-rate (${formatCurrency(Math.round(monthlyPayroll))}/mo)`,
      `Contractor invoices due ${CONTRACTOR_TERMS_DAYS} days after submission`,
      `VAT shown as the ${Math.round(VAT_RATE * 100)}% output-VAT component of incoming cash`,
      `Commissions projected at the average ${avgCommissionPct.toFixed(1)}% rate`,
    ],
  };
}
