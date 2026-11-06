import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { sendTemplate } from '@/lib/communications';
import { notifyUser } from '@/lib/notifications';
import { templateAudience } from '@/lib/sales-doctrine';
import { audienceFor, mergeLeadAutomation } from '@/lib/lead-automation-shared';

/**
 * Event-driven automation. Domain server actions call these on key events; each
 * fans out the configured templates/notifications and is fully self-contained
 * (swallows its own errors) so automation can never break the core action.
 * Time-based automations (no-reply, overdue payments) live in lib/automations
 * (cron). Sends route through the provider abstraction — simulated/logged until
 * a live provider is connected.
 */

function svc() {
  return createSupabaseServiceRoleClient();
}

async function leadContext(leadId: string) {
  const { data } = await svc()
    .from('leads')
    .select('contact_id, assigned_to, contacts(full_name, email, phone, buyer_type, preferred_language), projects:preferred_project_id(name), owner:assigned_to(full_name)')
    .eq('id', leadId)
    .maybeSingle();
  if (!data) return null;
  const c = (data as any).contacts;
  return {
    contactId: data.contact_id,
    ownerId: data.assigned_to as string | null,
    name: c?.full_name ?? 'there',
    email: c?.email ?? null,
    phone: c?.phone ?? null,
    audience: templateAudience(c?.buyer_type, c?.preferred_language),
    project: (data as any).projects?.name ?? 'Oramira',
    agent: (data as any).owner?.full_name ?? 'the Oramira team',
  };
}

/**
 * New lead → καλωσόρισμα στη γλώσσα του πελάτη (WhatsApp/email, όπως ορίζουν οι
 * Ρυθμίσεις → Leads & αυτοματισμοί) και ειδοποίηση στον υπεύθυνο.
 */
export async function onNewLead(leadId: string) {
  try {
    const s = svc();
    const { data: org } = await s.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const cfg = mergeLeadAutomation((org as any)?.data?.leadAutomation);
    const { data: lang } = await s.from('leads').select('contacts(preferred_language, buyer_type)').eq('id', leadId).maybeSingle();
    const ctx = await leadContext(leadId);
    if (!ctx) return;
    const c = (lang as any)?.contacts;
    const audience = audienceFor(c?.preferred_language, c?.buyer_type);
    const vars = { name: ctx.name, project: ctx.project, agent: ctx.agent };
    if (cfg.welcome.enabled) {
      if (cfg.welcome.whatsapp && ctx.phone) await sendTemplate({ contactId: ctx.contactId, leadId, channel: 'whatsapp', templateKey: 'first_contact', to: ctx.phone, vars, audience });
      if (cfg.welcome.email && ctx.email) await sendTemplate({ contactId: ctx.contactId, leadId, channel: 'email', templateKey: 'first_contact', to: ctx.email, vars, audience });
    }
    if (ctx.ownerId) {
      await notifyUser({ userId: ctx.ownerId, title: '🔥 Νέο lead — απαντήστε τώρα', body: `${ctx.name} μόλις ήρθε. Στόχος: απάντηση μέσα σε ${cfg.unanswered.minutes} λεπτά.`, link: `/crm/leads/${leadId}`, event: 'new_lead' });
    }
  } catch { /* automation is best-effort */ }
}

/** Lead (re)assigned → notify the new owner in-app. */
export async function onLeadAssigned(leadId: string, ownerId: string) {
  try {
    await notifyUser({ userId: ownerId, title: 'A lead was assigned to you', body: 'Open your sales board to review it.', link: `/crm/leads/${leadId}`, event: 'lead_assigned' });
  } catch { /* */ }
}

/** Lead moved to "viewing" → confirmation message. */
export async function onViewingScheduled(leadId: string) {
  try {
    const ctx = await leadContext(leadId);
    if (!ctx) return;
    const vars = { name: ctx.name, project: ctx.project, agent: ctx.agent, date: 'the agreed time' };
    await sendTemplate({ contactId: ctx.contactId, leadId, channel: 'whatsapp', templateKey: 'viewing_confirmation', to: ctx.phone, vars, audience: ctx.audience });
  } catch { /* */ }
}

/** Reservation created → confirmation to the buyer. */
export async function onReservationCreated(contactId: string, unitId: string) {
  try {
    const s = svc();
    const { data: contact } = await s.from('contacts').select('full_name, email, phone, buyer_type, preferred_language').eq('id', contactId).maybeSingle();
    const { data: unit } = await s.from('units').select('projects(name)').eq('id', unitId).maybeSingle();
    const audience = templateAudience(contact?.buyer_type, contact?.preferred_language);
    const vars = { name: contact?.full_name ?? 'there', project: (unit as any)?.projects?.name ?? 'Oramira', agent: 'the Oramira team' };
    await sendTemplate({ contactId, channel: 'whatsapp', templateKey: 'reservation_confirmation', to: contact?.phone ?? null, vars, audience });
    await sendTemplate({ contactId, channel: 'email', templateKey: 'reservation_confirmation', to: contact?.email ?? null, vars, audience });
  } catch { /* */ }
}

/** Maintenance ticket opened → acknowledgment to the homeowner. */
export async function onMaintenanceOpened(ticketId: string) {
  try {
    const s = svc();
    const { data: ticket } = await s
      .from('maintenance_tickets')
      .select('homeowners(contact_id, contacts(full_name, email, phone)), projects(name)')
      .eq('id', ticketId)
      .maybeSingle();
    const contactId = (ticket as any)?.homeowners?.contact_id;
    const c = (ticket as any)?.homeowners?.contacts;
    if (!contactId) return;
    const vars = { name: c?.full_name ?? 'there', project: (ticket as any)?.projects?.name ?? 'your home', agent: 'the Oramira team' };
    await sendTemplate({ contactId, channel: 'whatsapp', templateKey: 'maintenance_acknowledgment', to: c?.phone ?? null, vars });
    await sendTemplate({ contactId, channel: 'email', templateKey: 'maintenance_acknowledgment', to: c?.email ?? null, vars });
  } catch { /* */ }
}
