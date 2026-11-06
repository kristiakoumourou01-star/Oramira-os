export interface Attendee { email: string; name?: string | null; avatar_url?: string | null }

function initials(a: Attendee): string {
  const src = (a.name || a.email || '?').trim();
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase();
}

/**
 * Overlapping attendee avatar stack — max 3 shown, +N overflow pill, initials
 * fallback. Pure/presentational so it renders in server and client components.
 */
export function AvatarStack({ attendees, size = 20, max = 3 }: { attendees: Attendee[]; size?: number; max?: number }) {
  if (!attendees || attendees.length === 0) return null;
  const shown = attendees.slice(0, max);
  const overflow = attendees.length - shown.length;
  const dim = { width: size, height: size, fontSize: Math.round(size * 0.42) };

  return (
    <span className="flex items-center">
      {shown.map((a, i) => (
        <span
          key={a.email + i}
          title={a.name || a.email}
          className="flex items-center justify-center rounded-full border border-white bg-forest font-medium text-champagne ring-0"
          style={{ ...dim, marginLeft: i === 0 ? 0 : -size * 0.35 }}
        >
          {a.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={a.avatar_url} alt={a.name || a.email} className="h-full w-full rounded-full object-cover" />
          ) : (
            initials(a)
          )}
        </span>
      ))}
      {overflow > 0 && (
        <span
          className="flex items-center justify-center rounded-full border border-white bg-[#F5F1E8] font-medium text-charcoal-600"
          style={{ ...dim, marginLeft: -size * 0.35 }}
        >
          +{overflow}
        </span>
      )}
    </span>
  );
}
