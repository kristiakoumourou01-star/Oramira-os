'use client';

import { useState, type InputHTMLAttributes } from 'react';
import { Eye, EyeOff } from 'lucide-react';

/** Πεδίο κωδικού με «ματάκι» για εμφάνιση / απόκρυψη. Ίδια props με ένα κανονικό input. */
export function PasswordInput({ className = 'input', ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${className} pr-11`} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'} title={show ? 'Απόκρυψη κωδικού' : 'Εμφάνιση κωδικού'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-charcoal-600 hover:text-charcoal" tabIndex={-1}>
        {show ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
  );
}
