/**
 * Oramira OS — dynamic branding (PURE / client-safe half).
 *
 * Types, defaults, the font catalog, color math, and the CSS-variable builder
 * — everything with no server dependency, so Client Components (the branding
 * form + live preview) can import it without pulling server-only code into the
 * browser bundle. The server loader lives in lib/branding.ts.
 *
 * Tailwind's brand tokens (forest/champagne/sand/stone/charcoal) are backed by
 * these CSS variables (tailwind.config.ts), so overriding a variable recolors
 * every `bg-forest`, `text-champagne`, etc. The darker/lighter shades are
 * DERIVED here from the chosen colors, so a rebrand stays coherent.
 */

export type ContentWidth = 'standard' | 'wide' | 'full';
export type Density = 'comfortable' | 'compact';

export interface Branding {
  companyName: string;
  logoUrl: string | null;
  colorPrimary: string;
  colorAccent: string;
  colorSecondary: string;
  colorBackground: string;
  colorText: string;
  fontHeading: FontKey;
  fontBody: FontKey;
  contentWidth: ContentWidth;
  density: Density;
}

export const DEFAULT_BRANDING: Branding = {
  companyName: 'Oramira',
  logoUrl: null,
  colorPrimary: '#1F3A30',
  colorAccent: '#C8A86B',
  colorSecondary: '#E6DCC8',
  colorBackground: '#F7F3EC',
  colorText: '#2B2A27',
  fontHeading: 'source-serif',
  fontBody: 'ibm-plex',
  contentWidth: 'standard',
  density: 'comfortable',
};

/** Tailwind max-width class for the main content column per content-width pref. */
export const CONTENT_WIDTH_CLASS: Record<ContentWidth, string> = {
  standard: 'max-w-[1600px]',
  wide: 'max-w-[1920px]',
  full: 'max-w-none',
};

/* ------------------------------------------------------------------ fonts -- */

export type FontKey = 'source-serif' | 'cormorant' | 'playfair' | 'montserrat' | 'ibm-plex' | 'inter' | 'work-sans';

interface FontDef {
  label: string;
  /** CSS variable the font is loaded under in app/layout.tsx. */
  cssVar: string;
  /** Where it fits: heading-only, body-only, or either. */
  role: 'heading' | 'body' | 'both';
  /** Fallback stack appended after the variable. */
  stack: string;
}

export const FONT_CATALOG: Record<FontKey, FontDef> = {
  'source-serif': { label: 'Source Serif', cssVar: '--font-source-serif', role: 'heading', stack: 'Georgia, serif' },
  cormorant: { label: 'Cormorant Garamond', cssVar: '--font-cormorant', role: 'heading', stack: 'Georgia, serif' },
  playfair: { label: 'Playfair Display', cssVar: '--font-playfair', role: 'heading', stack: 'Georgia, serif' },
  montserrat: { label: 'Montserrat', cssVar: '--font-montserrat', role: 'both', stack: 'system-ui, sans-serif' },
  'ibm-plex': { label: 'IBM Plex Sans', cssVar: '--font-ibm-plex', role: 'body', stack: 'system-ui, sans-serif' },
  inter: { label: 'Inter', cssVar: '--font-inter', role: 'body', stack: 'system-ui, sans-serif' },
  'work-sans': { label: 'Work Sans', cssVar: '--font-work-sans', role: 'body', stack: 'system-ui, sans-serif' },
};

export const HEADING_FONTS: FontKey[] = (Object.keys(FONT_CATALOG) as FontKey[]).filter(
  (k) => FONT_CATALOG[k].role === 'heading' || FONT_CATALOG[k].role === 'both',
);
export const BODY_FONTS: FontKey[] = (Object.keys(FONT_CATALOG) as FontKey[]).filter(
  (k) => FONT_CATALOG[k].role === 'body' || FONT_CATALOG[k].role === 'both',
);

export function fontFamily(key: FontKey): string {
  const def = FONT_CATALOG[key] ?? FONT_CATALOG['ibm-plex'];
  return `var(${def.cssVar}), ${def.stack}`;
}

/* ----------------------------------------------------------- color utils -- */

/** Parse #RGB / #RRGGBB to [r,g,b]; returns null for anything unparseable. */
function parseHex(hex: string): [number, number, number] | null {
  if (typeof hex !== 'string') return null;
  let h = hex.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/** Space-separated RGB channels for `rgb(var(--c-x) / <alpha-value>)`, e.g. "31 58 48". */
function channels(hex: string, fallback: string): string {
  const rgb = parseHex(hex) ?? parseHex(fallback)!;
  return rgb.join(' ');
}

/** Mix a color toward a target (0 = original, 1 = target). */
function mix(hex: string, target: [number, number, number], t: number, fallback: string): string {
  const rgb = parseHex(hex) ?? parseHex(fallback)!;
  const out = rgb.map((c, i) => Math.round(c + (target[i] - c) * t));
  return out.join(' ');
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];

const lighten = (hex: string, t: number, fb: string) => mix(hex, WHITE, t, fb);
const darken = (hex: string, t: number, fb: string) => mix(hex, BLACK, t, fb);

/* --------------------------------------------------------- css var build -- */

/**
 * Build the `:root { … }` CSS that overrides the brand tokens for a given
 * branding. Shades are derived so the whole palette shifts coherently, and the
 * font variables consumed by Tailwind's `font-display`/`font-sans` are aliased.
 */
export function brandCssVars(b: Branding): string {
  const d = DEFAULT_BRANDING;
  const vars: Record<string, string> = {
    '--c-forest': channels(b.colorPrimary, d.colorPrimary),
    '--c-forest-deep': darken(b.colorPrimary, 0.28, d.colorPrimary),
    '--c-forest-50': lighten(b.colorPrimary, 0.9, d.colorPrimary),
    '--c-champagne': channels(b.colorAccent, d.colorAccent),
    '--c-champagne-50': lighten(b.colorAccent, 0.86, d.colorAccent),
    '--c-champagne-600': darken(b.colorAccent, 0.22, d.colorAccent),
    '--c-olive': darken(b.colorAccent, 0.2, d.colorAccent),
    '--c-sand': channels(b.colorSecondary, d.colorSecondary),
    '--c-sand-100': lighten(b.colorSecondary, 0.4, d.colorSecondary),
    '--c-sand-300': darken(b.colorSecondary, 0.12, d.colorSecondary),
    '--c-stone': channels(b.colorBackground, d.colorBackground),
    '--c-stone-200': darken(b.colorBackground, 0.04, d.colorBackground),
    '--c-stone-line': darken(b.colorBackground, 0.1, d.colorBackground),
    '--c-charcoal': channels(b.colorText, d.colorText),
    '--c-charcoal-600': lighten(b.colorText, 0.3, d.colorText),
    '--font-display': fontFamily(b.fontHeading),
    '--font-sans': fontFamily(b.fontBody),
  };
  const body = Object.entries(vars)
    .map(([k, v]) => `${k}:${v};`)
    .join('');
  return `:root{${body}}`;
}

/**
 * Same derivation as brandCssVars, but as a plain React style object keyed by
 * the CSS custom properties — for a scoped live preview (set on a wrapper
 * element rather than :root).
 */
export function brandStyleObject(b: Branding): Record<string, string> {
  const css = brandCssVars(b).replace(/^:root\{/, '').replace(/\}$/, '');
  const obj: Record<string, string> = {};
  for (const decl of css.split(';')) {
    if (!decl) continue;
    const idx = decl.indexOf(':');
    obj[decl.slice(0, idx)] = decl.slice(idx + 1);
  }
  return obj;
}
