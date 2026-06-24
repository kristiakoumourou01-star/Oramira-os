'use client';

import { useState, useTransition } from 'react';
import { sendMessage } from '@/app/actions/messages';

export interface MessageItem {
  id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

/**
 * Shared thread used by the Contractor Portal (ticket/task threads) and
 * staff-side ticket view. Homeowners read their own ticket thread but the
 * primary back-and-forth here is staff <-> contractor.
 */
export function MessageThread({
  entityType,
  entityId,
  currentUserId,
  initialMessages,
}: {
  entityType: 'ticket' | 'construction_task';
  entityId: string;
  currentUserId: string;
  initialMessages: MessageItem[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();

  function handleSend() {
    if (!draft.trim()) return;
    const optimistic: MessageItem = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId,
      sender_name: 'You',
      body: draft,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    const body = draft;
    setDraft('');
    startTransition(() => sendMessage(entityType, entityId, body));
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-1">
        {messages.length === 0 && (
          <p className="text-sm text-charcoal-600/70">No messages yet — start the conversation.</p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[75%] rounded-md px-3 py-2 text-sm ${
                  mine ? 'bg-forest text-stone-100' : 'bg-sand-100 text-charcoal'
                }`}
              >
                {!mine && <p className="mb-0.5 text-xs font-medium opacity-70">{m.sender_name}</p>}
                <p>{m.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2 border-t border-stone-line pt-3">
        <input
          className="input"
          placeholder="Write a message…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} disabled={isPending} className="btn-primary">
          Send
        </button>
      </div>
    </div>
  );
}
