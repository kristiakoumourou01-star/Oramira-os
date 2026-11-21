'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Inbox, Loader2, CheckCircle2, Clock, MessageSquare, Send } from 'lucide-react';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { createTicket, replyTicket, setTicketStatus } from '@/app/actions/tickets';

export interface TicketReply { id: string; author: string; mine: boolean; body: string; at: string }
export interface TicketRow {
  id: string; subject: string; body: string | null; priority: 'low' | 'normal' | 'high'; status: 'open' | 'in_progress' | 'resolved';
  createdBy: string; mine: boolean; createdAt: string; updatedAt: string; firstResponseAt: string | null; resolvedAt: string | null; replies: TicketReply[];
}

const PRIORITY: Record<TicketRow['priority'], { label: string; cls: string }> = {
  high: { label: 'Υψηλή', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
  normal: { label: 'Κανονική', cls: 'bg-forest/[0.07] text-forest ring-forest/20' },
  low: { label: 'Χαμηλή', cls: 'bg-stone text-charcoal-600 ring-stone-line' },
};
const STATUS: Record<TicketRow['status'], { label: string; cls: string }> = {
  open: { label: 'Ανοιχτό', cls: 'bg-amber-50 text-amber-800 ring-amber-200' },
  in_progress: { label: 'Σε εξέλιξη', cls: 'bg-forest/[0.07] text-forest ring-forest/20' },
  resolved: { label: 'Λύθηκε', cls: 'bg-stone text-charcoal-600 ring-stone-line' },
};

/** Ο λογαριασμός μου → Τα tickets μου (όπως στο FitnessCRM): κάρτες, πίνακας, νέο ticket και συνομιλία. */
export function TicketsView({ rows, isAdmin, lang, openId }: { rows: TicketRow[]; isAdmin: boolean; lang: string; openId?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ subject: '', body: '', priority: 'normal' });
  const [err, setErr] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(openId ?? null);
  const [reply, setReply] = useState('');
  const [status, setStatus] = useState<'' | TicketRow['status']>('');

  const fmt = (iso: string) => new Date(iso).toLocaleString(lang, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' });
  const now = Date.now();
  const responded = rows.filter((r) => r.firstResponseAt);
  const avgH = responded.length ? responded.reduce((s, r) => s + (new Date(r.firstResponseAt!).getTime() - new Date(r.createdAt).getTime()), 0) / responded.length / 36e5 : null;
  const cards = [
    { label: 'Ανοιχτά', v: String(rows.filter((r) => r.status === 'open').length), icon: Inbox },
    { label: 'Σε εξέλιξη', v: String(rows.filter((r) => r.status === 'in_progress').length), icon: Loader2 },
    { label: 'Λύθηκαν · 30 μέρες', v: String(rows.filter((r) => r.resolvedAt && now - new Date(r.resolvedAt).getTime() < 30 * 864e5).length), icon: CheckCircle2 },
    { label: 'Μέσος χρόνος απάντησης', v: avgH == null ? '—' : avgH < 1 ? `${Math.max(1, Math.round(avgH * 60))}′` : `${Math.round(avgH)} ώρ.`, icon: Clock },
  ];
  const list = rows.filter((r) => !status || r.status === status);
  const current = rows.find((r) => r.id === openTicket) ?? null;

  const submit = () => start(async () => {
    setErr(null);
    const r = await createTicket(form);
    if (!r.ok) { setErr(r.error); return; }
    setCreating(false); setForm({ subject: '', body: '', priority: 'normal' }); router.refresh();
  });
  const sendReply = () => current && start(async () => {
    const r = await replyTicket(current.id, reply);
    if (!r.ok) { setErr(r.error); return; }
    setReply(''); router.refresh();
  });
  const changeStatus = (s: TicketRow['status']) => current && start(async () => { await setTicketStatus(current.id, s); router.refresh(); });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-charcoal">Tickets</h2>
          <p className="text-sm text-charcoal-600/75">{isAdmin ? 'Όλα τα αιτήματα υποστήριξης της ομάδας' : 'Οι συνομιλίες σας με την υποστήριξη'}</p>
        </div>
        <button type="button" onClick={() => { setErr(null); setCreating(true); }} className="btn-primary inline-flex items-center gap-1.5"><Plus size={15} /> Νέο ticket</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-forest/10 text-forest"><c.icon size={14} /></span><span>{c.label}</span></div>
            <p className="mt-2 font-display text-3xl text-charcoal">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {([['', 'Όλα'], ['open', 'Ανοιχτά'], ['in_progress', 'Σε εξέλιξη'], ['resolved', 'Λύθηκαν']] as const).map(([v, l]) => (
          <button key={v} type="button" onClick={() => setStatus(v)} aria-pressed={status === v}
            className={`rounded-full border px-3 py-1 text-[13px] transition ${status === v ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/40'}`}>{l}</button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <table className="o-table w-full min-w-[640px] text-sm">
          <thead><tr><th>Θέμα</th>{isAdmin && <th>Από</th>}<th>Προτεραιότητα</th><th>Κατάσταση</th><th>Ενημέρωση</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan={isAdmin ? 5 : 4} className="py-14 text-center text-charcoal-600/70"><span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/10 text-forest"><MessageSquare size={20} /></span>Δεν υπάρχουν tickets ακόμη.</td></tr>}
            {list.map((r) => (
              <tr key={r.id} onClick={() => setOpenTicket(r.id)} className="cursor-pointer hover:bg-forest/[0.025]">
                <td className="font-medium text-charcoal"><span data-no-tr>{r.subject}</span>{r.replies.length > 0 && <span className="ml-2 text-xs text-charcoal-600/60">· {r.replies.length} <span>απαντήσεις</span></span>}</td>
                {isAdmin && <td className="text-charcoal-600" data-no-tr>{r.createdBy}</td>}
                <td><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${PRIORITY[r.priority].cls}`}>{PRIORITY[r.priority].label}</span></td>
                <td><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                <td className="whitespace-nowrap tabular-nums text-charcoal-600">{fmt(r.updatedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="Νέο ticket" description="Γράψτε τι χρειάζεστε — ο διαχειριστής ειδοποιείται αμέσως." size="md">
        <ModalBody className="space-y-3">
          <label className="block"><span className="text-xs font-medium text-charcoal-600">Θέμα</span><input className="input mt-1" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} maxLength={200} /></label>
          <label className="block"><span className="text-xs font-medium text-charcoal-600">Περιγραφή</span><textarea className="input mt-1 min-h-[120px]" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
          <div><span className="text-xs font-medium text-charcoal-600">Προτεραιότητα</span>
            <div className="mt-1 flex gap-1.5">
              {(['low', 'normal', 'high'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setForm({ ...form, priority: p })} aria-pressed={form.priority === p}
                  className={`rounded-full border px-3 py-1 text-[13px] ${form.priority === p ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/40'}`}>{PRIORITY[p].label}</button>
              ))}
            </div>
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </ModalBody>
        <ModalFooter>
          <button type="button" className="btn-secondary" onClick={() => setCreating(false)}>Άκυρο</button>
          <button type="button" className="btn-primary" disabled={pending || !form.subject.trim()} onClick={submit}>{pending ? 'Αποστολή…' : 'Αποστολή'}</button>
        </ModalFooter>
      </Modal>

      <Modal open={!!current} onClose={() => setOpenTicket(null)} title={current ? <span data-no-tr>{current.subject}</span> : ''} size="lg"
        description={current ? <span><span>{STATUS[current.status].label}</span> · <span>{PRIORITY[current.priority].label}</span> · {fmt(current.createdAt)}</span> : undefined}>
        {current && (
          <>
            <ModalBody className="space-y-3">
              {current.body && <div className="rounded-xl bg-stone/60 p-3 text-sm text-charcoal whitespace-pre-wrap" data-no-tr>{current.body}</div>}
              {current.replies.map((r) => (
                <div key={r.id} className={`rounded-xl p-3 text-sm ${r.mine ? 'ml-8 bg-forest/[0.07]' : 'mr-8 border border-stone-line bg-white'}`}>
                  <p className="mb-1 text-xs text-charcoal-600/70"><span data-no-tr>{r.author}</span> · {fmt(r.at)}</p>
                  <p className="whitespace-pre-wrap text-charcoal" data-no-tr>{r.body}</p>
                </div>
              ))}
              {current.status !== 'resolved' && (
                <div className="flex items-end gap-2">
                  <textarea className="input min-h-[70px] flex-1" placeholder="Γράψτε απάντηση…" value={reply} onChange={(e) => setReply(e.target.value)} />
                  <button type="button" className="btn-primary inline-flex h-10 items-center gap-1.5" disabled={pending || !reply.trim()} onClick={sendReply}><Send size={14} /> Αποστολή</button>
                </div>
              )}
              {err && <p className="text-sm text-signal-danger">{err}</p>}
            </ModalBody>
            <ModalFooter>
              {isAdmin ? (
                <div className="flex flex-wrap gap-1.5">
                  {(['open', 'in_progress', 'resolved'] as const).map((s) => (
                    <button key={s} type="button" disabled={pending} onClick={() => changeStatus(s)} aria-pressed={current.status === s}
                      className={`rounded-full border px-3 py-1 text-[13px] ${current.status === s ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/40'}`}>{STATUS[s].label}</button>
                  ))}
                </div>
              ) : current.status !== 'resolved' ? (
                <button type="button" className="btn-secondary" disabled={pending} onClick={() => changeStatus('resolved')}>Σήμανση ως λυμένο</button>
              ) : <span />}
              <button type="button" className="btn-secondary" onClick={() => setOpenTicket(null)}>Κλείσιμο</button>
            </ModalFooter>
          </>
        )}
      </Modal>
    </div>
  );
}
