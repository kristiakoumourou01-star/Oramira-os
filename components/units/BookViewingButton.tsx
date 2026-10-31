'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, X } from 'lucide-react';
import { bookUnitViewing } from '@/app/actions/unit-page';

export interface ViewingContactOption { contactId: string; leadId: string | null; label: string }

/** «Κλείσε προβολή» — pick the client (matching buyers first), the time and the agent. */
export function BookViewingButton({ unitId, projectId, contacts, agents, defaultAgent, preset }: {
  unitId: string; projectId: string; contacts: ViewingContactOption[]; agents: { id: string; name: string }[]; defaultAgent: string | null; preset?: ViewingContactOption | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState(preset?.label ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('11:00');
  const [agent, setAgent] = useState(defaultAgent ?? '');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const chosen = useMemo(() => contacts.find((c) => c.label === q) ?? (preset && preset.label === q ? preset : null), [q, contacts, preset]);

  const submit = () => {
    setErr(null);
    if (!chosen) { setErr('Διαλέξτε πελάτη από τη λίστα.'); return; }
    if (!date || !time) { setErr('Διαλέξτε ημερομηνία και ώρα.'); return; }
    // Cyprus local time → ISO (the server stores UTC).
    const local = new Date(`${date}T${time}:00`);
    start(async () => {
      const r = await bookUnitViewing({ unitId, projectId, contactId: chosen.contactId, leadId: chosen.leadId, agentId: agent || null, scheduledAt: local.toISOString(), notes });
      if (r.ok) { setDone(true); router.refresh(); } else setErr(r.error);
    });
  };

  return (
    <>
      <button type="button" onClick={() => { setOpen(true); setDone(false); }} className="btn-primary"><CalendarPlus size={15} /> Κλείσε προβολή</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="panel w-full max-w-md space-y-3 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between"><h4>Νέα προβολή</h4><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div>
            {done ? (
              <>
                <p className="text-sm text-signal-success">Η προβολή κλείστηκε. Ο πελάτης παίρνει επιβεβαίωση με WhatsApp και email, και μπαίνει στο ημερολόγιο.</p>
                <button type="button" onClick={() => setOpen(false)} className="btn-primary w-full justify-center">Τέλος</button>
              </>
            ) : (
              <>
                <label className="block"><span className="eyebrow mb-1 block">Πελάτης</span>
                  <input className="input" list="bv-contacts" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Όνομα ή email…" autoFocus />
                  <datalist id="bv-contacts">{contacts.map((c) => <option key={c.contactId + (c.leadId ?? '')} value={c.label} />)}</datalist>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="eyebrow mb-1 block">Ημερομηνία</span><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
                  <label className="block"><span className="eyebrow mb-1 block">Ώρα</span><input className="input" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></label>
                </div>
                <label className="block"><span className="eyebrow mb-1 block">Πωλητής</span>
                  <select className="input" value={agent} onChange={(e) => setAgent(e.target.value)}>
                    <option value="">Εγώ</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </label>
                <label className="block"><span className="eyebrow mb-1 block">Σημείωση</span><input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="π.χ. έρχεται με τη σύζυγο" /></label>
                {err && <p className="text-sm text-signal-danger">{err}</p>}
                <button type="button" disabled={pending} onClick={submit} className="btn-primary w-full justify-center">{pending ? 'Κλείσιμο…' : 'Κλείσε προβολή'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
