'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, Plus, History } from 'lucide-react';
import { convertContact, createLeadForContact, updateContactProfile } from '@/app/actions/contacts-hub';
import {
  ALL_ROLES, CONTACT_STATUSES, ROLE_EL, SOURCE_EL, STATUS_EL, eventText, suggestedConversions,
  type ContactEvent, type ContactRole, type ContactStatus,
} from '@/lib/contacts-hub-shared';
import { LEAD_SOURCES } from '@/lib/lead-automation-shared';
import { formatDateTime } from '@/lib/format';

interface Staff { id: string; name: string }

/** Καρτέλα επαφής → Ιδιότητες, κατάσταση, υπεύθυνος, μετατροπές, νέο lead. */
export function ContactRolesPanel({ contactId, roles: initialRoles, status: initialStatus, ownerId: initialOwner, staff, canEdit }: {
  contactId: string; roles: ContactRole[]; status: ContactStatus; ownerId: string | null; staff: Staff[]; canEdit: boolean;
}) {
  const router = useRouter();
  const [roles, setRoles] = useState(initialRoles);
  const [status, setStatus] = useState(initialStatus);
  const [owner, setOwner] = useState(initialOwner ?? '');
  const [conv, setConv] = useState<{ from: ContactRole | null; to: ContactRole; label: string } | null>(null);
  const [note, setNote] = useState('');
  const [leadSrc, setLeadSrc] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (f: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => {
    const r = await f();
    setMsg(r.ok ? { ok: true, text: ok } : { ok: false, text: (r as any).error ?? 'Αποτυχία.' });
    if (r.ok) router.refresh();
  });

  const flip = (r: ContactRole) => {
    const next = roles.includes(r) ? roles.filter((x) => x !== r) : [...roles, r];
    setRoles(next);
    run(() => updateContactProfile(contactId, { roles: next }), roles.includes(r) ? `Αφαιρέθηκε: ${ROLE_EL[r]}` : `Προστέθηκε: ${ROLE_EL[r]}`);
  };

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between"><h4>Ιδιότητες & κατάσταση</h4>{pending && <span className="text-xs text-charcoal-600/60">Αποθήκευση…</span>}</div>
      <div className="flex flex-wrap gap-1.5">
        {ALL_ROLES.map((r) => (
          <button key={r} type="button" disabled={!canEdit || pending} onClick={() => flip(r)}
            className={`rounded-full border px-3 py-1 text-xs ${roles.includes(r) ? 'border-forest bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal-600/70 hover:border-forest/40'}`}>
            {roles.includes(r) && <Check size={11} className="mr-1 inline" />}{ROLE_EL[r]}
          </button>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="eyebrow mb-1 block">Κατάσταση</span>
          <select className="input text-sm" disabled={!canEdit} value={status} onChange={(e) => { const v = e.target.value as ContactStatus; setStatus(v); run(() => updateContactProfile(contactId, { status: v }), `Κατάσταση: ${STATUS_EL[v]}`); }}>
            {CONTACT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_EL[s]}</option>)}
          </select></label>
        <label className="block"><span className="eyebrow mb-1 block">Υπεύθυνος (μεταφορά)</span>
          <select className="input text-sm" disabled={!canEdit} value={owner} onChange={(e) => { const v = e.target.value; setOwner(v); run(() => updateContactProfile(contactId, { ownerId: v || null }), v ? `Ανατέθηκε σε ${staff.find((s) => s.id === v)?.name}` : 'Χωρίς υπεύθυνο'); }}>
            <option value="">Κανένας</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select></label>
      </div>

      {canEdit && (
        <div className="space-y-2 border-t border-stone-line pt-3">
          <p className="eyebrow">Μετατροπή</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestedConversions(roles).map((c) => (
              <button key={c.label} type="button" onClick={() => { setConv(c); setNote(''); }} className={`btn-secondary px-2.5 py-1 text-xs ${conv?.label === c.label ? 'ring-2 ring-forest/30' : ''}`}><ArrowRight size={12} /> {c.label}</button>
            ))}
          </div>
          {conv && (
            <div className="space-y-2 rounded-lg bg-sand-50 p-3">
              <input className="input text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Σημείωση (προαιρετικό) — π.χ. υπέγραψε κράτηση για Α12" />
              <div className="flex gap-2">
                <button type="button" disabled={pending} className="btn-primary px-3 py-1.5 text-xs" onClick={() => { const c = conv; setConv(null); setRoles((r) => [...r.filter((x) => x !== c.from && x !== c.to), c.to]); run(() => convertContact(contactId, c.from, c.to, note), `${c.label} ✓`); }}>Επιβεβαίωση</button>
                <button type="button" className="btn-ghost text-xs" onClick={() => setConv(null)}>Άκυρο</button>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <select className="input w-auto py-1 text-xs" value={leadSrc} onChange={(e) => setLeadSrc(e.target.value)}>
              <option value="">Πηγή νέου lead…</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_EL[s]}</option>)}
            </select>
            <button type="button" disabled={pending} className="btn-ghost text-xs" onClick={() => run(() => createLeadForContact(contactId, leadSrc || 'other'), 'Άνοιξε νέο lead στο Pipeline.')}><Plus size={12} /> Νέο lead για την επαφή</button>
          </div>
        </div>
      )}
      {msg && <p className={`text-xs ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</p>}
    </div>
  );
}

/** Πλήρες ιστορικό της επαφής (αλλαγές, μετατροπές, leads), νεότερα πρώτα. */
export function ContactHistory({ events, names }: { events: ContactEvent[]; names: Record<string, string> }) {
  const [all, setAll] = useState(false);
  const list = all ? events : events.slice(0, 8);
  return (
    <div className="panel p-5">
      <h4 className="mb-3 flex items-center gap-2"><History size={15} /> Ιστορικό επαφής</h4>
      {events.length === 0 ? <p className="text-sm text-charcoal-600/60">Δεν υπάρχουν ακόμα αλλαγές.</p> : (
        <ol className="relative space-y-3 border-l border-stone-line pl-4">
          {list.map((e) => (
            <li key={e.id} className="text-sm">
              <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-forest/60" />
              <p className="text-charcoal">{eventText(e, names)}</p>
              {e.note && <p className="text-xs text-charcoal-600/80">«{e.note}»</p>}
              <p className="text-[11px] text-charcoal-600/60">{formatDateTime(e.at)}{e.actor ? ` · ${e.actor}` : ''}</p>
            </li>
          ))}
        </ol>
      )}
      {events.length > 8 && <button type="button" className="btn-ghost mt-2 text-xs" onClick={() => setAll((x) => !x)}>{all ? 'Λιγότερα' : `Όλο το ιστορικό (${events.length})`}</button>}
    </div>
  );
}
