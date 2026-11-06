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
  Noto_Sans,
  Noto_Serif,
  Open_Sans,
  Manrope,
  Commissioner,
  Literata,
} from 'next/font/google';
import './globals.css';
import { getBranding, brandCssVars, sidebarBackground } from '@/lib/branding';
import { getOrgSettings, getPublicAppearance } from '@/lib/org-settings';
import { requestLocale } from '@/lib/locale-server';

// Tabular figures — the ledger signature: every price, sqm, % renders here.
// Not re-skinnable; the brand's numeric voice is constant.
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-mono' , preload: false });

// Curated, re-skinnable typefaces. None is preloaded: only the pair chosen in
// Settings is ever used, so preloading all 14 slowed every first page load.
// Curated, re-skinnable typefaces. Each is exposed under its own CSS variable;
// branding (lib/branding.ts) aliases --font-display / --font-sans to the chosen
// pair at the root, so headings and body can be changed from Settings.
const sourceSerif = Source_Serif_4({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-source-serif' , preload: false });
const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-cormorant' , preload: false });
const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-playfair' , preload: false });
const montserrat = Montserrat({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-montserrat' , preload: false });
const ibmPlex = IBM_Plex_Sans({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-ibm-plex' , preload: false });
const inter = Inter({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-inter' , preload: false });
const workSans = Work_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-work-sans' , preload: false });
// Greek-ready faces (the company works in Greek): body and heading options.
const notoSans = Noto_Sans({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-noto-sans', display: 'swap' , preload: false });
const notoSerif = Noto_Serif({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-noto-serif', display: 'swap' , preload: false });
const openSans = Open_Sans({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-open-sans', display: 'swap' , preload: false });
const manrope = Manrope({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-manrope', display: 'swap' , preload: false });
const commissioner = Commissioner({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-commissioner', display: 'swap' , preload: false });
const literata = Literata({ subsets: ['latin', 'greek'], weight: ['400', '500', '600'], variable: '--font-literata', display: 'swap' , preload: false });

const FONT_VARS = [sourceSerif, cormorant, playfair, montserrat, ibmPlex, inter, workSans, notoSans, notoSerif, openSans, manrope, commissioner, literata, mono]
  .map((f) => f.variable)
  .join(' ');

export async function generateMetadata(): Promise<Metadata> {
  const [{ companyName }, appearance] = await Promise.all([getBranding(), getPublicAppearance()]);
  return {
    title: `${companyName} OS`,
    description: `The ${companyName} operating system — CRM, deal analysis, and client portals.`,
    ...(appearance.favicon ? { icons: { icon: appearance.favicon } } : {}),
  };
}

// Personal display (Settings → Εμφάνιση → "Η δική μου προβολή"): stored per
// device in localStorage and applied before first paint, so there is no flash.
const DISPLAY_PREFS_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('oramira:display')||'{}');var d=document.documentElement;var t=p.theme||'light';if(t==='system'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}d.dataset.theme=t;if(p.scale)d.style.setProperty('--ui-zoom',String(p.scale/100));if(p.reduceMotion)d.dataset.motion='reduce';if(p.highContrast)d.dataset.contrast='high'}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [branding, settings, appearance] = await Promise.all([getBranding(), getOrgSettings(), getPublicAppearance()]);
  const sidebarBg = sidebarBackground(appearance.sidebarStyle, branding.colorPrimary, appearance.sidebarColor);
  // The user's language + number format (cookie) — read by lib/format in the browser.
  const loc = requestLocale();
  return (
    <html
      lang={loc.lang}
      data-lang={loc.lang}
      data-num={loc.num}
      className={FONT_VARS}
      data-density={branding.density}
      data-dense={settings.layout.denseLists ? 'on' : 'off'}
      data-corners={appearance.corners}
      data-box={appearance.boxStyle}
      data-labels={appearance.labelStyle}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: DISPLAY_PREFS_SCRIPT }} />
      </head>
      <body>
        {/* Unlayered :root override from org_branding — wins over globals.css
            @layer base defaults regardless of source order. */}
        <style dangerouslySetInnerHTML={{ __html: brandCssVars(branding) + `:root{--sidebar-bg:${sidebarBg};}` }} />
        {children}
      </body>
    </html>
  );
}
