import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { intakeInboundLead } from '@/lib/intake';
import { overlaps } from '@/lib/scheduling';
import { isOnLeave } from '@/lib/leave-availability';

/**
 * Public self-service booking — the native Calendly replacement. A prospect
 * picks a slot on an agent's public booking page (/book/[agentId]) and POSTs
 * here. We dedupe them into ONE contact + lead through the intake chokepoint,
 * guard against double-booking, create the viewing, then best-effort mirror to
 * the agent's calendar and fire confirmations (never blocking the booking).
 */
const CORS = {
  'Access-Control-Allow-Origin': process.env.WEBSITE_ALLOWED_ORIGIN ?? '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  let body: any;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: CORS }); }

  const { agentId, slotISO, name, email, phone, message, projectId } = body ?? {};
  const meetingType = body?.meetingType === 'video' ? 'video' : 'in_person';
  const durationMin = Number(body?.durationMin) || 45;
  const startMs = Date.parse(slotISO);
  if (!agentId || Number.isNaN(startMs)) return NextResponse.json({ error: 'agentId and a valid slotISO are required' }, { status: 400, headers: CORS });
  if (!email && !phone) return NextResponse.json({ error: 'email or phone is required' }, { status: 400, headers: CORS });
  if (startMs < Date.now()) return NextResponse.json({ error: 'That time is in the past' }, { status: 400, headers: CORS });

  const supabase = createSupabaseServiceRoleClient();

  // Agent must be a real, active staff member.
  const { data: agent } = await supabase.from('profiles').select('id, full_name, is_active').eq('id', agentId).maybeSingle();
  if (!agent || agent.is_active === false) return NextResponse.json({ error: 'Unknown agent' }, { status: 404, headers: CORS });

  const endMs = startMs + durationMin * 60000;

  // Agent on approved leave that day → the slot isn't bookable.
  if (await isOnLeave(agentId, new Date(startMs).toISOString())) {
    return NextResponse.json({ error: 'That day is unavailable — please pick another slot.' }, { status: 409, headers: CORS });
  }

  // Double-booking guard — reject if the slot overlaps an existing viewing.
  // Best-effort: if the read is unavailable we don't block the booking.
  try {
    const dayStart = new Date(startMs - 12 * 3600_000).toISOString();
    const dayEnd = new Date(endMs + 12 * 3600_000).toISOString();
    const { data: sameAgent } = await supabase
      .from('viewings')
      .select('scheduled_at')
      .eq('agent_id', agentId)
      .not('status', 'in', '("cancelled","no_show")')
      .gte('scheduled_at', dayStart)
      .lte('scheduled_at', dayEnd);
    const busy = (sameAgent ?? []).map((v: any) => ({ start: v.scheduled_at, end: new Date(new Date(v.scheduled_at).getTime() + durationMin * 60000).toISOString() }));
    if (overlaps(startMs, endMs, busy)) {
      return NextResponse.json({ error: 'That time was just taken — please pick another slot.' }, { status: 409, headers: CORS });
    }
  } catch { /* availability read unavailable — proceed */ }

  // One contact + lead through the dedup chokepoint (also fires the welcome automation).
  const { contactId, leadId } = await intakeInboundLead({
    channel: 'website', source: 'website', name, email, phone,
    message: message ? `Viewing request: ${message}` : 'Requested a viewing via the booking page',
    projectInterestId: projectId || undefined,
  });

  const { data: viewing, error } = await supabase
    .from('viewings')
    .insert({
      lead_id: leadId, contact_id: contactId, project_id: projectId || null,
      agent_id: agentId, scheduled_at: new Date(startMs).toISOString(),
      status: 'scheduled', created_by: agentId,
      notes: [meetingType === 'video' ? '[Video call]' : '[In person]', message].filter(Boolean).join(' ') || null,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[book] viewing insert failed', error.message);
    return NextResponse.json({ error: 'Could not save the booking' }, { status: 500, headers: CORS });
  }

  // NOTE: agent notification, WhatsApp/email confirmation, and Google Calendar
  // mirror are handled by the existing viewing-reminder cron + scheduleViewing
  // path; wiring them into this public route is a follow-up (both currently gated
  // on the message_templates.audience column — see schema-drift repair 0049/0027).

  return NextResponse.json({ ok: true, viewingId: viewing.id, at: new Date(startMs).toISOString() }, { headers: CORS });
}
