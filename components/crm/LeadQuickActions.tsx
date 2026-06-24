'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MessageCircle, Mail, StickyNote, CalendarPlus, X } from 'lucide-react';
import { addNote, scheduleFollowUp, logCommunication } from '@/app/actions/leads';

export interface QuickActionLead {
  id: string;
  contact_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

const digits = (p: string) => p.replace(/[^\d]/g, '');

/**
 * Inline lead quick-actions: Call, WhatsApp, Email, Add note, Set follow-up.
 * Call/WhatsApp/Email open the native channel AND log an outbound communication
 * (which refreshes last_contacted_at, feeding the priority + needs-action logic).
 * Note / follow-up open a tiny inline popover. Used in the table, the
 * needs-action rail, and the lead detail page.
 */
export function LeadQuickActions({ lead, size = 'sm' }: { lead: QuickActionLead; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState<null | 'note' | 'followup'>(null);
  const [draft, setDraft] = useState('');
  const [due, setDue] = useState('');
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const icon = size === 'md' ? 16 : 14;
  const btn = 'rounded p-1.5 text-charcoal-600/70 transition-colors hover:bg-sand-100 hover:text-forest';

  function logContact(channel: 'phone' | 'whatsapp' | 'email') {
    // fire-and-forget; refreshes last_contacted_at server-side
    startTransition(() =>
      logCommunication({ contactId: lead.contact_id, channel, direction: 'outbound', summary: `Outbound ${channel}`, leadId: lead.id }),
    );
  }

  function saveNote() {
    if (!draft.trim()) return;
    const body = draft;
    setDraft('');
    setOpen(null);
    startTransition(async () => {
      await addNote('lead', lead.id, body);
      router.refresh();
    });
  }

  function saveFollowUp() {
    if (!due) return;
    const dueAt = new Date(due).toISOString();
    setDue('');
    setOpen(null);
    startTransition(async () => {
      await scheduleFollowUp({ leadId: lead.id, contactId: lead.contact_id, dueAt });
      router.refresh();
    });
  }

  return (
    <div className="relative flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      {lead.phone ? (
        <a href={`tel:${lead.phone}`} onClick={() => logContact('phone')} className={btn} title="Call" aria-label="Call">
          <Phone size={icon} strokeWidth={1.75} />
        </a>
      ) : (
        <span className={`${btn} opacity-30`} title="No phone"><Phone size={icon} strokeWidth={1.75} /></span>
      )}
      {lead.phone ? (
        <a
          href={`https://wa.me/${digits(lead.phone)}`}
          target="_blank"
          rel="noreferrer"
          onClick={() => logContact('whatsapp')}
          className={btn}
          title="WhatsApp"
          aria-label="WhatsApp"
        >
          <MessageCircle size={icon} strokeWidth={1.75} />
        </a>
      ) : (
        <span className={`${btn} opacity-30`} title="No phone"><MessageCircle size={icon} strokeWidth={1.75} /></span>
      )}
      {lead.email ? (
        <a href={`mailto:${lead.email}`} onClick={() => logContact('email')} className={btn} title="Email" aria-label="Email">
          <Mail size={icon} strokeWidth={1.75} />
        </a>
      ) : (
        <span className={`${btn} opacity-30`} title="No email"><Mail size={icon} strokeWidth={1.75} /></span>
      )}
      <button onClick={() => setOpen(open === 'note' ? null : 'note')} className={btn} title="Add note" aria-label="Add note">
        <StickyNote size={icon} strokeWidth={1.75} />
      </button>
      <button onClick={() => setOpen(open === 'followup' ? null : 'followup')} className={btn} title="Set follow-up" aria-label="Set follow-up">
        <CalendarPlus size={icon} strokeWidth={1.75} />
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-20 w-64 rounded-md border border-stone-line bg-white p-3 shadow-overlay">
          <div className="mb-2 flex items-center justify-between">
            <p className="eyebrow">{open === 'note' ? 'Add note' : 'Set follow-up'}</p>
            <button onClick={() => setOpen(null)} className="text-charcoal-600/60 hover:text-charcoal"><X size={14} strokeWidth={1.75} /></button>
          </div>
          {open === 'note' ? (
            <>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a note…" className="input min-h-[64px]" autoFocus />
              <button onClick={saveNote} disabled={isPending} className="btn-primary mt-2 w-full text-xs">Save note</button>
            </>
          ) : (
            <>
              <input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="input" autoFocus />
              <button onClick={saveFollowUp} disabled={isPending} className="btn-primary mt-2 w-full text-xs">Schedule</button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
