'use client';

import { useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { writeSidebarMode, type SidebarMode } from '@/lib/sidebar-mode-shared';

/**
 * Εμφάνιση / απόκρυψη του πλαϊνού μενού σε αυτή τη συσκευή (και Ctrl/Cmd + \).
 * Κρυφό → πλήρες· αλλιώς → κρυφό. Η επιλογή «μόνο εικονίδια» είναι στις
 * Ρυθμίσεις → Εμφάνιση → «Η δική μου προβολή».
 */
export function SidebarToggle({ mode }: { mode: SidebarMode }) {
  const router = useRouter();
  const [, start] = useTransition();
  const hidden = mode === 'hidden';
  const flip = () => { writeSidebarMode(hidden ? 'full' : 'hidden'); start(() => router.refresh()); };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === '\\') { e.preventDefault(); flip(); } };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return (
    <button type="button" onClick={flip} title={hidden ? 'Εμφάνιση μενού (Ctrl/⌘ + \\)' : 'Απόκρυψη μενού (Ctrl/⌘ + \\)'}
      aria-label={hidden ? 'Εμφάνιση μενού' : 'Απόκρυψη μενού'}
      className="mr-2 flex h-8 w-8 items-center justify-center rounded-lg text-charcoal-600/70 hover:bg-forest/[0.06] hover:text-forest">
      {hidden ? <PanelLeftOpen size={17} strokeWidth={1.75} /> : <PanelLeftClose size={17} strokeWidth={1.75} />}
    </button>
  );
}
