import { getBranding } from '@/lib/branding';
import { getPublicAppearance } from '@/lib/org-settings';
import { Logo } from './Logo';

/**
 * Server wrapper that feeds live org branding into the presentational <Logo/>.
 * Use on server surfaces (sidebar, login) so the uploaded logo + company name
 * render; the underlying getBranding read is request-deduped.
 */
export async function BrandMark({ tone = 'light', href = '/', compact = false }: { tone?: 'light' | 'dark'; href?: string; compact?: boolean }) {
  const [{ companyName, logoUrl }, appearance] = await Promise.all([getBranding(), getPublicAppearance()]);
  // tone 'light' = light mark for the dark menu; tone 'dark' = for light screens
  // (login, password page), which use the separate logo when one is uploaded.
  const src = tone === 'dark' ? appearance.logoOnLight ?? logoUrl : logoUrl;
  return <Logo tone={tone} href={href} companyName={companyName} logoUrl={src} compact={compact} />;
}
