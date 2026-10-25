import type { Metadata } from 'next';
import {
  Source_Serif_4,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Cormorant_Garamond,
  Playfair_Display,
  Montserrat,
  Inter,
  Work_Sans,
} from 'next/font/google';
import './globals.css';
import { getBranding, brandCssVars } from '@/lib/branding';
import { getOrgSettings } from '@/lib/org-settings';

// Tabular figures — the ledger signature: every price, sqm, % renders here.
// Not re-skinnable; the brand's numeric voice is constant.
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' });

// Curated, re-skinnable typefaces. Each is exposed under its own CSS variable;
// branding (lib/branding.ts) aliases --font-display / --font-sans to the chosen
// pair at the root, so headings and body can be changed from Settings.
const sourceSerif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-source-serif' });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-cormorant' });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-playfair' });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-montserrat' });
const ibmPlex = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-ibm-plex' });
const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-inter' });
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-work-sans' });

const FONT_VARS = [sourceSerif, cormorant, playfair, montserrat, ibmPlex, inter, workSans, mono]
  .map((f) => f.variable)
  .join(' ');

export async function generateMetadata(): Promise<Metadata> {
  const { companyName } = await getBranding();
  return {
    title: `${companyName} OS`,
    description: `The ${companyName} operating system — CRM, deal analysis, and client portals.`,
  };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [branding, settings] = await Promise.all([getBranding(), getOrgSettings()]);
  return (
    <html lang="en" className={FONT_VARS} data-density={branding.density} data-dense={settings.layout.denseLists ? 'on' : 'off'}>
      <body>
        {/* Unlayered :root override from org_branding — wins over globals.css
            @layer base defaults regardless of source order. */}
        <style dangerouslySetInnerHTML={{ __html: brandCssVars(branding) }} />
        {children}
      </body>
    </html>
  );
}
