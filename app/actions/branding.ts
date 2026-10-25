'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath } from 'next/cache';
import { FONT_CATALOG, type FontKey } from '@/lib/branding';

export interface SaveBrandingInput {
  companyName: string;
  logoUrl: string;
  colorPrimary: string;
  colorAccent: string;
  colorSecondary: string;
  colorBackground: string;
  colorText: string;
  fontHeading: string;
  fontBody: string;
  contentWidth: string;
  density: string;
}

const CONTENT_WIDTHS = ['standard', 'wide', 'full'];
const DENSITIES = ['comfortable', 'compact'];

export type SaveBrandingResult = { ok: true } | { ok: false; error: string };

const HEX = /^#[0-9a-fA-F]{6}$/;

function cleanColor(value: string, label: string): string {
  const v = (value || '').trim();
  if (!HEX.test(v)) throw new Error(`${label}: δώσε χρώμα σε μορφή #RRGGBB`);
  return v.toUpperCase();
}

function cleanFont(value: string, label: string): FontKey {
  if (!(value in FONT_CATALOG)) throw new Error(`${label}: μη έγκυρη γραμματοσειρά`);
  return value as FontKey;
}

/**
 * Persist org branding. Admin-only (the one surface that re-skins the whole OS)
 * and input-validated server-side so a bad color can never reach the CSS vars.
 * Revalidates the root layout so every page picks up the new theme immediately.
 */
export async function saveBranding(input: SaveBrandingInput): Promise<SaveBrandingResult> {
  try {
    const profile = await requireRole(['admin']);
    const supabase = await createSupabaseServerClient();

    const companyName = (input.companyName || '').trim();
    if (!companyName) return { ok: false, error: 'Το όνομα εταιρείας είναι υποχρεωτικό.' };

    const logoUrl = (input.logoUrl || '').trim();
    if (logoUrl && !/^https?:\/\//i.test(logoUrl)) {
      return { ok: false, error: 'Το logo URL πρέπει να ξεκινά με http(s)://' };
    }

    const row = {
      id: 'org',
      company_name: companyName,
      logo_url: logoUrl || null,
      color_primary: cleanColor(input.colorPrimary, 'Κύριο χρώμα'),
      color_accent: cleanColor(input.colorAccent, 'Accent'),
      color_secondary: cleanColor(input.colorSecondary, 'Δευτερεύον'),
      color_background: cleanColor(input.colorBackground, 'Φόντο'),
      color_text: cleanColor(input.colorText, 'Κείμενο'),
      font_heading: cleanFont(input.fontHeading, 'Γραμματοσειρά τίτλων'),
      font_body: cleanFont(input.fontBody, 'Γραμματοσειρά κειμένου'),
      content_width: CONTENT_WIDTHS.includes(input.contentWidth) ? input.contentWidth : 'standard',
      density: DENSITIES.includes(input.density) ? input.density : 'comfortable',
      updated_at: new Date().toISOString(),
      updated_by: profile.id,
    };

    const { error } = await supabase.from('org_branding').upsert(row, { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };

    await logActivity({ entityType: 'branding', entityId: 'org', action: 'branding_updated', metadata: { companyName } });

    // Branding lives at the root layout, so re-theme the entire app.
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}
