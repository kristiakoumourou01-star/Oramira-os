import Link from 'next/link';

/**
 * Presentational brand mark (client-safe — no data fetching). Renders the
 * uploaded logo image when `logoUrl` is given, else a `{companyName} OS`
 * wordmark; colors come from the themed brand tokens either way. Server
 * surfaces wrap this in <BrandMark/> to supply live branding; client-only auth
 * pages render it bare and fall back to the default wordmark.
 */
export function Logo({
  tone = 'light',
  href = '/',
  companyName = 'Oramira',
  logoUrl = null,
  compact = false,
}: {
  tone?: 'light' | 'dark';
  href?: string;
  companyName?: string;
  logoUrl?: string | null;
  compact?: boolean;
}) {
  // Compact: just the mark — the uploaded logo, or the company initial in a tile.
  if (compact) {
    return (
      <Link href={href} className="inline-flex items-center justify-center" title={companyName}>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={companyName} className="h-8 w-8 rounded-md object-contain" />
        ) : (
          <span className={`flex h-8 w-8 items-center justify-center rounded-md font-display text-base ${tone === 'light' ? 'bg-white/10 text-stone-100' : 'bg-forest/10 text-forest'}`}>
            {(companyName.trim()[0] ?? 'O').toUpperCase()}
          </span>
        )}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`inline-flex items-center font-display text-lg tracking-wide ${
        tone === 'light' ? 'text-stone-100' : 'text-forest'
      }`}
    >
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={companyName} className="h-7 w-auto max-w-[160px] object-contain" />
      ) : (
        <span>
          {companyName}
        </span>
      )}
    </Link>
  );
}
