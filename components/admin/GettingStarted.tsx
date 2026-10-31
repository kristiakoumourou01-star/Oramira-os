'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';

export interface StartStep { key: string; label: string; hint: string; href: string; done: boolean }

const HIDE_KEY = 'oramira_getting_started_hidden';

/** Settings → «Πρώτα βήματα»: what is left to set up, each with a link. Hidden per browser once dismissed or done. */
export function GettingStarted({ steps }: { steps: StartStep[] }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    let h = false;
    try { h = localStorage.getItem(HIDE_KEY) === '1'; } catch { /* storage blocked */ }
    setHidden(h);
  }, []);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  const hide = () => { try { localStorage.setItem(HIDE_KEY, '1'); } catch { /* ignore */ } setHidden(true); };

  return (
    <div className="panel space-y-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2"><Rocket size={16} className="text-champagne-600" /> Πρώτα βήματα</h4>
          <p className="text-xs text-charcoal-600/70">{done} από {steps.length} έτοιμα. Κάθε βήμα παίρνει λίγα λεπτά.</p>
        </div>
        <button type="button" onClick={hide} title="Απόκρυψη" className="text-charcoal-600/50 hover:text-charcoal"><X size={16} /></button>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-stone">
        <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${Math.round((done / steps.length) * 100)}%` }} />
      </div>
      <ul className="grid gap-1.5 sm:grid-cols-2">
        {steps.map((s) => (
          <li key={s.key}>
            <Link href={s.href} className="flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-stone/70">
              {s.done ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-signal-success" /> : <Circle size={16} className="mt-0.5 shrink-0 text-charcoal-600/40" />}
              <span>
                <span className={`block text-sm ${s.done ? 'text-charcoal-600/60 line-through' : 'text-charcoal'}`}>{s.label}</span>
                {!s.done && <span className="block text-[11px] text-charcoal-600/60">{s.hint}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
