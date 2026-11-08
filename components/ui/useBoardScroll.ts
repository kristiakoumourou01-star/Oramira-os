'use client';

import { useEffect, useRef, type DragEvent, type PointerEvent } from 'react';

/**
 * Οριζόντια κύλιση πίνακα: (α) όσο σέρνετε κάτι κοντά στην αριστερή/δεξιά άκρη
 * κυλά μόνος του, (β) σέρνοντας τον κενό χώρο με το ποντίκι μετακινείται.
 * Βάλτε τα `props` στο στοιχείο με overflow-x-auto.
 */
export function useBoardScroll<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  const edge = useRef<{ v: number; raf: number | null }>({ v: 0, raf: null });
  const pan = useRef<{ x: number; left: number; id: number } | null>(null);
  const stop = () => { edge.current.v = 0; if (edge.current.raf) cancelAnimationFrame(edge.current.raf); edge.current.raf = null; };
  useEffect(() => { const s = () => stop(); window.addEventListener('dragend', s); window.addEventListener('drop', s); return () => { window.removeEventListener('dragend', s); window.removeEventListener('drop', s); stop(); }; }, []);
  const props = {
    ref,
    onDragOver: (e: DragEvent<T>) => {
      const el = ref.current; if (!el) return;
      const r = el.getBoundingClientRect(); const Z = 90; const x = e.clientX;
      const v = x < r.left + Z ? -Math.ceil((r.left + Z - x) / 6) : x > r.right - Z ? Math.ceil((x - (r.right - Z)) / 6) : 0;
      edge.current.v = Math.max(-24, Math.min(24, v));
      if (edge.current.v && !edge.current.raf) {
        const tick = () => { const n = ref.current; if (!n || !edge.current.v) { edge.current.raf = null; return; } n.scrollLeft += edge.current.v; edge.current.raf = requestAnimationFrame(tick); };
        edge.current.raf = requestAnimationFrame(tick);
      }
    },
    onDragLeave: (e: DragEvent<T>) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) stop(); },
    onPointerDown: (e: PointerEvent<T>) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[draggable="true"],button,a,input,select,textarea,label')) return;
      const el = ref.current; if (!el || el.scrollWidth <= el.clientWidth) return;
      pan.current = { x: e.clientX, left: el.scrollLeft, id: e.pointerId };
      el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing';
    },
    onPointerMove: (e: PointerEvent<T>) => { const p = pan.current; const el = ref.current; if (p && el) el.scrollLeft = p.left - (e.clientX - p.x); },
    onPointerUp: () => { const el = ref.current; if (pan.current && el) { try { el.releasePointerCapture(pan.current.id); } catch { /* */ } el.style.cursor = ''; } pan.current = null; },
  };
  return { ...props, onPointerCancel: props.onPointerUp };
}
