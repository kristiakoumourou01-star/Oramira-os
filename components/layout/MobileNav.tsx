'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

/**
 * Μενού για κινητό / tablet (κάτω από 768px): κουμπί ☰ στη γραμμή κορυφής
 * που ανοίγει το ίδιο πλαϊνό μενού ως συρτάρι. Κλείνει όταν αλλάζει σελίδα,
 * με Escape ή πατώντας έξω.
 */
export function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => { setOpen(false); }, [path]);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', esc);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [open]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Άνοιγμα μενού"
        className="mr-1 flex h-9 w-9 items-center justify-center rounded-lg text-charcoal-600 hover:bg-forest/[0.06] hover:text-forest md:hidden">
        <Menu size={19} strokeWidth={1.8} />
      </button>
      {/* Στο <body> (portal), ώστε τίποτα της σελίδας (π.χ. οι ώρες του ημερολογίου) να μη φαίνεται πάνω από το μενού. */}
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[100] isolate md:hidden" role="dialog" aria-modal="true">
          <div className="anim-fade absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="anim-pop absolute inset-y-0 left-0 flex max-w-[85vw] shadow-overlay [&>aside]:!flex">
            {children}
            <button type="button" onClick={() => setOpen(false)} aria-label="Κλείσιμο μενού"
              className="absolute -right-11 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white text-charcoal shadow-md"><X size={17} /></button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
