'use client';

import { useState, type DragEvent } from 'react';

/**
 * Αλλαγή σειράς σέρνοντας (HTML5 drag & drop). `item(i)` δίνει τα props της
 * γραμμής, `cls(i)` το περίγραμμα / διαφάνεια όσο σέρνεται. Το σύρσιμο δεν
 * ξεκινά από πεδία κειμένου ή κουμπιά, ώστε να γράφετε κανονικά.
 */
export function useDragSort(onMove: (from: number, to: number) => void, enabled = true, group = 'list') {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);
  const reset = () => { setDrag(null); setOver(null); };
  const item = (i: number) => ({
    draggable: enabled,
    onDragStart: (e: DragEvent) => {
      if ((e.target as HTMLElement).closest?.('input,select,textarea,button')) { e.preventDefault(); return; }
      e.stopPropagation();
      e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', `${group}:${i}`); setDrag(i);
    },
    onDragOver: (e: DragEvent) => { if (drag !== null) { e.preventDefault(); e.stopPropagation(); setOver(i); } },
    onDrop: (e: DragEvent) => { if (drag === null) return; e.preventDefault(); e.stopPropagation(); if (drag !== i) onMove(drag, i); reset(); },
    onDragEnd: reset,
  });
  const cls = (i: number) => (over === i && drag !== null && drag !== i ? 'ring-2 ring-forest/40 rounded-md' : drag === i ? 'opacity-50' : '');
  return { item, cls };
}

/** Μετακίνηση στοιχείου πίνακα από → σε. */
export function moveItem<T>(a: T[], from: number, to: number): T[] {
  const n = [...a]; const [x] = n.splice(from, 1); n.splice(to, 0, x); return n;
}
