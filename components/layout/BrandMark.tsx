import { getBranding } from '@/lib/branding';
import { Logo } from './Logo';

/**
 * Server wrapper that feeds live org branding into the presentational <Logo/>.
 * Use on server surfaces (sidebar, login) so the uploaded logo + company name
 * render; the underlying getBranding read is request-deduped.
 */
export async function BrandMark({ tone = 'light', href = '/' }: { tone?: 'light' | 'dark'; href?: string }) {
  const { companyName, logoUrl } = await getBranding();
  return <Logo tone={tone} href={href} companyName={companyName} logoUrl={logoUrl} />;
}
