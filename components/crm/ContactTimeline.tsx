'use client';

import { useState, useTransition } from 'react';
import { Phone, Mail, MessageSquare, Users as MeetingIcon, StickyNote } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { addNote, logCommunication } from '@/app/actions/leads';

export interface TimelineEntry {
  id: string;
  kind: 'note' | 'communication';
  body: string;
  channel?: string;
  direction?: string;
  author?: string | null;
  occurred_at: string;
}

const CHANNEL_ICON: Record<string, any> = {
  phone: Phone, email: Mail, whatsapp: MessageSquare, meeting: MeetingIcon,
};

/**
 * Combines notes and call/email logs into one chronological feed — the
 * CRM requirement is "call logs" and "email logs" but a rep reading a
 * contact's history wants them interleaved with notes, not three tabs.
 */
export function ContactTimeline({
  contactId,
  leadId,
  entries,
}: {
  contactId: string;
  leadId?: string;
  entries: TimelineEntry[];
}) {
  const [tab, setTab] = useState<'note' | 'phone' | 'email'>('note');
  const [draft, setDraft] = useState('');
  const [direction, setDirection] = useState<'inbound' | 'outbound'>('outbound');
  const [isPending, startTransition] = useTransition();

  function submit() {
    if (!draft.trim()) return;
    const body = draft;
    setDraft('');
    startTransition(async () => {
      if (tab === 'note') {
        await addNote('contact', contactId, body);
      } else {
        await logCommunication({ contactId, channel: tab, direction, summary: body, leadId });
      }
    });
  }

  return (
    <div className="panel p-6">
      <h4 className="mb-4">Activity & communication</h4>

      <div className="mb-3 flex gap-1">
        {(['note', 'phone', 'email'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
              tab === t ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'
            }`}
          >
            {t === 'note' ? 'Add note' : `Log ${t}`}
          </button>
        ))}
      </div>

      <div className="mb-6 space-y-2">
        {tab !== 'note' && (
          <div className="flex gap-2">
            {(['outbound', 'inbound'] as const).map((d) => (
              <button
                key={d}
                onClick={() => setDirection(d)}
                className={`badge ${direction === d ? 'badge-forest' : 'badge-neutral'} capitalize`}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        <textarea
          className="input min-h-[80px]"
          placeholder={tab === 'note' ? 'Write a note…' : `Summarize this ${tab} call/email…`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button onClick={submit} disabled={isPending} className="btn-secondary">
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <ol className="space-y-4 border-l border-stone-line pl-4">
        {entries.length === 0 && <p className="text-sm text-charcoal-600/70">No activity recorded yet.</p>}
        {entries.map((entry) => {
          const Icon = entry.kind === 'note' ? StickyNote : CHANNEL_ICON[entry.channel ?? ''] ?? MessageSquare;
          return (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[21px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-champagne text-forest-deep">
                <Icon size={10} strokeWidth={2} />
              </span>
              <p className="text-sm text-charcoal">{entry.body}</p>
              <p className="text-xs text-charcoal-600/60">
                {entry.author ? `${entry.author} · ` : ''}
                {formatDistanceToNow(new Date(entry.occurred_at), { addSuffix: true })}
                {entry.direction ? ` · ${entry.direction}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
