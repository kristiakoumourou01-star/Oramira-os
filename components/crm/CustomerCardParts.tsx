'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, GitMerge, MessageCircle, Pencil, Plus, Search, Send } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { PopSelect } from '@/components/ui/PopSelect';
import { FieldLabel } from '@/components/admin/settings-ui';
import { EditCustomerDialog } from '@/components/crm/EditCustomerDialog';
import { createLeadForContact } from '@/app/actions/contacts-hub';
import { scheduleViewing } from '@/app/actions/viewings';
import { mergeContacts } from '@/app/actions/duplicates';
import { findContacts, type ContactHit } from '@/app/actions/contact-card';
import { sendCustomerMessage } from '@/app/actions/customer-card';
import type { CustomerProfileInput } from '@/lib/customer-card-shared';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

const btn = 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-stone-line bg-white px-3 text-sm text-charcoal transition-colors hover:border-forest/40';

/** Κουμπιά κορυφής: Μήνυμα · Νέα κράτηση / deal · Κλείσιμο προβολής. */
export function CustomerActions({ contactId, here, units, agents, currentUserId, leadId, canEdit }: {
  contactId: string; here: string; units: { id: string; label: string; projectId: string | null }[]; agents: { id: string; name: string }[]; currentUserId: string; leadId: string | null; canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [book, setBook] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const newDeal = () => start(async () => {
    setErr(null);
    const r = await createLeadForContact(contactId, 'other');
    if (!r.ok) { setErr(r.error); return; }
    router.push(r.id ? `/crm/leads/${r.id}` : `${here}?tab=deals`);
  });
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`${here}?tab=comms`} scroll={false} className={btn}><MessageCircle size={15} /> Μήνυμα</Link>
      {canEdit && <button type="button" disabled={pending} onClick={newDeal} className={btn}><Plus size={15} /> Νέα κράτηση / deal</button>}
      {canEdit && <button type="button" onClick={() => setBook(true)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-forest px-3 text-sm font-semibold text-white hover:bg-forest/90"><CalendarDays size={15} /> Κλείσιμο προβολής</button>}
      {err && <p className="w-full text-sm text-signal-danger">{err}</p>}
      {book && <BookViewing contactId={contactId} leadId={leadId} units={units} agents={agents} currentUserId={currentUserId} onClose={() => setBook(false)} onDone={() => { setBook(false); router.push(`${here}?tab=activity`); router.refresh(); }} />}
    </div>
  );
}

function BookViewing({ contactId, leadId, units, agents, currentUserId, onClose, onDone }: { contactId: string; leadId: string | null; units: { id: string; label: string; projectId: string | null }[]; agents: { id: string; name: string }[]; currentUserId: string; onClose: () => void; onDone: () => void }) {
  const tomorrow = new Date(Date.now() + 86400000);
  const p = (n: number) => String(n).padStart(2, '0');
  const [date, setDate] = useState(`${tomorrow.getFullYear()}-${p(tomorrow.getMonth() + 1)}-${p(tomorrow.getDate())}`);
  const [time, setTime] = useState('11:00');
  const [unit, setUnit] = useState('');
  const [agent, setAgent] = useState(currentUserId);
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setErr(null);
    const u = units.find((x) => x.id === unit);
    try {
      await scheduleViewing({ contactId, leadId, unitId: u?.id ?? null, projectId: u?.projectId ?? null, agentId: agent || null, scheduledAt: new Date(`${date}T${time || '11:00'}`).toISOString(), notes: notes || undefined });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Η προβολή δεν κλείστηκε.'); }
  });
  return (
    <Modal open onClose={onClose} title="Κλείσιμο προβολής" size="md">
      <ModalBody className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><FieldLabel>Ημερομηνία</FieldLabel><input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="block"><FieldLabel>Ώρα</FieldLabel><input type="time" className="input" value={time} onChange={(e) => setTime(e.target.value)} /></label>
        </div>
        <label className="block"><FieldLabel>Μονάδα</FieldLabel><PopSelect searchable width="w-full" value={unit} onChange={setUnit} options={[['', 'Χωρίς συγκεκριμένη μονάδα'], ...units.map((u) => [u.id, u.label] as [string, string])]} /></label>
        <label className="block"><FieldLabel>Συνεργάτης</FieldLabel><PopSelect searchable width="w-full" value={agent} onChange={setAgent} options={agents.map((a) => [a.id, a.name] as [string, string])} /></label>
        <label className="block"><FieldLabel>Σημειώσεις</FieldLabel><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <p className="rounded-xl border border-stone-line bg-stone-50 px-3 py-2 text-xs text-charcoal-600">Ο πελάτης παίρνει επιβεβαίωση με WhatsApp και email· η προβολή μπαίνει στο ημερολόγιο του συνεργάτη.</p>
        {err && <p className="text-sm text-signal-danger">{err}</p>}
      </ModalBody>
      <ModalFooter className="justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Άκυρο</button>
        <button type="button" className="btn-primary" disabled={pending || !date} onClick={save}><CalendarDays size={14} /> Κλείσιμο</button>
      </ModalFooter>
    </Modal>
  );
}

/** Προφίλ: «Επεξεργασία» και «Συγχώνευση» δίπλα στις υπο-καρτέλες. */
export function ProfileToolbar({ contactId, name, canEdit, canMerge, edit }: {
  contactId: string; name: string; canEdit: boolean; canMerge: boolean;
  edit: { initial: CustomerProfileInput; photoUrl: string | null; groupOptions: string[]; tagOptions: string[]; otp: { setAt: string | null; available: boolean } };
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  return (
    <span className="flex items-center gap-2">
      {canEdit && <button type="button" onClick={() => setEditOpen(true)} className={btn}><Pencil size={14} /> Επεξεργασία</button>}
      {canMerge && <button type="button" onClick={() => setMergeOpen(true)} className={btn}><GitMerge size={14} /> Συγχώνευση</button>}
      {editOpen && <EditCustomerDialog contactId={contactId} {...edit} onClose={() => setEditOpen(false)} />}
      {mergeOpen && <MergeDialog contactId={contactId} name={name} onClose={() => setMergeOpen(false)} />}
    </span>
  );
}

function MergeDialog({ contactId, name, onClose }: { contactId: string; name: string; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [picked, setPicked] = useState<ContactHit | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (picked || q.trim().length < 2) { setHits([]); return; }
    const t = setTimeout(async () => setHits(await findContacts(q, contactId)), 250);
    return () => clearTimeout(t);
  }, [q, picked, contactId]);
  const merge = () => picked && start(async () => {
    const r = await mergeContacts(contactId, picked.id);
    if (!r.ok) { setErr(r.error); return; }
    onClose(); router.refresh();
  });
  return (
    <Modal open onClose={onClose} title="Συγχώνευση πελάτη" description="Όλα τα στοιχεία του άλλου πελάτη (leads, μηνύματα, έγγραφα, κρατήσεις) περνούν σε αυτόν και ο άλλος διαγράφεται." size="md">
      <ModalBody className="space-y-3">
        <p className="text-sm text-charcoal-600">Κρατάμε: <span className="font-semibold text-charcoal" data-no-tr>{name}</span></p>
        {picked ? (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
            <span className="min-w-0"><span className="font-medium text-charcoal" data-no-tr>{picked.name}</span><span className="block truncate text-xs text-charcoal-600" data-no-tr>{picked.email ?? picked.phone ?? ''}</span></span>
            <button type="button" className="text-[13px] text-charcoal-600 hover:text-charcoal" onClick={() => setPicked(null)}>Αλλαγή</button>
          </div>
        ) : (
          <div className="relative">
            <label className="relative block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
              <input autoFocus className="input pl-8" placeholder="Αναζήτηση του διπλού πελάτη…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            {hits.length > 0 && (
              <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-stone-line bg-white shadow-overlay">
                {hits.map((h) => <li key={h.id}><button type="button" onClick={() => setPicked(h)} className="block w-full px-3 py-2 text-left text-sm hover:bg-stone-50"><span data-no-tr>{h.name}</span> <span className="text-xs text-charcoal-600" data-no-tr>{h.email ?? h.phone ?? ''}</span></button></li>)}
              </ul>
            )}
          </div>
        )}
        {err && <p className="text-sm text-signal-danger">{err}</p>}
      </ModalBody>
      <ModalFooter className="justify-end">
        <button type="button" className="btn-secondary" onClick={onClose}>Άκυρο</button>
        <button type="button" className="btn-primary" disabled={pending || !picked} onClick={merge}><GitMerge size={14} /> Συγχώνευση</button>
      </ModalFooter>
    </Modal>
  );
}

export interface ConversationRow { id: string; channel: string; direction: string; subject: string | null; body: string; status: string | null; author: string | null; at: string }
const CH: Record<string, string> = { email: 'Email', sms: 'SMS', whatsapp: 'WhatsApp', phone: 'Κλήση', meeting: 'Συνάντηση' };

/** Επικοινωνία: «Αποστολή μηνύματος» και «Πρόσφατες συνομιλίες». */
export function CustomerMessage({ contactId, hasEmail, hasPhone, rows, canEdit }: { contactId: string; hasEmail: boolean; hasPhone: boolean; rows: ConversationRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [channel, setChannel] = useState<'email' | 'sms' | 'whatsapp'>(hasEmail ? 'email' : 'whatsapp');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const send = () => start(async () => {
    setMsg(null);
    const r = await sendCustomerMessage(contactId, { channel, subject, body });
    if (!r.ok) { setMsg({ ok: false, text: r.error }); return; }
    setBody(''); setSubject(''); setMsg({ ok: true, text: 'Το μήνυμα στάλθηκε.' }); router.refresh();
  });
  const when = (iso: string) => new Date(iso).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <section className="space-y-3 rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-2">
        <h3 className="text-[17px] font-semibold text-charcoal">Αποστολή μηνύματος</h3>
        <label className="block"><FieldLabel>Κανάλι</FieldLabel>
          <PopSelect width="w-full" value={channel} onChange={(v) => setChannel(v as typeof channel)} options={[['email', hasEmail ? 'Email' : 'Email (χωρίς email)'], ['sms', hasPhone ? 'SMS' : 'SMS (χωρίς κινητό)'], ['whatsapp', 'WhatsApp']]} /></label>
        {channel === 'email' && <label className="block"><FieldLabel>Θέμα</FieldLabel><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>}
        <label className="block"><FieldLabel>Μήνυμα</FieldLabel><textarea className="input min-h-[140px]" value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <p className="rounded-xl border border-stone-line bg-stone-50 px-3 py-2 text-xs text-charcoal-600">Η ημερομηνία αποστολής καταγράφεται αυτόματα.</p>
        {msg && <p className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</p>}
        <div className="flex justify-end"><button type="button" className="btn-primary" disabled={!canEdit || pending || !body.trim()} onClick={send}><Send size={14} /> Αποστολή μηνύματος</button></div>
      </section>
      <section className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] lg:col-span-3">
        <h3 className="px-5 pt-5 text-[17px] font-semibold text-charcoal">Πρόσφατες συνομιλίες</h3>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-charcoal-600">Καμία συνομιλία ακόμη.</p> : (
          <ul className="mt-3 divide-y divide-stone-line border-t border-stone-line">
            {rows.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <p className="flex flex-wrap items-center gap-2 text-xs text-charcoal-600">
                  <span className="rounded-full border border-stone-line px-2 py-px font-medium text-charcoal">{CH[r.channel] ?? r.channel}</span>
                  <span>{r.direction === 'inbound' ? 'Εισερχόμενο' : 'Εξερχόμενο'}</span>
                  <span>{when(r.at)}</span>
                  {r.author && <span data-no-tr>{r.author}</span>}
                  {r.status === 'failed' && <span className="font-medium text-signal-danger">Απέτυχε</span>}
                </p>
                {r.subject && <p className="mt-1 text-sm font-semibold text-charcoal" data-no-tr>{r.subject}</p>}
                <p className="mt-0.5 line-clamp-3 whitespace-pre-line text-sm text-charcoal" data-no-tr>{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
