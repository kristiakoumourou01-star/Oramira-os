'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/auth';
import { logActivity } from '@/lib/activity';
import { revalidatePath, revalidateTag } from 'next/cache';
import { BRANDING_TAG, FONT_CATALOG, type FontKey } from '@/lib/branding';

export interface SaveBrandingInput {
  companyName: string;
  logoUrl?: string;
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

/** An http(s) link, or an uploaded image kept inline (data URL, ≤ ~400 KB). */
function isImageSource(v: string): boolean {
  if (/^https?:\/\//i.test(v)) return true;
  return /^data:image\/(png|jpeg|webp|gif|svg\+xml);base64,/i.test(v) && v.length <= 560_000;
}

/** Upload/replace/remove the main logo (shown on the dark menu). */
export async function saveLogo(dataUrl: string | null): Promise<SaveBrandingResult> {
  try {
    await requireRole(['admin']);
    if (dataUrl && !isImageSource(dataUrl)) return { ok: false, error: 'Μη έγκυρη εικόνα ή πολύ μεγάλο αρχείο (έως 400 KB).' };
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('org_branding').update({ logo_url: dataUrl, updated_at: new Date().toISOString() }).eq('id', 'org');
    if (error) return { ok: false, error: error.message };
    await logActivity({ entityType: 'branding', entityId: 'org', action: dataUrl ? 'logo_updated' : 'logo_removed' });
    revalidateTag(BRANDING_TAG);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}

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

    // logoUrl undefined = leave the logo as it is (it has its own upload control).
    const logoUrl = input.logoUrl === undefined ? undefined : (input.logoUrl || '').trim();
    if (logoUrl && !isImageSource(logoUrl)) {
      return { ok: false, error: 'Το logo πρέπει να είναι εικόνα (PNG, JPG, SVG, WebP) έως 400 KB, ή σύνδεσμος http(s)://' };
    }

    const row = {
      id: 'org',
      company_name: companyName,
      ...(logoUrl === undefined ? {} : { logo_url: logoUrl || null }),
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
    revalidateTag(BRANDING_TAG);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}

/** Μόνο όνομα (εμπορική ονομασία) και κύριο/δεύτερο χρώμα — από τα Στοιχεία εταιρείας και την Εμφάνιση. */
export async function saveBrandBasics(input: { companyName?: string; colorPrimary?: string; colorSecondary?: string }): Promise<SaveBrandingResult> {
  try {
    const profile = await requireRole(['admin']);
    const supabase = await createSupabaseServerClient();
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: profile.id };
    if (input.companyName !== undefined) {
      const n = input.companyName.trim().slice(0, 120);
      if (!n) return { ok: false, error: 'Η εμπορική ονομασία είναι υποχρεωτική.' };
      patch.company_name = n;
    }
    if (input.colorPrimary !== undefined) patch.color_primary = cleanColor(input.colorPrimary, 'Κύριο χρώμα');
    if (input.colorSecondary !== undefined) patch.color_secondary = cleanColor(input.colorSecondary, 'Δεύτερο χρώμα');
    const { data, error } = await supabase.from('org_branding').update(patch as any).eq('id', 'org').select('id');
    if (error) return { ok: false, error: error.message };
    if (!data?.length) return { ok: false, error: 'Δεν βρέθηκαν ρυθμίσεις εμφάνισης — αποθηκεύστε μία φορά από την Εμφάνιση.' };
    await logActivity({ entityType: 'branding', entityId: 'org', action: 'branding_updated', metadata: { fields: Object.keys(patch) } });
    revalidateTag(BRANDING_TAG);
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Αποτυχία αποθήκευσης.' };
  }
}
