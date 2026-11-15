'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Download, Search, X, Users, UserX, Clock, Check, CalendarDays } from 'lucide-react';
import { createContact, bulkUpdateContacts, updateContactBasics, deleteContact } from '@/app/actions/contacts-hub';
import { Eye, Pencil, Trash2 } from 'lucide-react';
import {
  ALL_ROLES, CONTACT_STATUSES, DEFAULT_FILTERS, ROLE_EL, ROLE_TONE, SOURCE_EL, STATUS_EL, STATUS_TONE,
  contactsCsv, filterContacts, roleCounts, type ContactFilters, type ContactListRow, type ContactRole, type ContactStatus,
} from '@/lib/contacts-hub-shared';
import { LEAD_SOURCES } from '@/lib/lead-automation-shared';
import { LANGUAGES } from '@/lib/kyc-shared';
import { formatCurrency, formatDate } from '@/lib/format';
import { PhoneInput } from '@/components/ui/PhoneInput';

interface Staff { id: string; name: string }
const PAGE = 100;

/**
 * Πελάτες → Όλες οι επαφές: όλοι οι άνθρωποι σε μία λίστα, με ιδιότητες
 * (lead, αγοραστής, επενδυτής…), κατάσταση, υπεύθυνο, φίλτρα, μαζικές αλλαγές,
 * εξαγωγή και καταχώριση νέας επαφής.
 */
export function ContactsHub({ rows, staff, initialRole = '', canCreate, canEdit }: { rows: ContactListRow[]; staff: Staff[]; initialRole?: ContactRole | ''; canCreate: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<ContactFilters>({ ...DEFAULT_FILTERS, role: initialRole });
  const [shown, setShown] = useState(PAGE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [editRow, setEditRow] = useState<ContactListRow | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const remove = (r: ContactListRow) => {
    if (!confirm(`Διαγραφή της επαφής «${r.name}»;\n\nΑν συνδέεται με deals, κρατήσεις ή συμβόλαια, θα αρχειοθετηθεί αντί να διαγραφεί, για να μη χαθεί το ιστορικό.`)) return;
    start(async () => {
      const res = await deleteContact(r.id);
      if (!res.ok) { setMsg({ ok: false, text: res.error }); return; }
      setGone((g) => new Set(g).add(r.id));
      setMsg({ ok: true, text: res.archived ? `Η «${r.name}» αρχειοθετήθηκε (έχει συνδεδεμένα στοιχεία).` : `Η «${r.name}» διαγράφηκε.` });
      router.refresh();
    });
  };
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<ContactFilters>) => { setF((x) => ({ ...x, ...p })); setShown(PAGE); setSel(new Set()); };

  const list = useMemo(() => filterContacts(rows, f), [rows, f]);
  const counts = useMemo(() => roleCounts(rows), [rows]);
  const tags = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.tags))).sort(), [rows]);
  const groups = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.groups))).sort(), [rows]);
  const now = Date.now();
  const quiet = rows.filter((r) => r.status === 'active' && now - Date.parse(r.lastContactAt ?? r.createdAt) > 30 * 86_400_000).length;
  const noOwner = rows.filter((r) => r.status !== 'archived' && !r.ownerId).length;
  const active = rows.filter((r) => r.status === 'active').length;
  const filtered = JSON.stringify({ ...f, role: '' }) !== JSON.stringify({ ...DEFAULT_FILTERS, role: '' });

  const exportCsv = () => {
    const blob = new Blob([contactsCsv(list)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `epafes-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };
  const bulk = (op: Parameters<typeof bulkUpdateContacts>[1]) => start(async () => {
    const r = await bulkUpdateContacts([...sel], op);
    setMsg(r.ok ? { ok: true, text: `Ενημερώθηκαν ${r.updated} επαφές.` } : { ok: false, text: r.error });
    if (r.ok) { setSel(new Set()); router.refresh(); }
  });
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const page = list.slice(0, shown);
  const allOnPage = page.length > 0 && page.every((r) => sel.has(r.id));

  const Kpi = ({ icon: Icon, label, value, onClick, on }: { icon: any; label: string; value: number; onClick?: () => void; on?: boolean }) => (
    <button type="button" onClick={onClick} className={`panel flex items-center gap-3 p-4 text-left transition ${on ? 'ring-2 ring-forest/40' : 'hover:ring-1 hover:ring-forest/20'}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest/[0.07] text-forest"><Icon size={16} /></span>
      <span><span className="eyebrow block">{label}</span><span className="figure text-xl text-charcoal">{value}</span></span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={!f.role} onClick={() => set({ role: '' })}>Όλες <b>{counts.all ?? 0}</b></Chip>
          {ALL_ROLES.filter((r) => ['lead', 'buyer', 'investor', 'homeowner'].includes(r) || counts[r] || f.role === r).map((r) => (
            <Chip key={r} on={f.role === r} onClick={() => set({ role: f.role === r ? '' : r })}>{ROLE_EL[r]} <b>{counts[r] ?? 0}</b></Chip>
          ))}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={exportCsv} className="btn-ghost text-sm"><Download size={14} /> Export ({list.length})</button>
          {canCreate && <button type="button" onClick={() => setAdding(true)} className="btn-primary text-sm"><Plus size={14} /> Νέα επαφή</button>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi icon={Users} label="Ενεργές επαφές" value={active} onClick={() => set({ status: f.status === 'active' ? '' : 'active' })} on={f.status === 'active'} />
        <Kpi icon={Clock} label="Χωρίς επαφή 30+ μέρες" value={quiet} onClick={() => set({ quietDays: f.quietDays ? 0 : 30, status: f.quietDays ? f.status : 'active' })} on={f.quietDays > 0} />
        <Kpi icon={UserX} label="Χωρίς υπεύθυνο" value={noOwner} onClick={() => set({ owner: f.owner === 'none' ? '' : 'none' })} on={f.owner === 'none'} />
      </div>

      <div className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <label className="relative sm:col-span-2">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Όνομα, email, τηλέφωνο, tag…" className="input pl-8" />
        </label>
        <Sel value={f.status} onChange={(v) => set({ status: v as ContactFilters['status'] })} options={[['', 'Κατάσταση: όλες ενεργές'], ['all', 'Και αρχειοθετημένες'], ...CONTACT_STATUSES.map((s) => [s, STATUS_EL[s]] as [string, string])]} />
        <Sel value={f.owner} onChange={(v) => set({ owner: v })} options={[['', 'Υπεύθυνος: όλοι'], ['none', 'Χωρίς υπεύθυνο'], ...staff.map((s) => [s.id, s.name] as [string, string])]} />
        <Sel value={f.source} onChange={(v) => set({ source: v })} options={[['', 'Πηγή: όλες'], ...[...LEAD_SOURCES, 'manual'].map((s) => [s, SOURCE_EL[s] ?? s] as [string, string])]} />
        <Sel value={f.tag} onChange={(v) => set({ tag: v })} options={[['', 'Tag: όλα'], ...tags.map((t) => [t, t] as [string, string])]} />
        <Sel value={f.sort} onChange={(v) => set({ sort: v as ContactFilters['sort'] })} options={[['recent', 'Νεότερες πρώτα'], ['name', 'Αλφαβητικά'], ['last_contact', 'Παλαιότερη επαφή πρώτα'], ['value', 'Μεγαλύτερη αξία']]} />
        <div className="flex items-center gap-1.5 sm:col-span-2">
          <CalendarDays size={15} className="shrink-0 text-charcoal-600/60" />
          <select value={f.dateField} onChange={(e) => set({ dateField: e.target.value as ContactFilters['dateField'] })} className="input w-auto text-sm" aria-label="Ημερομηνία"><option value="created">Καταχώριση</option><option value="last_contact">Τελευταία επαφή</option></select>
          <input type="date" value={f.dateFrom} max={f.dateTo || undefined} onChange={(e) => set({ dateFrom: e.target.value })} className="input min-w-0 flex-1 text-sm" aria-label="Από" title="Από" />
          <span className="text-charcoal-600/60">–</span>
          <input type="date" value={f.dateTo} min={f.dateFrom || undefined} onChange={(e) => set({ dateTo: e.target.value })} className="input min-w-0 flex-1 text-sm" aria-label="Έως" title="Έως" />
        </div>
        {groups.length > 0 && <Sel value={f.group} onChange={(v) => set({ group: v })} options={[['', 'Ομάδα: όλες'], ...groups.map((g) => [g, g] as [string, string])]} />}
        {filtered && <button type="button" onClick={() => set({ ...DEFAULT_FILTERS, role: f.role })} className="btn-ghost text-xs"><X size={13} /> Καθαρισμός</button>}
      </div>

      {canEdit && sel.size > 0 && (
        <div className="panel flex flex-wrap items-center gap-2 border border-forest/30 p-3 text-sm">
          <b className="mr-1">{sel.size} επιλεγμένες:</b>
          <Sel compact value="" onChange={(v) => v && bulk({ addRole: v as ContactRole })} options={[['', '+ Ιδιότητα…'], ...ALL_ROLES.map((r) => [r, ROLE_EL[r]] as [string, string])]} />
          <Sel compact value="" onChange={(v) => v && bulk({ removeRole: v as ContactRole })} options={[['', '− Ιδιότητα…'], ...ALL_ROLES.map((r) => [r, ROLE_EL[r]] as [string, string])]} />
          <Sel compact value="" onChange={(v) => v && bulk({ status: v as ContactStatus })} options={[['', 'Κατάσταση…'], ...CONTACT_STATUSES.map((s) => [s, STATUS_EL[s]] as [string, string])]} />
          <Sel compact value="" onChange={(v) => v && bulk({ ownerId: v === 'none' ? null : v })} options={[['', 'Υπεύθυνος…'], ['none', 'Κανένας'], ...staff.map((s) => [s.id, s.name] as [string, string])]} />
          <button type="button" onClick={() => setSel(new Set())} className="btn-ghost ml-auto text-xs">Ακύρωση επιλογής</button>
        </div>
      )}
      {msg && <p className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</p>}

      <div className="panel overflow-x-auto">
        <table className="table-base w-full min-w-[860px]">
          <thead>
            <tr>
              {canEdit && <th className="w-8"><input type="checkbox" checked={allOnPage} onChange={() => setSel(allOnPage ? new Set() : new Set(page.map((r) => r.id)))} aria-label="Επιλογή όλων" /></th>}
              <th>Επαφή</th><th>Ιδιότητες</th><th>Κατάσταση</th><th>Υπεύθυνος</th><th>Πηγή</th><th>Τελευταία επαφή</th><th className="text-right">Αξία</th>
              <th className="sticky right-0 z-[1] w-[112px] bg-white text-right shadow-[-8px_0_12px_-10px_rgba(17,49,36,0.25)]">Ενέργειες</th>
            </tr>
          </thead>
          <tbody>
            {page.filter((r) => !gone.has(r.id)).map((r) => {
              const days = r.lastContactAt ? Math.floor((now - Date.parse(r.lastContactAt)) / 86_400_000) : null;
              return (
                <tr key={r.id} className={sel.has(r.id) ? 'bg-forest/[0.03]' : ''}>
                  {canEdit && <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} aria-label={`Επιλογή ${r.name}`} /></td>}
                  <td>
                    <Link href={`/crm/${r.id}`} className="font-medium text-charcoal hover:text-forest hover:underline">{r.name}</Link>
                    <span className="block text-xs text-charcoal-600/70">{[r.email, r.phone].filter(Boolean).join(' · ') || '—'}</span>
                    {r.tags.length > 0 && <span className="mt-0.5 block text-[11px] text-charcoal-600/60">{r.tags.slice(0, 4).join(' · ')}</span>}
                  </td>
                  <td><span className="flex flex-wrap gap-1">{r.roles.length ? r.roles.map((x) => <span key={x} className={ROLE_TONE[x]}>{ROLE_EL[x]}</span>) : <span className="text-xs text-charcoal-600/50">—</span>}</span></td>
                  <td><span className={STATUS_TONE[r.status]}>{STATUS_EL[r.status]}</span>{r.openLeads > 0 && <span className="block text-[11px] text-charcoal-600/60">{r.openLeads === 1 ? '1 ανοιχτό lead' : `${r.openLeads} ανοιχτά leads`}</span>}</td>
                  <td className="text-sm">{r.ownerName ?? <span className="text-charcoal-600/50">—</span>}</td>
                  <td className="text-sm text-charcoal-600">{SOURCE_EL[r.source ?? 'manual'] ?? r.source}</td>
                  <td className={`text-sm ${days !== null && days > 30 ? 'text-signal-danger' : 'text-charcoal-600'}`}>{r.lastContactAt ? `${formatDate(r.lastContactAt)}${days !== null && days > 30 ? ` · ${days} μέρες` : ''}` : <span className="text-charcoal-600/50">ποτέ</span>}</td>
                  <td className="figure text-right text-sm">{r.value ? formatCurrency(r.value) : '—'}</td>
                  <td className={`sticky right-0 z-[1] shadow-[-8px_0_12px_-10px_rgba(17,49,36,0.25)] ${sel.has(r.id) ? 'bg-[#f4f6f2]' : 'bg-white'}`}>
                    <span className="flex justify-end gap-1">
                      <Link href={`/crm/${r.id}`} title="Προβολή" aria-label="Προβολή" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest"><Eye size={16} /></Link>
                      {canEdit && <button type="button" onClick={() => setEditRow(r)} title="Επεξεργασία" aria-label="Επεξεργασία" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest"><Pencil size={15} /></button>}
                      {canEdit && <button type="button" onClick={() => remove(r)} disabled={pending} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button>}
                    </span>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-sm text-charcoal-600/70">Καμία επαφή με αυτά τα φίλτρα.</td></tr>}
          </tbody>
        </table>
        {list.length > shown && <div className="border-t border-stone-line p-3 text-center"><button type="button" className="btn-ghost text-sm" onClick={() => setShown((n) => n + PAGE)}>Περισσότερες ({list.length - shown})</button></div>}
      </div>

      {editRow && <EditContactDialog row={editRow} staff={staff} onClose={() => setEditRow(null)} onSaved={(t) => { setEditRow(null); setMsg({ ok: true, text: t }); router.refresh(); }} />}
      {adding && <NewContactDialog staff={staff} defaultRole={f.role || 'lead'} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); router.push(`/crm/${id}`); }} />}
      {pending && <span className="sr-only">Αποθήκευση…</span>}
    </div>
  );
}

function EditContactDialog({ row, staff, onClose, onSaved }: { row: ContactListRow; staff: Staff[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const [name, setName] = useState(row.name);
  const [email, setEmail] = useState(row.email ?? '');
  const [phone, setPhone] = useState(row.phone ?? '');
  const [status, setStatus] = useState<ContactStatus>(row.status);
  const [owner, setOwner] = useState(row.ownerId ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    const r = await updateContactBasics(row.id, { name, email, phone, status, ownerId: owner || null });
    if (!r.ok) { setErr(r.error); return; }
    onSaved(`Αποθηκεύτηκε: ${name}`);
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-3.5"><p className="font-semibold text-charcoal">Επεξεργασία επαφής</p><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600/60 hover:text-charcoal">✕</button></div>
        <div className="space-y-3 p-5">
          <label className="block"><span className="text-xs font-medium text-charcoal-600">Ονοματεπώνυμο</span><input className="input mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="text-xs font-medium text-charcoal-600">Email</span><input className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block"><span className="text-xs font-medium text-charcoal-600">Τηλέφωνο</span><input className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
            <label className="block"><span className="text-xs font-medium text-charcoal-600">Κατάσταση</span>
              <select className="input mt-1" value={status} onChange={(e) => setStatus(e.target.value as ContactStatus)}>{CONTACT_STATUSES.map((st) => <option key={st} value={st}>{STATUS_EL[st]}</option>)}</select></label>
            <label className="block"><span className="text-xs font-medium text-charcoal-600">Υπεύθυνος</span>
              <select className="input mt-1" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">Κανένας</option>{staff.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
          </div>
          <p className="text-xs text-charcoal-600/60">Ιδιότητες, προτιμήσεις, έγγραφα κ.λπ. αλλάζουν στο πλήρες προφίλ (👁).</p>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-5 py-3"><button type="button" className="btn-ghost" onClick={onClose}>Άκυρο</button><button type="button" className="btn-primary" disabled={pending} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></div>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal-600 hover:border-forest/40'} [&_b]:ml-1 [&_b]:font-semibold`}>{children}</button>;
}

function Sel({ value, onChange, options, compact }: { value: string; onChange: (v: string) => void; options: [string, string][]; compact?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={`input ${compact ? 'w-auto py-1 text-xs' : 'text-sm'}`}>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

function NewContactDialog({ staff, defaultRole, onClose, onCreated }: { staff: Staff[]; defaultRole: ContactRole; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState<ContactRole[]>([defaultRole]);
  const [owner, setOwner] = useState('');
  const [source, setSource] = useState('');
  const [language, setLanguage] = useState('');
  const [note, setNote] = useState('');
  const [createLead, setCreateLead] = useState(defaultRole === 'lead');
  const [err, setErr] = useState<{ text: string; id?: string } | null>(null);
  const [pending, start] = useTransition();
  const flip = (r: ContactRole) => setRoles((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  const submit = () => start(async () => {
    const r = await createContact({ name, email, phone, roles, ownerId: owner || null, source: source || undefined, language: language || undefined, note, createLead });
    if (r.ok && r.id) onCreated(r.id); else if (!r.ok) setErr({ text: r.error, id: r.existingId });
  });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/40 p-4 ws-fade-in" onClick={onClose}>
      <div className="panel ws-pop max-h-[90vh] w-full max-w-lg space-y-4 overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between"><h3 className="text-xl">Νέα επαφή</h3><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <label className="block"><span className="eyebrow mb-1 block">Ονοματεπώνυμο *</span><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="eyebrow mb-1 block">Email</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="block"><span className="eyebrow mb-1 block">Τηλέφωνο</span><PhoneInput value={phone} onChange={setPhone} /></label>
        </div>
        <div>
          <p className="eyebrow mb-1.5">Ιδιότητες</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROLES.map((r) => (
              <button key={r} type="button" onClick={() => flip(r)} className={`rounded-full border px-3 py-1 text-xs ${roles.includes(r) ? 'border-forest bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal-600'}`}>
                {roles.includes(r) && <Check size={11} className="mr-1 inline" />}{ROLE_EL[r]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="eyebrow mb-1 block">Υπεύθυνος</span>
            <select className="input text-sm" value={owner} onChange={(e) => setOwner(e.target.value)}><option value="">—</option>{staff.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          <label className="block"><span className="eyebrow mb-1 block">Πηγή</span>
            <select className="input text-sm" value={source} onChange={(e) => setSource(e.target.value)}><option value="">Καταχώριση</option>{LEAD_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_EL[s]}</option>)}</select></label>
          <label className="block"><span className="eyebrow mb-1 block">Γλώσσα</span>
            <select className="input text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}><option value="">—</option>{LANGUAGES.map((l) => <option key={l.v} value={l.v}>{l.l}</option>)}</select></label>
        </div>
        <label className="block"><span className="eyebrow mb-1 block">Σημείωση</span><textarea className="input min-h-[70px]" value={note} onChange={(e) => setNote(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={createLead} onChange={(e) => setCreateLead(e.target.checked)} /> Άνοιγμα και lead στο Pipeline (με καλωσόρισμα και ανάθεση)</label>
        {err && <p className="text-sm text-signal-danger">{err.text} {err.id && <Link href={`/crm/${err.id}`} className="underline">Άνοιγμα</Link>}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-ghost">Ακύρωση</button>
          <button type="button" disabled={pending || !name.trim()} onClick={submit} className="btn-primary">{pending ? 'Αποθήκευση…' : 'Καταχώριση'}</button>
        </div>
      </div>
    </div>
  );
}
