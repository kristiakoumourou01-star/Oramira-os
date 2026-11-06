'use client';

import { Printer } from 'lucide-react';

/** Triggers the browser print dialog → Save as PDF. */
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn-primary print:hidden">
      <Printer size={15} strokeWidth={1.75} /> Download / Print PDF
    </button>
  );
}
