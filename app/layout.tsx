import type { Metadata } from 'next';
import './fonts';
import './globals.css';
import { getBranding, brandCssVars, sidebarBackground } from '@/lib/branding';
import { getOrgSettings, getPublicAppearance } from '@/lib/org-settings';
import { requestLocale } from '@/lib/locale-server';

// Οι γραμματοσειρές (και οι μεταβλητές τους) έρχονται από app/fonts.ts.
const FONT_VARS = '';

export async function generateMetadata(): Promise<Metadata> {
  const [{ companyName }, appearance] = await Promise.all([getBranding(), getPublicAppearance()]);
  return {
    title: companyName,
    description: `${companyName} — CRM, deal analysis and client portals.`,
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
