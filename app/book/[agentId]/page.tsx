import { notFound } from 'next/navigation';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { computeAvailability, countSlots } from '@/lib/availability';
import { getApprovedLeaveBlocks } from '@/lib/leave-availability';
import { BookingWidget } from '@/components/booking/BookingWidget';
import { mergeFieldRules } from '@/lib/org-settings-shared';
import { consentWording, getGdprSettingsPublic } from '@/lib/gdpr';

export const dynamic = 'force-dynamic';

/**
 * Public self-service booking page — the Calendly replacement. No auth: a
 * prospect opens /book/[agentId] (optionally ?project=<id>), sees the agent's
 * live availability (working hours minus real commitments) and books a viewing
 * in two taps. Availability is computed by the shared engine; the booking POSTs
 * to /api/public/book which dedupes them into one CRM lead + viewing.
 */
export default async function BookingPage({ params, searchParams }: { params: { agentId: string }; searchParams: { project?: string } }) {
  const supabase = createSupabaseServiceRoleClient();

  const { data: agent } = await supabase.from('profiles').select('id, full_name, avatar_url, is_active').eq('id', params.agentId).maybeSingle();
  if (!agent || agent.is_active === false) notFound();

  const nowISO = new Date().toISOString();
  const horizonEnd = new Date(Date.now() + 21 * 86400_000).toISOString();

  // Busy = the agent's real commitments. Viewings always; calendar_events is
  // additive and degrades gracefully if unavailable (never blocks the page).
  const { data: viewings } = await supabase
    .from('viewings').select('scheduled_at')
    .eq('agent_id', agent.id).not('status', 'in', '("cancelled","no_show")')
    .gte('scheduled_at', nowISO).lte('scheduled_at', horizonEnd);
  let busy = (viewings ?? []).map((v: any) => ({ start: v.scheduled_at, end: new Date(new Date(v.scheduled_at).getTime() + 45 * 60000).toISOString() }));

  const { data: events } = await supabase
    .from('calendar_events').select('start_at, duration_min')
    .eq('profile_id', agent.id).neq('status', 'cancelled')
    .gte('start_at', nowISO).lte('start_at', horizonEnd);
  if (events) busy = busy.concat(events.map((e: any) => ({ start: e.start_at, end: new Date(new Date(e.start_at).getTime() + (e.duration_min ?? 45) * 60000).toISOString() })));

  // Approved leave removes whole days from the agent's public availability.
  busy = busy.concat(await getApprovedLeaveBlocks(agent.id, nowISO, horizonEnd));

  const days = computeAvailability({ busy, durationMin: 45, horizonDays: 21, maxDays: 7 });

  let project: { id: string; name: string } | null = null;
  if (searchParams.project) {
    const { data } = await supabase.from('projects').select('id, name').eq('id', searchParams.project).maybeSingle();
    project = data ?? null;
  }

  const wording = consentWording(await getGdprSettingsPublic(), 'en');
  const { data: org } = await (supabase as any).from('org_settings').select('data').eq('id', 'org').maybeSingle();
  const rules = mergeFieldRules(org?.data?.fields);
  return <BookingWidget agent={{ id: agent.id, name: agent.full_name, avatarUrl: agent.avatar_url }} days={days} totalSlots={countSlots(days)} project={project} consentWording={wording} fields={{ shown: rules.publicShown, required: rules.public }} />;
}
