'use client';

import { useState } from 'react';
import { CalendarCheck } from 'lucide-react';

/** Public selection page: the client asks for a viewing of this unit. */
export function InterestButton({ token, unitId, lang, already }: { token: string; unitId: string; lang: 'el' | 'en'; already: boolean }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>(already ? 'done' : 'idle');
  const el = lang === 'el';
  const send = async () => {
    setState('sending');
    try {
      const r = await fetch('/api/public/selection', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, unitId }) });
      setState(r.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };
  if (state === 'done') return <span className="badge-forest inline-flex items-center gap-1"><CalendarCheck size={13} /> {el ? 'Θα επικοινωνήσουμε μαζί σας για την προβολή' : "We'll contact you to arrange a viewing"}</span>;
  return (
    <button type="button" onClick={send} disabled={state === 'sending'} className="btn-primary">
      <CalendarCheck size={15} /> {state === 'sending' ? '…' : el ? 'Θέλω προβολή' : 'Request a viewing'}
      {state === 'error' && <span className="ml-2 text-xs">{el ? '(δοκιμάστε ξανά)' : '(try again)'}</span>}
    </button>
  );
}
