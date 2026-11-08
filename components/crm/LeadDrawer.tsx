'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { X, Maximize2, Phone, Mail, MessageCircle, Save, StickyNote, CalendarClock, Check, AlarmClock, Plus, Trash2 } from 'lucide-react';
import { getLeadQuick, saveLeadQuick, type LeadQuick } from '@/app/actions/lead-quick';
import { addNote, reassignLead } from '@/app/actions/leads';
import { StatusPipeline } from '@/components/crm/StatusPipeline';
import { formatDate, formatDateTime } from '@/lib/format';
import { addFollowUp, updateFollowUp } from '@/app/actions/follow-ups';
import { CompletePanel } from '@/components/crm/CompletePanel';
import { DeleteLeadDialog } from '@/components/crm/DeleteLeadDialog';
import { NEXT_PRESETS, snoozeTo, toLocalInput } from '@/lib/follow-ups-shared';
import { PhoneInput } from '@/components/ui/PhoneInput';

interface Agent { id: string; full_name: string | null }

/**
 * Πλαϊνό παράθυρο (μισή σελίδα) για ένα lead: στάδιο, υπεύθυνος, στοιχεία,
 * budget, επόμενη ενέργεια, σημειώσεις — χωρίς να ανοίξει το πλήρες προφίλ.
 */
export function LeadDrawer({ leadId, agents, onClose }: { leadId: string; agents: Agent[]; onClose: () => void }) {
  const router = useRouter();
  const [lead, setLead] = useState<LeadQuick | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [askDelete, setAskDelete] = useState(false);

  const load = () => getLeadQuick(leadId).then((r) => {
    if (!r.ok) { setErr(r.error); return; }
    setLead(r.lead);
    setForm({
      name: r.lead.contact.name, email: r.lead.contact.email ?? '', phone: r.lead.contact.phone ?? '',
      budgetMin: r.lead.budgetMin?.toString() ?? '', budgetMax: r.lead.budgetMax?.toString() ?? '', timeline: r.lead.timeline ?? '',
      nextActionDate: r.lead.nextActionDate ?? '', nextActionType: r.lead.nextActionType ?? '',
    });
  });
  useEffect(() => { setLead(null); setErr(null); setMsg(null); void load(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setForm((f) => ({ ...f, [k]: e.target.value })); setMsg(null); };
  const save = () => start(async () => {
    const r = await saveLeadQuick(leadId, {
      name: form.name, email: form.email, phone: form.phone,
      budgetMin: form.budgetMin === '' ? null : Number(form.budgetMin), budgetMax: form.budgetMax === '' ? null : Number(form.budgetMax),
      timeline: form.timeline, nextActionDate: form.nextActionDate || null, nextActionType: form.nextActionType || null,
    });
    setMsg(r.ok ? { ok: true, text: 'Αποθηκεύτηκε.' } : { ok: false, text: r.error });
    if (r.ok) { router.refresh(); void load(); }
  });
  const addN = () => start(async () => { if (!note.trim()) return; await addNote('lead', leadId, note.trim()); setNote(''); void load(); });
  const assign = (id: string) => start(async () => { if (id) { await reassignLead(leadId, id); router.refresh(); void load(); } });
  const tel = (form.phone ?? '').replace(/[^\d+]/g, '');

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Lead">
      <button type="button" aria-label="Κλείσιμο" className="absolute inset-0 bg-charcoal/30 ws-fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full flex-col bg-stone shadow-overlay sm:w-[min(760px,55vw)] ws-pop">
        <header className="flex items-start justify-between gap-3 border-b border-stone-line bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow">Lead{lead?.project ? ` · ${lead.project}` : ''}</p>
            <h3 className="truncate text-xl text-charcoal">{lead?.contact.name ?? '…'}</h3>
            {lead && <p className="text-xs text-charcoal-600/70">Από {formatDate(lead.createdAt)}{lead.source ? ` · ${lead.source}` : ''}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {tel && <a href={`tel:${tel}`} className="btn-ghost p-2" title="Κλήση"><Phone size={15} /></a>}
            {tel && <a href={`https://wa.me/${tel.replace('+', '')}`} target="_blank" rel="noreferrer" className="btn-ghost p-2" title="WhatsApp"><MessageCircle size={15} /></a>}
            {form.email && <a href={`mailto:${form.email}`} className="btn-ghost p-2" title="Email"><Mail size={15} /></a>}
            {lead && <button type="button" onClick={() => setAskDelete(true)} className="btn-ghost p-2 text-charcoal-600/60 hover:text-signal-danger" title="Διαγραφή lead"><Trash2 size={15} /></button>}
            <Link href={`/crm/leads/${leadId}`} className="btn-secondary px-3 py-1.5 text-xs" title="Πλήρες προφίλ"><Maximize2 size={13} /> Πλήρες προφίλ</Link>
            <button type="button" onClick={onClose} className="btn-ghost p-2" aria-label="Κλείσιμο"><X size={17} /></button>
          </div>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          {err && <p className="text-sm text-signal-danger">{err}</p>}
          {!lead && !err && <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-white/70" />)}</div>}
          {lead && (
            <>
              <section className="panel p-4">
                <StatusPipeline key={`${lead.status}-${lead.stage}`} leadId={lead.id} currentStatus={lead.status} currentStage={lead.stage} pipeline={lead.pipeline} lostReasons={lead.lostReasons}
                  stageEnteredAt={lead.stageEnteredAt} lostReason={lead.lostReason} lostNote={lead.lostNote} commissionInvoiceId={lead.commissionInvoiceId} onChange={() => void load()} />
              </section>

              <NextMoves leadId={leadId} items={lead.followUps} onChange={() => { router.refresh(); void load(); }} />

              <section className="panel grid gap-3 p-4 sm:grid-cols-2">
                <Field label="Ονοματεπώνυμο"><input className="input text-sm" value={form.name ?? ''} onChange={set('name')} /></Field>
                <Field label="Υπεύθυνος">
                  <select className="input text-sm" value={lead.ownerId ?? ''} disabled={pending} onChange={(e) => assign(e.target.value)}>
                    <option value="">Χωρίς υπεύθυνο</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? '—'}</option>)}
                  </select>
                </Field>
                <Field label="Τηλέφωνο"><PhoneInput value={form.phone ?? ''} onChange={(v) => { setForm((f) => ({ ...f, phone: v })); setMsg(null); }} /></Field>
                <Field label="Email"><input className="input text-sm" type="email" value={form.email ?? ''} onChange={set('email')} /></Field>
                <Field label="Budget από (€)"><input className="input text-sm" type="number" min={0} value={form.budgetMin ?? ''} onChange={set('budgetMin')} /></Field>
                <Field label="Budget έως (€)"><input className="input text-sm" type="number" min={0} value={form.budgetMax ?? ''} onChange={set('budgetMax')} /></Field>
                <Field label="Πότε θέλει να αγοράσει"><input className="input text-sm" value={form.timeline ?? ''} onChange={set('timeline')} placeholder="π.χ. σε 3 μήνες" /></Field>
                <Field label="Επόμενη ενέργεια">
                  <div className="flex gap-2">
                    <input className="input text-sm" type="date" value={form.nextActionDate ?? ''} onChange={set('nextActionDate')} />
                    <select className="input w-32 text-sm" value={form.nextActionType ?? ''} onChange={set('nextActionType')}>
                      <option value="">—</option><option value="call">Κλήση</option><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="meeting">Συνάντηση</option><option value="viewing">Ξενάγηση</option>
                    </select>
                  </div>
                </Field>
                <div className="flex items-center gap-3 sm:col-span-2">
                  <button type="button" disabled={pending} onClick={save} className="btn-primary text-sm"><Save size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
                  {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
                </div>
              </section>

              {lead.message && <section className="panel p-4 text-sm"><p className="eyebrow mb-1">Μήνυμα πελάτη</p><p className="whitespace-pre-line text-charcoal-600">{lead.message}</p></section>}

              <section className="panel space-y-3 p-4">
                <p className="eyebrow flex items-center gap-1"><StickyNote size={12} /> Σημειώσεις</p>
                <div className="flex gap-2">
                  <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Γράψτε σημείωση…" onKeyDown={(e) => { if (e.key === 'Enter') addN(); }} />
                  <button type="button" disabled={pending || !note.trim()} onClick={addN} className="btn-secondary px-3 text-xs">Προσθήκη</button>
                </div>
                <ul className="space-y-2 text-sm">
                  {lead.notes.map((n) => <li key={n.id}><p className="whitespace-pre-line text-charcoal">{n.body}</p><p className="text-[11px] text-charcoal-600/60">{formatDateTime(n.at)}{n.author ? ` · ${n.author}` : ''}</p></li>)}
                  {lead.notes.length === 0 && <li className="text-xs text-charcoal-600/60">Καμία σημείωση ακόμα.</li>}
                </ul>
              </section>

              {lead.comms.length > 0 && (
                <section className="panel p-4">
                  <p className="eyebrow mb-2">Τελευταία επικοινωνία</p>
                  <ul className="space-y-1.5 text-sm">{lead.comms.map((m) => <li key={m.id} className="flex justify-between gap-3"><span className="truncate">{m.direction === 'inbound' ? '←' : '→'} {m.channel} · {m.summary ?? ''}</span><span className="shrink-0 text-xs text-charcoal-600/60">{formatDateTime(m.at)}</span></li>)}</ul>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
      {askDelete && lead && <DeleteLeadDialog ids={[leadId]} names={[lead.contact.name]} onClose={() => setAskDelete(false)} onDeleted={onClose} />}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="eyebrow mb-1 block">{label}</span>{children}</label>;
}

/** Επόμενες κινήσεις: λίστα ανοιχτών follow-ups με «έγινε», αναβολή και νέα κίνηση. */
function NextMoves({ leadId, items, onChange }: { leadId: string; items: { id: string; dueAt: string; note: string | null }[]; onChange: () => void }) {
  const [pending, start] = useTransition();
  const [askDelete, setAskDelete] = useState(false);
  const [doing, setDoing] = useState<string | null>(null);
  const [note, setNote] = useState('Κλήση');
  const [at, setAt] = useState(toLocalInput(snoozeTo('tomorrow')));
  const [err, setErr] = useState<string | null>(null);
  const now = Date.now();
  const add = () => start(async () => {
    const r = await addFollowUp(leadId, new Date(at).toISOString(), note);
    if (!r.ok) { setErr(r.error); return; }
    setErr(null); setNote('Κλήση'); setAt(toLocalInput(snoozeTo('tomorrow'))); onChange();
  });
  const postpone = (id: string, iso: string) => start(async () => { const r = await updateFollowUp(id, { dueAt: iso }); if (r.ok) onChange(); else setErr(r.error); });

  return (
    <section className="panel space-y-3 p-4">
      <p className="eyebrow flex items-center gap-1"><CalendarClock size={12} /> Επόμενες κινήσεις</p>
      <ul className="space-y-1.5">
        {items.map((f) => (
          <li key={f.id}>
            <div className="flex items-center gap-2 text-sm">
              <button type="button" title="Έγινε" onClick={() => setDoing(doing === f.id ? null : f.id)}
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border ${doing === f.id ? 'border-forest bg-forest text-white' : 'border-stone-line text-transparent hover:border-forest hover:text-forest'}`}><Check size={11} /></button>
              <span className="min-w-0 flex-1 truncate">{f.note ?? 'Follow-up'}</span>
              <span className={`shrink-0 text-xs ${Date.parse(f.dueAt) < now ? 'text-signal-danger' : 'text-charcoal-600/70'}`}>{formatDateTime(f.dueAt)}</span>
              <button type="button" disabled={pending} onClick={() => postpone(f.id, snoozeTo('tomorrow'))} className="btn-ghost p-1 text-xs" title="Αναβολή για αύριο"><AlarmClock size={13} /></button>
            </div>
            {doing === f.id && <div className="mt-2"><CompletePanel inline r={{ id: f.id }} onCancel={() => setDoing(null)} onDone={() => { setDoing(null); onChange(); }} /></div>}
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-charcoal-600/60">Δεν υπάρχει προγραμματισμένη κίνηση.</li>}
      </ul>
      <div className="space-y-2 border-t border-stone-line pt-3">
        <div className="flex flex-wrap gap-1">
          {NEXT_PRESETS.map((p) => <button key={p} type="button" onClick={() => setNote(p)} className={`rounded-full border px-2.5 py-0.5 text-xs ${note === p ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal-600 hover:border-forest'}`}>{p}</button>)}
        </div>
        <div className="flex flex-wrap gap-2">
          <input className="input min-w-[9rem] flex-1 text-sm" value={note} onChange={(e) => setNote(e.target.value)} />
          <input type="datetime-local" className="input w-auto text-sm" value={at} onChange={(e) => setAt(e.target.value)} />
          <button type="button" disabled={pending || !at} onClick={add} className="btn-secondary px-3 text-xs"><Plus size={13} /> Προσθήκη</button>
        </div>
        {err && <p className="text-xs text-signal-danger">{err}</p>}
      </div>
    </section>
  );
}
