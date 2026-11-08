'use client';

import { brandStyleObject, sidebarBackground, type Branding } from '@/lib/branding-shared';

/**
 * Ζωντανή προεπισκόπηση της Εμφάνισης: ό,τι αλλάζετε (χρώματα, γραμματοσειρές,
 * χρώμα μενού) εφαρμόζεται αμέσως σε ΟΛΗ την οθόνη, ώστε να βλέπετε ακριβώς το
 * αποτέλεσμα. Μόλις φύγετε από τη σελίδα χωρίς αποθήκευση, όλα επανέρχονται.
 */
let draft: Branding | null = null;
let saved: Branding | null = null;
let savedMenu = { style: 'brand', custom: '#113124' };
/** Επιφάνειες/κείμενο: στο σκούρο θέμα τα ορίζει το θέμα, όχι το brand. */
const SURFACE = ['--c-stone', '--c-stone-200', '--c-stone-line', '--c-sand', '--c-sand-100', '--c-sand-300', '--c-charcoal', '--c-charcoal-600', '--c-forest-50', '--c-champagne-50'];
let menu = { style: 'brand', custom: '#113124' };
const touched = new Set<string>();
const listeners = new Set<(b: Branding) => void>();

export function initLiveBrand(savedB: Branding, sidebar?: { style: string; custom: string }) {
  if (!draft) { draft = { ...savedB }; saved = { ...savedB }; }
  if (sidebar) { menu = { ...sidebar }; savedMenu = { ...sidebar }; }
}
export function getLiveBrand(): Branding | null { return draft; }
export function onLiveBrand(fn: (b: Branding) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function apply() {
  if (!draft || !saved || typeof document === 'undefined') return;
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark';
  const want = brandStyleObject(draft);
  const base = brandStyleObject(saved);
  // Μόνο ό,τι διαφέρει από τα αποθηκευμένα — αλλιώς θα «πατούσαμε» το σκούρο θέμα.
  for (const [k, v] of Object.entries(want)) {
    if (v !== base[k] && !(dark && SURFACE.includes(k))) { root.style.setProperty(k, v); touched.add(k); }
    else if (touched.has(k)) { root.style.removeProperty(k); touched.delete(k); }
  }
  const bg = sidebarBackground(menu.style, draft.colorPrimary, menu.custom);
  if (bg !== sidebarBackground(savedMenu.style, saved.colorPrimary, savedMenu.custom)) { root.style.setProperty('--sidebar-bg', bg); touched.add('--sidebar-bg'); }
  else if (touched.has('--sidebar-bg')) { root.style.removeProperty('--sidebar-bg'); touched.delete('--sidebar-bg'); }
  listeners.forEach((fn) => fn(draft!));
}

export function patchLiveBrand(p: Partial<Branding>) { if (!draft) return; draft = { ...draft, ...p }; apply(); }
export function patchLiveMenu(style: string, custom: string) { menu = { style, custom }; apply(); }

/** Φεύγοντας από την Εμφάνιση: επιστροφή στα αποθηκευμένα (τα έδινε ο server). */
export function clearLiveBrand() {
  if (typeof document !== 'undefined') for (const k of touched) document.documentElement.style.removeProperty(k);
  touched.clear(); draft = null; saved = null;
}
export function reapplyLiveBrand() { apply(); }
