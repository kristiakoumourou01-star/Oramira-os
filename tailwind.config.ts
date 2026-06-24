import type { Config } from 'tailwindcss';

/**
 * Oramira OS brand tokens — luxury real estate developer identity,
 * applied consistently across every module: CRM, Deal Analyzer, Buyer
 * Portal, Homeowner Portal, Investor Dashboard, Contractor Portal, Admin.
 *
 * Palette (named, not incidental):
 *  - forest      #1F3A30  primary — deep dark green. Sidebar, headings, primary actions.
 *  - forest-deep #142922  hover/pressed states on forest surfaces.
 *  - sand        #E6DCC8  secondary — warm beige/stone. Cards, secondary surfaces.
 *  - stone       #F7F3EC  background — warm off-white, the app's resting surface.
 *  - stone-line  #E3DAC9  borders — warm grey-stone, never cold grey.
 *  - champagne   #C8A86B  accent — soft gold. Active indicators, premium tags,
 *                         key figures. Never used as a background fill.
 *  - charcoal    #2B2A27  primary text.
 *
 * Typography: a quiet serif (display) carries the brand's architectural,
 * timeless character on page titles and project names — used in the
 * internal workbench too, not just the client portal, per brand direction.
 * A humanist sans carries dense UI/body text. Tabular mono numerals remain
 * the signature for every figure (price, sqm, ROI%) — a ledger-like detail
 * fitting a developer who deals in precise numbers, kept understated.
 */
const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        forest: {
          DEFAULT: '#1F3A30',
          deep: '#142922',
          50: '#EAF0EC',
        },
        sand: {
          DEFAULT: '#E6DCC8',
          100: '#F0E9DA',
          300: '#D9CBAA',
        },
        stone: {
          DEFAULT: '#F7F3EC',
          line: '#E3DAC9',
          200: '#EFE9DD',
        },
        champagne: {
          DEFAULT: '#C8A86B',
          50: '#F8F0E1',
          600: '#AD8C52',
        },
        olive: '#8A8560',
        charcoal: {
          DEFAULT: '#2B2A27',
          600: '#534F47',
        },
        signal: {
          success: '#3F6B4E',
          warning: '#A8793B',
          danger: '#9C4A3A',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: '3px',
        DEFAULT: '6px',
        md: '10px',
        lg: '14px',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(43, 42, 39, 0.04), 0 6px 16px -6px rgba(43, 42, 39, 0.08)',
        overlay: '0 12px 32px -8px rgba(20, 41, 34, 0.22)',
      },
      letterSpacing: {
        eyebrow: '0.12em',
      },
    },
  },
  plugins: [],
};

export default config;
