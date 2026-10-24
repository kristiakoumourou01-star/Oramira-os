'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { sendBuyerMessage } from '@/app/actions/buyer';
import { Send } from 'lucide-react';
import { formatDateTime } from '@/lib/format';

export interface ThreadMessage {
  id: string;
  sender_id: string;
  sender_name: string | null;
  body: string;
  created_at: string;
}

/**
 * Buyer <-> Oramira team thread, keyed to the buyer's unit (entity_type
 * 'unit'). Realtime so a reply from the team lands without a refresh. RLS
 * (messages_buyer_rw / messages_staff_all) scopes the thread to this unit's
 * owner and staff — nobody else can read or post.
 */
export function BuyerMessageThread({
  unitId,
  currentUserId,
  initialMessages,
}: {
  unitId: string;
  currentUserId: string;
  initialMessages: ThreadMessage[];
}) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`unit-thread-${unitId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `entity_id=eq.${unitId}` },
        (payload) => {
          const row = payload.new as { id: string; sender_id: string; body: string; created_at: string };
          setMessages((prev) =>
            prev.some((m) => m.id === row.id)
              ? prev
              : [...prev, { id: row.id, sender_id: row.sender_id, sender_name: row.sender_id === currentUserId ? 'You' : 'Oramira team', body: row.body, created_at: row.created_at }]
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [unitId, currentUserId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSend() {
    const body = draft.trim();
    if (!body) return;
    setMessages((prev) => [
      ...prev,
      { id: `temp-${Date.now()}`, sender_id: currentUserId, sender_name: 'You', body, created_at: new Date().toISOString() },
    ]);
    setDraft('');
    startTransition(() => sendBuyerMessage(unitId, body));
  }

  return (
    <div className="flex h-[28rem] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {messages.length === 0 && (
          <p className="text-sm text-charcoal-600/70">
            No messages yet. Your Oramira team is here for anything you need — say hello.
          </p>
        )}
        {messages.map((m) => {
          const mine = m.sender_id === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[78%] rounded-md px-3.5 py-2 text-sm ${mine ? 'bg-forest text-stone-100' : 'border border-stone-line bg-white text-charcoal'}`}>
                {!mine && <p className="mb-0.5 text-xs font-medium text-champagne-600">{m.sender_name ?? 'Oramira team'}</p>}
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? 'text-stone-100/50' : 'text-charcoal-600/50'}`}>
                  {formatDateTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      <div className="mt-3 flex gap-2 border-t border-stone-line pt-3">
        <input
          className="input"
          placeholder="Write a message to your Oramira team…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button onClick={handleSend} disabled={isPending} className="btn-primary">
          <Send size={15} strokeWidth={1.75} /> Send
        </button>
      </div>
    </div>
  );
}
