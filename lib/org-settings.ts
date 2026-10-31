import { cache } from 'react';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { DEFAULT_ORG_SETTINGS, DEFAULT_APPEARANCE, mergeAppearance, mergeOrgSettings, type AppearanceSettings, type OrgSettings } from '@/lib/org-settings-shared';

export * from '@/lib/org-settings-shared';

/**
 * Read the singleton agency settings. Never throws: any error (missing table,
 * schema drift) degrades to defaults. Request-deduped.
 */
export const getOrgSettings = cache(async function getOrgSettings(): Promise<OrgSettings> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    if (error || !data) return DEFAULT_ORG_SETTINGS;
    return mergeOrgSettings((data as any).data);
  } catch {
    return DEFAULT_ORG_SETTINGS;
  }
});

/**
 * The appearance slice for EVERY visitor, including the signed-out login page
 * (org_settings is readable by signed-in users only). Reads just
 * data->appearance — logos, favicon, menu colour, corners — which is public by
 * nature, via the service client on the server. Never exposes other slices.
 */
export const getPublicAppearance = cache(async function getPublicAppearance(): Promise<AppearanceSettings> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) return (await getOrgSettings()).appearance;
    const service = createSupabaseServiceRoleClient();
    const { data } = await service.from('org_settings').select('data').eq('id', 'org').maybeSingle();
    return mergeAppearance((data as any)?.data?.appearance);
  } catch {
    return DEFAULT_APPEARANCE;
  }
});
