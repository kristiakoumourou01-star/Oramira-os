import { NextResponse } from 'next/server';
import { getCurrentProfile } from '@/lib/auth';
import { isInternalRole } from '@/lib/permissions';
import { getMobileApp, getMobileHome } from '@/lib/mobile-app';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mobile-app — the app's home screen for the signed-in person, as set
 * in Admin → Mobile app. Staff get the Admin app; buyers, owners and investors
 * the Customer app (with their projects, support details and what is switched on).
 */
export async function GET() {
  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const kind = isInternalRole(profile.role) ? 'admin' : 'customer';
  const [home, cfg] = await Promise.all([getMobileHome(kind), getMobileApp()]);
  const customer = kind === 'customer' ? {
    projects: cfg.projects.filter((p) => p.shown),
    showPrices: cfg.showPrices, showAvailability: cfg.showAvailability, availableOnly: cfg.availableOnly,
    allowViewings: cfg.allowViewings, allowMaintenance: cfg.allowMaintenance, allowDeletion: cfg.allowDeletion,
    profileFields: cfg.profileFields,
    welcomeI18n: { el: cfg.welcome, en: cfg.welcomeEn, ru: cfg.welcomeRu },
    colors: { primary: cfg.colorPrimary, secondary: cfg.colorSecondary },
    support: { phone: cfg.supportPhone, email: cfg.supportEmail, instagram: cfg.instagram, facebook: cfg.facebook, tiktok: cfg.tiktok, youtube: cfg.youtube, website: cfg.website },
  } : null;
  const admin = kind === 'admin' ? {
    modules: profile.role === 'admin' ? null : (cfg.adminModules[profile.role] ?? null),
  } : null;
  return NextResponse.json({ ...home, ...(customer ? { customer } : {}), ...(admin ? { admin } : {}) }, { headers: { 'Cache-Control': 'private, no-store' } });
}
