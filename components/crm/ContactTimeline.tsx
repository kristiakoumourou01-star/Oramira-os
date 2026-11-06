'use client';

import { useState, useTransition } from 'react';
import { Phone, Mail, MessageSquare, Users as MeetingIcon, StickyNote } from 'lucide-react';
import { addNote, logCommunication } from '@/app/actions/leads';
import { formatRelative } from '@/lib/format';

export interface TimelineEntry {
  id: string;
  kind: 'note' | 'communication';
  body: string;
  channel?: string;
  direction?: string;
  status?: string;
  ai_generated?: boolean;
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
  const [filter, setFilter] = useState<'all' | 'whatsapp' | 'email' | 'phone' | 'note' | 'ai'>('all');
  const [isPending, startTransition] = useTransition();

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'whatsapp', label: 'WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'phone', label: 'Calls' },
    { key: 'note', label: 'Notes' },
    { key: 'ai', label: 'AI drafts' },
  ];
  const visible = entries.filter((e) => {
    if (filter === 'all') return true;
    if (filter === 'ai') return !!e.ai_generated;
    if (filter === 'note') return e.kind === 'note';
    return e.kind === 'communication' && e.channel === filter;
  });

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

      <div className="mb-4 flex flex-wrap gap-1.5 border-t border-stone-line pt-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded px-2.5 py-1 text-[11px] font-medium transition-colors ${filter === f.key ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ol className="space-y-4 border-l border-stone-line pl-4">
        {visible.length === 0 && <p className="text-sm text-charcoal-600/70">No activity recorded yet.</p>}
        {visible.map((entry) => {
          const Icon = entry.kind === 'note' ? StickyNote : CHANNEL_ICON[entry.channel ?? ''] ?? MessageSquare;
          return (
            <li key={entry.id} className="relative">
              <span className="absolute -left-[21px] top-1 flex h-4 w-4 items-center justify-center rounded-full bg-champagne text-forest-deep">
                <Icon size={10} strokeWidth={2} />
              </span>
              <p className="text-sm text-charcoal">{entry.body}{entry.ai_generated ? <span className="ml-1 text-[10px] text-champagne-600">· AI</span> : null}</p>
              <p className="text-xs text-charcoal-600/60">
                {entry.author ? `${entry.author} · ` : ''}
                {formatRelative(entry.occurred_at)}
                {entry.direction ? ` · ${entry.direction}` : ''}
                {entry.status && entry.status !== 'logged' ? ` · ${entry.status}` : ''}
              </p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
