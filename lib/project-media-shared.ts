/** Client-safe types for project media (no server imports). */
export interface SignedMedia {
  id: string;
  kind: string;
  title: string | null;
  building_id: string | null;
  floor: number | null;
  url: string | null;
}
