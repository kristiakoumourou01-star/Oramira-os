'use client';

import { useState, useTransition } from 'react';
import { Mail, Check } from 'lucide-react';
import { emailMorningBrief } from '@/app/actions/brief';

/** Small "email me this brief" affordance for the Morning Brief card. */
export function MorningBriefEmailButton() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  return (
    <button
      onClick={() => start(async () => {
        setErr(null);
        const res = await emailMorningBrief();
        if (res.ok) { setDone(true); setTimeout(() => setDone(false), 4000); }
        else setErr(res.error ?? 'Could not send');
      })}
      disabled={pending || done}
      title={err ?? 'Email this brief to yourself'}
      className="flex items-center gap-1.5 rounded-lg border border-champagne/40 bg-white/60 px-2.5 py-1 text-xs text-forest transition-colors hover:bg-champagne-50 disabled:opacity-60"
    >
      {done ? <><Check size={13} strokeWidth={2} /> Sent</> : <><Mail size={13} strokeWidth={1.9} /> {pending ? 'Sending…' : 'Email me'}</>}
    </button>
  );
}
