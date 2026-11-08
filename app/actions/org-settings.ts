'use server';

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath, revalidateTag } from 'next/cache';
import { ORG_SETTINGS_TAG } from '@/lib/org-settings';
import { getLabelMap, ensureLabelTranslations } from '@/lib/label-tr';
import { settingsNames } from '@/lib/localize';
import { headers } from 'next/headers';
import { ipAllowed } from '@/lib/security-shared';
import { mergeWatermark } from '@/lib/watermark-shared';
import { mergeReservations } from '@/lib/pricing-shared';
import { mergeAml } from '@/lib/kyc-shared';
import { mergePipelines } from '@/lib/pipeline-shared';
import { mergeLeadAutomation } from '@/lib/lead-automation-shared';
import { mergeOrgSettings, mergeAppearance, mergeTags, mergeNotifications, mergeInvoices, mergeGdpr, mergeFieldRules, mergePortal, mergeDepartments, mergeCommunication, type AppearanceSettings, type BusinessSettings, type Office } from '@/lib/org-settings-shared';

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Merge one settings slice into the singleton org_settings.data JSONB. */
/** Μετά την αποθήκευση: αυτόματη μετάφραση των νέων ονομάτων (στάδια, τμήματα, πεδία, μενού, ρόλοι). */
const NAMED_SLICES = ['pipelines', 'departments', 'tags', 'menu', 'roles'];
export async function saveOrgSlice(slice: string, value: unknown): Promise<SaveResult> {
  const r = await saveOrgSliceInner(slice, value);
  if (r.ok && NAMED_SLICES.includes(slice)) {
    try {
      const { data } = await (createSupabaseServiceRoleClient() as any).from('org_settings').select('data').eq('id', 'org').maybeSingle();
      const raw = mergeOrgSettings(data?.data ?? {});
      await ensureLabelTranslations(settingsNames(raw), { ...(await getLabelMap()) }, 8000);
    } catch { /* η μετάφραση θα ξαναδοκιμαστεί όταν ανοίξει σελίδα */ }
  }
  return r;
}

async function saveOrgSliceInner(slice: string, value: unknown): Promise<SaveResult> {
  // Slices with structure are normalized server-side before they are stored.
  if (slice === 'tags') return saveSlice(slice, mergeTags(value));
  if (slice === 'notifications') return saveSlice(slice, mergeNotifications(value));
  if (slice === 'invoices') return saveSlice(slice, mergeInvoices(value));
  if (slice === 'gdpr') return saveSlice(slice, mergeGdpr(value));
  if (slice === 'fields') return saveSlice(slice, mergeFieldRules(value));
  if (slice === 'portal') return saveSlice(slice, mergePortal(value));
  if (slice === 'departments') return saveSlice(slice, mergeDepartments(value));
  if (slice === 'communication') return saveSlice(slice, mergeCommunication(value));
  if (slice === 'layout') { const r = await saveSlice(slice, mergeOrgSettings({ layout: value }).layout); if (r.ok) revalidatePath('/', 'layout'); return r; }
  if (slice === 'menu') { const r = await saveSlice(slice, mergeOrgSettings({ menu: value }).menu); if (r.ok) revalidatePath('/', 'layout'); return r; }
  if (slice === 'unitForms') return saveSlice(slice, mergeOrgSettings({ unitForms: value }).unitForms);
  if (slice === 'pipelines') return saveSlice(slice, mergePipelines(value));
  if (slice === 'leadAutomation') return saveSlice(slice, mergeLeadAutomation(value));
  if (slice === 'aml') return saveSlice(slice, mergeAml(value));
  if (slice === 'reservations') return saveSlice(slice, mergeReservations(value));
  if (slice === 'watermark') return saveSlice(slice, mergeWatermark(value));
  if (slice === 'locale') return saveSlice(slice, mergeOrgSettings({ locale: value }).locale);
  if (slice === 'security') {
    const clean = mergeOrgSettings({ security: value }).security;
    // Never let an admin lock themselves out with the IP allow-list.
    if (clean.ipAllowList.trim()) {
      const h = await headers();
      const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || null;
      if (!ipAllowed(ip, clean.ipAllowList)) {
        return { ok: false, error: `Η δική σας διεύθυνση (${ip ?? 'άγνωστη'}) δεν είναι στη λίστα IP — θα κλειδωνόσασταν έξω. Προσθέστε την και ξαναπατήστε Αποθήκευση.` };
      }
    }
    return saveSlice(slice, clean);
  }
  return saveSlice(slice, value);
}

async function saveSlice(slice: string, value: unknown): Promise<SaveResult> {
  try {
    const profile = await requireRole(['admin']);
    const supabase = await createSupabaseServerClient();

    const { data: row } = await supabase.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const current = (row as any)?.data && typeof (row as any).data === 'object' ? (row as any).data : {};
    // Keep the value being replaced, so the change can be undone (undoOrgSlice).
    const prevStore = current._prev && typeof current._prev === 'object' ? current._prev : {};
    const next = { ...current, [slice]: value, _prev: { ...prevStore, [slice]: { value: current[slice] ?? null, at: new Date().toISOString() } } };

    const { error } = await supabase
      .from('org_settings')
      .upsert({ id: 'org', data: next as any, updated_at: new Date().toISOString(), updated_by: profile.id }, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };

    revalidateTag(ORG_SETTINGS_TAG);
    await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'settings_updated', metadata: { slice } });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}

const t = (x: unknown, n: number) => (typeof x === 'string' ? x.trim().slice(0, n) : '');
const coord = (x: unknown, lim: number) => { const n = Number(x); return x !== '' && x != null && Number.isFinite(n) && Math.abs(n) <= lim ? String(Math.round(n * 1e6) / 1e6) : ''; };

export async function saveBusinessSettings(input: BusinessSettings): Promise<SaveResult> {
  const offices: Office[] = Array.isArray(input.offices)
    ? input.offices
        .filter((o) => (o.name || '').trim() || (o.address || '').trim())
        .map((o) => ({ name: (o.name || '').trim(), address: (o.address || '').trim(), phone: (o.phone || '').trim(), manager: (o.manager || '').trim(), main: !!o.main }))
    : [];
  // Normalize: exactly one main office when any exist.
  if (offices.length && !offices.some((o) => o.main)) offices[0].main = true;

  const clean: BusinessSettings = {
    registrationNo: (input.registrationNo || '').trim(),
    vatNo: (input.vatNo || '').trim(),
    licence: (input.licence || '').trim(),
    invoiceEmail: (input.invoiceEmail || '').trim(),
    website: (input.website || '').trim(),
    footer: (input.footer || '').trim(),
    offices,
    officialName: t(input.officialName, 160), tradingName: t(input.tradingName, 160),
    address1: t(input.address1, 200), address2: t(input.address2, 200), city: t(input.city, 80), region: t(input.region, 80),
    postalCode: t(input.postalCode, 20), country: /^[A-Z]{2}$/.test(input.country ?? '') ? input.country : 'CY',
    landline: t(input.landline, 40), mobile: t(input.mobile, 40),
    lat: coord(input.lat, 90), lng: coord(input.lng, 180),
  };
  // Validate against the merged shape to catch anything unexpected.
  mergeOrgSettings({ business: clean });
  return saveSlice('business', clean);
}

/** Company-wide appearance extras: second logo, favicon, menu colour, corners, boxes. */
export async function saveAppearance(input: AppearanceSettings): Promise<SaveResult> {
  const clean = mergeAppearance(input);
  if (input.logoOnLight && !clean.logoOnLight) return { ok: false, error: 'Το logo για ανοιχτό φόντο δεν είναι έγκυρη εικόνα ή είναι πολύ μεγάλο (έως 400 KB).' };
  if (input.favicon && !clean.favicon) return { ok: false, error: 'Το favicon δεν είναι έγκυρη εικόνα ή είναι πολύ μεγάλο.' };
  const res = await saveSlice('appearance', clean);
  if (res.ok) revalidatePath('/', 'layout');
  return res;
}

/**
 * «Αναίρεση» right after a save: puts back the value the last save replaced
 * (null = it was on the defaults). One step back per section.
 */
export async function undoOrgSlice(slice: string): Promise<SaveResult> {
  try {
    const profile = await requireRole(['admin']);
    const supabase = await createSupabaseServerClient();
    const { data: row } = await supabase.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const current = (row as any)?.data && typeof (row as any).data === 'object' ? { ...(row as any).data } : {};
    const prevStore = current._prev && typeof current._prev === 'object' ? { ...current._prev } : {};
    if (!(slice in prevStore)) return { ok: false, error: 'Δεν υπάρχει αλλαγή για αναίρεση.' };
    const prev = prevStore[slice]?.value ?? null;
    delete prevStore[slice];
    if (prev === null) delete current[slice]; else current[slice] = prev;
    current._prev = prevStore;
    const { error } = await supabase
      .from('org_settings')
      .upsert({ id: 'org', data: current as any, updated_at: new Date().toISOString(), updated_by: profile.id }, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    revalidateTag(ORG_SETTINGS_TAG);
    await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'settings_undone', metadata: { slice } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Η αναίρεση απέτυχε.' };
  }
}

/** Πεδία πελατών → «Ενεργοποίηση για όλους»: συγκατάθεση email/SMS/push σε κάθε υπάρχουσα επαφή. */
export async function optInAllContacts(): Promise<{ ok: true; updated: number } | { ok: false; error: string }> {
  const profile = await requireRole(['admin']);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await (supabase as any).from('contacts')
    .update({ marketing_opt_in: true, marketing_opt_in_at: new Date().toISOString() })
    .or('marketing_opt_in.is.null,marketing_opt_in.eq.false').is('anonymized_at', null).select('id');
  if (error) return { ok: false, error: error.message };
  await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'marketing_opt_in_all', metadata: { by: profile.id, count: data?.length ?? 0 } });
  return { ok: true, updated: data?.length ?? 0 };
}
