import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_ORG_SETTINGS, mergeOrgSettings, type OrgSettings } from '@/lib/org-settings-shared';

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
