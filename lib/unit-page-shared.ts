/** Σελίδα μονάδας — client-safe types and helpers. */

export interface UnitMediaItem {
  id: string;
  kind: 'photo' | 'video' | 'floor_plan' | 'video_link';
  caption: string | null;
  /** Signed file URL, or the external link for video_link. */
  url: string | null;
  isPdf: boolean;
  sort: number;
}

export interface Room { name: string; length: number; width: number }

export const MEDIA_KIND_LABEL: Record<UnitMediaItem['kind'], string> = {
  photo: 'Φωτογραφία', video: 'Βίντεο', floor_plan: 'Κάτοψη', video_link: 'Σύνδεσμος βίντεο',
};

export const area = (r: Room) => Math.round((Number(r.length) || 0) * (Number(r.width) || 0) * 100) / 100;

export function cleanRooms(x: unknown): Room[] {
  if (!Array.isArray(x)) return [];
  return x
    .map((r: any) => ({ name: String(r?.name ?? '').trim().slice(0, 60), length: Math.max(0, Math.round(Number(r?.length) * 100) / 100 || 0), width: Math.max(0, Math.round(Number(r?.width) * 100) / 100 || 0) }))
    .filter((r) => r.name)
    .slice(0, 40);
}

/** YouTube / Vimeo link → embeddable URL (others open in a new tab). */
export function embedUrl(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube-nocookie.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

/** Coordinates from "34.68, 33.04" or a Google / OpenStreetMap link. */
export function parseCoords(input: string): { lat: number; lng: number } | null {
  const s = input.trim();
  const m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ?? s.match(/[?&](?:q|query|ll|mlat)=(-?\d+\.\d+)[,&](?:mlon=)?(-?\d+\.\d+)/) ?? s.match(/#map=\d+\/(-?\d+\.\d+)\/(-?\d+\.\d+)/) ?? s.match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]); const lng = Number(m[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}
