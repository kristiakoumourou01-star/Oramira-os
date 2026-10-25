'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';
import { mergeOrgSettings, type BusinessSettings, type Office } from '@/lib/org-settings-shared';

export type SaveResult = { ok: true } | { ok: false; error: string };

/** Merge one settings slice into the singleton org_settings.data JSONB. */
export async function saveOrgSlice(slice: string, value: unknown): Promise<SaveResult> {
  return saveSlice(slice, value);
}

async function saveSlice(slice: string, value: unknown): Promise<SaveResult> {
  try {
    const profile = await requireRole(['admin']);
    const supabase = await createSupabaseServerClient();

    const { data: row } = await supabase.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    const current = (row as any)?.data && typeof (row as any).data === 'object' ? (row as any).data : {};
    const next = { ...current, [slice]: value };

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
