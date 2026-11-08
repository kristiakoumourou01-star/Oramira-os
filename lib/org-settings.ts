import { cache } from 'react';
import { unstable_cache } from 'next/cache';
import { createSupabaseServiceRoleClient, } from '@/lib/supabase/server';
import { localizeSettings } from '@/lib/localize';
import { requestLocale } from '@/lib/locale-server';
import { DEFAULT_ORG_SETTINGS, DEFAULT_APPEARANCE, mergeAppearance, mergeOrgSettings, type AppearanceSettings, type OrgSettings } from '@/lib/org-settings-shared';

export * from '@/lib/org-settings-shared';

/** Cache tag for org_settings — saving any slice calls revalidateTag(ORG_SETTINGS_TAG). */
export const ORG_SETTINGS_TAG = 'org-settings';

/**
 * The raw org_settings JSON, shared by every request for up to 2 minutes (or
 * until a save clears it). It is one row for the whole company, so there is
 * no reason to re-read it on every click. Server-only (service client).
 */
const readOrgSettingsRaw = unstable_cache(
  async (): Promise<unknown | null> => {
    const service = createSupabaseServiceRoleClient();
    const { data, error } = await service.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    if (error) throw error; // not cached — the next request retries
    return (data as any)?.data ?? null;
  },
  ['org-settings-v1'],
  { tags: [ORG_SETTINGS_TAG], revalidate: 120 },
);

/**
 * Read the singleton agency settings. Never throws: any error (missing table,
 * schema drift) degrades to defaults. Request-deduped and cached across requests.
 */
export const getOrgSettingsRaw = cache(async function getOrgSettingsRaw(): Promise<OrgSettings> {
  try {
    const raw = await readOrgSettingsRaw();
    return raw ? mergeOrgSettings(raw) : DEFAULT_ORG_SETTINGS;
  } catch {
    return DEFAULT_ORG_SETTINGS;
  }
});

/**
 * Οι ρυθμίσεις για ΕΜΦΑΝΙΣΗ: ονόματα σταδίων, τμημάτων, πεδίων, μενού στη
 * γλώσσα του χρήστη. Όποιος αποθηκεύει ή τις επεξεργάζεται → getOrgSettingsRaw.
 */
export const getOrgSettings = cache(async function getOrgSettings(): Promise<OrgSettings> {
  return localizeSettings(await getOrgSettingsRaw(), requestLocale().lang);
});

/**
 * The appearance slice for EVERY visitor, including the signed-out login page
 * (org_settings is readable by signed-in users only). Reads just
 * data->appearance — logos, favicon, menu colour, corners — which is public by
 * nature, via the service client on the server. Never exposes other slices.
 */
export const getPublicAppearance = cache(async function getPublicAppearance(): Promise<AppearanceSettings> {
  try {
    // Only the appearance slice leaves this function, so signed-in or not is
    // the same cached read.
    return (await getOrgSettingsRaw()).appearance ?? mergeAppearance(undefined);
  } catch {
    return DEFAULT_APPEARANCE;
  }
});
