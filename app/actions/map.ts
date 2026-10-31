'use server';

import { randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { logActivity } from '@/lib/activity';
import { areasIn } from '@/lib/areas';
import type { DayStop } from '@/lib/map-shared';

/**
 * «Πλάνο ημέρας»: one agent's viewings on a day (Cyprus time), in time order,
 * with each stop's position (the project's coordinates, or its area's centre).
 */
export async function getDayPlan(agentId: string | null, day: string): Promise<{ ok: true; stops: DayStop[] } | { ok: false; error: string }> {
  const profile = await requirePermission('leads');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: 'Μη έγκυρη ημερομηνία.' };
  // The day in Cyprus: widen by ±3h around UTC midnight and filter precisely below.
  const from = new Date(`${day}T00:00:00Z`).getTime() - 3 * 3600_000;
  const to = new Date(`${day}T23:59:59Z`).getTime() + 3 * 3600_000;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any)
    .from('viewings')
    .select('id, scheduled_at, status, notes, agent_id, contacts(full_name, phone), units(unit_number), projects(name, location, latitude, longitude)')
    .eq('agent_id', agentId || profile.id)
    .gte('scheduled_at', new Date(from).toISOString())
    .lte('scheduled_at', new Date(to).toISOString())
    .neq('status', 'cancelled')
    .order('scheduled_at');
  if (error) return { ok: false, error: error.message };
  const local = (iso: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Nicosia', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
  const stops: DayStop[] = ((data ?? []) as any[])
    .filter((v) => local(v.scheduled_at) === day)
    .map((v) => {
      const p = v.projects ?? {};
      let lat: number | null = p.latitude != null ? Number(p.latitude) : null;
      let lng: number | null = p.longitude != null ? Number(p.longitude) : null;
      let approx = false;
      if (lat == null) { const a = areasIn(p.location)[0]; if (a) { lat = a.lat; lng = a.lng; approx = true; } }
      return {
        id: v.id, time: v.scheduled_at, status: v.status, contact: v.contacts?.full_name ?? '—', phone: v.contacts?.phone ?? null,
        unit: v.units?.unit_number ?? null, project: p.name ?? null, lat, lng, approx,
      };
    });
  return { ok: true, stops };
}

/**
 * «Αποστολή επιλογής»: a link the client opens without signing in, showing the
 * chosen units. Returns the link plus ready-to-send WhatsApp / email texts.
 */
export async function createSelection(p: { leadId: string | null; contactId: string | null; unitIds: string[]; message?: string }): Promise<
  { ok: true; url: string; whatsapp: string | null; mailto: string | null } | { ok: false; error: string }
> {
  const profile = await requirePermission('leads', 'edit');
  const ids = Array.from(new Set((p.unitIds ?? []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))).slice(0, 30);
  if (!ids.length) return { ok: false, error: 'Διαλέξτε τουλάχιστον μία μονάδα.' };
  const supabase = await createSupabaseServerClient();

  let contactId = p.contactId;
  if (p.leadId && !contactId) {
    const { data: l } = await supabase.from('leads').select('contact_id').eq('id', p.leadId).maybeSingle();
    contactId = l?.contact_id ?? null;
  }
  const { data: contact } = contactId
    ? await supabase.from('contacts').select('full_name, email, phone, preferred_language').eq('id', contactId).maybeSingle()
    : { data: null };

  const token = randomBytes(18).toString('base64url');
  const { error } = await (supabase as any).from('property_selections').insert({
    token, lead_id: p.leadId, contact_id: contactId, unit_ids: ids, message: p.message?.trim().slice(0, 1000) || null, created_by: profile.id,
  });
  if (error) return { ok: false, error: /does not exist|schema cache/i.test(error.message) ? 'Χρειάζεται η αλλαγή βάσης 0062.' : error.message };

  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'https';
  const base = process.env.NEXT_PUBLIC_APP_URL || (host ? `${proto}://${host}` : '');
  const url = `${base}/selection/${token}`;

  const el = (contact?.preferred_language ?? '').startsWith('el');
  const first = (contact?.full_name ?? '').split(' ')[0];
  const text = el
    ? `Γεια σας${first ? ` ${first}` : ''}, σας ετοίμασα ${ids.length === 1 ? 'ένα ακίνητο' : `${ids.length} ακίνητα`} που ταιριάζουν σε αυτό που ψάχνετε: ${url}${p.message ? `\n\n${p.message}` : ''}`
    : `Hi${first ? ` ${first}` : ''}, here ${ids.length === 1 ? 'is a property' : `are ${ids.length} properties`} that match what you are looking for: ${url}${p.message ? `\n\n${p.message}` : ''}`;
  const phone = (contact?.phone ?? '').replace(/[^\d]/g, '');
  const whatsapp = phone ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}` : null;
  const mailto = contact?.email ? `mailto:${contact.email}?subject=${encodeURIComponent(el ? 'Ακίνητα για εσάς' : 'Properties for you')}&body=${encodeURIComponent(text)}` : null;

  if (contactId) {
    await (supabase as any).from('contact_communications').insert({ contact_id: contactId, channel: 'link', direction: 'outbound', summary: `Επιλογή ${ids.length} μονάδων: ${url}`, logged_by: profile.id });
  }
  await logActivity({ entityType: 'lead', entityId: p.leadId ?? contactId ?? profile.id, action: 'selection_sent', metadata: { units: ids.length, url } });
  return { ok: true, url, whatsapp, mailto };
}
