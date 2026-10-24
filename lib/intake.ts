import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { onNewLead } from '@/lib/automation-events';
import { ensureFirstFollowUp } from '@/lib/lead-followup';
import { detectBuyerType, detectLanguage, languageForBuyerType, detectProjectInterest } from '@/lib/lead-detect';

/**
 * Website intake chokepoint. Public contact-form and newsletter submissions
 * flow through here, never inserting into `contacts` directly — they go via
 * find_or_create_contact() so a person who filled the form last year and
 * subscribes to the newsletter today resolve to ONE contact. Runs with the
 * service-role client because it's called from trusted server code only
 * (public API routes, automations) and the underlying tables are staff-only
 * under RLS.
 */

const VALID_SOURCES = ['website', 'meta', 'google', 'organic', 'referral', 'whatsapp', 'walk_in', 'other'];

/** Coerce an arbitrary marketing source label to a valid lead_source enum. */
export function coerceSource(s?: string | null): string {
  if (!s) return 'website';
  const v = s.toLowerCase().trim();
  if (VALID_SOURCES.includes(v)) return v;
  if (['campaign', 'ads', 'paid', 'facebook', 'instagram', 'manychat', 'messenger', 'fb', 'ig'].includes(v)) return 'meta';
  if (['adwords', 'ppc', 'search'].includes(v)) return 'google';
  if (v === 'newsletter') return 'website';
  return 'other';
}

export interface ContactFormPayload {
  name?: string;
  email: string;
  phone?: string;
  message?: string;
  source?: string;
  projectInterestId?: string;
  budget?: string;
  budgetMin?: number;
  budgetMax?: number;
  timeline?: string; // timeline_to_buy — carried from bot/ad qualification
}

/**
 * Core identity + lead resolution for a contact-form submission. Does NOT
 * capture a website_submissions row — callers either capture first
 * (intakeContactForm) or operate on an already-captured row (the website-sync
 * automation reconciling unprocessed rows). Shared so both paths dedupe people
 * the same way and neither double-captures.
 */
export async function resolveContactFormLead(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  p: ContactFormPayload
): Promise<{ contactId: string; leadId: string | null }> {
  const source = coerceSource(p.source);

  const { data: contactId, error } = await supabase.rpc('find_or_create_contact', {
    p_email: p.email,
    p_name: p.name ?? null,
    p_phone: p.phone ?? null,
  });
  if (error || !contactId) throw error ?? new Error('Could not resolve contact');

  await supabase.from('contacts').update({ is_lead: true }).eq('id', contactId);
  await supabase.from('contacts').update({ first_touch_source: source }).eq('id', contactId).is('first_touch_source', null);

  // Auto-detect buyer type + language from the phone country code and message
  // script, only filling fields that aren't already set (never override a human).
  const buyerType = detectBuyerType({ phone: p.phone, message: p.message });
  const language = detectLanguage(p.message) ?? languageForBuyerType(buyerType);
  await supabase.from('contacts').update({ buyer_type: buyerType }).eq('id', contactId).is('buyer_type', null);
  await supabase.from('contacts').update({ preferred_language: language }).eq('id', contactId).is('preferred_language', null);

  // Auto-detect project interest from the enquiry text when not provided.
  let projectInterestId = p.projectInterestId ?? null;
  if (!projectInterestId && p.message) {
    const { data: projects } = await supabase.from('projects').select('id, name');
    projectInterestId = detectProjectInterest(p.message, projects ?? []);
  }

  // Reuse an open lead if one exists, else create (the on_lead_created trigger
  // auto-logs the activity and creates the 24h follow-up task).
  const { data: existing } = await supabase
    .from('leads')
    .select('id')
    .eq('contact_id', contactId)
    .not('status', 'in', '("won","lost")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let leadId = existing?.id ?? null;
  if (!leadId) {
    const { data: lead } = await supabase
      .from('leads')
      .insert({
        contact_id: contactId,
        source,
        message: p.message ?? null,
        preferred_project_id: projectInterestId,
        budget_min: p.budgetMin ?? null,
        budget_max: p.budgetMax ?? null,
        timeline_to_buy: p.timeline ?? null,
      })
      .select('id')
      .single();
    leadId = lead?.id ?? null;
    if (leadId) {
      await onNewLead(leadId); // welcome automation for inbound leads
      // Same first-touch to-do every inbound lead gets — clear, urgent, and
      // routed to the default owner so it's immediately manageable.
      await ensureFirstFollowUp(supabase, { leadId, contactId, source });
    }
  }

  return { contactId, leadId };
}

export async function intakeContactForm(p: ContactFormPayload): Promise<{ contactId: string; leadId: string | null }> {
  const supabase = createSupabaseServiceRoleClient();
  const source = coerceSource(p.source);

  // 1 — raw capture, kept permanently for audit
  const { data: submission } = await supabase
    .from('website_submissions')
    .insert({
      type: 'contact_form',
      name: p.name ?? null,
      email: p.email,
      phone: p.phone ?? null,
      message: p.message ?? null,
      source,
      project_interest_id: p.projectInterestId ?? null,
      budget: p.budget ?? null,
    })
    .select('id')
    .single();

  // 2 — resolve identity + lead through the shared chokepoint
  const { contactId, leadId } = await resolveContactFormLead(supabase, p);

  // 3 — link the raw submission to the resolved identity
  if (submission) {
    await supabase
      .from('website_submissions')
      .update({ contact_id: contactId, lead_id: leadId, processed_at: new Date().toISOString() })
      .eq('id', submission.id);
  }

  return { contactId, leadId };
}

export interface NewsletterPayload {
  email: string;
  name?: string;
  source?: string;
  tags?: string[];
}

/** Core newsletter sync (no capture row). Shared by the API path and automation. */
export async function resolveNewsletter(
  supabase: ReturnType<typeof createSupabaseServiceRoleClient>,
  p: NewsletterPayload
): Promise<{ contactId: string }> {
  const source = coerceSource(p.source);
  const email = p.email.toLowerCase().trim();

  const { data: contactId, error } = await supabase.rpc('find_or_create_contact', {
    p_email: email,
    p_name: p.name ?? null,
    p_phone: null,
  });
  if (error || !contactId) throw error ?? new Error('Could not resolve contact');

  await supabase.from('contacts').update({ is_newsletter_subscriber: true }).eq('id', contactId);
  await supabase.from('contacts').update({ first_touch_source: source }).eq('id', contactId).is('first_touch_source', null);

  // Same contact identity, deduped by unique email on the subscriber row.
  await supabase
    .from('newsletter_subscribers')
    .upsert({ contact_id: contactId, email, source, tags: p.tags ?? [] }, { onConflict: 'email' });

  return { contactId };
}

/**
 * Normalized inbound lead ingestion for any channel (Instagram, Facebook,
 * website, WhatsApp, manual import). Captures the raw submission tagged with the
 * channel, then resolves to one contact + lead through the same chokepoint.
 * Provider APIs are NOT integrated — a channel webhook/import just POSTs here.
 */
export async function intakeInboundLead(p: {
  channel: string; // instagram | facebook | website | whatsapp | manual
  name?: string;
  email?: string;
  phone?: string;
  message?: string;
  source?: string;
  externalId?: string;
  // Qualification carried from the bot / ad form (ManyChat, Meta Lead Ads) so a
  // qualified inbound lead lands pre-qualified instead of dropping to discovery.
  budgetMin?: number;
  budgetMax?: number;
  projectInterestId?: string;
  timeline?: string;
}): Promise<{ contactId: string; leadId: string | null }> {
  const supabase = createSupabaseServiceRoleClient();
  const source = coerceSource(p.source ?? p.channel);
  // A lead needs an email for the identity chokepoint; synthesize a placeholder
  // for channels that only give a handle, so manual cleanup can merge later.
  const email = (p.email ?? `${p.channel}-${p.externalId ?? Date.now()}@inbound.oramira`).toLowerCase().trim();

  const { data: submission } = await supabase
    .from('website_submissions')
    .insert({ type: p.channel, name: p.name ?? null, email, phone: p.phone ?? null, message: p.message ?? null, source })
    .select('id')
    .single();

  const { contactId, leadId } = await resolveContactFormLead(supabase, {
    name: p.name, email, phone: p.phone, message: p.message, source,
    budgetMin: p.budgetMin, budgetMax: p.budgetMax, projectInterestId: p.projectInterestId, timeline: p.timeline,
  });

  if (submission) {
    await supabase.from('website_submissions').update({ contact_id: contactId, lead_id: leadId, processed_at: new Date().toISOString() }).eq('id', submission.id);
  }
  return { contactId, leadId };
}

export async function intakeNewsletter(p: NewsletterPayload): Promise<{ contactId: string }> {
  const supabase = createSupabaseServiceRoleClient();
  const source = coerceSource(p.source);
  const email = p.email.toLowerCase().trim();
  await supabase.from('website_submissions').insert({ type: 'newsletter', name: p.name ?? null, email, source });
  return resolveNewsletter(supabase, p);
}
