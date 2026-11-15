'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Download, Search, X, Users, Check, CalendarDays, ChevronLeft, ChevronRight, Columns3, SlidersHorizontal, Megaphone } from 'lucide-react';
import { createContact, bulkUpdateContacts, updateContactBasics, deleteContact, importContacts, createContactGroup, updateContactGroup, deleteContactGroup } from '@/app/actions/contacts-hub';
import { Eye, Pencil, Trash2, Filter, LayoutGrid, Upload, FileSpreadsheet, Mail, Phone, ExternalLink, Sparkles } from 'lucide-react';
import {
  ALL_ROLES, CONTACT_STATUSES, DEFAULT_FILTERS, ROLE_EL, ROLE_TONE, SOURCE_EL, STATUS_EL, STATUS_TONE,
  contactsCsv, filterContacts, roleCounts, type ContactFilters, type ContactGroup, type ContactListRow, type ContactRole, type ContactStatus,
} from '@/lib/contacts-hub-shared';
import { LEAD_SOURCES } from '@/lib/lead-automation-shared';
import { LANGUAGES } from '@/lib/kyc-shared';
import { formatCurrency, formatDate } from '@/lib/format';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { HubCards } from '@/components/ui/HubCards';

interface Staff { id: string; name: string }

// Στήλες όπως στο FitnessCRM: Ονοματεπώνυμο (πάντα), Όνομα, Επώνυμο, E-mail, Κινητό, Ομάδα, Εγγραφή + προαιρετικές.
const COLS = [
  ['first', 'Όνομα'], ['last', 'Επώνυμο'], ['email', 'E-mail'], ['mobile', 'Κινητό'], ['group', 'Ομάδα'], ['tags', 'Tags'], ['joined', 'Ημ. εγγραφής'], ['roles', 'Ιδιότητα'],
] as const;
type Col = (typeof COLS)[number][0];
const DEFAULT_COLS: Col[] = ['first', 'last', 'email', 'mobile', 'group', 'joined'];
const COLS_KEY = 'oramira:customer-cols-v2';
const splitName = (n: string) => { const p = n.trim().split(/\s+/); return { first: p[0] ?? '', last: p.slice(1).join(' ') }; };
const ddmmyyyy = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('el-GR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—');
const LANG_EL: Record<string, string> = Object.fromEntries(LANGUAGES.map((l) => [l.v, l.l]));
const BUYER_TYPES: [string, string][] = [['investor', 'Επενδυτής'], ['end_user', 'Ιδιοκατοίκηση'], ['holiday', 'Εξοχικό'], ['relocation', 'Μετεγκατάσταση'], ['other', 'Άλλο']];
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';

/**
 * Πελάτες (όπως στο FitnessCRM): κάρτες Πελάτες · Leads · Ομάδες · Import και
 * από κάτω το αποτέλεσμα. Φίλτρα σε όλα τα στοιχεία που καταχωρούνται, ομάδες
 * (segments) που στοχεύονται μετά από το Marketing.
 */
export function ContactsHub({ rows, staff, groupDefs = [], initialRole = '', initialView, canCreate, canEdit }: { rows: ContactListRow[]; staff: Staff[]; groupDefs?: ContactGroup[]; initialRole?: ContactRole | ''; initialView?: string; canCreate: boolean; canEdit: boolean }) {
  const router = useRouter();
  const [f, setF] = useState<ContactFilters>({ ...DEFAULT_FILTERS, role: initialRole });
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'customers' | 'leads' | 'groups' | 'import'>(
    initialView === 'groups' || initialView === 'import' ? initialView : initialRole === 'lead' ? 'leads' : 'customers');
  const [more, setMore] = useState(false);
  const [colsOpen, setColsOpen] = useState(false);
  const [cols, setCols] = useState<Col[]>(DEFAULT_COLS);
  useEffect(() => { try { const v = JSON.parse(localStorage.getItem(COLS_KEY) ?? 'null'); if (Array.isArray(v)) setCols(v); } catch { /* */ } }, []);
  const flipCol = (c: Col) => setCols((x) => { const n = x.includes(c) ? x.filter((y) => y !== c) : [...x, c]; try { localStorage.setItem(COLS_KEY, JSON.stringify(n)); } catch { /* */ } return n; });
  const resetCols = () => { setCols(DEFAULT_COLS); try { localStorage.removeItem(COLS_KEY); } catch { /* */ } };
  const [sortBy, setSortBy] = useState<{ k: string; dir: 1 | -1 } | null>(null);
  const [quick, setQuick] = useState<ContactListRow | null>(null);
  const [groupDlg, setGroupDlg] = useState<ContactGroup | 'new' | null>(null);
  const [editRow, setEditRow] = useState<ContactListRow | null>(null);
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<ContactFilters>) => { setF((x) => ({ ...x, ...p })); setPageNo(0); setSel(new Set()); };
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

  const list = useMemo(() => filterContacts(rows, f).filter((r) => !gone.has(r.id)), [rows, f, gone]);
  const counts = useMemo(() => roleCounts(rows), [rows]);
  const tags = useMemo(() => Array.from(new Set(rows.flatMap((r) => r.tags))).sort(), [rows]);
  const groups = useMemo(() => Array.from(new Set([...groupDefs.map((g) => g.name), ...rows.flatMap((r) => r.groups)])).sort((a, b) => a.localeCompare(b, 'el')), [rows, groupDefs]);
  const nationalities = useMemo(() => Array.from(new Set(rows.map((r) => r.nationality).filter(Boolean) as string[])).sort(), [rows]);
  const now = Date.now();
  const active = rows.filter((r) => r.status === 'active').length;
  const advanced = (['owner', 'source', 'tag', 'language', 'nationality', 'buyerType', 'consent', 'dateFrom', 'dateTo'] as const).filter((k) => f[k]).length + (f.quietDays ? 1 : 0) + (f.role && view === 'customers' ? 1 : 0);
  const filtered = JSON.stringify({ ...f, role: '', sort: '' }) !== JSON.stringify({ ...DEFAULT_FILTERS, role: '', sort: '' });

  const exportCsv = () => {
    const blob = new Blob([contactsCsv(list)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pelates-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  };
  const bulk = (op: Parameters<typeof bulkUpdateContacts>[1]) => start(async () => {
    const r = await bulkUpdateContacts([...sel], op);
    setMsg(r.ok ? { ok: true, text: `Ενημερώθηκαν ${r.updated} επαφές.` } : { ok: false, text: r.error });
    if (r.ok) { setSel(new Set()); router.refresh(); }
  });
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const sorted = useMemo(() => {
    if (!sortBy) return list;
    const val = (r: ContactListRow): string => {
      const n = splitName(r.name);
      switch (sortBy.k) { case 'name': return r.name; case 'first': return n.first; case 'last': return n.last; case 'email': return r.email ?? ''; case 'mobile': return r.phone ?? ''; case 'group': return r.groups[0] ?? ''; case 'joined': return r.createdAt; default: return ''; }
    };
    return [...list].sort((a, b) => val(a).localeCompare(val(b), 'el') * sortBy.dir);
  }, [list, sortBy]);
  const sortClick = (k: string) => setSortBy((x) => (x?.k === k ? (x.dir === 1 ? { k, dir: -1 } : null) : { k, dir: 1 }));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = sorted.slice(pg * per, pg * per + per);
  const allOnPage = page.length > 0 && page.every((r) => sel.has(r.id));
  const campaignHref = (q: Record<string, string>) => `/marketing?tab=email&${new URLSearchParams(q).toString()}`;

  const newThisMonth = rows.filter((r) => Date.parse(r.createdAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()).length;
  const leadCount = counts.lead ?? 0;
  const conv = leadCount + (counts.buyer ?? 0) > 0 ? Math.round(((counts.buyer ?? 0) / (leadCount + (counts.buyer ?? 0))) * 100) : 0;
  const groupStats = groups.map((g) => ({ g, def: groupDefs.find((d) => d.name === g), n: rows.filter((r) => r.groups.includes(g)).length }));
  const inAnyGroup = rows.filter((r) => r.groups.length > 0).length;
  const go = (v: string) => { setView(v as typeof view); setSel(new Set()); if (v === 'leads') set({ role: 'lead' }); else if (v === 'customers') set({ role: '' }); };
  const has = (c: Col) => cols.includes(c);

  return (
    <div className="space-y-5">
      <HubCards active={view} onSelect={go} cards={[
        { key: 'customers', icon: Users, title: 'Πελάτες', value: (counts.all ?? rows.length).toLocaleString('el-GR'), sub: `${newThisMonth} νέοι αυτόν τον μήνα`, sub2: `${active} ενεργοί` },
        { key: 'leads', icon: Filter, title: 'Leads', value: leadCount.toLocaleString('el-GR'), sub: `${conv}% μετατροπή σε αγοραστές` },
        { key: 'groups', icon: LayoutGrid, title: 'Ομάδες', value: groups.length, sub: `${inAnyGroup} πελάτες σε ομάδες` },
        { key: 'import', icon: Download, title: 'Import', value: 'CSV', sub: 'Μαζική προσθήκη ή ενημέρωση πελατών' },
      ]} />

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {view === 'groups' && (
        <GroupsPanel stats={groupStats} canEdit={canEdit} onNew={() => setGroupDlg('new')} onEdit={(g) => setGroupDlg(g)}
          onView={(g) => { setView('customers'); set({ ...DEFAULT_FILTERS, group: g }); }}
          campaignHref={(g) => campaignHref({ group: g })}
          onDelete={(g) => {
            if (!g.def) return;
            if (!confirm(`Διαγραφή της ομάδας «${g.g}»;\n\nΟι πελάτες δεν διαγράφονται, απλώς βγαίνουν από την ομάδα.`)) return;
            start(async () => { const r = await deleteContactGroup(g.def!.id); setMsg(r.ok ? { ok: true, text: `Η ομάδα «${g.g}» διαγράφηκε.` } : { ok: false, text: r.error }); router.refresh(); });
          }} />
      )}

      {view === 'import' && <ImportPanel onDone={(t) => { setMsg({ ok: true, text: t }); setView('customers'); router.refresh(); }} />}

      {(view === 'customers' || view === 'leads') && (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2 text-[15px] text-charcoal-600">
              <span>Εμφάνιση</span>
              <select value={per} onChange={(e) => { setPer(Number(e.target.value)); setPageNo(0); }} className="input h-9 w-20 py-1 text-sm">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}</select>
              <span>εγγραφές</span>
              <div className="relative">
                <button type="button" onClick={() => setColsOpen((o) => !o)} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-stone-100 px-3 text-sm font-medium text-charcoal hover:bg-stone-200"><Columns3 size={15} /> Στήλες</button>
                {colsOpen && (
                  <div className="absolute left-0 top-10 z-20 w-56 rounded-xl border border-stone-line bg-white p-1.5 shadow-overlay" onMouseLeave={() => setColsOpen(false)}>
                    <p className="px-2 py-1 text-[12px] text-charcoal-600">Εμφάνιση στηλών</p>
                    {COLS.map(([k, l]) => <label key={k} className="flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm text-charcoal hover:bg-stone-50">{l}<input type="checkbox" className="accent-forest" checked={has(k)} onChange={() => flipCol(k)} /></label>)}
                    <button type="button" onClick={resetCols} className="mt-1 w-full border-t border-stone-line px-2 py-1.5 text-left text-sm text-charcoal hover:bg-stone-50">↺ Επαναφορά</button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <select value={f.group} onChange={(e) => set({ group: e.target.value })} className="input h-10 w-auto min-w-[170px] text-sm"><option value="">Όλες οι ομάδες</option>{groups.map((g) => <option key={g} value={g}>{g}</option>)}</select>
              <select value={f.status} onChange={(e) => set({ status: e.target.value as ContactFilters['status'] })} className="input h-10 w-auto min-w-[170px] text-sm"><option value="">Όλες οι καταστάσεις</option>{CONTACT_STATUSES.map((s) => <option key={s} value={s}>{STATUS_EL[s]}</option>)}</select>
              <label className="relative min-w-[180px] flex-1 sm:max-w-[220px]">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
                <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Αναζήτηση…" className="input h-10 pl-9" />
              </label>
              <button type="button" onClick={() => set({ status: f.status === 'active' ? '' : 'active' })} className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${f.status === 'active' ? 'border-forest/40 bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal'}`}><Users size={13} /> {active} ενεργοί</button>
              <button type="button" onClick={() => setMore((m) => !m)} title="Περισσότερα φίλτρα" className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] ${more || advanced ? 'border-forest/40 bg-forest/[0.08] text-forest' : 'border-stone-line text-charcoal'}`}><SlidersHorizontal size={13} />{advanced ? ` ${advanced}` : ''}</button>
              {canCreate && <button type="button" onClick={() => setAdding(true)} className="btn-primary text-sm"><Plus size={15} /> {view === 'leads' ? 'Νέο lead' : 'Νέος πελάτης'}</button>}
            </div>

            {more && (
              <div className="grid gap-3 rounded-xl border border-stone-line bg-stone-50/60 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {view === 'customers' && <F label="Ιδιότητα"><Sel value={f.role} onChange={(v) => set({ role: v as ContactRole })} options={[['', 'Όλες'], ...ALL_ROLES.map((r) => [r, `${ROLE_EL[r]} (${counts[r] ?? 0})`] as [string, string])]} /></F>}
                <F label="Υπεύθυνος"><Sel value={f.owner} onChange={(v) => set({ owner: v })} options={[['', 'Όλοι'], ['none', 'Χωρίς υπεύθυνο'], ...staff.map((s) => [s.id, s.name] as [string, string])]} /></F>
                <F label="Πηγή"><Sel value={f.source} onChange={(v) => set({ source: v })} options={[['', 'Όλες'], ...[...LEAD_SOURCES, 'manual'].map((s) => [s, SOURCE_EL[s] ?? s] as [string, string])]} /></F>
                <F label="Tag"><Sel value={f.tag} onChange={(v) => set({ tag: v })} options={[['', 'Όλα'], ...tags.map((t) => [t, t] as [string, string])]} /></F>
                <F label="Γλώσσα"><Sel value={f.language} onChange={(v) => set({ language: v })} options={[['', 'Όλες'], ...LANGUAGES.map((l) => [l.v, l.l] as [string, string])]} /></F>
                <F label="Εθνικότητα"><Sel value={f.nationality} onChange={(v) => set({ nationality: v })} options={[['', 'Όλες'], ...nationalities.map((n) => [n, n] as [string, string])]} /></F>
                <F label="Τύπος αγοραστή"><Sel value={f.buyerType} onChange={(v) => set({ buyerType: v })} options={[['', 'Όλοι'], ...BUYER_TYPES]} /></F>
                <F label="Συγκατάθεση marketing"><Sel value={f.consent} onChange={(v) => set({ consent: v as ContactFilters['consent'] })} options={[['', 'Όλοι'], ['yes', 'Έχουν δώσει'], ['no', 'Δεν έχουν δώσει']]} /></F>
                <F label="Ημ. εγγραφής">
                  <span className="flex items-center gap-1.5">
                    <input type="date" value={f.dateFrom} max={f.dateTo || undefined} onChange={(e) => set({ dateField: 'created', dateFrom: e.target.value })} className="input min-w-0 flex-1 text-sm" aria-label="Από" />
                    <span className="text-charcoal-600/60">–</span>
                    <input type="date" value={f.dateTo} min={f.dateFrom || undefined} onChange={(e) => set({ dateField: 'created', dateTo: e.target.value })} className="input min-w-0 flex-1 text-sm" aria-label="Έως" />
                  </span>
                </F>
                {filtered && <button type="button" onClick={() => set({ ...DEFAULT_FILTERS, role: f.role })} className="inline-flex items-center gap-1 self-end text-[13px] text-charcoal-600 hover:text-charcoal"><X size={13} /> Καθαρισμός φίλτρων</button>}
              </div>
            )}
          </div>

          <div className="overflow-x-auto border-t border-stone-line">
            <table className="w-full min-w-[820px] text-[14px]">
              <thead>
                <tr className="border-b border-stone-line text-left text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">
                  {([['name', 'Ονοματεπώνυμο'], ...COLS.filter(([k]) => has(k))] as [string, string][]).map(([k, l]) => (
                    <th key={k} className="whitespace-nowrap px-4 py-3">
                      {['roles', 'tags'].includes(k) ? l : <button type="button" onClick={() => sortClick(k)} className="inline-flex items-center gap-1 uppercase hover:text-charcoal">{l}<span className="text-[10px] text-charcoal-600/60">{sortBy?.k === k ? (sortBy.dir === 1 ? '↑' : '↓') : '⇅'}</span></button>}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {page.map((r) => {
                  const n = splitName(r.name);
                  return (
                    <tr key={r.id} onClick={() => setQuick(r)} className="cursor-pointer border-b border-stone-line/70 last:border-0 hover:bg-stone-50">
                      <td className="px-4 py-3 font-semibold text-charcoal" data-no-tr>{r.name}</td>
                      {has('first') && <td className="px-4 py-3 text-charcoal-600" data-no-tr>{n.first || '—'}</td>}
                      {has('last') && <td className="px-4 py-3 text-charcoal-600" data-no-tr>{n.last || '—'}</td>}
                      {has('email') && <td className="px-4 py-3 text-charcoal-600" data-no-tr>{r.email || '—'}</td>}
                      {has('mobile') && <td className="whitespace-nowrap px-4 py-3 text-charcoal-600" data-no-tr>{r.phone || '—'}</td>}
                      {has('group') && <td className="px-4 py-3">{r.groups.length ? <span className="flex flex-wrap gap-1">{r.groups.map((g) => <span key={g} className="whitespace-nowrap rounded-full border border-stone-line px-2 py-0.5 text-[12px] text-charcoal" data-no-tr>{g}</span>)}</span> : <span className="text-charcoal-600">—</span>}</td>}
                      {has('tags') && <td className="px-4 py-3 text-[13px] text-charcoal-600" data-no-tr>{r.tags.join(', ') || '—'}</td>}
                      {has('joined') && <td className="whitespace-nowrap px-4 py-3 text-charcoal-600">{ddmmyyyy(r.createdAt)}</td>}
                      {has('roles') && <td className="px-4 py-3"><span className="flex flex-wrap gap-1">{r.roles.length ? r.roles.map((x) => <span key={x} className={ROLE_TONE[x]}>{ROLE_EL[x]}</span>) : <span className="text-charcoal-600">—</span>}</span></td>}
                      <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                        <span className="flex justify-end gap-1">
                          {canEdit && <button type="button" onClick={() => setEditRow(r)} title="Επεξεργασία πελάτη" aria-label="Επεξεργασία πελάτη" className={iconBtn}><Pencil size={15} /></button>}
                          {canEdit && <button type="button" onClick={() => remove(r)} disabled={pending} title="Διαγραφή πελάτη" aria-label="Διαγραφή πελάτη" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button>}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {list.length === 0 && <tr><td colSpan={12} className="py-10 text-center text-sm text-charcoal-600">Κανένας πελάτης με αυτά τα φίλτρα.</td></tr>}
              </tbody>
            </table>
          </div>
          <Pager from={list.length ? pg * per + 1 : 0} to={Math.min(list.length, pg * per + per)} total={list.length} page={pg} pages={pages} onPage={setPageNo} />
        </div>
        <CustomersSide rows={rows} groups={groupStats} newThisMonth={newThisMonth} onGroup={(g) => set({ ...DEFAULT_FILTERS, group: g })} onUngrouped={() => setView('groups')} exportCsv={exportCsv} onOpen={(r) => setQuick(r)} />
        </div>
      )}

      {quick && <QuickView r={quick} onClose={() => setQuick(null)} />}
      {groupDlg && <GroupDialog group={groupDlg === 'new' ? null : groupDlg} rows={rows} preselect={groupDlg === 'new' ? [...sel] : undefined}
        onClose={() => setGroupDlg(null)} onSaved={(t) => { setGroupDlg(null); setSel(new Set()); setMsg({ ok: true, text: t }); router.refresh(); }} />}
      {editRow && <EditContactDialog row={editRow} staff={staff} onClose={() => setEditRow(null)} onSaved={(t) => { setEditRow(null); setMsg({ ok: true, text: t }); router.refresh(); }} />}
      {adding && <NewContactDialog staff={staff} defaultRole={f.role || (view === 'leads' ? 'lead' : 'buyer')} onClose={() => setAdding(false)} onCreated={(id) => { setAdding(false); router.push(`/crm/${id}`); }} />}
      {pending && <span className="sr-only">Αποθήκευση…</span>}
    </div>
  );
}

function F({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`block ${wide ? 'sm:col-span-2' : ''}`}><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">{label}</span>{children}</label>;
}

function Pager({ from, to, total, page, pages, onPage }: { from: number; to: number; total: number; page: number; pages: number; onPage: (n: number) => void }) {
  const nums = Array.from(new Set([0, 1, page - 1, page, page + 1, pages - 1].filter((n) => n >= 0 && n < pages))).sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">
      <span>Εμφάνιση {from}–{to} από {total}</span>
      {pages > 1 && <span className="flex items-center gap-1">
        <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-lg border border-stone-line px-3 py-1 disabled:opacity-40">Προηγούμενη</button>
        {nums.map((n, i) => (
          <span key={n} className="flex items-center gap-1">
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1">…</span>}
            <button type="button" onClick={() => onPage(n)} className={`min-w-[32px] rounded-lg px-2 py-1 tabular-nums ${n === page ? 'bg-forest text-white' : 'border border-stone-line text-charcoal hover:border-forest/40'}`}>{n + 1}</button>
          </span>
        ))}
        <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="rounded-lg border border-stone-line px-3 py-1 disabled:opacity-40">Επόμενη</button>
      </span>}
    </div>
  );
}

function QuickView({ r, onClose }: { r: ContactListRow; onClose: () => void }) {
  const days = r.lastContactAt ? Math.floor((Date.now() - Date.parse(r.lastContactAt)) / 86_400_000) : null;
  const risk = days === null ? 'Δεν έγινε ποτέ επικοινωνία' : days > 60 ? 'Υψηλός' : days > 30 ? 'Μέτριος' : 'Χαμηλός';
  const Row = ({ label, value, icon: I }: { label: string; value: React.ReactNode; icon?: any }) => (
    <div className="flex items-center justify-between gap-3 border-b border-stone-line/70 py-2 text-[14px] last:border-0">
      <span className="flex items-center gap-2 text-charcoal-600">{I && <I size={14} />}{label}</span><span className="truncate text-right font-medium text-charcoal" data-no-tr>{value}</span>
    </div>
  );
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-charcoal/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-overlay" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3 border-b border-stone-line px-5 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-forest/[0.09] text-[14px] font-semibold text-forest">{r.name.split(' ').map((x) => x[0]).slice(0, 2).join('').toUpperCase()}</span>
          <div className="min-w-0 flex-1"><p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal-600">Πελάτης</p><p className="truncate font-display text-lg text-charcoal" data-no-tr>{r.name}</p><p className="truncate text-[13px] text-charcoal-600" data-no-tr>{r.email ?? r.phone ?? ''}</p></div>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-5 py-4">
          <section><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal-600">Επικοινωνία</p>
            <Row icon={Mail} label="E-mail" value={r.email || '—'} />
            <Row icon={Phone} label="Τηλέφωνο" value={r.phone || '—'} />
            <Row label="Ομάδα" value={r.groups.join(', ') || 'Χωρίς ομάδα'} />
            <Row label="Ημ. εγγραφής" value={ddmmyyyy(r.createdAt)} />
          </section>
          <section><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal-600">Αγορά</p>
            <Row label="Ιδιότητα" value={r.roles.map((x) => ROLE_EL[x]).join(', ') || '—'} />
            <Row label="Αξία συμβολαίων" value={r.value ? formatCurrency(r.value) : '—'} />
            <Row label="Υπόλοιπο" value={r.value ? formatCurrency(Math.max(0, r.value - r.paid)) : '—'} />
          </section>
          <section><p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-charcoal-600">Δραστηριότητα</p>
            <Row label="Τελευταία επαφή" value={ddmmyyyy(r.lastContactAt)} />
            <Row label="Ανοιχτά leads" value={r.openLeads} />
            <Row label="Κίνδυνος" value={risk} />
          </section>
        </div>
        <div className="px-5 pb-5"><Link href={`/crm/${r.id}`} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-2.5 text-sm font-semibold text-white hover:bg-forest/90"><ExternalLink size={15} /> Άνοιγμα πλήρους προφίλ</Link></div>
      </div>
    </div>
  );
}

function CustomersSide({ rows, groups, newThisMonth, onGroup, onUngrouped, exportCsv, onOpen }: { rows: ContactListRow[]; groups: GroupStat[]; newThisMonth: number; onGroup: (g: string) => void; onUngrouped: () => void; exportCsv: () => void; onOpen: (r: ContactListRow) => void }) {
  const [who, setWho] = useState<'all' | 'active' | 'inactive'>('all');
  const [metric, setMetric] = useState<'value' | 'paid' | 'recent'>('value');
  const live = rows.filter((r) => r.status !== 'archived');
  const grouped = live.filter((r) => r.groups.length > 0).length;
  const fromPipeline = live.length ? Math.round((live.filter((r) => r.source && r.source !== 'manual').length / live.length) * 100) : 0;
  const inUse = groups.filter((g) => g.n > 0);
  const top = live.filter((r) => (who === 'all' ? true : who === 'active' ? r.status === 'active' : r.status !== 'active'))
    .map((r) => ({ r, v: metric === 'value' ? r.value : metric === 'paid' ? r.paid : r.lastContactAt ? Date.parse(r.lastContactAt) : 0 }))
    .filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 5);
  const maxV = Math.max(1, ...top.map((x) => x.v));
  const biggest = [...inUse].sort((a, b) => b.n - a.n)[0];
  const card = 'rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
  const chip = (on: boolean) => `rounded-full px-2.5 py-0.5 text-[12px] font-medium ${on ? 'bg-forest text-white' : 'bg-forest/[0.07] text-forest'}`;
  return (
    <aside className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-forest to-forest-deep p-4 text-white shadow-[0_8px_24px_-12px_rgb(var(--c-forest)/0.6)]">
        <span className="inline-flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]"><Sparkles size={11} /> Ενημέρωση πελατών</span>
        <p className="mt-2 text-[16px] font-semibold leading-snug">Κάθε πελάτης ένα βήμα πιο κοντά στην αγορά.</p>
        <p className="mt-1 text-[13px] text-white/80">Βάλτε τους πελάτες σε ομάδες, κάντε follow-up στα ανοιχτά leads και κρατήστε τα στοιχεία καθαρά για όλη την ομάδα.</p>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-white/70">Ζωντανές μετρήσεις</p>
        <div className="mt-1.5 grid grid-cols-3 gap-2">
          {[['Σύνολο', live.length, 'πελάτες'], ['Νέοι', newThisMonth, 'αυτόν τον μήνα'], ['Σε ομάδες', grouped, 'ανατεθειμένοι']].map(([k, v, n]) => (
            <div key={String(k)} className="rounded-xl border border-white/20 bg-white/10 px-2 py-2 text-center"><p className="text-[10px] font-semibold uppercase text-white/70">{k}</p><p className="font-display text-xl">{v}</p><p className="text-[10px] text-white/70">{n}</p></div>
          ))}
        </div>
        <button type="button" onClick={exportCsv} className="mt-3 w-full rounded-lg bg-white py-2 text-[13px] font-semibold text-forest hover:bg-white/90">Εξαγωγή πελατών (CSV)</button>
      </div>

      <div className={card}>
        <div className="flex items-center justify-between gap-2"><p className="text-[15px] font-semibold text-charcoal">Κορυφαίοι πελάτες</p>
          <span className="flex gap-1">{(['all', 'active', 'inactive'] as const).map((k) => <button key={k} type="button" onClick={() => setWho(k)} className={chip(who === k)}>{k === 'all' ? 'Όλοι' : k === 'active' ? 'Ενεργοί' : 'Ανενεργοί'}</button>)}</span></div>
        <div className="mt-2 flex flex-wrap gap-1">{(['value', 'paid', 'recent'] as const).map((k) => <button key={k} type="button" onClick={() => setMetric(k)} className={chip(metric === k)}>{k === 'value' ? 'Αξία' : k === 'paid' ? 'Εισπράξεις' : 'Πρόσφατη επαφή'}</button>)}</div>
        <ol className="mt-3 space-y-2.5">
          {top.map((x, i) => (
            <li key={x.r.id}>
              <button type="button" onClick={() => onOpen(x.r)} className="flex w-full items-center justify-between gap-2 text-left text-[13px]"><span className="flex min-w-0 items-center gap-2"><span className="text-charcoal-600">{i + 1}</span><span className="truncate font-medium text-charcoal" data-no-tr>{x.r.name}</span></span><span className="shrink-0 text-charcoal-600">{metric === 'recent' ? ddmmyyyy(x.r.lastContactAt) : formatCurrency(x.v)}</span></button>
              <span className="mt-1 block h-1 rounded-full bg-stone-100"><span className="block h-1 rounded-full bg-forest" style={{ width: `${metric === 'recent' ? 100 - i * 15 : (x.v / maxV) * 100}%` }} /></span>
            </li>
          ))}
          {top.length === 0 && <li className="text-[13px] text-charcoal-600">Δεν υπάρχουν δεδομένα ακόμη.</li>}
        </ol>
      </div>

      <div className={card}><p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Ομάδες σε χρήση</p><p className="font-display text-3xl text-charcoal">{inUse.length}</p><p className="text-[13px] text-charcoal-600">Ομάδες με τουλάχιστον έναν πελάτη. Οι άδειες ομάδες δεν βοηθούν την ομάδα πωλήσεων.</p></div>
      <div className={card}><p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Ποσοστό από pipeline</p><p className="font-display text-3xl text-charcoal">{fromPipeline}%</p><p className="text-[13px] text-charcoal-600">Πελάτες που ήρθαν από τις πηγές leads. Όσο μεγαλύτερο, τόσο καλύτερα δουλεύει το follow-up.</p></div>

      <div className={card}>
        <p className="text-[15px] font-semibold text-charcoal">Προτεινόμενα επόμενα βήματα</p>
        <button type="button" onClick={onUngrouped} className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-stone-line px-3 py-2 text-left hover:border-forest/40"><span><span className="block text-[13px] font-medium text-charcoal">Βάλτε σε ομάδες όσους δεν έχουν</span><span className="block text-[12px] text-charcoal-600">Για να ξέρει η ομάδα ποιος θέλει follow-up.</span></span><span className="font-semibold text-forest">{live.length - grouped}</span></button>
        {biggest && <button type="button" onClick={() => onGroup(biggest.g)} className="mt-2 flex w-full items-center justify-between gap-2 rounded-xl border border-stone-line px-3 py-2 text-left hover:border-forest/40"><span><span className="block text-[13px] font-medium text-charcoal">Δείτε τη μεγαλύτερη ομάδα</span><span className="block text-[12px] text-charcoal-600" data-no-tr>«{biggest.g}»</span></span><span className="font-semibold text-forest">{biggest.n}</span></button>}
      </div>

      <div className={card}>
        <div className="flex items-center justify-between"><p className="text-[15px] font-semibold text-charcoal">Πελάτες ανά ομάδα</p><span className="text-[12px] text-charcoal-600">{inUse.length} ομάδες</span></div>
        <p className="text-[12px] text-charcoal-600">Πού βρίσκονται οι πελάτες σας.</p>
        <ul className="mt-2 space-y-2">{inUse.sort((a, b) => b.n - a.n).slice(0, 8).map((g) => (
          <li key={g.g}><button type="button" onClick={() => onGroup(g.g)} className="w-full text-left"><span className="flex justify-between text-[13px]"><span className="truncate font-medium text-charcoal" data-no-tr>{g.g}</span><span className="text-charcoal-600">{g.n} · {live.length ? Math.round((g.n / live.length) * 100) : 0}%</span></span><span className="mt-1 block h-1 rounded-full bg-stone-100"><span className="block h-1 rounded-full bg-forest" style={{ width: `${live.length ? (g.n / live.length) * 100 : 0}%` }} /></span></button></li>
        ))}{inUse.length === 0 && <li className="text-[13px] text-charcoal-600">Καμία ομάδα σε χρήση.</li>}</ul>
      </div>
    </aside>
  );
}

type GroupStat = { g: string; def?: ContactGroup; n: number };
function GroupsPanel({ stats, canEdit, onNew, onEdit, onView, onDelete, campaignHref }: { stats: GroupStat[]; canEdit: boolean; onNew: () => void; onEdit: (g: ContactGroup) => void; onView: (g: string) => void; onDelete: (g: GroupStat) => void; campaignHref: (g: string) => string }) {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState('');
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const allTags = Array.from(new Set(stats.flatMap((s) => s.def?.tags ?? []))).sort();
  const list = stats.filter((s) => (!q || s.g.toLowerCase().includes(q.toLowerCase())) && (!tag || (s.def?.tags ?? []).includes(tag)));
  const pages = Math.max(1, Math.ceil(list.length / per));
  const page = list.slice(pg * per, pg * per + per);
  const members = stats.reduce((n, s) => n + s.n, 0);
  const largest = [...stats].sort((a, b) => b.n - a.n)[0];
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[15px] text-charcoal-600">
            <span>Εμφάνιση</span>
            <select value={per} onChange={(e) => { setPer(Number(e.target.value)); setPg(0); }} className="input h-9 w-20 py-1 text-sm">{[10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}</select>
            <span>εγγραφές</span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select value={tag} onChange={(e) => { setTag(e.target.value); setPg(0); }} className="input h-10 w-auto min-w-[170px] text-sm"><option value="">Όλα τα tags</option>{allTags.map((t) => <option key={t} value={t}>{t}</option>)}</select>
            <label className="relative min-w-[200px] flex-1 sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} placeholder="Αναζήτηση…" className="input h-10 pl-9" /></label>
            {canEdit && <button type="button" onClick={onNew} className="btn-primary text-sm"><Plus size={15} /> Νέα ομάδα</button>}
          </div>
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="table-base w-full min-w-[640px]">
            <thead><tr><th>Όνομα</th><th>Μέλη</th><th>Tags</th><th className="text-right">Ενέργειες</th></tr></thead>
            <tbody>
              {page.map((s) => (
                <tr key={s.g}>
                  <td><button type="button" onClick={() => onView(s.g)} className="font-semibold text-charcoal hover:text-forest hover:underline" data-no-tr>{s.g}</button>{s.def?.description && <span className="block text-[13px] text-charcoal-600" data-no-tr>{s.def.description}</span>}</td>
                  <td className="tabular-nums">{s.n}</td>
                  <td><span className="flex flex-wrap gap-1">{(s.def?.tags ?? []).length ? s.def!.tags.map((t) => <span key={t} className="rounded-full border border-stone-line px-2 py-0.5 text-[12px]" data-no-tr>{t}</span>) : <span className="text-charcoal-600/60">—</span>}</span></td>
                  <td>
                    <span className="flex justify-end gap-1">
                      <button type="button" onClick={() => onView(s.g)} title="Προβολή μελών" aria-label="Προβολή μελών" className={iconBtn}><Eye size={16} /></button>
                      <Link href={campaignHref(s.g)} title="Αποστολή campaign σε αυτή την ομάδα" aria-label="Campaign" className={iconBtn}><Megaphone size={15} /></Link>
                      {canEdit && s.def && <button type="button" onClick={() => onEdit(s.def!)} title="Επεξεργασία" aria-label="Επεξεργασία" className={iconBtn}><Pencil size={15} /></button>}
                      {canEdit && s.def && <button type="button" onClick={() => onDelete(s)} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-rose-50 hover:text-signal-danger"><Trash2 size={15} /></button>}
                    </span>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={4} className="py-10 text-center text-sm text-charcoal-600">{stats.length ? 'Καμία ομάδα με αυτά τα φίλτρα.' : 'Δεν υπάρχουν ακόμη ομάδες. Πατήστε «Νέα ομάδα».'}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager from={list.length ? pg * per + 1 : 0} to={Math.min(list.length, pg * per + per)} total={list.length} page={pg} pages={pages} onPage={setPg} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Σύνολο ομάδων" value={stats.length} note="Ομάδες για φίλτρο στη λίστα και στόχευση στο Marketing." />
        <Stat label="Πελάτες σε ομάδες" value={members} note="Όσοι ανήκουν σε τουλάχιστον μία ομάδα." />
        <Stat label="Μέσο μέγεθος" value={stats.length ? Math.round(members / stats.length) : 0} note="Μέσος όρος μελών ανά ομάδα." />
        <Stat label="Μεγαλύτερη ομάδα" value={largest?.n ?? 0} note={largest ? `«${largest.g}» είναι η μεγαλύτερη ομάδα.` : '—'} />
      </div>
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

function GroupDialog({ group, rows, preselect, onClose, onSaved }: { group: ContactGroup | null; rows: ContactListRow[]; preselect?: string[]; onClose: () => void; onSaved: (msg: string) => void }) {
  const initial = useMemo(() => new Set(group ? rows.filter((r) => r.groups.includes(group.name)).map((r) => r.id) : preselect ?? []), [group, rows, preselect]);
  const [name, setName] = useState(group?.name ?? '');
  const [desc, setDesc] = useState(group?.description ?? '');
  const [tagText, setTagText] = useState((group?.tags ?? []).join(', '));
  const [members, setMembers] = useState<Set<string>>(new Set(initial));
  const [q, setQ] = useState('');
  const [onlySel, setOnlySel] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ql = q.trim().toLowerCase();
  const shown = rows.filter((r) => r.status !== 'archived' && (!onlySel || members.has(r.id)) && (!ql || [r.name, r.email ?? '', r.phone ?? '', ...r.tags].join(' ').toLowerCase().includes(ql))).slice(0, 200);
  const flip = (id: string) => setMembers((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => start(async () => {
    const tags = tagText.split(',').map((t) => t.trim()).filter(Boolean);
    const add = [...members].filter((id) => !initial.has(id) || !group);
    const remove = [...initial].filter((id) => !members.has(id));
    const r = group ? await updateContactGroup(group.id, { name, description: desc, tags, add, remove }) : await createContactGroup({ name, description: desc, tags, memberIds: [...members] });
    if (!r.ok) { setErr(r.error); return; }
    onSaved(group ? `Η ομάδα «${name}» αποθηκεύτηκε.` : `Δημιουργήθηκε η ομάδα «${name}» με ${members.size} μέλη.`);
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">{group ? 'Επεξεργασία ' : 'Νέα '}<em className="text-forest">ομάδα</em></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button></div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Βασικά</p>
          <label className="block"><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Όνομα *</span><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Επενδυτές Ισραήλ, VIP Λεμεσός" /></label>
          <label className="block"><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Περιγραφή</span><input className="input" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ποιοι ανήκουν εδώ και γιατί" /></label>
          <label className="block"><span className="mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Tags</span><input className="input" value={tagText} onChange={(e) => setTagText(e.target.value)} placeholder="π.χ. investor, golden visa, sea view" /><span className="mt-1 block text-[12px] text-charcoal-600">Χωρισμένα με κόμμα</span></label>
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <p className="text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Μέλη · {members.size}</p>
              <label className="ml-auto flex items-center gap-1.5 text-sm text-charcoal-600"><input type="checkbox" checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)} /> Μόνο επιλεγμένοι</label>
            </div>
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση πελάτη για προσθήκη…" className="input pl-9" /></label>
            <div className="mt-2 max-h-64 divide-y divide-stone-line overflow-y-auto rounded-xl border border-stone-line">
              {shown.map((r) => (
                <label key={r.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
                  <input type="checkbox" checked={members.has(r.id)} onChange={() => flip(r.id)} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-charcoal" data-no-tr>{r.name}</span><span className="block truncate text-[12px] text-charcoal-600" data-no-tr>{[r.email, r.phone].filter(Boolean).join(' · ')}</span></span>
                  <span className="hidden gap-1 sm:flex">{r.roles.slice(0, 2).map((x) => <span key={x} className={ROLE_TONE[x]}>{ROLE_EL[x]}</span>)}</span>
                </label>
              ))}
              {shown.length === 0 && <p className="p-4 text-center text-sm text-charcoal-600">Κανένας πελάτης.</p>}
            </div>
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-6 py-4"><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !name.trim()} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></div>
      </div>
    </div>
  );
}

function ImportPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [map, setMap] = useState<Record<string, string>>({});
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const FIELDS: [string, string, RegExp][] = [['name', 'Ονοματεπώνυμο *', /^(full.?name|name|όνομα|ονοματεπώνυμο|πελάτης)$/i], ['email', 'Email', /e-?mail/i], ['phone', 'Τηλέφωνο', /phone|mobile|τηλ|κινητό/i], ['role', 'Ιδιότητα', /role|type|ιδιότητα|τύπος/i], ['source', 'Πηγή', /source|πηγή/i], ['tags', 'Tags', /tag/i], ['group', 'Ομάδα', /group|ομάδα/i]];
  const parse = (text: string) => {
    const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim());
    if (lines.length < 2) { setErr('Το αρχείο χρειάζεται επικεφαλίδα και τουλάχιστον μία γραμμή.'); return; }
    const sep = (lines[0].match(/;/g)?.length ?? 0) > (lines[0].match(/,/g)?.length ?? 0) ? ';' : lines[0].includes('\t') ? '\t' : ',';
    const split = (l: string) => { const out: string[] = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
    const head = split(lines[0].replace(/^\ufeff/, ''));
    setCols(head);
    setRows(lines.slice(1).map((l) => { const v = split(l); return Object.fromEntries(head.map((h, i) => [h, v[i] ?? ''])); }));
    const m: Record<string, string> = {}; for (const [k, , re] of FIELDS) { const hit = head.find((h) => re.test(h)); if (hit) m[k] = hit; } setMap(m); setErr(null);
  };
  const run = () => start(async () => {
    if (!map.name) { setErr('Διαλέξτε ποια στήλη είναι το ονοματεπώνυμο.'); return; }
    const payload = rows.map((r) => ({ name: r[map.name] ?? '', email: map.email ? r[map.email] : '', phone: map.phone ? r[map.phone] : '', role: map.role ? r[map.role] : '', source: map.source ? r[map.source] : '', tags: map.tags ? r[map.tags] : '', group: map.group ? r[map.group] : '' })).filter((r) => r.name.trim());
    const res = await importContacts(payload);
    if (!res.ok) { setErr(res.error); return; }
    if (res.errors.length) setErr(res.errors.join('\n'));
    onDone(`Εισήχθησαν ${res.created} επαφές${res.skipped ? ` · ${res.skipped} υπήρχαν ήδη` : ''}.`);
  });
  return (
    <div className="space-y-4 rounded-2xl border border-stone-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 font-semibold text-charcoal"><FileSpreadsheet size={17} className="text-forest" /> Import επαφών από CSV / Excel</p>
        <button type="button" onClick={() => { const csv = '\ufeffΟνοματεπώνυμο,Email,Τηλέφωνο,Ιδιότητα,Πηγή,Tags,Ομάδα\nMaria Georgiou,maria@example.com,+35799000000,lead,website,VIP,Λεμεσός'; const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'oramira-epafes-protypo.csv'; a.click(); }} className="text-xs font-medium text-forest hover:underline">Κατέβασμα προτύπου</button>
      </div>
      <label className="flex cursor-pointer flex-col items-center gap-1 rounded-2xl border-2 border-dashed border-forest/25 bg-forest/[0.03] px-4 py-8 text-center text-sm text-charcoal-600 hover:border-forest/50">
        <Upload size={22} className="text-forest" />
        <span>Επιλέξτε αρχείο <b>.csv</b> (από Excel: Αποθήκευση ως → CSV)</span>
        <input type="file" accept=".csv,text/csv" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(parse); }} />
      </label>
      {cols.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {FIELDS.map(([k, label]) => (
              <label key={k} className="block"><span className="text-xs font-medium text-charcoal-600">{label}</span>
                <select className="input mt-1" value={map[k] ?? ''} onChange={(e) => setMap((m) => ({ ...m, [k]: e.target.value }))}><option value="">—</option>{cols.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
            ))}
          </div>
          <div className="overflow-x-auto rounded-xl border border-stone-line">
            <table className="w-full text-xs"><thead className="bg-forest/[0.04]"><tr>{cols.map((c) => <th key={c} className="px-3 py-2 text-left font-semibold">{c}</th>)}</tr></thead>
              <tbody>{rows.slice(0, 5).map((r, i) => <tr key={i} className="border-t border-stone-line">{cols.map((c) => <td key={c} className="px-3 py-1.5" data-no-tr>{r[c]}</td>)}</tr>)}</tbody></table>
          </div>
          <div className="flex items-center gap-3"><span className="text-sm text-charcoal-600">{rows.length} γραμμές έτοιμες</span><button type="button" disabled={pending} onClick={run} className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Upload size={14} /> {pending ? 'Εισαγωγή…' : 'Εισαγωγή'}</button></div>
        </>
      )}
      {err && <p className="whitespace-pre-line text-sm text-signal-danger">{err}</p>}
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
