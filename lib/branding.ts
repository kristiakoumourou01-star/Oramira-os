/**
 * Oramira OS — dynamic branding (SERVER half).
 *
 * The singleton loader only. All pure logic (types, defaults, font catalog,
 * color math, CSS-var builder) lives in lib/branding-shared.ts and is
 * re-exported here, so server callers can keep importing from '@/lib/branding'
 * while Client Components import the pure half directly without pulling server
 * code into the browser bundle.
 */

import { cache } from 'react';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_BRANDING, type Branding, type FontKey } from '@/lib/branding-shared';

export * from '@/lib/branding-shared';

/**
 * Read the singleton branding row. Never throws: any error (missing table,
 * RLS, schema drift) degrades to the built-in Oramira identity. Request-deduped
 * so the root layout, <BrandMark/>, and metadata share a single query.
 */
export const getBranding = cache(async function getBranding(): Promise<Branding> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from('org_branding')
      .select('company_name, logo_url, color_primary, color_accent, color_secondary, color_background, color_text, font_heading, font_body')
      .eq('id', 'org')
      .maybeSingle();
    if (error || !data) return DEFAULT_BRANDING;
    return {
      companyName: data.company_name || DEFAULT_BRANDING.companyName,
      logoUrl: data.logo_url || null,
      colorPrimary: data.color_primary || DEFAULT_BRANDING.colorPrimary,
      colorAccent: data.color_accent || DEFAULT_BRANDING.colorAccent,
      colorSecondary: data.color_secondary || DEFAULT_BRANDING.colorSecondary,
      colorBackground: data.color_background || DEFAULT_BRANDING.colorBackground,
      colorText: data.color_text || DEFAULT_BRANDING.colorText,
      fontHeading: (data.font_heading as FontKey) || DEFAULT_BRANDING.fontHeading,
      fontBody: (data.font_body as FontKey) || DEFAULT_BRANDING.fontBody,
    };
  } catch {
    return DEFAULT_BRANDING;
  }
});
