'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle, BarChart3, FileBarChart, Gift, Plus, Search, X, Eye, Trash2, Copy, Send } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { saveCampaign, deleteCampaign, previewAudience } from '@/app/actions/campaigns';
import { STATUS_LABEL, audienceLabel, parseAddresses, type CampaignAudience, type CampaignChannel, type CampaignRow } from '@/lib/campaigns-shared';
import { ROLE_EL, ALL_ROLES } from '@/lib/contacts-hub-shared';
import { formatDate } from '@/lib/format';

export interface PickContact { id: string; name: string; email: string | null; phone: string | null; optIn: boolean }
export interface Prefill { tab?: string; group?: string; tag?: string; role?: string; ids?: string }

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';

/**
 * Marketing (όπως στο FitnessCRM): κάρτες Email · WhatsApp · Πηγές leads ·
 * Αναφορές · Benefits, και από κάτω τα campaigns με «Νέο campaign».
 * Το κοινό είναι οι Ομάδες πελατών, συγκεκριμένοι πελάτες ή γραπτές διευθύνσεις.
 */
export function MarketingHub({ campaigns, groups, contacts, tags, prefill, sources, canEdit }: { campaigns: CampaignRow[]; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[]; prefill: Prefill; sources: React.ReactNode; canEdit: boolean }) {
  const router = useRouter();
  const startTab = prefill.tab === 'whatsapp' || prefill.tab === 'sources' ? prefill.tab : 'email';
  const [tab, setTab] = useState<string>(startTab);
  const wantsNew = !!(prefill.group || prefill.tag || prefill.role || prefill.ids);
  const [dlg, setDlg] = useState<{ row?: CampaignRow; copy?: boolean } | null>(wantsNew ? {} : null);
  const [view, setView] = useState<CampaignRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [per, setPer] = useState(25);
  const [, start] = useTransition();
  const channel: CampaignChannel = tab === 'whatsapp' ? 'whatsapp' : 'email';
  const mine = campaigns.filter((c) => c.channel === channel);
  const list = mine.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase())).slice(0, per);
  const st = (k: CampaignRow['status']) => mine.filter((c) => c.status === k).length;
  const sentMsgs = mine.reduce((n, c) => n + c.sent, 0);
  const failedMsgs = mine.reduce((n, c) => n + c.failed, 0);
  const roleLabel = (r: string) => `Όλοι: ${ROLE_EL[r] ?? r}`;

  const go = (k: string) => {
    if (k === 'reports') { router.push('/reports'); return; }
    if (k === 'benefits') { router.push('/benefits'); return; }
    setTab(k);
  };
  const del = (c: CampaignRow) => {
    if (!confirm(`Διαγραφή του προχείρου «${c.name}»;`)) return;
    start(async () => { const r = await deleteCampaign(c.id); setMsg(r.ok ? { ok: true, text: 'Το πρόχειρο διαγράφηκε.' } : { ok: false, text: r.error }); router.refresh(); });
  };

  return (
    <div className="space-y-5">
      <HubCards cols={3} active={tab} onSelect={go} cards={[
        { key: 'email', icon: Mail, title: 'Email', value: campaigns.filter((c) => c.channel === 'email').length, sub: 'Email campaigns σε ομάδες πελατών' },
        { key: 'whatsapp', icon: MessageCircle, title: 'WhatsApp', value: campaigns.filter((c) => c.channel === 'whatsapp').length, sub: 'Μαζικά μηνύματα WhatsApp' },
        { key: 'sources', icon: BarChart3, title: 'Πηγές leads', value: 'Stats', sub: 'Από πού έρχονται τα leads και πόσα κλείνουν' },
        { key: 'reports', icon: FileBarChart, title: 'Αναφορές', value: 'Stats', sub: 'Όλες οι αναφορές με export' },
        { key: 'benefits', icon: Gift, title: 'Benefits', value: 'Partners', sub: 'Παροχές και εκπτώσεις συνεργατών' },
      ]} />

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {tab === 'sources' && sources}

      {(tab === 'email' || tab === 'whatsapp') && (
        <>
          <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-2 p-4 text-[15px] text-charcoal-600 sm:p-5">
              <span>Εμφάνιση</span>
              <select value={per} onChange={(e) => setPer(Number(e.target.value))} className="input h-9 w-20 py-1 text-sm">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              <span>εγγραφές</span>
              <label className="relative ml-auto min-w-[180px] sm:w-64"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" className="input h-10 pl-9" /></label>
              {canEdit && <button type="button" onClick={() => setDlg({})} className="btn-primary text-sm"><Plus size={15} /> Νέο campaign</button>}
            </div>
            <div className="overflow-x-auto border-t border-stone-line">
              <table className="table-base w-full min-w-[760px]">
                <thead><tr><th>Campaign</th><th>Κατάσταση</th><th>Κοινό</th><th className="text-right">Στάλθηκαν</th><th className="text-right">Απέτυχαν</th><th>Ημερομηνία</th><th className="text-right">Ενέργειες</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td><button type="button" onClick={() => setView(c)} className="font-semibold text-charcoal hover:text-forest hover:underline" data-no-tr>{c.name}</button>{c.subject && <span className="block text-[13px] text-charcoal-600" data-no-tr>{c.subject}</span>}</td>
                      <td><span className={c.status === 'sent' ? 'badge-forest' : 'badge-neutral'}>{STATUS_LABEL[c.status]}</span></td>
                      <td className="text-sm" data-no-tr>{audienceLabel(c.audience, roleLabel)}</td>
                      <td className="text-right tabular-nums">{c.status === 'draft' ? '—' : c.sent}</td>
                      <td className="text-right tabular-nums">{c.status === 'draft' ? '—' : c.failed}</td>
                      <td className="text-sm text-charcoal-600">{formatDate(c.sentAt ?? c.createdAt)}</td>
                      <td>
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => setView(c)} title="Προβολή" aria-label="Προβολή" className={iconBtn}><Eye size={16} /></button>
                          {canEdit && c.status === 'draft' && <button type="button" onClick={() => setDlg({ row: c })} title="Συνέχεια / αποστολή" aria-label="Συνέχεια" className={iconBtn}><Send size={15} /></button>}
                          {canEdit && <button type="button" onClick={() => setDlg({ row: c, copy: true })} title="Αντίγραφο" aria-label="Αντίγραφο" className={iconBtn}><Copy size={15} /></button>}
                          {canEdit && c.status === 'draft' && <button type="button" onClick={() => del(c)} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button>}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-charcoal-600">Δεν υπάρχουν ακόμη campaigns. Δημιουργήστε το πρώτο.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">{mine.length ? `Εμφάνιση 1–${list.length} από ${mine.length}` : 'Καμία εγγραφή'}</div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Stat label="Στάλθηκαν" value={sentMsgs} note="Μηνύματα που έφυγαν σε πελάτες." />
            <Stat label="Απέτυχαν" value={failedMsgs} note="Λάθος διεύθυνση ή πρόβλημα παρόχου." />
            <Stat label="Πρόχειρα" value={st('draft')} note="Αποθηκευμένα, δεν έχουν σταλεί ακόμη." />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Ολοκληρωμένες αποστολές" value={st('sent')} note="Campaigns που στάλθηκαν. Ανοίξτε το καθένα για τα αποτελέσματα." />
            <Stat label="Σύνολο campaigns" value={mine.length} note={`Όλα τα ${channel === 'email' ? 'email' : 'WhatsApp'} campaigns, πρόχειρα και σταλμένα.`} />
          </div>
        </>
      )}

      {dlg && <CampaignDialog channel={dlg.row?.channel ?? channel} row={dlg.row} copy={dlg.copy} groups={groups} contacts={contacts} tags={tags} prefill={dlg.row ? {} : prefill}
        onClose={() => { setDlg(null); if (wantsNew) router.replace('/marketing'); }}
        onDone={(t, ok = true) => { setDlg(null); setMsg({ ok, text: t }); router.replace('/marketing'); router.refresh(); }} />}
      {view && <ViewDialog c={view} roleLabel={roleLabel} onClose={() => setView(null)} />}
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note: string }) {
  return (
    <div className="rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">{label}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums text-charcoal">{value}</p>
      <p className="mt-1 text-[13px] text-charcoal-600">{note}</p>
    </div>
  );
}

type Kind = CampaignAudience['kind'];

function CampaignDialog({ channel: ch0, row, copy, groups, contacts, tags, prefill, onClose, onDone }: { channel: CampaignChannel; row?: CampaignRow; copy?: boolean; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[]; prefill: Prefill; onClose: () => void; onDone: (msg: string, ok?: boolean) => void }) {
  const a0 = row?.audience;
  const preIds = prefill.ids ? prefill.ids.split(',').filter(Boolean) : [];
  const [channel, setChannel] = useState<CampaignChannel>(ch0);
  const [name, setName] = useState(row ? `${row.name}${copy ? ' (αντίγραφο)' : ''}` : '');
  const [kind, setKind] = useState<Kind>(a0?.kind ?? (preIds.length ? 'contacts' : prefill.tag ? 'tag' : prefill.role ? 'role' : 'groups'));
  const [selGroups, setSelGroups] = useState<string[]>(a0?.kind === 'groups' ? a0.groups : prefill.group ? [prefill.group] : []);
  const [ids, setIds] = useState<Set<string>>(new Set(a0?.kind === 'contacts' ? a0.ids : preIds));
  const [addrText, setAddrText] = useState(a0?.kind === 'addresses' ? a0.addresses.join('\n') : '');
  const [tag, setTag] = useState(a0?.kind === 'tag' ? a0.tag : prefill.tag ?? '');
  const [role, setRole] = useState(a0?.kind === 'role' ? a0.role : prefill.role ?? 'buyer');
  const [subject, setSubject] = useState(row?.subject ?? '');
  const [preview, setPreview] = useState(row?.preview ?? '');
  const [body, setBody] = useState(row?.body ?? '');
  const [q, setQ] = useState('');
  const [count, setCount] = useState<{ total: number; reachable: number; noConsent: number; noAddress: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const audience: CampaignAudience | null = kind === 'groups' ? { kind, groups: selGroups } : kind === 'contacts' ? { kind, ids: [...ids] } : kind === 'addresses' ? { kind, addresses: parseAddresses(addrText) } : kind === 'tag' ? { kind, tag } : { kind: 'role', role };
  const key = JSON.stringify([audience, channel]);
  useEffect(() => { setCount(null); const t = setTimeout(() => { void previewAudience(audience, channel).then((r) => { if (r.ok) setCount(r); }); }, 350); return () => clearTimeout(t); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const shown = contacts.filter((c) => !ql || [c.name, c.email ?? '', c.phone ?? ''].join(' ').toLowerCase().includes(ql)).slice(0, 150);
  const flip = (id: string) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const insert = (t: string) => setBody((b) => `${b}${t}`);

  const submit = (send: boolean) => start(async () => {
    setErr(null);
    if (send && !confirm(`Αποστολή σε ${count?.reachable ?? 'όλους τους'} παραλήπτες τώρα;`)) return;
    const r = await saveCampaign({ id: row && !copy ? row.id : undefined, name, channel, audience, subject, preview, body }, send);
    if (!r.ok) { setErr(r.error); return; }
    if (!send) { onDone(`Το «${name}» αποθηκεύτηκε ως πρόχειρο.`); return; }
    if (r.providerMissing) onDone(`Το «${name}» καταγράφηκε για ${r.queued ?? 0} παραλήπτες, αλλά δεν έχει συνδεθεί πάροχος ${channel === 'email' ? 'email (Resend / Postmark)' : 'WhatsApp'} — δεν στάλθηκε πραγματικά.`, false);
    else onDone(`Το «${name}» στάλθηκε: ${r.sent ?? 0} επιτυχίες${r.failed ? `, ${r.failed} αποτυχίες` : ''}.`);
  });

  const KINDS: [Kind, string][] = [['groups', 'Ομάδα πελατών'], ['contacts', 'Συγκεκριμένοι πελάτες'], ['tag', 'Tag'], ['role', 'Ιδιότητα'], ['addresses', channel === 'email' ? 'Γραπτές διευθύνσεις' : 'Γραπτά τηλέφωνα']];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">Νέο <em className="text-forest">{channel === 'email' ? 'email campaign' : 'WhatsApp campaign'}</em></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button></div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Βασικά</p>
          <label className="block"><span className={lbl}>Όνομα campaign *</span><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Νέο έργο Λεμεσός — προπώληση" /></label>
          <div className="flex flex-wrap gap-2">
            {(['email', 'whatsapp'] as const).map((c) => <button key={c} type="button" onClick={() => setChannel(c)} className={`rounded-full border px-3 py-1 text-sm ${channel === c ? 'border-forest/40 bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal'}`}>{c === 'email' ? 'Email' : 'WhatsApp'}</button>)}
          </div>
          <div>
            <span className={lbl}>Κοινό *</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="input w-auto text-sm">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="mt-2">
              {kind === 'groups' && (groups.length ? (
                <div className="flex flex-wrap gap-1.5">{groups.map((g) => { const on = selGroups.includes(g.name); return <button key={g.name} type="button" onClick={() => setSelGroups((x) => (on ? x.filter((y) => y !== g.name) : [...x, g.name]))} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-forest/40 bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal'}`} data-no-tr>{g.name} <span className="text-charcoal-600">· {g.n}</span></button>; })}</div>
              ) : <p className="text-sm text-charcoal-600">Δεν υπάρχουν ομάδες. Φτιάξτε μία στους Πελάτες → Ομάδες.</p>)}
              {kind === 'contacts' && (
                <div>
                  <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση πελάτη…" className="input pl-9" /></label>
                  <div className="mt-2 max-h-56 divide-y divide-stone-line overflow-y-auto rounded-xl border border-stone-line">
                    {shown.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
                        <input type="checkbox" checked={ids.has(c.id)} onChange={() => flip(c.id)} />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-charcoal" data-no-tr>{c.name}</span><span className="block truncate text-[12px] text-charcoal-600" data-no-tr>{channel === 'email' ? c.email ?? 'χωρίς email' : c.phone ?? 'χωρίς τηλέφωνο'}</span></span>
                        {!c.optIn && <span className="text-[12px] text-charcoal-600">χωρίς συγκατάθεση</span>}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] text-charcoal-600">{ids.size} επιλεγμένοι</p>
                </div>
              )}
              {kind === 'tag' && <select value={tag} onChange={(e) => setTag(e.target.value)} className="input text-sm"><option value="">Διαλέξτε tag…</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
              {kind === 'role' && <select value={role} onChange={(e) => setRole(e.target.value)} className="input text-sm">{ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_EL[r]}</option>)}</select>}
              {kind === 'addresses' && <textarea value={addrText} onChange={(e) => setAddrText(e.target.value)} className="input min-h-[90px] text-sm" placeholder={channel === 'email' ? 'ένα email ανά γραμμή ή με κόμμα' : 'ένα τηλέφωνο ανά γραμμή, με κωδικό χώρας (+357…)'} />}
            </div>
            <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600">
              {count === null ? 'Υπολογισμός παραληπτών…' : kind === 'addresses' ? `${count.reachable} έγκυρες διευθύνσεις.` : <>Θα το λάβουν <b className="text-charcoal">{count.reachable}</b> από {count.total}{count.noConsent ? ` · ${count.noConsent} χωρίς συγκατάθεση marketing (GDPR)` : ''}{count.noAddress ? ` · ${count.noAddress} χωρίς ${channel === 'email' ? 'email' : 'τηλέφωνο'}` : ''}.</>}
            </p>
          </div>

          <p className="pt-2 text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Μήνυμα</p>
          {channel === 'email' && <>
            <label className="block"><span className={lbl}>Θέμα</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="block"><span className={lbl}>Κείμενο προεπισκόπησης</span><input className="input" value={preview} onChange={(e) => setPreview(e.target.value)} /></label>
          </>}
          <div>
            <div className="mb-1 flex items-center justify-between"><span className={lbl}>Μήνυμα *</span>
              <span className="flex gap-1 text-[12px]"><button type="button" onClick={() => insert('{{first_name}}')} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ Μικρό όνομα</button><button type="button" onClick={() => insert('{{name}}')} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ Ονοματεπώνυμο</button></span></div>
            <textarea className="input min-h-[180px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Αγαπητέ/ή {{first_name}},\n\n…'} />
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-line px-6 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button>
          <button type="button" className="rounded-full border border-stone-line px-4 py-2 text-sm font-medium text-charcoal hover:border-forest/40" disabled={pending || !name.trim()} onClick={() => submit(false)}>Αποθήκευση προχείρου</button>
          <button type="button" className="btn-primary" disabled={pending || !name.trim() || !body.trim() || !count?.reachable} onClick={() => submit(true)}>{pending ? 'Αποστολή…' : 'Δημιουργία & αποστολή'}</button>
        </div>
      </div>
    </div>
  );
}

function ViewDialog({ c, roleLabel, onClose }: { c: CampaignRow; roleLabel: (r: string) => string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-xl" data-no-tr>{c.name}</h3><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="space-y-3 px-6 py-5 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Κατάσταση', STATUS_LABEL[c.status]], ['Παραλήπτες', c.recipients], ['Στάλθηκαν', c.sent], ['Απέτυχαν', c.failed]].map(([l, v]) => <div key={String(l)} className="rounded-xl border border-stone-line p-3"><p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">{l}</p><p className="text-lg font-semibold text-charcoal">{v}</p></div>)}
          </div>
          <p><span className="text-charcoal-600">Κοινό:</span> <span data-no-tr>{audienceLabel(c.audience, roleLabel)}</span>{c.skipped ? ` · ${c.skipped} παραλείφθηκαν (χωρίς συγκατάθεση ή διεύθυνση)` : ''}</p>
          {c.subject && <p><span className="text-charcoal-600">Θέμα:</span> <span data-no-tr>{c.subject}</span></p>}
          <div className="whitespace-pre-wrap rounded-xl border border-stone-line bg-stone-50 p-4 text-charcoal" data-no-tr>{c.body || '—'}</div>
          <p className="text-[13px] text-charcoal-600">{c.sentAt ? `Στάλθηκε ${formatDate(c.sentAt)}` : `Δημιουργήθηκε ${formatDate(c.createdAt)}`}</p>
        </div>
      </div>
    </div>
  );
}
