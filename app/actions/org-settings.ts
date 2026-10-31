'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { ipAllowed } from '@/lib/security-shared';
import { mergeWatermark } from '@/lib/watermark-shared';
import { mergeReservations } from '@/lib/pricing-shared';
import { mergeAml } from '@/lib/kyc-shared';
import { mergePipelines } from '@/lib/pipeline-shared';
import { mergeLeadAutomation } from '@/lib/lead-automation-shared';
import { mergeOrgSettings, mergeAppearance, mergeTags, mergeNotifications, mergeInvoices, mergeGdpr, mergeFieldRules, mergePortal, type AppearanceSettings, type BusinessSettings, type Office } from '@/lib/org-settings-shared';

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Merge one settings slice into the singleton org_settings.data JSONB. */
export async function saveOrgSlice(slice: string, value: unknown): Promise<SaveResult> {
  // Slices with structure are normalized server-side before they are stored.
  if (slice === 'tags') return saveSlice(slice, mergeTags(value));
  if (slice === 'notifications') return saveSlice(slice, mergeNotifications(value));
  if (slice === 'invoices') return saveSlice(slice, mergeInvoices(value));
  if (slice === 'gdpr') return saveSlice(slice, mergeGdpr(value));
  if (slice === 'fields') return saveSlice(slice, mergeFieldRules(value));
  if (slice === 'portal') return saveSlice(slice, mergePortal(value));
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

    await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'settings_updated', metadata: { slice } });
    revalidatePath('/settings');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}

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
    await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'settings_undone', metadata: { slice } });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Η αναίρεση απέτυχε.' };
  }
}
