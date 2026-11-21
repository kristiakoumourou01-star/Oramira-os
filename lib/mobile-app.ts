import { cache } from 'react';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { mergeMobileApp, visibleHome, type MobileAppKind, type MobileAppSettings, type MobileBlock } from '@/lib/mobile-app-shared';

/** The saved mobile-app settings (Admin → Mobile app), defaults when none. Never throws. */
export const getMobileApp = cache(async function getMobileApp(): Promise<MobileAppSettings> {
  try {
    const { data } = await (createSupabaseServiceRoleClient() as any).from('org_settings').select('data').eq('id', 'org').maybeSingle();
    return mergeMobileApp(data?.data?.mobileApp);
  } catch {
    return mergeMobileApp(null);
  }
});

export interface MobileHome {
  kind: MobileAppKind;
  enabled: boolean;
  welcome: string;
  blocks: MobileBlock[];
}

/** The home screen a person sees: customers get the Customer app, staff the Admin app. */
export async function getMobileHome(kind: MobileAppKind): Promise<MobileHome> {
  const cfg = await getMobileApp();
  return {
    kind,
    enabled: kind === 'admin' ? cfg.adminEnabled : cfg.appEnabled,
    welcome: kind === 'admin' ? cfg.adminWelcome : cfg.welcome,
    blocks: visibleHome(cfg, kind),
  };
}
