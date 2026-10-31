import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getBranding } from '@/lib/branding';
import { DEFAULT_UNIT_FORMS, cleanValues, fieldsFor, label, mergeUnitForms, showValue, typeKeyOf } from '@/lib/unit-forms-shared';
import { cleanRooms, area } from '@/lib/unit-page-shared';
import { deliverNotification } from '@/lib/notifications';
import { formatNumber } from '@/lib/format';

/**
 * «Αποστολή επιλογής» — the public side. The client has no session, so rows
 * are read with the service client, and only what a client should see is
 * returned (client-visible fields, never staff-only ones or internal notes).
 */
const svc = () => createSupabaseServiceRoleClient() as any;
const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

export interface SelectionUnit {
  id: string; unitNumber: string; project: string; location: string | null; type: string | null; price: number | null;
  bedrooms: number | null; bathrooms: number | null; sqm: number | null; description: string | null;
  cover: string | null; facts: { label: string; value: string }[]; rooms: string[]; mapUrl: string | null; available: boolean; interested: boolean;
}

export async function loadSelection(token: string, opts: { countView?: boolean } = {}) {
  if (!TOKEN_RE.test(token)) return null;
  const s = svc();
  const { data: sel } = await s.from('property_selections').select('*').eq('token', token).maybeSingle();
  if (!sel) return null;
  const expired = Date.parse(sel.expires_at) < Date.now();

  const [{ data: contact }, { data: agent }, branding, { data: org }] = await Promise.all([
    sel.contact_id ? s.from('contacts').select('full_name, preferred_language').eq('id', sel.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    sel.created_by ? s.from('profiles').select('full_name').eq('id', sel.created_by).maybeSingle() : Promise.resolve({ data: null }),
    getBranding(),
    s.from('org_settings').select('data').eq('id', 'org').maybeSingle(),
  ]);
  const lang: 'el' | 'en' = (contact?.preferred_language ?? '').startsWith('el') ? 'el' : 'en';
  const forms = mergeUnitForms(org?.data?.unitForms ?? DEFAULT_UNIT_FORMS);
  const logo = org?.data?.appearance?.logoOnLight ?? branding.logoUrl;

  if (opts.countView && !expired) {
    const first = !sel.first_viewed_at;
    await s.from('property_selections').update({ view_count: (sel.view_count ?? 0) + 1, ...(first ? { first_viewed_at: new Date().toISOString() } : {}) }).eq('id', sel.id);
    if (first && sel.created_by) {
      await deliverNotification(s, { userId: sel.created_by, title: `${contact?.full_name ?? 'Ο πελάτης'} άνοιξε την επιλογή ακινήτων`, body: `${(sel.unit_ids ?? []).length} μονάδες`, link: sel.lead_id ? `/crm/leads/${sel.lead_id}` : null });
    }
  }

  let units: SelectionUnit[] = [];
  if (!expired && (sel.unit_ids ?? []).length) {
    const { data: rows } = await s
      .from('units')
      .select('id, unit_number, type, price, bedrooms, bathrooms, sqm, description, status, custom_fields, rooms, project_id, projects(name, location, latitude, longitude)')
      .in('id', sel.unit_ids);
    const { data: media } = await s.from('unit_media').select('unit_id, bucket, storage_path, sort').in('unit_id', sel.unit_ids).eq('kind', 'photo').order('sort');
    const coverPath = new Map<string, { bucket: string; path: string }>();
    for (const m of (media ?? []) as any[]) if (!coverPath.has(m.unit_id)) coverPath.set(m.unit_id, { bucket: m.bucket, path: m.storage_path });
    const order = new Map<string, number>((sel.unit_ids as string[]).map((id, i) => [id, i]));
    for (const u of ((rows ?? []) as any[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))) {
      const cp = coverPath.get(u.id);
      const cover = cp ? (await s.storage.from(cp.bucket).createSignedUrl(cp.path, 24 * 3600)).data?.signedUrl ?? null : null;
      const fields = fieldsFor(forms, typeKeyOf(u.type, forms.types)).filter((f) => f.visibleToClient);
      const values = cleanValues(u.custom_fields, fields);
      const p = u.projects ?? {};
      units.push({
        id: u.id, unitNumber: String(u.unit_number ?? ''), project: p.name ?? '', location: p.location ?? null, type: u.type ?? null,
        price: u.price != null ? Number(u.price) : null, bedrooms: u.bedrooms ?? null, bathrooms: u.bathrooms ?? null, sqm: u.sqm != null ? Number(u.sqm) : null,
        description: u.description ?? null, cover,
        facts: fields.filter((f) => values[f.key] !== undefined).map((f) => ({ label: label(f, lang), value: showValue(f, values[f.key], lang, formatNumber) })),
        rooms: cleanRooms(u.rooms).map((r) => `${r.name} ${formatNumber(area(r))} m²`),
        mapUrl: p.latitude != null && p.longitude != null ? `https://www.google.com/maps?q=${p.latitude},${p.longitude}` : null,
        available: u.status === 'available',
        interested: (sel.interested_unit_ids ?? []).includes(u.id),
      });
    }
  }

  return {
    lang, expired, units, message: sel.message as string | null,
    firstName: ((contact?.full_name ?? '') as string).split(' ')[0] || null,
    agent: agent?.full_name ?? null, company: branding.companyName, logo,
  };
}

/** «Θέλω προβολή» on the public page → notify the agent who sent it (and the unit's responsible agent). */
export async function registerInterest(token: string, unitId: string): Promise<boolean> {
  if (!TOKEN_RE.test(token) || !/^[0-9a-f-]{36}$/i.test(unitId)) return false;
  const s = svc();
  const { data: sel } = await s.from('property_selections').select('id, unit_ids, interested_unit_ids, created_by, lead_id, contact_id, expires_at').eq('token', token).maybeSingle();
  if (!sel || Date.parse(sel.expires_at) < Date.now() || !(sel.unit_ids ?? []).includes(unitId)) return false;
  const already = (sel.interested_unit_ids ?? []).includes(unitId);
  if (!already) await s.from('property_selections').update({ interested_unit_ids: [...(sel.interested_unit_ids ?? []), unitId] }).eq('id', sel.id);
  if (already) return true;
  const [{ data: contact }, { data: unit }] = await Promise.all([
    sel.contact_id ? s.from('contacts').select('full_name').eq('id', sel.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    s.from('units').select('unit_number, project_id, responsible_agent_id, projects(name)').eq('id', unitId).maybeSingle(),
  ]);
  const who = contact?.full_name ?? 'Ένας πελάτης';
  const what = `${unit?.projects?.name ?? ''} · Μονάδα ${unit?.unit_number ?? ''}`;
  const link = sel.lead_id ? `/crm/leads/${sel.lead_id}` : unit ? `/projects/${unit.project_id}/units/${unitId}` : null;
  const targets = Array.from(new Set([sel.created_by, unit?.responsible_agent_id].filter(Boolean))) as string[];
  for (const userId of targets) await deliverNotification(s, { userId, title: `${who} θέλει προβολή`, body: what, link, event: 'viewing_request' });
  if (sel.contact_id) await s.from('contact_communications').insert({ contact_id: sel.contact_id, channel: 'link', direction: 'inbound', summary: `Ζήτησε προβολή από την επιλογή: ${what}` });
  return true;
}
