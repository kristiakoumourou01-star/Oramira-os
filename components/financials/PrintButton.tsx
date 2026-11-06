'use client';

import { Printer } from 'lucide-react';

/** Print / save as PDF — the page's print styles keep only the document. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      <Printer size={15} /> Εκτύπωση / PDF
    </button>
  );
}
