import Link from 'next/link';

/**
 * Wordmark, not an icon-mark — fitting a developer brand that trades on
 * restraint rather than a logo-as-decoration. Used on dark (forest) and
 * light (stone) surfaces via the `tone` prop.
 */
export function Logo({ tone = 'light', href = '/' }: { tone?: 'light' | 'dark'; href?: string }) {
  return (
    <Link
      href={href}
      className={`font-display text-lg tracking-wide ${
        tone === 'light' ? 'text-stone-100' : 'text-forest'
      }`}
    >
      Oramira <span className="text-champagne">OS</span>
    </Link>
  );
}
