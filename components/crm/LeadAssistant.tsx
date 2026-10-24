'use client';

import { useState, useTransition } from 'react';
import { Sparkles, Send, MessageCircle, Mail } from 'lucide-react';
import { draftLeadMessageAction, sendLeadMessageAction } from '@/app/actions/communications';
import type { DraftIntent } from '@/lib/ai-shared';

const INTENTS: { key: DraftIntent; label: string }[] = [
  { key: 'follow_up', label: 'Follow-up' },
  { key: 'objection', label: 'Objection handling' },
  { key: 'viewing_reminder', label: 'Viewing reminder' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'nurture', label: 'Nurture' },
];

const STATUS_NOTE: Record<string, string> = {
  sent: 'Sent ✓',
  queued: 'Captured — no live provider connected yet, logged on the timeline.',
  failed: 'Could not send (no contact on file for this channel).',
};

/**
 * AI assistant on the lead detail: draft a WhatsApp/email follow-up, review it,
 * and send through the provider abstraction (recorded on the timeline).
 */
export function LeadAssistant({ leadId, hasPhone, hasEmail }: { leadId: string; hasPhone: boolean; hasEmail: boolean }) {
  const [channel, setChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [intent, setIntent] = useState<DraftIntent>('follow_up');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function draft() {
    setStatus(null);
    startTransition(async () => {
      const d = await draftLeadMessageAction(leadId, channel, intent);
      setSubject(d.subject ?? '');
      setBody(d.message);
    });
  }
  function send() {
    if (!body.trim()) return;
    startTransition(async () => {
      const r = await sendLeadMessageAction({ leadId, channel, body, subject: subject || undefined });
      setStatus(r.status);
    });
  }

  const canSend = channel === 'whatsapp' ? hasPhone : hasEmail;

  return (
    <div className="panel p-6">
      <h4 className="mb-3 flex items-center gap-2"><Sparkles size={15} className="text-champagne-600" strokeWidth={1.75} /> AI assistant</h4>
      <div className="mb-3 flex gap-2">
        {(['whatsapp', 'email'] as const).map((c) => (
          <button key={c} onClick={() => setChannel(c)} className={`badge capitalize ${channel === c ? 'badge-forest' : 'badge-neutral'}`}>
            {c === 'whatsapp' ? <MessageCircle size={12} className="mr-1" strokeWidth={1.75} /> : <Mail size={12} className="mr-1" strokeWidth={1.75} />}{c}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {INTENTS.map((i) => (
          <button key={i.key} onClick={() => setIntent(i.key)} className={`rounded px-2 py-1 text-[11px] font-medium transition-colors ${intent === i.key ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'}`}>
            {i.label}
          </button>
        ))}
      </div>

      <button onClick={draft} disabled={isPending} className="btn-secondary mb-3 w-full text-xs">
        <Sparkles size={13} strokeWidth={1.75} /> {isPending ? 'Working…' : 'Draft with AI'}
      </button>

      {channel === 'email' && body && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="input mb-2 text-sm" />
      )}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Draft a message, or generate one with AI…" className="input min-h-[110px] text-sm" />

      <button onClick={send} disabled={isPending || !body.trim() || !canSend} className="btn-primary mt-2 w-full">
        <Send size={14} strokeWidth={1.75} /> Send {channel}
      </button>
      {!canSend && <p className="mt-1 text-xs text-charcoal-600/60">No {channel === 'whatsapp' ? 'phone' : 'email'} on file for this lead.</p>}
      {status && <p className="mt-2 text-xs text-charcoal-600/80">{STATUS_NOTE[status] ?? status}</p>}
    </div>
  );
}
