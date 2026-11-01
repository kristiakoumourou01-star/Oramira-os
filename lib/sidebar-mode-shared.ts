/** Per-device sidebar view (cookie, so the server renders it without a flash). */
export type SidebarMode = 'full' | 'icons' | 'hidden';
export const SIDEBAR_COOKIE = 'oramira_sidebar';
export const SIDEBAR_MODES: { v: SidebarMode; l: string }[] = [
  { v: 'full', l: 'Πλήρες' },
  { v: 'icons', l: 'Μόνο εικονίδια' },
  { v: 'hidden', l: 'Κρυφό' },
];
export function parseSidebarMode(v: string | undefined | null): SidebarMode | null {
  return v === 'full' || v === 'icons' || v === 'hidden' ? v : null;
}
/** Write the cookie (1 year) — or clear it to follow the company default. */
export function writeSidebarMode(mode: SidebarMode | null) {
  document.cookie = mode
    ? `${SIDEBAR_COOKIE}=${mode}; path=/; max-age=31536000; samesite=lax`
    : `${SIDEBAR_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
