'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { requirePermission } from '@/lib/auth';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { ORG_SETTINGS_TAG } from '@/lib/org-settings';
import { logActivity } from '@/lib/activity';
import { mergeMobileApp } from '@/lib/mobile-app-shared';
import { mergeExtra } from '@/lib/settings-extra-shared';

export type MobileSaveResult = { ok: true } | { ok: false; error: string };

/**
 * Admin → Mobile app: save the layout and settings of both apps
 * (org_settings.data.mobileApp). Anyone with "Mobile app · Δημιουργεί & αλλάζει"
 * may save, not only the Owner; the value is validated before it is stored.
 */
export async function saveMobileApp(value: unknown, signInCode?: 'sms' | 'email'): Promise<MobileSaveResult> {
  const me = await requirePermission('mobileapp', 'edit');
  try {
    const clean = mergeMobileApp(value);
    const db = createSupabaseServiceRoleClient() as any;
    const { data: row } = await db.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const current = row?.data && typeof row.data === 'object' ? row.data : {};
    const prevStore = current._prev && typeof current._prev === 'object' ? current._prev : {};
    // Ο κωδικός σύνδεσης (SMS / Email) είναι μία ρύθμιση, κοινή με Ρυθμίσεις → Κωδικός σύνδεσης.
    const code = signInCode === 'sms' || signInCode === 'email' ? signInCode : null;
    if (code) clean.loginMethod = code;
    const extra = code ? { extra: mergeExtra({ ...(current.extra ?? {}), signInCode: code }) } : {};
    const next = { ...current, ...extra, mobileApp: clean, _prev: { ...prevStore, mobileApp: { value: current.mobileApp ?? null, at: new Date().toISOString() } } };
    const { error } = await db.from('org_settings').upsert({ id: 'org', data: next, updated_at: new Date().toISOString(), updated_by: me.id }, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    revalidateTag(ORG_SETTINGS_TAG);
    await logActivity({ entityType: 'org_settings', entityId: 'org', action: 'settings_updated', metadata: { slice: 'mobileApp' } });
    revalidatePath('/settings/mobile-app');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}
