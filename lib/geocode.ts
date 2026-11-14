import 'server-only';

/**
 * Κατά προσέγγιση συντεταγμένες από κείμενο τοποθεσίας (π.χ. «Pyrgos, Limassol»)
 * μέσω OpenStreetMap Nominatim — δωρεάν, με cache 7 ημερών. Ποτέ δεν πετάει σφάλμα.
 */
export async function geocodeText(text: string | null | undefined, country = 'cy'): Promise<{ lat: number; lng: number } | null> {
  const q = (text ?? '').trim();
  if (q.length < 3) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=${country}&q=${encodeURIComponent(q)}`;
    const r = await fetch(url, { headers: { 'User-Agent': 'OramiraOS/1.0 (project map)', 'Accept-Language': 'el,en' }, next: { revalidate: 604800 }, signal: AbortSignal.timeout(2500) });
    if (!r.ok) return null;
    const j = (await r.json()) as { lat: string; lon: string }[];
    if (!j[0]) return null;
    const lat = Number(j[0].lat); const lng = Number(j[0].lon);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  } catch { return null; }
}
