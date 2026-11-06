'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/**
 * The single modal/dialog primitive for the whole app. Replaces 16 hand-rolled
 * `fixed inset-0` overlays that each shipped with zero accessibility. It owns:
 *   • the premium shell (forest overlay, rounded panel, header, close button)
 *   • a11y — role="dialog", aria-modal, labelled by the title, focus trap,
 *     focus restore on close, Escape to close
 *   • body scroll-lock while open (ref-counted for stacked modals)
 *   • backdrop-click to close
 *
 * Compose the content with <ModalBody> (scrolls) and <ModalFooter> (sticky),
 * optionally wrapped in a <form> so a footer submit button drives body inputs.
 */

const SIZES = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' } as const;

let lockCount = 0;
function lockScroll() {
  if (lockCount++ === 0) document.body.style.overflow = 'hidden';
}
function unlockScroll() {
  if (--lockCount <= 0) { lockCount = 0; document.body.style.overflow = ''; }
}

const FOCUSABLE = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function Modal({
  open,
  onClose,
  title,
  description,
  size = 'lg',
  closeOnBackdrop = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  size?: keyof typeof SIZES;
  closeOnBackdrop?: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useRef(`modal-${Math.random().toString(36).slice(2, 9)}`).current;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    lockScroll();

    // Move focus into the dialog (first field, else the panel itself).
    const panel = panelRef.current;
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
      if (e.key !== 'Tab' || !panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null);
      if (items.length === 0) { e.preventDefault(); return; }
      const firstEl = items[0], lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); firstEl.focus(); }
    }

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      unlockScroll();
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="ws-fade-in fixed inset-0 z-50 flex items-center justify-center bg-forest-deep/40 p-4"
      onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`ws-pop flex max-h-[88vh] w-full ${SIZES[size]} flex-col overflow-hidden rounded-2xl bg-white shadow-overlay outline-none`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-line px-5 py-3.5">
          <div className="min-w-0">
            <h3 id={titleId} className="text-[17px] font-semibold text-charcoal">{title}</h3>
            {description && <p className="mt-0.5 text-xs text-charcoal-600/60">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-1 shrink-0 rounded-lg p-1 text-charcoal-600/50 transition-colors hover:bg-[#F5F1E8] hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}

/** Scrollable content region. */
export function ModalBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex-1 overflow-y-auto px-5 py-4 ${className}`}>{children}</div>;
}

/** Sticky action bar. Primary action goes last (right). */
export function ModalFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex gap-2 border-t border-stone-line px-5 py-3.5 ${className}`}>{children}</div>;
}
