/** Χάρτης (βήμα 10) — client-safe types and helpers. */
import type { MatchCriteria } from '@/lib/matching';
import type { FieldValue } from '@/lib/unit-forms-shared';
import { kmBetween } from '@/lib/areas';

export interface MapProject { id: string; name: string; location: string | null; lat: number; lng: number; approx: boolean }
export interface MapUnit {
  id: string; projectId: string; unitNumber: string; type: string | null; price: number | null;
  bedrooms: number | null; sqm: number | null; status: string; features: Record<string, FieldValue>;
}
export interface MapLead {
  leadId: string; contactId: string; name: string; email: string | null; phone: string | null;
  areas: string[]; criteria: MatchCriteria;
}

export interface DayStop {
  id: string; time: string; status: string; contact: string; phone: string | null;
  unit: string | null; project: string | null; lat: number | null; lng: number | null; approx: boolean;
}
export interface DayLeg { km: number; minutes: number }

/** Road distance ≈ 1.3 × straight line; ~45 km/h average + 5 min to park. */
export function legBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): DayLeg {
  const km = Math.round(kmBetween(a, b) * 1.3 * 10) / 10;
  return { km, minutes: km < 0.3 ? 2 : Math.round((km / 45) * 60 + 5) };
}

/** Google Maps directions through every stop that has a position, in order. */
export function directionsUrl(stops: { lat: number | null; lng: number | null }[]): string | null {
  const pts = stops.filter((s) => s.lat != null && s.lng != null).map((s) => `${s.lat},${s.lng}`);
  if (!pts.length) return null;
  return `https://www.google.com/maps/dir/${pts.join('/')}`;
}
