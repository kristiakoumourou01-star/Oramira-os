import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { resolveContactFormLead, resolveNewsletter } from '@/lib/intake';
import { sendTemplate } from '@/lib/communications';
import { pushEventToGoogle } from '@/lib/calendar-sync';
import { FOLLOW_UP_CADENCE, templateAudience } from '@/lib/sales-doctrine';
import { persistLearningInsights } from '@/lib/learning-loop';
import { captureMemory } from '@/lib/executive-memory';
import { summarizeDD } from '@/lib/due-diligence';
import { formatDate, formatDateTime, formatTime, formatCurrency } from '@/lib/format';

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

/** Profile ids for a set of roles (service-role read). */
async function userIdsForRoles(svc: Svc, roles: string[]): Promise<string[]> {
  const { data } = await svc.from('profiles').select('id, role');
  return (data ?? []).filter((p: any) => roles.includes(p.role)).map((p: any) => p.id);
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
    const when = formatDate(w.ends_on);
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
    const amount = `${formatCurrency(Number(s.amount))}`;
    if (isOverdue) {
      if (buyerProfile && (await notifyOnce(svc, buyerProfile, link, 'Payment overdue', `Installment ${s.installment_number} of ${amount} was due on ${formatDate(due)}.`))) overdue += 1;
      await notifyStaffOnce(svc, staff, '/financials', 'Overdue payment', `Installment ${s.installment_number} (${amount}) is overdue.`);
    } else {
      if (buyerProfile && (await notifyOnce(svc, buyerProfile, link, 'Upcoming payment', `Installment ${s.installment_number} of ${amount} is due on ${formatDate(due)}.`))) upcoming += 1;
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
    const when = v.scheduled_for ? formatDateTime(v.scheduled_for) : 'soon';
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
      for (const r of recipients) sent = (await notifyOnce(svc, r, link, 'High-value lead', `Budget up to ${formatCurrency(Number(l.budget_max))} — prioritise.`)) || sent;
      if (sent) highValue += 1;
    }
  }
  return { processed: inactive + aging + highValue, summary: `${inactive} inactive, ${aging} aging, ${highValue} high-value lead alert(s)`, details: { inactive, aging, highValue } };
}

// ── Speed-to-lead escalation ─────────────────────────────────────────────────

async function runSpeedToLead(svc: Svc): Promise<RunResult> {
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stale } = await svc
    .from('leads')
    .select('id, assigned_to, contacts(full_name)')
    .eq('status', 'new')
    .is('first_response_at', null)
    .lte('created_at', tenMinAgo);

  const staff = await staffUserIds(svc);
  let escalated = 0;
  for (const l of stale ?? []) {
    const name = (l as any).contacts?.full_name ?? 'A new lead';
    const link = `/crm/leads/${l.id}`;
    if (l.assigned_to) await notifyOnce(svc, l.assigned_to, link, '⏱ Speed-to-lead at risk', `${name} still has no response — respond now.`);
    if (await notifyStaffOnce(svc, staff, link, 'Speed-to-lead escalation', `${name} has had no first response past the 5-minute window.`)) escalated += 1;
  }
  return { processed: escalated, summary: escalated > 0 ? `${escalated} lead(s) escalated for slow response` : 'All new leads responded to in time' };
}

// ── Sales cadence: follow-up + nurture + retargeting ──────────────────────────

async function runSalesCadence(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const fourteenDaysAgo = new Date(now - 14 * DAY).toISOString();
  // In-flight leads only (avoid blasting the historical backlog).
  const { data: leads } = await svc
    .from('leads')
    .select('id, status, created_at, assigned_to, contact_id, contacts(full_name, email, phone, buyer_type, preferred_language)')
    .not('status', 'in', '("won","lost","reserved","retargeting","nurture")')
    .gte('created_at', fourteenDaysAgo);

  let processed = 0;
  for (const l of leads ?? []) {
    const ageH = (now - new Date(l.created_at).getTime()) / (60 * 60 * 1000);
    const c = (l as any).contacts;
    const audience = templateAudience(c?.buyer_type, c?.preferred_language);
    const vars = { name: c?.full_name ?? 'there', project: 'Oramira', agent: 'the Oramira team' };

    const { data: sent } = await svc.from('contact_communications').select('template_key').eq('lead_id', l.id).not('template_key', 'is', null);
    const sentKeys = new Set((sent ?? []).map((x: any) => x.template_key));

    for (const step of FOLLOW_UP_CADENCE) {
      if (ageH < step.afterHours) continue;
      if ((step.action === 'whatsapp' || step.action === 'email') && step.templateKey && !sentKeys.has(step.templateKey)) {
        await sendTemplate({ contactId: l.contact_id, leadId: l.id, channel: step.action, templateKey: step.templateKey, to: step.action === 'email' ? c?.email : c?.phone, vars, audience });
        sentKeys.add(step.templateKey);
        processed += 1;
      } else if (step.action === 'call_task') {
        const { data: existing } = await svc.from('follow_up_tasks').select('id').eq('lead_id', l.id).eq('note', 'Cadence: phone follow-up').maybeSingle();
        if (!existing) {
          await svc.from('follow_up_tasks').insert({ lead_id: l.id, contact_id: l.contact_id, assigned_to: l.assigned_to, due_at: new Date().toISOString(), note: 'Cadence: phone follow-up' });
          processed += 1;
        }
      } else if (step.action === 'retarget') {
        // Cadence creates reminders/messages only — it never moves the lead's
        // stage. The pipeline status is changed manually (or by the dedicated
        // reactivation job), keeping the pipeline the single source of truth.
        if (!sentKeys.has('nurture_objections')) {
          await sendTemplate({ contactId: l.contact_id, leadId: l.id, channel: 'email', templateKey: 'nurture_objections', to: c?.email, vars, audience });
          processed += 1;
        }
      }
    }
  }
  return { processed, summary: processed > 0 ? `${processed} cadence action(s) executed` : 'No cadence actions due' };
}

// ── Contract reminders ──────────────────────────────────────────────────────

async function adminUserIds(svc: Svc): Promise<string[]> {
  const { data } = await svc.from('profiles').select('id, role');
  return (data ?? []).filter((p: any) => ['admin', 'management'].includes(p.role)).map((p: any) => p.id);
}

/** Days from today until `date` (UTC, calendar days). Negative if past. */
function daysUntil(date: string): number {
  return Math.round((new Date(date + 'T00:00:00Z').getTime() - Date.now()) / DAY);
}

/**
 * Contract lifecycle reminders. For each active contract:
 *  - expiry: notify admins 60d and 30d before; notify the employee 30d before.
 *  - probation end: notify admins 14d before; notify the employee 14d before.
 *  - renewal date: notify admins on/within 30d.
 * Windowed so a daily run fires once per threshold; notifyOnce de-dupes.
 */
async function runContractReminders(svc: Svc): Promise<RunResult> {
  const { data: contracts } = await svc
    .from('employee_contracts')
    .select('id, profile_id, title, status, expiry_date, probation_end_date, renewal_date, profiles(full_name)')
    .eq('status', 'active');
  if (!contracts || contracts.length === 0) return { processed: 0, summary: 'No active contracts' };

  const admins = await adminUserIds(svc);
  let processed = 0;

  for (const c of contracts as any[]) {
    const name = c.profiles?.full_name ?? 'an employee';
    const link = '/hr';

    if (c.expiry_date) {
      const d = daysUntil(c.expiry_date);
      if (d >= 54 && d <= 60) processed += await notifyStaffOnce(svc, admins, `${link}#expiry60-${c.id}`, 'Contract expiring in ~60 days', `${name}'s contract "${c.title}" expires on ${c.expiry_date}.`);
      if (d >= 24 && d <= 30) {
        processed += await notifyStaffOnce(svc, admins, `${link}#expiry30-${c.id}`, 'Contract expiring in ~30 days', `${name}'s contract "${c.title}" expires on ${c.expiry_date}.`);
        if (await notifyOnce(svc, c.profile_id, `/dashboard#expiry30-${c.id}`, 'Your contract is expiring soon', `Your contract "${c.title}" expires on ${c.expiry_date}. HR will be in touch about renewal.`)) processed += 1;
      }
    }

    if (c.probation_end_date) {
      const d = daysUntil(c.probation_end_date);
      if (d >= 8 && d <= 14) {
        processed += await notifyStaffOnce(svc, admins, `${link}#probation-${c.id}`, 'Probation ending soon', `${name}'s probation ends on ${c.probation_end_date}. Confirm or extend.`);
        if (await notifyOnce(svc, c.profile_id, `/dashboard#probation-${c.id}`, 'Your probation is ending', `Your probation period ends on ${c.probation_end_date}.`)) processed += 1;
      }
    }

    if (c.renewal_date) {
      const d = daysUntil(c.renewal_date);
      if (d >= 24 && d <= 30) processed += await notifyStaffOnce(svc, admins, `${link}#renewal-${c.id}`, 'Contract renewal due', `${name}'s contract "${c.title}" is due for renewal on ${c.renewal_date}.`);
    }
  }
  return { processed, summary: processed > 0 ? `${processed} contract reminder(s) sent` : 'No contract reminders due' };
}

// ── Viewing reminders ────────────────────────────────────────────────────────

async function runViewingReminders(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const in24h = new Date(now + DAY).toISOString();
  const { data: viewings } = await svc
    .from('viewings')
    .select('id, lead_id, contact_id, scheduled_at, contacts(full_name, phone, buyer_type, preferred_language), projects(name)')
    .eq('status', 'scheduled')
    .is('reminder_sent_at', null)
    .gte('scheduled_at', new Date(now).toISOString())
    .lte('scheduled_at', in24h);

  let processed = 0;
  for (const v of viewings ?? []) {
    const c = (v as any).contacts;
    const audience = templateAudience(c?.buyer_type, c?.preferred_language);
    const vars = { name: c?.full_name ?? 'there', project: (v as any).projects?.name ?? 'Oramira', agent: 'the Oramira team', date: formatDateTime(v.scheduled_at) };
    await sendTemplate({ contactId: v.contact_id, leadId: v.lead_id, channel: 'whatsapp', templateKey: 'viewing_reminder', to: c?.phone ?? null, vars, audience });
    await svc.from('viewings').update({ reminder_sent_at: new Date().toISOString() }).eq('id', v.id);
    processed += 1;
  }
  return { processed, summary: processed > 0 ? `${processed} viewing reminder(s) sent` : 'No viewings within 24h' };
}

// ── Meeting reminders ────────────────────────────────────────────────────────

/**
 * WhatsApp reminders for planner meetings that are linked to a lead/contact and
 * start within the next ~2 hours. Idempotent via calendar_events.reminder_sent_at.
 * Complements viewing_reminders (which covers the viewings table); together they
 * extend the WhatsApp automation layer across the planner + sales cadence.
 */
async function runMeetingReminders(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const in2h = new Date(now + 2 * 60 * 60 * 1000).toISOString();
  const { data: events } = await svc
    .from('calendar_events')
    .select('id, title, start_at, related_lead_id, leads:related_lead_id(id, contact_id, contacts(full_name, phone, buyer_type, preferred_language))')
    .in('type', ['meeting', 'viewing'])
    .neq('status', 'cancelled')
    .is('reminder_sent_at', null)
    .not('related_lead_id', 'is', null)
    .gte('start_at', new Date(now).toISOString())
    .lte('start_at', in2h);

  let processed = 0;
  for (const e of events ?? []) {
    const lead = (e as any).leads;
    const c = lead?.contacts;
    // Mark handled regardless, so a missing phone/template doesn't re-fire hourly.
    await svc.from('calendar_events').update({ reminder_sent_at: new Date().toISOString() }).eq('id', e.id);
    if (!c?.phone || !lead?.contact_id) continue;
    const audience = templateAudience(c.buyer_type, c.preferred_language);
    const vars = { name: c.full_name ?? 'there', title: e.title, time: formatTime(e.start_at) };
    await sendTemplate({ contactId: lead.contact_id, leadId: lead.id, channel: 'whatsapp', templateKey: 'meeting_reminder', to: c.phone, vars, audience });
    processed += 1;
  }
  return { processed, summary: processed > 0 ? `${processed} meeting reminder(s) sent` : 'No meetings within 2h' };
}

// ── Dead-lead reactivation ───────────────────────────────────────────────────

/**
 * Scan for cold leads (no contact in 30+ days, not terminal) and move them into
 * the reactivation pipeline with an audience-aware WhatsApp + email campaign.
 * Once a lead is in 'reactivation' it's excluded from re-processing.
 */
async function runDeadLeadReactivation(svc: Svc): Promise<RunResult> {
  const cutoff = new Date(Date.now() - 30 * DAY).toISOString();
  const { data: leads } = await svc
    .from('leads')
    .select('id, contact_id, assigned_to, last_contacted_at, created_at, contacts(full_name, email, phone, buyer_type, preferred_language), projects:preferred_project_id(name)')
    .not('status', 'in', '("won","lost","reactivation","reserved")');

  let processed = 0;
  for (const l of leads ?? []) {
    const last = l.last_contacted_at ?? l.created_at;
    if (!last || last > cutoff) continue; // still warm
    const c = (l as any).contacts;
    const audience = templateAudience(c?.buyer_type, c?.preferred_language);
    const vars = { name: c?.full_name ?? 'there', project: (l as any).projects?.name ?? 'Oramira', agent: 'the Oramira team' };
    await sendTemplate({ contactId: l.contact_id, leadId: l.id, channel: 'whatsapp', templateKey: 'reactivation', to: c?.phone ?? null, vars, audience });
    await sendTemplate({ contactId: l.contact_id, leadId: l.id, channel: 'email', templateKey: 'reactivation', to: c?.email ?? null, vars, audience });
    await svc.from('leads').update({ status: 'reactivation' }).eq('id', l.id);
    if (l.assigned_to) await notifyOnce(svc, l.assigned_to, `/crm/leads/${l.id}`, '♻️ Lead moved to reactivation', `${vars.name} went cold (30+ days) — a reactivation campaign was sent.`);
    processed += 1;
  }
  return { processed, summary: processed > 0 ? `${processed} cold lead(s) entered reactivation` : 'No cold leads to reactivate' };
}

// ── Auto calendar events ─────────────────────────────────────────────────────

/** Idempotently create a system calendar event (deduped by source_key), with
 *  optional Google sync (AUTO_EVENT_GOOGLE_SYNC=true). */
async function ensureSystemEvent(svc: Svc, p: { profileId: string; title: string; startAt: string; source: string; sourceKey: string; priority?: string }): Promise<boolean> {
  const { data: existing } = await svc.from('calendar_events').select('id').eq('source_key', p.sourceKey).maybeSingle();
  if (existing) return false;
  let googleEventId: string | null = null;
  if (process.env.AUTO_EVENT_GOOGLE_SYNC === 'true') {
    const sync = await pushEventToGoogle(p.profileId, { summary: p.title, start: p.startAt, durationMin: 30, reminderMinutes: 60 });
    googleEventId = sync?.googleEventId ?? null;
  }
  await svc.from('calendar_events').insert({
    profile_id: p.profileId, title: p.title, start_at: p.startAt, type: 'task', priority: p.priority ?? 'normal',
    status: 'scheduled', source: p.source, source_key: p.sourceKey, duration_min: 30,
    google_event_id: googleEventId, calendar_synced_at: googleEventId ? new Date().toISOString() : null,
  });
  return true;
}

/** Idempotently create an actionable task (deduped by source_key, migration
 *  0044). Returns true only when a new task was inserted, so callers can notify
 *  exactly once. Skipped silently if the same source_key task already exists —
 *  even when previously completed — so we never nag on resolved work. */
async function ensureTask(svc: Svc, p: { assignedTo: string | null; title: string; dueAt: string; sourceKey: string; description?: string; relatedType?: string; relatedId?: string }): Promise<boolean> {
  const { data: existing } = await svc.from('tasks').select('id').eq('source_key', p.sourceKey).maybeSingle();
  if (existing) return false;
  await svc.from('tasks').insert({
    title: p.title, assigned_to: p.assignedTo, due_at: p.dueAt, is_done: false, source_key: p.sourceKey,
    description: p.description ?? null, related_entity_type: p.relatedType ?? null, related_entity_id: p.relatedId ?? null,
  });
  return true;
}

/**
 * Turn operational deadlines into planner events (deduped) and notify the team:
 * contract expiries/renewals, warranty (document/lease) expiries, viewing
 * reminders, and the monthly payroll deadline. Google sync is optional.
 */
async function runAutoCalendarEvents(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const todayISO = new Date().toISOString().slice(0, 10);
  const in60 = new Date(now + 60 * DAY).toISOString().slice(0, 10);
  const admins = await adminUserIds(svc);
  const at9 = (dateStr: string) => new Date(`${dateStr}T09:00:00`).toISOString();
  let created = 0;

  // Contract expiries + renewals (assigned to the employee).
  const { data: contracts } = await svc.from('employee_contracts').select('id, profile_id, expiry_date, renewal_date, probation_end_date, status, profiles(full_name)').eq('status', 'active');
  for (const c of contracts ?? []) {
    const name = (c as any).profiles?.full_name ?? 'Employee';
    if (c.profile_id && c.expiry_date && c.expiry_date >= todayISO && c.expiry_date <= in60) {
      if (await ensureSystemEvent(svc, { profileId: c.profile_id, title: `Contract expiry — ${name}`, startAt: at9(c.expiry_date), source: 'contract_expiry', sourceKey: `contract_expiry:${c.id}`, priority: 'high' })) { created += 1; await notifyStaffOnce(svc, admins, '/hr', 'Contract expiring', `${name}'s contract expires on ${c.expiry_date}.`); }
    }
    if (c.profile_id && c.renewal_date && c.renewal_date >= todayISO && c.renewal_date <= in60) {
      if (await ensureSystemEvent(svc, { profileId: c.profile_id, title: `Contract renewal — ${name}`, startAt: at9(c.renewal_date), source: 'contract_renewal', sourceKey: `contract_renewal:${c.id}` })) { created += 1; await notifyStaffOnce(svc, admins, '/hr', 'Contract renewal due', `${name}'s contract renews on ${c.renewal_date}.`); }
    }
  }

  // Warranty (document / lease) expiries → assigned to an admin.
  if (admins[0]) {
    const { data: warranties } = await svc.from('warranties').select('id, name, ends_on').gte('ends_on', todayISO).lte('ends_on', in60);
    for (const w of warranties ?? []) {
      if (await ensureSystemEvent(svc, { profileId: admins[0], title: `Warranty expiry — ${w.name}`, startAt: at9(w.ends_on), source: 'warranty_expiry', sourceKey: `warranty_expiry:${w.id}` })) { created += 1; await notifyStaffOnce(svc, admins, '/property', 'Warranty expiring', `${w.name} warranty ends on ${w.ends_on}.`); }
    }
  }

  // Viewing reminders (1 hour before) → assigned to the agent.
  const in3 = new Date(now + 3 * DAY).toISOString();
  const { data: viewings } = await svc.from('viewings').select('id, agent_id, scheduled_at, contacts(full_name)').eq('status', 'scheduled').gte('scheduled_at', new Date(now).toISOString()).lte('scheduled_at', in3);
  for (const v of viewings ?? []) {
    if (!v.agent_id) continue;
    const name = (v as any).contacts?.full_name ?? 'client';
    const remindAt = new Date(new Date(v.scheduled_at).getTime() - 60 * 60000).toISOString();
    if (await ensureSystemEvent(svc, { profileId: v.agent_id, title: `Viewing reminder — ${name}`, startAt: remindAt, source: 'viewing_reminder', sourceKey: `viewing_reminder:${v.id}`, priority: 'high' })) { created += 1; await notifyOnce(svc, v.agent_id, '/dashboard', 'Viewing coming up', `Viewing with ${name} soon.`); }
  }

  // HR — probation deadlines (→ employee, notify admins).
  for (const c of contracts ?? []) {
    const name = (c as any).profiles?.full_name ?? 'Employee';
    if (c.profile_id && c.probation_end_date && c.probation_end_date >= todayISO && c.probation_end_date <= in60) {
      if (await ensureSystemEvent(svc, { profileId: c.profile_id, title: `Probation ends — ${name}`, startAt: at9(c.probation_end_date), source: 'probation_deadline', sourceKey: `probation_deadline:${c.id}`, priority: 'high' })) { created += 1; await notifyStaffOnce(svc, admins, '/hr', 'Probation ending', `${name}'s probation ends on ${c.probation_end_date}.`); }
    }
  }

  // Sales — reservation deadlines (→ the agent who created it).
  const { data: reservations } = await svc.from('reservations').select('id, created_by, expires_at, buyer_contact_id, contacts(full_name)').eq('status', 'active').not('expires_at', 'is', null);
  for (const r of reservations ?? []) {
    if (!r.created_by || !r.expires_at) continue;
    const day = r.expires_at.slice(0, 10);
    if (day < todayISO || day > in60) continue;
    const name = (r as any).contacts?.full_name ?? 'buyer';
    if (await ensureSystemEvent(svc, { profileId: r.created_by, title: `Reservation deadline — ${name}`, startAt: r.expires_at, source: 'reservation_deadline', sourceKey: `reservation_deadline:${r.id}`, priority: 'high' })) { created += 1; await notifyOnce(svc, r.created_by, '/crm/leads', 'Reservation expiring', `${name}'s reservation lapses on ${day}.`); }
  }

  // Finance team (finance + admins).
  const { data: finProfiles } = await svc.from('profiles').select('id, role');
  const finance = (finProfiles ?? []).filter((p: any) => ['finance', 'admin', 'management'].includes(p.role)).map((p: any) => p.id);

  // Finance — contractor payments (due ≈ 14 days after invoice submission).
  if (finance[0]) {
    const { data: invoices } = await svc.from('contractor_invoices').select('id, amount, status, submitted_at, contractors(company_name)').not('status', 'in', '("paid","rejected","cancelled")');
    for (const iv of invoices ?? []) {
      const due = new Date(new Date(iv.submitted_at).getTime() + 14 * DAY);
      const dueISO = due.toISOString().slice(0, 10);
      if (dueISO < todayISO || dueISO > in60) continue;
      const co = (iv as any).contractors?.company_name ?? 'contractor';
      if (await ensureSystemEvent(svc, { profileId: finance[0], title: `Contractor payment — ${co}`, startAt: at9(dueISO), source: 'contractor_payment', sourceKey: `contractor_payment:${iv.id}`, priority: 'normal' })) { created += 1; await notifyStaffOnce(svc, finance, '/financials', 'Contractor payment due', `${formatCurrency(Number(iv.amount ?? 0))} to ${co} due ${dueISO}.`); }
    }
  }

  // Finance — quarterly VAT deadline (Cyprus: ~40 days after quarter end).
  if (finance[0]) {
    const d = new Date(); const y = d.getFullYear();
    const quarterEnds = [new Date(y, 2, 31), new Date(y, 5, 30), new Date(y, 8, 30), new Date(y, 11, 31), new Date(y + 1, 2, 31)];
    for (let q = 0; q < quarterEnds.length; q++) {
      const vat = new Date(quarterEnds[q].getTime() + 40 * DAY);
      const vatISO = vat.toISOString().slice(0, 10);
      if (vatISO < todayISO || vatISO > in60) continue;
      const key = `vat_deadline:${vat.getFullYear()}-Q${((q % 4) + 1)}`;
      if (await ensureSystemEvent(svc, { profileId: finance[0], title: 'VAT return deadline', startAt: at9(vatISO), source: 'vat_deadline', sourceKey: key, priority: 'high' })) { created += 1; await notifyStaffOnce(svc, finance, '/financials', 'VAT deadline', `Quarterly VAT return is due ${vatISO}.`); }
    }
  }

  // Monthly payroll deadline (25th) → admins.
  if (admins[0]) {
    const d = new Date(); const y = d.getFullYear(); const m = d.getMonth();
    const payroll = new Date(y, m, 25);
    if (payroll.getTime() >= now - 5 * DAY) {
      const key = `payroll_deadline:${y}-${String(m + 1).padStart(2, '0')}`;
      if (await ensureSystemEvent(svc, { profileId: admins[0], title: 'Payroll run deadline', startAt: at9(payroll.toISOString().slice(0, 10)), source: 'payroll_deadline', sourceKey: key, priority: 'high' })) { created += 1; await notifyStaffOnce(svc, admins, '/hr', 'Payroll deadline', `Monthly payroll run is due ${payroll.toDateString()}.`); }
    }
  }

  return { processed: created, summary: created > 0 ? `${created} calendar event(s) auto-created` : 'No new auto events due' };
}

// ── Churn / drop-off detection ───────────────────────────────────────────────

/**
 * Predictive churn detection — surfaces relationships that are quietly slipping
 * before they're lost: high-value leads going quiet, stalled negotiations,
 * reservations at risk of lapsing (deposit unpaid), and long-inactive owners.
 * Deduped via notifyOnce (re-alerts at most every 3 days while still at risk).
 */
async function runChurnDetection(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const staff = await staffUserIds(svc);
  let alerts = 0;

  // At-risk advanced leads — in a closing stage but gone quiet (7+ days).
  const ADVANCED = ['offer', 'negotiating', 'reserved'];
  const { data: leads } = await svc.from('leads').select('id, status, assigned_to, last_contacted_at, created_at, contacts(full_name)').in('status', ADVANCED);
  for (const l of leads ?? []) {
    const ref = new Date(l.last_contacted_at ?? l.created_at).getTime();
    const days = Math.floor((now - ref) / DAY);
    if (days < 7) continue;
    const name = (l as any).contacts?.full_name ?? 'Lead';
    const recipients = l.assigned_to ? [l.assigned_to] : staff;
    for (const r of recipients) if (await notifyOnce(svc, r, `/crm/leads/${l.id}#atrisk`, '⚠ Deal at risk of going cold', `${name} is in "${l.status}" but hasn't been contacted in ${days} days.`)) alerts += 1;
  }

  // Stalled negotiations — open (no agreed price) and the lead has gone quiet.
  const { data: negs } = await svc.from('negotiations').select('id, lead_id, created_by, leads(status, last_contacted_at, created_at, assigned_to, contacts(full_name))').is('agreed_price', null);
  for (const n of negs ?? []) {
    const lead = (n as any).leads;
    if (!lead || ['won', 'lost'].includes(lead.status)) continue;
    const ref = new Date(lead.last_contacted_at ?? lead.created_at).getTime();
    const days = Math.floor((now - ref) / DAY);
    if (days < 7) continue;
    const name = lead.contacts?.full_name ?? 'Lead';
    const recipients = lead.assigned_to ? [lead.assigned_to] : n.created_by ? [n.created_by] : staff;
    for (const r of recipients) if (await notifyOnce(svc, r, `/crm/leads/${n.lead_id}#negotiation`, '💬 Negotiation stalling', `The negotiation with ${name} has been quiet for ${days} days — send a counter or confirm terms.`)) alerts += 1;
  }

  // Delayed reservations — active, near expiry, deposit still unpaid.
  const soon = new Date(now + 5 * DAY).toISOString();
  const { data: resv } = await svc.from('reservations').select('id, created_by, expires_at, deposit_paid, contacts:buyer_contact_id(full_name)').eq('status', 'active').eq('deposit_paid', false).not('expires_at', 'is', null).lte('expires_at', soon);
  for (const r of resv ?? []) {
    if (!r.created_by) continue;
    const name = (r as any).contacts?.full_name ?? 'buyer';
    if (await notifyOnce(svc, r.created_by, `/crm/leads#reservation-${r.id}`, '⏳ Reservation at risk', `${name}'s deposit is unpaid and the reservation lapses ${r.expires_at?.slice(0, 10)}.`)) alerts += 1;
  }

  // Inactive owners — moved in 6+ months ago with no maintenance ticket ever.
  const propStaff = await userIdsForRoles(svc, ['property', 'admin', 'management']);
  if (propStaff[0]) {
    const sixMonths = new Date(now - 182 * DAY).toISOString();
    const { data: owners } = await svc.from('homeowners').select('id, moved_in_at, contacts(full_name)').not('moved_in_at', 'is', null).lte('moved_in_at', sixMonths);
    const { data: tickets } = await svc.from('maintenance_tickets').select('homeowner_id');
    const withTickets = new Set((tickets ?? []).map((t) => t.homeowner_id));
    for (const o of owners ?? []) {
      if (withTickets.has(o.id)) continue;
      const name = (o as any).contacts?.full_name ?? 'Owner';
      if (await notifyStaffOnce(svc, propStaff, `/property#owner-${o.id}`, '🏡 Owner check-in due', `${name} moved in over 6 months ago with no maintenance contact — a proactive check-in is overdue.`)) alerts += 1;
    }
  }

  return { processed: alerts, summary: alerts > 0 ? `${alerts} churn alert(s) raised` : 'No churn risks detected' };
}

// ── Owner lifecycle automations ──────────────────────────────────────────────

/**
 * Owner-lifecycle nudges keyed off move-in (handover) and resolved maintenance:
 * post-repair follow-ups, annual inspection reminders, and handover-anniversary
 * check-ins. Durable events are created for the property team (deduped forever
 * via source_key); the owner + team are notified only on first creation.
 */
async function runOwnerLifecycle(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const todayISO = new Date().toISOString().slice(0, 10);
  const at9 = (dateStr: string) => new Date(`${dateStr}T09:00:00`).toISOString();
  const propStaff = await userIdsForRoles(svc, ['property', 'admin', 'management']);
  if (!propStaff[0]) return { processed: 0, summary: 'No property staff to route lifecycle events to' };
  const owner = propStaff[0];
  let created = 0;

  // 1 · Maintenance follow-ups — 3–10 days after a ticket was resolved.
  const from = new Date(now - 10 * DAY).toISOString();
  const to = new Date(now - 3 * DAY).toISOString();
  const { data: resolved } = await svc.from('maintenance_tickets').select('id, homeowner_id, title, resolved_at, homeowners(contact_id, contacts(full_name, phone, preferred_language, buyer_type))').in('status', ['resolved', 'closed']).not('resolved_at', 'is', null).gte('resolved_at', from).lte('resolved_at', to);
  for (const t of resolved ?? []) {
    const ho = (t as any).homeowners; const c = ho?.contacts;
    if (await ensureSystemEvent(svc, { profileId: owner, title: `Post-repair check-in — ${c?.full_name ?? 'owner'}`, startAt: at9(todayISO), source: 'maintenance_followup', sourceKey: `maintenance_followup:${t.id}`, priority: 'normal' })) {
      created += 1;
      const ownerProfile = await profileForContact(svc, ho?.contact_id ?? null);
      if (ownerProfile) await notifyOnce(svc, ownerProfile, '/homeowner', 'How is everything?', `Following up on your recent "${t.title}" repair — let us know if all is well.`);
      if (c?.phone) await sendTemplate({ contactId: ho.contact_id, channel: 'whatsapp', templateKey: 'owner_maintenance_reminder', to: c.phone, vars: { name: c.full_name ?? 'there', title: t.title, detail: 'Just checking everything is working well after our visit.' }, audience: templateAudience(c.buyer_type, c.preferred_language) });
    }
  }

  // Anniversary helper — next yearly occurrence of a base date, and days until.
  const nextAnniversary = (base: string) => {
    const b = new Date(base); const n = new Date(b); n.setFullYear(new Date().getFullYear());
    if (n.getTime() < now) n.setFullYear(n.getFullYear() + 1);
    return { date: n, days: Math.floor((n.getTime() - now) / DAY), years: n.getFullYear() - b.getFullYear() };
  };

  const { data: owners } = await svc.from('homeowners').select('id, moved_in_at, contact_id, contacts(full_name)').not('moved_in_at', 'is', null);
  for (const o of owners ?? []) {
    const name = (o as any).contacts?.full_name ?? 'Owner';
    const ann = nextAnniversary(o.moved_in_at!);
    const ownerProfile = await profileForContact(svc, o.contact_id);

    // 2 · Annual inspection reminder — 30 days before each move-in anniversary.
    if (ann.days >= 0 && ann.days <= 30 && ann.years >= 1) {
      if (await ensureSystemEvent(svc, { profileId: owner, title: `Annual inspection — ${name}`, startAt: at9(ann.date.toISOString().slice(0, 10)), source: 'annual_inspection', sourceKey: `annual_inspection:${o.id}:${ann.date.getFullYear()}`, priority: 'normal' })) {
        created += 1;
        await notifyStaffOnce(svc, propStaff, `/property#inspection-${o.id}`, 'Annual inspection due', `${name}'s year-${ann.years} inspection is due around ${ann.date.toISOString().slice(0, 10)}.`);
      }
    }

    // 3 · Handover anniversary check-in — 14 days before the anniversary.
    if (ann.days >= 0 && ann.days <= 14 && ann.years >= 1) {
      if (await ensureSystemEvent(svc, { profileId: owner, title: `Handover anniversary — ${name}`, startAt: at9(ann.date.toISOString().slice(0, 10)), source: 'handover_anniversary', sourceKey: `handover_anniversary:${o.id}:${ann.date.getFullYear()}`, priority: 'normal' })) {
        created += 1;
        if (ownerProfile) await notifyOnce(svc, ownerProfile, '/homeowner', `${ann.years} year${ann.years === 1 ? '' : 's'} in your home`, 'It has been a year since your handover — we would love to hear how you are settling in.');
        await notifyStaffOnce(svc, propStaff, `/property#anniversary-${o.id}`, 'Handover anniversary', `${name} reaches ${ann.years} year(s) since handover on ${ann.date.toISOString().slice(0, 10)}.`);
      }
    }
  }

  return { processed: created, summary: created > 0 ? `${created} owner-lifecycle event(s) created` : 'No owner-lifecycle events due' };
}

// ── Auto task orchestration ──────────────────────────────────────────────────

const weekKey = () => { const d = new Date(); const jan1 = new Date(d.getFullYear(), 0, 1); const wk = Math.ceil((((d.getTime() - jan1.getTime()) / DAY) + jan1.getDay() + 1) / 7); return `${d.getFullYear()}W${wk}`; };

/**
 * The system's hands — when a condition is detected, it doesn't just alert, it
 * schedules the work: hot leads → first-contact task, stalled deals → re-engage,
 * unpaid reservations → chase deposit, expiring contracts → prepare renewal,
 * long-overdue follow-ups → manager escalation, maintenance → escalation task.
 * Every task is idempotent (ensureTask / source_key); recurring conditions use a
 * weekly bucket so they re-raise once per week rather than pile up.
 */
async function runTaskOrchestration(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const staff = await staffUserIds(svc);
  const admins = await adminUserIds(svc);
  const propStaff = await userIdsForRoles(svc, ['property', 'admin', 'management']);
  const wk = weekKey();
  const inHours = (h: number) => new Date(now + h * 3600000).toISOString();
  let created = 0;

  // Hot leads with no first response → first-contact task.
  const { data: newLeads } = await svc.from('leads').select('id, assigned_to, created_at, first_response_at, contacts(full_name)').eq('status', 'new').is('first_response_at', null);
  for (const l of newLeads ?? []) {
    if ((now - new Date(l.created_at).getTime()) / 60000 < 15) continue;
    const name = (l as any).contacts?.full_name ?? 'lead';
    if (await ensureTask(svc, { assignedTo: l.assigned_to ?? staff[0] ?? null, title: `Make first contact — ${name}`, dueAt: inHours(1), sourceKey: `orch:firstcontact:${l.id}`, relatedType: 'lead', relatedId: l.id, description: 'Auto-created: new lead awaiting a first response (speed-to-lead).' })) { created += 1; if (l.assigned_to) await notifyOnce(svc, l.assigned_to, `/crm/leads/${l.id}`, '⚡ First contact needed', `${name} is waiting for a first response.`); }
  }

  // Stalled advanced-stage deals → weekly re-engage task.
  const { data: adv } = await svc.from('leads').select('id, status, assigned_to, last_contacted_at, created_at, contacts(full_name)').in('status', ['offer', 'negotiating', 'reserved']);
  for (const l of adv ?? []) {
    const days = (now - new Date(l.last_contacted_at ?? l.created_at).getTime()) / DAY;
    if (days < 7) continue;
    const name = (l as any).contacts?.full_name ?? 'lead';
    if (await ensureTask(svc, { assignedTo: l.assigned_to ?? staff[0] ?? null, title: `Re-engage stalled deal — ${name}`, dueAt: inHours(4), sourceKey: `orch:reengage:${l.id}:${wk}`, relatedType: 'lead', relatedId: l.id, description: `Auto-created: "${l.status}" deal quiet for ${Math.floor(days)} days.` })) created += 1;
  }

  // Unpaid reservations near expiry → chase-deposit task.
  const soon = new Date(now + 7 * DAY).toISOString();
  const { data: resv } = await svc.from('reservations').select('id, created_by, expires_at, deposit_paid, contacts:buyer_contact_id(full_name)').eq('status', 'active').eq('deposit_paid', false).not('expires_at', 'is', null).lte('expires_at', soon);
  for (const r of resv ?? []) {
    const name = (r as any).contacts?.full_name ?? 'buyer';
    const due = new Date(Math.max(now + 3600000, new Date(r.expires_at!).getTime() - 2 * DAY)).toISOString();
    if (await ensureTask(svc, { assignedTo: r.created_by ?? staff[0] ?? null, title: `Chase deposit — ${name}`, dueAt: due, sourceKey: `orch:deposit:${r.id}`, description: `Auto-created: deposit unpaid, reservation lapses ${r.expires_at?.slice(0, 10)}.` })) { created += 1; if (r.created_by) await notifyOnce(svc, r.created_by, '/crm/leads', '💰 Deposit unpaid', `${name}'s reservation deposit is still outstanding.`); }
  }

  // Expiring employee contracts → prepare-renewal task for admins.
  const in30 = new Date(now + 30 * DAY).toISOString().slice(0, 10);
  const todayISO = new Date().toISOString().slice(0, 10);
  const { data: contracts } = await svc.from('employee_contracts').select('id, title, expiry_date, profiles(full_name)').eq('status', 'active').gte('expiry_date', todayISO).lte('expiry_date', in30);
  for (const c of contracts ?? []) {
    const name = (c as any).profiles?.full_name ?? 'employee';
    const due = new Date(Math.max(now + DAY, new Date(c.expiry_date!).getTime() - 14 * DAY)).toISOString();
    if (await ensureTask(svc, { assignedTo: admins[0] ?? null, title: `Prepare contract renewal — ${name}`, dueAt: due, sourceKey: `orch:contract:${c.id}`, description: `Auto-created: "${c.title}" expires ${c.expiry_date}.` })) created += 1;
  }

  // Long-overdue follow-ups (3+ days) → manager escalation task.
  const overdueCut = new Date(now - 3 * DAY).toISOString();
  const { data: overdue } = await svc.from('follow_up_tasks').select('id, note, lead_id, assigned_to, due_at').eq('is_done', false).lt('due_at', overdueCut);
  for (const f of overdue ?? []) {
    if (await ensureTask(svc, { assignedTo: admins[0] ?? staff[0] ?? null, title: `Escalation: overdue follow-up${f.note ? ` — ${f.note}` : ''}`, dueAt: inHours(6), sourceKey: `orch:followup_escalation:${f.id}`, relatedType: f.lead_id ? 'lead' : undefined, relatedId: f.lead_id ?? undefined, description: `Auto-created: follow-up overdue since ${f.due_at.slice(0, 10)}.` })) created += 1;
  }

  // Maintenance escalation — high/emergency tickets open 3+ days.
  const { data: tickets } = await svc.from('maintenance_tickets').select('id, title, priority, created_at').in('status', ['open', 'acknowledged', 'in_progress', 'awaiting_parts', 'reopened']).in('priority', ['high', 'emergency']);
  for (const t of tickets ?? []) {
    if ((now - new Date(t.created_at).getTime()) / DAY < 3) continue;
    if (await ensureTask(svc, { assignedTo: propStaff[0] ?? null, title: `Escalate maintenance — ${t.title}`, dueAt: inHours(2), sourceKey: `orch:maintenance:${t.id}:${wk}`, relatedType: 'ticket', relatedId: t.id, description: `Auto-created: ${t.priority} ticket unresolved 3+ days.` })) { created += 1; await notifyStaffOnce(svc, propStaff, '/property', '🔧 Maintenance escalation', `${t.priority} ticket "${t.title}" is unresolved.`); }
  }

  return { processed: created, summary: created > 0 ? `${created} task(s) auto-orchestrated` : 'No new tasks to orchestrate' };
}

// ── Self-healing workflows ───────────────────────────────────────────────────

/**
 * Detects broken or half-finished processes and escalates them: active leads
 * with no next step scheduled, reservations without a contract, resolved
 * maintenance missing a contractor invoice, signed sales without a handover,
 * and a payroll run that hasn't happened by month-end. Each gap becomes an
 * idempotent task so nothing silently falls through.
 */
async function runSelfHealing(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const staff = await staffUserIds(svc);
  const admins = await adminUserIds(svc);
  const finance = await userIdsForRoles(svc, ['finance', 'admin', 'management']);
  const propStaff = await userIdsForRoles(svc, ['property', 'admin', 'management']);
  const wk = weekKey();
  const inHours = (h: number) => new Date(now + h * 3600000).toISOString();
  let healed = 0;

  // Missing next step — active leads with no open follow-up.
  const ACTIVE = ['contacted', 'engaged', 'qualified', 'viewing', 'offer', 'negotiating'];
  const { data: leads } = await svc.from('leads').select('id, status, assigned_to, contacts(full_name)').in('status', ACTIVE);
  const { data: openFollows } = await svc.from('follow_up_tasks').select('lead_id').eq('is_done', false);
  const hasFollow = new Set((openFollows ?? []).map((f) => f.lead_id).filter(Boolean));
  for (const l of leads ?? []) {
    if (hasFollow.has(l.id)) continue;
    const name = (l as any).contacts?.full_name ?? 'lead';
    if (await ensureTask(svc, { assignedTo: l.assigned_to ?? staff[0] ?? null, title: `Schedule next step — ${name}`, dueAt: inHours(8), sourceKey: `heal:nofollowup:${l.id}:${wk}`, relatedType: 'lead', relatedId: l.id, description: `Auto-created: "${l.status}" lead has no follow-up scheduled.` })) healed += 1;
  }

  // Incomplete paperwork — active reservation older than 7 days, no contract.
  const cut7 = new Date(now - 7 * DAY).toISOString();
  const { data: resv } = await svc.from('reservations').select('id, created_by, reserved_at, converted_contract_id, contacts:buyer_contact_id(full_name)').eq('status', 'active').is('converted_contract_id', null).lte('reserved_at', cut7);
  for (const r of resv ?? []) {
    const name = (r as any).contacts?.full_name ?? 'buyer';
    if (await ensureTask(svc, { assignedTo: r.created_by ?? admins[0] ?? null, title: `Draft contract — ${name}`, dueAt: inHours(24), sourceKey: `heal:nocontract:${r.id}`, description: 'Auto-created: reservation held 7+ days without a contract.' })) healed += 1;
  }

  // Missing invoice — resolved ticket with a contractor but no invoice.
  const { data: resolved } = await svc.from('maintenance_tickets').select('id, title, contractor_id, resolved_at').in('status', ['resolved', 'closed']).not('contractor_id', 'is', null).not('resolved_at', 'is', null);
  const { data: invoices } = await svc.from('contractor_invoices').select('ticket_id');
  const invoiced = new Set((invoices ?? []).map((i) => i.ticket_id).filter(Boolean));
  for (const t of resolved ?? []) {
    if (invoiced.has(t.id)) continue;
    if ((now - new Date(t.resolved_at!).getTime()) / DAY < 3) continue;
    if (await ensureTask(svc, { assignedTo: finance[0] ?? admins[0] ?? null, title: `Chase contractor invoice — ${t.title}`, dueAt: inHours(24), sourceKey: `heal:noinvoice:${t.id}`, description: 'Auto-created: work resolved but no contractor invoice on file.' })) healed += 1;
  }

  // Stalled handover — signed contract with no homeowner record yet.
  const { data: signed } = await svc.from('contracts').select('id, unit_id, signed_at').eq('status', 'signed');
  const { data: homeowners } = await svc.from('homeowners').select('unit_id');
  const ownedUnits = new Set((homeowners ?? []).map((h) => h.unit_id));
  for (const c of signed ?? []) {
    if (ownedUnits.has(c.unit_id)) continue;
    if (c.signed_at && (now - new Date(c.signed_at).getTime()) / DAY < 14) continue;
    if (await ensureTask(svc, { assignedTo: propStaff[0] ?? admins[0] ?? null, title: 'Complete handover — signed sale', dueAt: inHours(48), sourceKey: `heal:handover:${c.id}`, description: 'Auto-created: contract signed but handover/homeowner not recorded.' })) healed += 1;
  }

  // Delayed payroll — month-end reached with no payslips for the period.
  const d = new Date();
  if (d.getDate() >= 28 && admins[0]) {
    const period = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const { count } = await svc.from('payslips').select('id', { count: 'exact', head: true }).eq('period', period);
    if ((count ?? 0) === 0) {
      if (await ensureTask(svc, { assignedTo: admins[0], title: `Run payroll — ${period}`, dueAt: inHours(24), sourceKey: `heal:payroll:${period}`, description: 'Auto-created: no payslips issued for the current period.' })) { healed += 1; await notifyStaffOnce(svc, admins, '/hr', '⚠ Payroll not run', `No payslips issued for ${period}.`); }
    }
  }

  return { processed: healed, summary: healed > 0 ? `${healed} process gap(s) escalated` : 'No broken processes detected' };
}

// ── Learning loop ────────────────────────────────────────────────────────────

/** Refresh the empirical insights snapshot (source conversion, response-time
 *  impact, cadence, negotiation) from closed history. */
async function runLearningLoop(svc: Svc): Promise<RunResult> {
  const kinds = await persistLearningInsights(svc);
  return { processed: kinds, summary: `Learning insights refreshed (${kinds} models)` };
}

// ── Executive memory (auto-capture) ──────────────────────────────────────────

/**
 * Writes the institutionally significant moments into executive memory as they
 * happen — won / lost deals, closed negotiations, and resolved emergencies —
 * so the record survives staff turnover. Idempotent via source_key.
 */
async function runExecutiveMemory(svc: Svc): Promise<RunResult> {
  let captured = 0;

  const { data: closed } = await svc.from('leads').select('id, status, contacts(full_name)').in('status', ['won', 'lost']);
  for (const l of closed ?? []) {
    const name = (l as any).contacts?.full_name ?? 'client';
    const won = l.status === 'won';
    if (await captureMemory(svc, { kind: 'decision', title: `Deal ${won ? 'won' : 'lost'} — ${name}`, body: `Lead ${l.id} closed as ${l.status}.`, entityType: 'lead', entityId: l.id, tags: ['sales', l.status], importance: won ? 'high' : 'normal', sourceKey: `mem:${l.status}:${l.id}` })) captured += 1;
  }

  const { data: negs } = await svc.from('negotiations').select('id, agreed_price, lead_id, leads(contacts(full_name))').not('agreed_price', 'is', null).gte('agreed_price', 200000);
  for (const n of negs ?? []) {
    const name = (n as any).leads?.contacts?.full_name ?? 'client';
    if (await captureMemory(svc, { kind: 'negotiation', title: `Negotiation closed — ${name}`, body: `Agreed at ${formatCurrency(Number(n.agreed_price))}.`, entityType: 'lead', entityId: n.lead_id, tags: ['negotiation'], importance: 'high', sourceKey: `mem:neg:${n.id}` })) captured += 1;
  }

  const { data: emergencies } = await svc.from('maintenance_tickets').select('id, title, resolved_at').eq('priority', 'emergency').in('status', ['resolved', 'closed']).not('resolved_at', 'is', null);
  for (const t of emergencies ?? []) {
    if (await captureMemory(svc, { kind: 'risk', title: `Emergency resolved — ${t.title}`, body: `Emergency maintenance closed on ${t.resolved_at?.slice(0, 10)}.`, entityType: 'ticket', entityId: t.id, tags: ['maintenance', 'emergency'], importance: 'normal', sourceKey: `mem:maint:${t.id}` })) captured += 1;
  }

  return { processed: captured, summary: captured > 0 ? `${captured} memory entr(y/ies) captured` : 'No new memory to capture' };
}

// ── Acquisition outreach cadence ─────────────────────────────────────────────

/**
 * Nudges quiet landowners in the sourcing pipeline (contacted / interested /
 * negotiation) with an audience-aware WhatsApp then email touch, stamps
 * last_contacted_at (a natural 7-day throttle), and pings the assigned agent to
 * place a call. Mirrors the sales cadence, for the acquisition side.
 */
async function runAcquisitionCadence(svc: Svc): Promise<RunResult> {
  const cutoff = new Date(Date.now() - 7 * DAY).toISOString();
  const { data: parcels } = await svc
    .from('land_parcels')
    .select('id, reference, location, stage, assigned_to, contact_id, last_contacted_at, contacts(full_name, phone, email, buyer_type, preferred_language)')
    .in('stage', ['contacted', 'interested', 'negotiation'])
    .or(`last_contacted_at.is.null,last_contacted_at.lt.${cutoff}`);

  let processed = 0;
  for (const p of parcels ?? []) {
    const c = (p as any).contacts;
    if (!p.contact_id || (!c?.phone && !c?.email)) continue;
    const audience = templateAudience(c?.buyer_type, c?.preferred_language);
    const key = p.stage === 'contacted' ? 'landowner_intro' : 'landowner_follow_up';
    const vars = { name: c?.full_name ?? 'there', location: p.location ?? 'the area', agent: 'the Oramira team' };
    if (c?.phone) await sendTemplate({ contactId: p.contact_id, channel: 'whatsapp', templateKey: key, to: c.phone, vars, audience });
    else await sendTemplate({ contactId: p.contact_id, channel: 'email', templateKey: key, to: c.email, vars, audience });
    await svc.from('land_parcels').update({ last_contacted_at: new Date().toISOString() }).eq('id', p.id);
    if (p.assigned_to) await notifyOnce(svc, p.assigned_to, `/acquisitions/${p.id}`, '🌱 Landowner nudged', `${vars.name}'s parcel "${p.reference}" was nudged — worth a follow-up call.`);
    processed += 1;
  }
  return { processed, summary: processed > 0 ? `${processed} landowner(s) nudged` : 'No landowners due for outreach' };
}

/**
 * Acquisition ops — turns pipeline conditions into work: follow-up tasks for
 * contacted/interested parcels, no-contact alerts (14d+), stalled-negotiation
 * escalation (10d+), due-diligence deadline tasks, and document-request tasks.
 * Idempotent via ensureTask / notifyOnce; recurring conditions use a weekly key.
 */
async function runAcquisitionOps(svc: Svc): Promise<RunResult> {
  const now = Date.now();
  const staff = await staffUserIds(svc);
  const admins = await adminUserIds(svc);
  const wk = weekKey();
  const inHours = (h: number) => new Date(now + h * 3600000).toISOString();
  let n = 0;

  const { data: parcels } = await svc.from('land_parcels').select('id, reference, stage, assigned_to, last_contacted_at, due_diligence').not('stage', 'in', '("acquired","lost")');
  const { data: docs } = await svc.from('parcel_documents').select('parcel_id');
  const withDocs = new Set((docs ?? []).map((d) => d.parcel_id));

  for (const p of parcels ?? []) {
    const owner = p.assigned_to ?? staff[0] ?? null;
    const days = p.last_contacted_at ? (now - new Date(p.last_contacted_at).getTime()) / DAY : Infinity;

    if (days >= 14 && owner) { if (await notifyOnce(svc, owner, `/acquisitions/${p.id}`, '🕓 Landowner gone quiet', `No contact with "${p.reference}" in ${Number.isFinite(days) ? Math.floor(days) : 'many'} days.`)) n += 1; }

    if (p.stage === 'negotiation' && days >= 10 && owner) { if (await ensureTask(svc, { assignedTo: owner, title: `Re-engage stalled negotiation — ${p.reference}`, dueAt: inHours(4), sourceKey: `acq:stalled:${p.id}:${wk}`, description: 'Auto: negotiation quiet 10+ days.' })) n += 1; }

    if (['contacted', 'interested'].includes(p.stage) && owner) { if (await ensureTask(svc, { assignedTo: owner, title: `Follow up landowner — ${p.reference}`, dueAt: inHours(24), sourceKey: `acq:followup:${p.id}:${wk}` })) n += 1; }

    if (p.stage === 'due_diligence') {
      const dd = summarizeDD(p.due_diligence as Record<string, boolean>);
      if (!dd.mandatoryComplete && owner) { if (await ensureTask(svc, { assignedTo: owner, title: `Complete due diligence — ${p.reference}`, dueAt: inHours(48), sourceKey: `acq:dd:${p.id}:${wk}`, description: `${dd.mandatoryDone}/${dd.mandatoryTotal} mandatory checks done.` })) n += 1; }
      if (!withDocs.has(p.id) && owner) { if (await ensureTask(svc, { assignedTo: owner, title: `Request documents — ${p.reference}`, dueAt: inHours(48), sourceKey: `acq:docs:${p.id}`, description: 'Auto: no documents in the vault yet.' })) n += 1; }
    }
  }
  return { processed: n, summary: n > 0 ? `${n} acquisition task(s)/alert(s) raised` : 'No acquisition ops due' };
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
  { key: 'speed_to_lead', label: 'Speed-to-lead', description: 'Escalate new leads with no response past the 5-minute window.', schedule: 'Every 5 min', run: runSpeedToLead },
  { key: 'sales_cadence', label: 'Sales cadence', description: 'Follow-up cadence, email nurture, and retargeting for unanswered leads.', schedule: 'Every 6 hours', run: runSalesCadence },
  { key: 'contract_reminders', label: 'Contract reminders', description: 'Alert admins and employees ahead of contract expiry, probation end, and renewals.', schedule: 'Daily', run: runContractReminders },
  { key: 'viewing_reminders', label: 'Viewing reminders', description: 'Send WhatsApp reminders for viewings scheduled within the next 24 hours.', schedule: 'Hourly', run: runViewingReminders },
  { key: 'meeting_reminders', label: 'Meeting reminders', description: 'Send WhatsApp reminders for planner meetings linked to a lead within the next 2 hours.', schedule: 'Hourly', run: runMeetingReminders },
  { key: 'dead_lead_reactivation', label: 'Dead-lead reactivation', description: 'Move 30+ day cold leads into reactivation with a WhatsApp + email campaign.', schedule: 'Daily', run: runDeadLeadReactivation },
  { key: 'auto_calendar_events', label: 'Auto calendar events', description: 'Create planner events for contract/warranty expiries, viewing reminders, and payroll deadlines.', schedule: 'Daily', run: runAutoCalendarEvents },
  { key: 'churn_detection', label: 'Churn detection', description: 'Flag at-risk deals, stalled negotiations, delayed reservations, and inactive owners.', schedule: 'Daily', run: runChurnDetection },
  { key: 'owner_lifecycle', label: 'Owner lifecycle', description: 'Post-repair follow-ups, annual inspection reminders, and handover-anniversary check-ins.', schedule: 'Daily', run: runOwnerLifecycle },
  { key: 'task_orchestration', label: 'Task orchestration', description: 'Auto-create tasks for hot leads, stalled deals, unpaid reservations, expiring contracts, overdue follow-ups, and maintenance escalations.', schedule: 'Every 2 hours', run: runTaskOrchestration },
  { key: 'self_healing', label: 'Self-healing workflows', description: 'Detect and escalate broken processes: missing follow-ups, unfinished paperwork, stalled handovers, missing invoices, delayed payroll.', schedule: 'Daily', run: runSelfHealing },
  { key: 'learning_loop', label: 'Learning loop', description: 'Mine won/lost history into empirical insights for scoring, cadence, and negotiation.', schedule: 'Daily', run: runLearningLoop },
  { key: 'executive_memory', label: 'Executive memory', description: 'Auto-capture won/lost deals, closed negotiations, and resolved emergencies into institutional memory.', schedule: 'Daily', run: runExecutiveMemory },
  { key: 'acquisition_cadence', label: 'Acquisition cadence', description: 'Nudge quiet landowners in the sourcing pipeline via WhatsApp/email and flag a call.', schedule: 'Daily', run: runAcquisitionCadence },
  { key: 'acquisition_ops', label: 'Acquisition ops', description: 'Follow-up tasks, no-contact alerts, stalled-negotiation escalation, DD deadlines and document-request tasks.', schedule: 'Daily', run: runAcquisitionOps },
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
