'use client';

import { brandStyleObject, sidebarBackground, type Branding } from '@/lib/branding-shared';

/**
 * Ζωντανή προεπισκόπηση της Εμφάνισης: ό,τι αλλάζετε (χρώματα, γραμματοσειρές,
 * χρώμα μενού) εφαρμόζεται αμέσως σε ΟΛΗ την οθόνη, ώστε να βλέπετε ακριβώς το
 * αποτέλεσμα. Μόλις φύγετε από τη σελίδα χωρίς αποθήκευση, όλα επανέρχονται.
 */
let draft: Branding | null = null;
let menu = { style: 'brand', custom: '#113124' };
const touched = new Set<string>();
const listeners = new Set<(b: Branding) => void>();

export function initLiveBrand(saved: Branding, sidebar?: { style: string; custom: string }) {
  if (!draft) draft = { ...saved };
  if (sidebar) menu = { ...sidebar };
}
export function getLiveBrand(): Branding | null { return draft; }
export function onLiveBrand(fn: (b: Branding) => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

function apply() {
  if (!draft || typeof document === 'undefined') return;
  const root = document.documentElement;
  const vars = brandStyleObject(draft);
  for (const [k, v] of Object.entries(vars)) { root.style.setProperty(k, v); touched.add(k); }
  root.style.setProperty('--sidebar-bg', sidebarBackground(menu.style, draft.colorPrimary, menu.custom)); touched.add('--sidebar-bg');
  listeners.forEach((fn) => fn(draft!));
}

export function patchLiveBrand(p: Partial<Branding>) { if (!draft) return; draft = { ...draft, ...p }; apply(); }
export function patchLiveMenu(style: string, custom: string) { menu = { style, custom }; apply(); }

/** Φεύγοντας από την Εμφάνιση: επιστροφή στα αποθηκευμένα (τα έδινε ο server). */
export function clearLiveBrand() {
  if (typeof document !== 'undefined') for (const k of touched) document.documentElement.style.removeProperty(k);
  touched.clear(); draft = null;
}
