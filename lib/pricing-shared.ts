/**
 * Τιμοκατάλογοι, προγράμματα πληρωμών, κρατήσεις (βήμα 11β) — client-safe.
 *
 *  - Μαζική αλλαγή τιμών (+/− %, +/− €, €/m²) με στρογγυλοποίηση, πριν
 *    αποθηκευτεί (το ιστορικό το γράφει trigger στη βάση, migration 0065).
 *  - Πρόγραμμα πληρωμών: βήματα σε % της τιμής. Το έργο έχει ένα βασικό· μια
 *    μονάδα μπορεί να έχει δικό της. Όταν η κράτηση γίνει συμβόλαιο, τα βήματα
 *    γίνονται δόσεις (payment_schedules) με ποσά και ημερομηνίες.
 *  - Ρυθμίσεις κρατήσεων: πόσες μέρες κρατά, πότε προειδοποιεί, αν αποδεσμεύει.
 */

/* ------------------------------------------------------- payment plans -- */

export type PlanWhen = 'reservation' | 'contract' | 'days_after_contract' | 'date' | 'milestone' | 'handover';
export const PLAN_WHEN: { value: PlanWhen; label: string }[] = [
  { value: 'reservation', label: 'Με την κράτηση' },
  { value: 'contract', label: 'Με την υπογραφή συμβολαίου' },
  { value: 'days_after_contract', label: 'Μέρες μετά το συμβόλαιο' },
  { value: 'date', label: 'Συγκεκριμένη ημερομηνία' },
  { value: 'milestone', label: 'Με στάδιο κατασκευής' },
  { value: 'handover', label: 'Με την παράδοση' },
];
export interface PlanStep { label: string; pct: number; when: PlanWhen; days?: number; date?: string }

export const DEFAULT_PLAN: PlanStep[] = [
  { label: 'Προκαταβολή κράτησης', pct: 10, when: 'reservation' },
  { label: 'Υπογραφή συμβολαίου', pct: 20, when: 'contract' },
  { label: 'Σκελετός', pct: 30, when: 'milestone' },
  { label: 'Παράδοση', pct: 40, when: 'handover' },
];

/** Validate steps (used on read AND before save). null in = null out (= "use the project's plan"). */
export function cleanPlan(x: unknown): PlanStep[] {
  const out: PlanStep[] = [];
  for (const s of Array.isArray(x) ? x : []) {
    const pct = Math.round(Number((s as any)?.pct) * 100) / 100;
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) continue;
    const when: PlanWhen = PLAN_WHEN.some((w) => w.value === (s as any)?.when) ? (s as any).when : 'contract';
    const step: PlanStep = { label: String((s as any)?.label ?? '').trim().slice(0, 80) || PLAN_WHEN.find((w) => w.value === when)!.label, pct, when };
    if (when === 'days_after_contract') { const d = Math.round(Number((s as any)?.days)); step.days = Number.isFinite(d) && d >= 0 && d <= 3650 ? d : 30; }
    if (when === 'date') { const d = String((s as any)?.date ?? ''); if (/^\d{4}-\d{2}-\d{2}$/.test(d)) step.date = d; }
    out.push(step);
    if (out.length >= 24) break;
  }
  return out;
}

export const planTotal = (plan: PlanStep[]) => Math.round(plan.reduce((s, p) => s + p.pct, 0) * 100) / 100;
export const planProblem = (plan: PlanStep[]): string | null => {
  if (!plan.length) return 'Προσθέστε τουλάχιστον μία δόση.';
  const t = planTotal(plan);
  return Math.abs(t - 100) > 0.001 ? `Τα ποσοστά κάνουν ${t}% — πρέπει να κάνουν 100%.` : null;
};

/** Amount of each step for a price (cents-exact: the last step absorbs rounding). */
export function planAmounts(plan: PlanStep[], price: number | null | undefined): number[] {
  const p = Number(price);
  if (!Number.isFinite(p) || p <= 0) return plan.map(() => 0);
  const cents = Math.round(p * 100);
  const total = planTotal(plan) || 100;
  const amounts = plan.map((s) => Math.round((cents * s.pct) / total));
  const diff = cents - amounts.reduce((a, b) => a + b, 0);
  if (amounts.length) amounts[amounts.length - 1] += diff;
  return amounts.map((c) => c / 100);
}

const addDays = (iso: string, days: number) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };

/** Steps → payment_schedules rows for a contract (amounts from the contract total). */
export function scheduleFromPlan(plan: PlanStep[], total: number, opts: { contractDate: string; reservedDate?: string | null }): { installment_number: number; description: string; due_date: string | null; amount: number }[] {
  const amounts = planAmounts(plan, total);
  return plan.map((s, i) => {
    let due: string | null = null;
    if (s.when === 'reservation') due = opts.reservedDate ?? opts.contractDate;
    else if (s.when === 'contract') due = opts.contractDate;
    else if (s.when === 'days_after_contract') due = addDays(opts.contractDate, s.days ?? 0);
    else if (s.when === 'date') due = s.date ?? null;
    const extra = s.when === 'milestone' ? ' (με το στάδιο κατασκευής)' : s.when === 'handover' ? ' (με την παράδοση)' : '';
    return { installment_number: i + 1, description: `${s.label} · ${s.pct}%${extra}`, due_date: due, amount: amounts[i] };
  });
}

export function whenText(s: PlanStep): string {
  if (s.when === 'days_after_contract') return `${s.days ?? 0} μέρες μετά το συμβόλαιο`;
  if (s.when === 'date') return s.date ? s.date.split('-').reverse().join('/') : 'Ημερομηνία (δεν ορίστηκε)';
  return PLAN_WHEN.find((w) => w.value === s.when)?.label ?? '';
}

/* --------------------------------------------------------- bulk prices -- */

export type BulkMode = 'pct' | 'amount' | 'per_sqm' | 'set';
export interface BulkOp { mode: BulkMode; value: number; round: 0 | 100 | 500 | 1000 | 5000 }

/** New price for one unit (null = can't compute, e.g. €/m² without m²). */
export function applyBulk(price: number | null, sqm: number | null, op: BulkOp): number | null {
  const v = Number(op.value);
  if (!Number.isFinite(v)) return null;
  let n: number | null = null;
  if (op.mode === 'pct') n = price != null ? price * (1 + v / 100) : null;
  else if (op.mode === 'amount') n = price != null ? price + v : null;
  else if (op.mode === 'per_sqm') n = sqm ? sqm * v : null;
  else n = v;
  if (n === null || !Number.isFinite(n)) return null;
  if (op.round) n = Math.round(n / op.round) * op.round;
  n = Math.round(n * 100) / 100;
  return n < 0 ? 0 : n;
}

export const pctChange = (from: number | null, to: number | null): number | null =>
  from && to != null ? Math.round(((to - from) / from) * 1000) / 10 : null;

/* -------------------------------------------------- reservation settings -- */

export interface ReservationSettings {
  /** Default hold when reserving (days). */
  holdDays: number;
  /** Warn the agent this many days before the hold lapses (deposit unpaid). */
  warnDays: number;
  /** Release the unit automatically when a hold lapses unpaid. */
  autoRelease: boolean;
}
export const DEFAULT_RESERVATIONS: ReservationSettings = { holdDays: 14, warnDays: 3, autoRelease: true };
export function mergeReservations(x: any): ReservationSettings {
  const v = x && typeof x === 'object' ? x : {};
  const num = (n: any, lo: number, hi: number, fb: number) => (Number.isFinite(Number(n)) && n !== '' && n !== null ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : fb);
  return { holdDays: num(v.holdDays, 1, 180, 14), warnDays: num(v.warnDays, 0, 30, 3), autoRelease: v.autoRelease !== false };
}

/** Days until an ISO time (negative = past). */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.ceil((t - now) / 86400000) : null;
}
