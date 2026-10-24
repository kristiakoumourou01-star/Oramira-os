import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { formatCurrency } from '@/lib/format';

/**
 * HR Intelligence — deterministic anomaly & risk detection over the HR data
 * the caller can see (RLS-scoped; effectively all staff for an HR user).
 * Surfaces the things a manager would otherwise have to notice by hand:
 * contract risk, leave anomalies, payroll anomalies, commission anomalies,
 * and upcoming performance-review anniversaries.
 */

export type AlertSeverity = 'high' | 'medium' | 'low';
export type AlertCategory = 'Contract' | 'Leave' | 'Payroll' | 'Commission' | 'Performance';
export interface HrAlert { id: string; severity: AlertSeverity; category: AlertCategory; employee: string; message: string }

type Client = SupabaseClient<Database>;
const daysBetween = (a: number, b: number) => Math.round((a - b) / 86400000);
const name = (r: any) => r?.profiles?.full_name ?? 'Employee';

export async function computeHrAlerts(supabase: Client): Promise<HrAlert[]> {
  const now = Date.now();
  const year = new Date().getFullYear();

  const [contractsRes, payslipsRes, commissionsRes, balancesRes, staffRes] = await Promise.all([
    supabase.from('employee_contracts').select('id, title, status, expiry_date, profiles(full_name)').eq('status', 'active'),
    supabase.from('payslips').select('id, period, gross_amount, net_amount, employer_cost, profiles(full_name)').order('issued_at', { ascending: false }).limit(80),
    supabase.from('commissions').select('id, base_value, commission_pct, amount, profiles(full_name)').order('created_at', { ascending: false }).limit(80),
    supabase.from('leave_balances').select('leave_type, total_days, used_days, profiles(full_name)').eq('year', year),
    supabase.from('profiles').select('full_name, employment_start_date').not('employment_start_date', 'is', null),
  ]);

  const alerts: HrAlert[] = [];

  // ── Contract risk ──
  for (const c of contractsRes.data ?? []) {
    if (!c.expiry_date) continue;
    const d = daysBetween(new Date(c.expiry_date).getTime(), now);
    if (d < 0) alerts.push({ id: `c_${c.id}`, severity: 'high', category: 'Contract', employee: name(c), message: `Contract "${c.title}" expired ${Math.abs(d)}d ago but is still marked active.` });
    else if (d <= 15) alerts.push({ id: `c_${c.id}`, severity: 'high', category: 'Contract', employee: name(c), message: `Contract "${c.title}" expires in ${d}d — renew or offboard.` });
    else if (d <= 45) alerts.push({ id: `c_${c.id}`, severity: 'medium', category: 'Contract', employee: name(c), message: `Contract "${c.title}" expires in ${d}d.` });
  }

  // ── Leave anomalies ──
  for (const b of balancesRes.data ?? []) {
    const total = Number(b.total_days ?? 0), used = Number(b.used_days ?? 0);
    if (total > 0 && used > total) alerts.push({ id: `l_${name(b)}_${b.leave_type}`, severity: used > total * 1.2 ? 'high' : 'medium', category: 'Leave', employee: name(b), message: `${b.leave_type} leave overdrawn — ${used} of ${total} days used.` });
  }

  // ── Payroll anomalies (latest payslip per employee) ──
  const seenPay = new Set<string>();
  for (const p of payslipsRes.data ?? []) {
    const emp = name(p);
    if (seenPay.has(emp)) continue; // only newest payslip per person
    seenPay.add(emp);
    const gross = Number(p.gross_amount ?? 0), net = Number(p.net_amount ?? 0), cost = Number(p.employer_cost ?? 0);
    if (gross > 0 && net > gross) alerts.push({ id: `p_${p.id}`, severity: 'high', category: 'Payroll', employee: emp, message: `Net pay (${formatCurrency(net)}) exceeds gross (${formatCurrency(gross)}) for ${p.period}.` });
    else if (gross > 0 && net <= 0) alerts.push({ id: `p_${p.id}`, severity: 'high', category: 'Payroll', employee: emp, message: `Net pay is ${formatCurrency(net)} for ${p.period} — check deductions.` });
    else if (cost > 0 && gross > 0 && cost < gross) alerts.push({ id: `p_${p.id}`, severity: 'medium', category: 'Payroll', employee: emp, message: `Employer cost (${formatCurrency(cost)}) is below gross (${formatCurrency(gross)}) for ${p.period}.` });
  }

  // ── Commission anomalies ──
  for (const c of commissionsRes.data ?? []) {
    const base = Number(c.base_value ?? 0), pct = Number(c.commission_pct ?? 0), amt = Number(c.amount ?? 0);
    if (pct > 10) alerts.push({ id: `cm_${c.id}`, severity: 'medium', category: 'Commission', employee: name(c), message: `Commission rate of ${pct}% is unusually high (${formatCurrency(amt)}).` });
    else if (base > 0 && pct > 0) {
      const expected = (base * pct) / 100;
      if (expected > 0 && Math.abs(amt - expected) / expected > 0.02) alerts.push({ id: `cm_${c.id}`, severity: 'medium', category: 'Commission', employee: name(c), message: `Commission ${formatCurrency(amt)} doesn't match ${pct}% of ${formatCurrency(base)} (≈ ${formatCurrency(expected)}).` });
    }
  }

  // ── Performance review reminders (annual anniversary within 21 days) ──
  for (const s of staffRes.data ?? []) {
    if (!s.employment_start_date) continue;
    const start = new Date(s.employment_start_date);
    const next = new Date(start); next.setFullYear(new Date().getFullYear());
    if (next.getTime() < now) next.setFullYear(next.getFullYear() + 1);
    const d = daysBetween(next.getTime(), now);
    const years = new Date().getFullYear() - start.getFullYear();
    if (d >= 0 && d <= 21 && years >= 1) alerts.push({ id: `pf_${s.full_name}`, severity: 'low', category: 'Performance', employee: s.full_name ?? 'Employee', message: `${years}-year work anniversary in ${d}d — schedule a performance review.` });
  }

  const rank: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
