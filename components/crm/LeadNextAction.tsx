'use client';

import { Sparkles, MessageCircle } from 'lucide-react';
import type { AiSource } from '@/lib/ai-shared';
import type { NextBestAction } from '@/lib/next-best-action';

/**
 * The ONE authoritative "what to do now" for a lead — surfaced at the top of the
 * lead page so the agent never has to hunt or reconcile competing panels. Driven
 * by the single Next-Best-Action engine (same as the pipeline chip + dashboard),
 * with a provenance badge, and turned into a one-click action (WhatsApp — the
 * dominant channel here).
 */
export function LeadNextAction({ nba, source, phone }: { nba: NextBestAction; source: AiSource; phone: string | null }) {
  const ring =
    nba.tone === 'urgent' ? 'border-signal-danger/25 bg-champagne-50'
    : nba.tone === 'warm' ? 'border-forest/20 bg-forest/[0.05]'
    : 'border-stone-line bg-white';

  // Cyprus mobiles are stored as 8 digits (9xxxxxxx) — prepend the country code
  // for the wa.me deep link; otherwise use the number's own digits.
  const digits = (phone ?? '').replace(/[^0-9]/g, '');
  const waNumber = digits.length === 8 && digits.startsWith('9') ? `357${digits}` : digits;
  const waHref = waNumber ? `https://wa.me/${waNumber}` : null;

  return (
    <div className={`flex flex-wrap items-center gap-3 rounded-2xl border px-4 py-3 ${ring}`}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white"><Sparkles size={16} strokeWidth={1.9} /></span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow flex items-center gap-1.5">
          Next best action
          <span className={`rounded px-1 py-px text-[9px] font-semibold uppercase tracking-wide ${source === 'claude' ? 'bg-champagne-100 text-champagne-600' : 'bg-sand-100 text-charcoal-600/70'}`}>
            {source === 'claude' ? 'AI' : 'Rule-based'}
          </span>
        </p>
        <p className="text-sm text-charcoal"><span className="font-semibold">{nba.label}</span> · <span className="text-charcoal-600/80">{nba.reason}</span></p>
      </div>
      {waHref && (
        <a href={waHref} target="_blank" rel="noopener noreferrer" className="btn-primary shrink-0 text-sm">
          <MessageCircle size={15} strokeWidth={1.9} /> Message on WhatsApp
        </a>
      )}
    </div>
  );
}
