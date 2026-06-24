import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { resolveContactFormLead, resolveNewsletter } from '@/lib/intake';

/**
 * Oramira OS — Automation Center engine.
 *
 * The central, cross-module automation layer. Each job runs with the
 * service-role client (it acts system-wide, across every user's data) and is
 * invoked by cron (Vercel Cron or a Supabase scheduled Edge Function → POST
 * /api/cron) or manually from the Automation Center UI. Every run is recorded
 * in automation_runs for success/failure tracking and audit history.
 *
 * Notifications are written idempotently (notifyOnce) so re-running a job — or
 * running it more often than needed — never spams a user with duplicates.
 */

type Svc = ReturnType<typeof createSupabaseServiceRoleClient>;

export interface RunResult {
  processed: number;
  summary: string;
  details?: Record<string, unknown>;
}

const DAY = 24 * 60 * 60 * 1000;
const HIGH_VALUE_BUDGET = 1_500_000;

// ── shared helpers ──────────────────────────────────────────────────────────

async function staffUserIds(svc: Svc): Promise<string[]> {
  const { data } = await svc.from('profiles').select('id, role');
  return (data ?? []).filter((p: any) => ['admin', 'sales', 'management'].includes(p.role)).map((p: any) => p.id);
}

async function profileForContact(svc: Svc, contactId: string | null): Promise<string | null> {
  if (!contactId) return null;
  const { data } = await svc.from('profiles').select('id').eq('contact_id', contactId).maybeSingle();
  return data?.id ?? null;
}

/** Insert a notification only if the same user hasn't had one with this link in the last 3 days. */
async function notifyOnce(svc: Svc, userId: string, link: string, title: string, body?: string): Promise<boolean> {
  const since = new Date(Date.now() - 3 * DAY).toISOString();
  const { data: existing } = await svc
    .from('notifications')
    .select('id')
    .eq('user_id', userId)
    .eq('link', link)
    .gte('created_at', since)
    .limit(1)
    .maybeSingle();
  if (existing) return false;
  await svc.from('notifications').insert({ user_id: userId, channel: 'in_app', title, body: body ?? null, link });
  return true;
}

async function notifyStaffOnce(svc: Svc, staff: string[], link: string, title: string, body?: string): Promise<number> {
  let n = 0;
  for (const id of staff) if (await notifyOnce(svc, id, link, title, body)) n += 1;
  return n;
}

// ── 1. Reservation expiry ───────────────────────────────────────────────────

async function runReservationExpiry(svc: Svc): Promise<RunResult> {
  // The DB function flips lapsed holds to 'expired' and releases their units.
  const { data: released, error } = await svc.rpc('expire_stale_reservations');
  if (error) throw error;
  const count = Number(released ?? 0);

  if (count > 0) {
    const staff = await staffUserIds(svc);
    await notifyStaffOnce(
      svc,
      staff,
      '/projects',
      'Reservations expired',
      `${count} reservation${count === 1 ? '' : 's'} lapsed without a deposit and the unit${count === 1 ? ' was' : 's were'} released back to inventory.`
    );
  }
  return { processed: count, summary: count > 0 ? `${count} unit(s) released from expired reservations` : 'No reservations to expire' };
}

// ── 2. Warranty expiry ──────────────────────────────────────────────────────

async function runWarrantyExpiry(svc: Svc): Promise<RunResult> {
  const horizon = new Date(Date.now() + 60 * DAY).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const { data: warranties } = await svc
    .from('warranties')
    .select('id, unit_id, category, ends_on')
    .gte('ends_on', today)
    .lte('ends_on', horizon);

  const staff = await staffUserIds(svc);
  let processed = 0;
  for (const w of warranties ?? []) {
    // Resolve the unit's homeowner → profile.
    const { data: homeowner } = await svc.from('homeowners').select('contact_id').eq('unit_id', w.unit_id).maybeSingle();
    const ownerProfile = await profileForContact(svc, homeowner?.contact_id ?? null);
    const link = `/homeowner/warranty`;
    const when = new Date(w.ends_on).toLocaleDateString();
    if (ownerProfile && (await notifyOnce(svc, ownerProfile, link, 'Warranty expiring soon', `Your ${w.category} warranty expires on ${when}.`))) processed += 1;
    await notifyStaffOnce(svc, staff, `/projects`, 'Warranty expiring', `A ${w.category} warranty expires on ${when} — confirm any outstanding obligations.`);
  }
  return { processed, summary: `${(warranties ?? []).length} warranty(ies) within 60 days; ${processed} homeowner reminder(s) sent`, details: { count: (warranties ?? []).length } };
}

// ── 3. Payment reminders ────────────────────────────────────────────────────

async function runPaymentReminders(svc: Svc): Promise<RunResult> {
  const soon = new Date(Date.now() + 14 * DAY).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const { data: schedules } = await svc
    .from('payment_schedules')
    .select('id, contract_id, installment_number, amount, due_date, contracts(buyer_contact_id, unit_id)')
    .not('due_date', 'is', null)
    .lte('due_date', soon);

  // Which schedules already have a payment?
  const { data: payments } = await svc.from('payments').select('payment_schedule_id');
  const paid = new Set((payments ?? []).map((p: any) => p.payment_schedule_id).filter(Boolean));

  const staff = await staffUserIds(svc);
  let upcoming = 0;
  let overdue = 0;
  for (const s of schedules ?? []) {
    if (paid.has(s.id)) continue;
    const buyerContact = (s as any).contracts?.buyer_contact_id ?? null;
    const buyerProfile = await profileForContact(svc, buyerContact);
    const due = s.due_date as string;
    const isOverdue = due < today;
    const link = '/buyer/payments';
    const amount = `€${Number(s.amount).toLocaleString()}`;
    if (isOverdue) {
      if (buyerProfile && (await notifyOnce(svc, buyerProfile, link, 'Payment overdue', `Installment ${s.installment_number} of ${amount} was due on ${new Date(due).toLocaleDateString()}.`))) overdue += 1;
      await notifyStaffOnce(svc, staff, '/financials', 'Overdue payment', `Installment ${s.installment_number} (${amount}) is overdue.`);
    } else {
      if (buyerProfile && (await notifyOnce(svc, buyerProfile, link, 'Upcoming payment', `Installment ${s.installment_number} of ${amount} is due on ${new Date(due).toLocaleDateString()}.`))) upcoming += 1;
    }
  }
  return { processed: upcoming + overdue, summary: `${upcoming} upcoming reminder(s), ${overdue} overdue alert(s)`, details: { upcoming, overdue } };
}

// ── 4. Website lead sync (reconciliation of any unprocessed submissions) ─────

async function runWebsiteSync(svc: Svc): Promise<RunResult> {
  const { data: pending } = await svc
    .from('website_submissions')
    .select('id, type, name, email, phone, message, source, project_interest_id, budget')
    .is('processed_at', null)
    .limit(200);

  let processed = 0;
  for (const s of pending ?? []) {
    try {
      // Process the EXISTING captured row in place — never re-capture (would
      // duplicate submissions). Shared resolvers dedupe the person by email.
      let contactId: string | null = null;
      let leadId: string | null = null;
      if (s.type === 'newsletter') {
        ({ contactId } = await resolveNewsletter(svc, { email: s.email, name: s.name ?? undefined, source: s.source }));
      } else {
        ({ contactId, leadId } = await resolveContactFormLead(svc, {
          email: s.email, name: s.name ?? undefined, phone: s.phone ?? undefined, message: s.message ?? undefined,
          source: s.source, projectInterestId: s.project_interest_id ?? undefined, budget: s.budget ?? undefined,
        }));
      }
      await svc.from('website_submissions').update({ contact_id: contactId, lead_id: leadId, processed_at: new Date().toISOString() }).eq('id', s.id);
      processed += 1;
    } catch {
      /* leave unprocessed for the next run */
    }
  }
  return { processed, summary: processed > 0 ? `${processed} website submission(s) synced into CRM` : 'No unprocessed submissions' };
}

// ── 5. Maintenance automations ──────────────────────────────────────────────

async function runMaintenance(svc: Svc): Promise<RunResult> {
  const staff = await staffUserIds(svc);
  const now = Date.now();

  // (a) Contractor visit reminders — visits scheduled in the next 24h.
  const in24 = new Date(now + DAY).toISOString();
  const { data: visits } = await svc
    .from('contractor_visits')
    .select('id, ticket_id, unit_id, contractor_id, scheduled_for, status')
    .eq('status', 'scheduled')
    .gte('scheduled_for', new Date(now).toISOString())
    .lte('scheduled_for', in24);
  let reminders = 0;
  for (const v of visits ?? []) {
    if (!v.ticket_id) continue;
    const { data: ticket } = await svc.from('maintenance_tickets').select('homeowner_id, homeowners(contact_id)').eq('id', v.ticket_id).maybeSingle();
    const ownerProfile = await profileForContact(svc, (ticket as any)?.homeowners?.contact_id ?? null);
    const link = `/homeowner/maintenance/${v.ticket_id}`;
    const when = v.scheduled_for ? new Date(v.scheduled_for).toLocaleString() : 'soon';
    if (ownerProfile && (await notifyOnce(svc, ownerProfile, link, 'Contractor visit tomorrow', `A contractor is scheduled to visit on ${when}.`))) reminders += 1;
    // remind the contractor too (guard: never query with an empty uuid)
    if (v.contractor_id) {
      const { data: cprofile } = await svc.from('profiles').select('id').eq('contractor_id', v.contractor_id).maybeSingle();
      if (cprofile) await notifyOnce(svc, cprofile.id, `/contractor/jobs/${v.ticket_id}`, 'Upcoming visit', `You have a visit scheduled for ${when}.`);
    }
  }

  // (b) Overdue + (c) escalation — open tickets aging.
  const { data: openTickets } = await svc
    .from('maintenance_tickets')
    .select('id, title, priority, status, created_at')
    .not('status', 'in', '("resolved","closed")');
  let overdue = 0;
  let escalated = 0;
  for (const t of openTickets ?? []) {
    const ageDays = (now - new Date(t.created_at).getTime()) / DAY;
    const urgent = t.priority === 'high' || t.priority === 'emergency';
    if (ageDays >= 14 || (urgent && ageDays >= 2)) {
      if (await notifyStaffOnce(svc, staff, `/financials`, 'Ticket escalation', `"${t.title}" has been open ${Math.floor(ageDays)} days (${t.priority}). Escalate.`)) escalated += 1;
    } else if (ageDays >= 7) {
      if (await notifyStaffOnce(svc, staff, `/financials`, 'Maintenance overdue', `"${t.title}" has been open ${Math.floor(ageDays)} days with no resolution.`)) overdue += 1;
    }
  }
  return {
    processed: reminders + overdue + escalated,
    summary: `${reminders} visit reminder(s), ${overdue} overdue alert(s), ${escalated} escalation(s)`,
    details: { reminders, overdue, escalated },
  };
}

// ── 6. CRM automations ──────────────────────────────────────────────────────

async function runCrm(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const { data: leads } = await svc
    .from('leads')
    .select('id, status, assigned_to, budget_max, last_contacted_at, created_at')
    .not('status', 'in', '("won","lost")');

  let inactive = 0;
  let aging = 0;
  let highValue = 0;
  const staff = await staffUserIds(svc);

  for (const l of leads ?? []) {
    const link = `/crm/${l.id}`;
    const lastTouch = l.last_contacted_at ? new Date(l.last_contacted_at).getTime() : new Date(l.created_at).getTime();
    const daysSinceTouch = (now - lastTouch) / DAY;
    const daysSinceCreated = (now - new Date(l.created_at).getTime()) / DAY;
    const target = l.assigned_to ?? null;

    // Inactive lead follow-up
    if (daysSinceTouch >= 14) {
      const recipients = target ? [target] : staff;
      let sent = false;
      for (const r of recipients) sent = (await notifyOnce(svc, r, link, 'Lead needs follow-up', `No contact in ${Math.floor(daysSinceTouch)} days.`)) || sent;
      if (sent) inactive += 1;
    }

    // Status aging (still in early stages well past creation)
    if ((l.status === 'new' || l.status === 'contacted') && daysSinceCreated >= 21) {
      const recipients = target ? [target] : staff;
      for (const r of recipients) await notifyOnce(svc, r, link, 'Lead aging', `Still "${l.status}" after ${Math.floor(daysSinceCreated)} days.`);
      aging += 1;
    }

    // High-value priority
    if ((l.budget_max ?? 0) >= HIGH_VALUE_BUDGET && (l.status === 'new' || l.status === 'contacted')) {
      const recipients = target ? [target] : staff;
      let sent = false;
      for (const r of recipients) sent = (await notifyOnce(svc, r, link, 'High-value lead', `Budget up to €${Number(l.budget_max).toLocaleString()} — prioritise.`)) || sent;
      if (sent) highValue += 1;
    }
  }
  return { processed: inactive + aging + highValue, summary: `${inactive} inactive, ${aging} aging, ${highValue} high-value lead alert(s)`, details: { inactive, aging, highValue } };
}

// ── Registry + dispatcher ───────────────────────────────────────────────────

export interface JobDef {
  key: string;
  label: string;
  description: string;
  schedule: string; // human-readable cadence
  run: (svc: Svc) => Promise<RunResult>;
}

export const JOBS: JobDef[] = [
  { key: 'reservation_expiry', label: 'Reservation expiry', description: 'Release units from lapsed reservations and alert staff.', schedule: 'Hourly', run: runReservationExpiry },
  { key: 'warranty_expiry', label: 'Warranty expiry', description: 'Remind homeowners and staff of warranties ending within 60 days.', schedule: 'Daily', run: runWarrantyExpiry },
  { key: 'payment_reminders', label: 'Payment reminders', description: 'Upcoming-payment reminders and overdue alerts.', schedule: 'Daily', run: runPaymentReminders },
  { key: 'website_sync', label: 'Website lead sync', description: 'Reconcile any unprocessed website/newsletter submissions into the CRM.', schedule: 'Every 15 min', run: runWebsiteSync },
  { key: 'maintenance', label: 'Maintenance', description: 'Visit reminders, overdue alerts, and unresolved-ticket escalation.', schedule: 'Every 6 hours', run: runMaintenance },
  { key: 'crm', label: 'CRM follow-ups', description: 'Inactive-lead reminders, status aging, and high-value lead priority.', schedule: 'Daily', run: runCrm },
];

export const JOB_KEYS = JOBS.map((j) => j.key);

/** Run one job by key, recording the outcome in automation_runs. */
export async function runJob(key: string, triggeredBy: 'cron' | 'manual' | 'event' = 'cron'): Promise<RunResult & { status: string }> {
  const job = JOBS.find((j) => j.key === key);
  if (!job) throw new Error(`Unknown automation job: ${key}`);
  const svc = createSupabaseServiceRoleClient();
  const startedAt = new Date().toISOString();
  try {
    const result = await job.run(svc);
    await svc.from('automation_runs').insert({
      job: key, status: 'success', processed: result.processed, summary: result.summary,
      details: (result.details ?? {}) as any, triggered_by: triggeredBy, started_at: startedAt, finished_at: new Date().toISOString(),
    });
    return { ...result, status: 'success' };
  } catch (err: any) {
    await svc.from('automation_runs').insert({
      job: key, status: 'failed', processed: 0, summary: 'Run failed', error: err?.message ?? String(err),
      triggered_by: triggeredBy, started_at: startedAt, finished_at: new Date().toISOString(),
    });
    return { processed: 0, summary: err?.message ?? 'Run failed', status: 'failed' };
  }
}

/** Run every scheduled job (the cron entrypoint runs this). */
export async function runAllJobs(triggeredBy: 'cron' | 'manual' = 'cron') {
  const results: Record<string, RunResult & { status: string }> = {};
  for (const job of JOBS) results[job.key] = await runJob(job.key, triggeredBy);
  return results;
}
