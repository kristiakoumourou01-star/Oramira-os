'use client';

import { HubCards } from '@/components/ui/HubCards';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutTemplate, Layers, SlidersHorizontal, GripVertical, Lock, Eye, EyeOff, Pencil, Plus, RotateCcw, Save, Bell, Search, Home, Calendar,
  Wrench, FileText, User, Phone as PhoneIcon, MessageCircle, Hammer, CreditCard, Building2, Megaphone, Check, Copy, Apple, Smartphone,
  Users, ListChecks, Inbox, Plane, UserPlus, StickyNote, Trash2, ClipboardCheck,
} from 'lucide-react';
import { saveMobileApp } from '@/app/actions/mobile-app';
import { useDragSort, moveItem } from '@/components/ui/useDragSort';
import { Switch } from '@/components/admin/PermissionMatrix';
import { formatCurrency } from '@/lib/format';
import { catalogFor, defaultBlocks, type BlockDef, type MobileAppKind, type MobileAppSettings, type MobileBlock } from '@/lib/mobile-app-shared';

type Tab = 'home' | 'content' | 'settings';
export interface MobileProjectInfo { id: string; name: string; location: string | null; available: number; total: number; fromPrice: number | null }
/** Real numbers for the Admin app preview. */
export interface AdminPreviewStats { leadsToday: number; followupsDue: number; pendingLeave: number; openTasks: number; unitsAvailable: number; me: string }

const KIND_OPTIONS: [MobileAppKind, string][] = [['customer', 'Εφαρμογή πελατών'], ['admin', 'Εφαρμογή ομάδας']];

/** Admin → Mobile app (όπως στο FitnessCRM): Home builder με ζωντανή προεπισκόπηση, Content, Settings — για την εφαρμογή πελατών και της ομάδας. */
export function MobileAppBuilder({ initial, projects, installUrl, company, stats, canEdit = true }: {
  initial: MobileAppSettings; projects: MobileProjectInfo[]; installUrl: string; company: string; stats: AdminPreviewStats; canEdit?: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');
  const [kind, setKind] = useState<MobileAppKind>('customer');
  const [cfg, setCfg] = useState<MobileAppSettings>(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const set = (p: Partial<MobileAppSettings>) => { if (!canEdit) return; setCfg((c) => ({ ...c, ...p })); setDirty(true); setMsg(null); };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const save = () => start(async () => {
    const r = await saveMobileApp(cfg);
    if (r.ok) { setDirty(false); setMsg({ ok: true, text: 'Αποθηκεύτηκε. Οι αλλαγές φαίνονται στην επόμενη ανανέωση της εφαρμογής.' }); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  });

  const catalog = catalogFor(kind);
  const DEF = Object.fromEntries(catalog.map((b) => [b.key, b])) as Record<string, BlockDef>;
  const blocks = kind === 'admin' ? cfg.adminBlocks : cfg.blocks;
  const head = blocks.find((b) => b.key === 'header') ?? { key: 'header', on: true };
  const foot = blocks.find((b) => b.key === 'footer') ?? { key: 'footer', on: true };
  const mid = blocks.filter((b) => b.key !== 'header' && b.key !== 'footer');
  const setMid = (m: MobileBlock[]) => {
    const next = [head, ...m, foot];
    set(kind === 'admin' ? { adminBlocks: next } : { blocks: next });
  };
  const dnd = useDragSort((a, b) => setMid(moveItem(mid, a, b)), canEdit, `mblocks-${kind}`);
  const missing = catalog.filter((b) => !b.locked && !blocks.some((x) => x.key === b.key));
  const projList = (() => {
    const order = cfg.projects.map((p) => p.id);
    return [...projects].sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  })();
  const projCfg = (id: string) => cfg.projects.find((p) => p.id === id) ?? { id, shown: true };
  const setProj = (id: string, p: Partial<{ shown: boolean; tagline: string }>) => {
    const base = projList.map((x) => projCfg(x.id));
    set({ projects: base.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  };
  const pdnd = useDragSort((a, b) => set({ projects: moveItem(projList.map((x) => projCfg(x.id)), a, b) }), canEdit, 'mprojects');

  const visibleCount = cfg.blocks.filter((b) => b.on).length + cfg.adminBlocks.filter((b) => b.on).length;
  const cards: { k: Tab; icon: any; title: string; sub: string; n?: number }[] = [
    { k: 'home', icon: LayoutTemplate, title: 'Home', sub: 'Μπλοκ στην αρχική οθόνη', n: visibleCount },
    { k: 'content', icon: Layers, title: 'Content', sub: 'Έργα και ακίνητα που εμφανίζονται', n: projList.filter((p) => projCfg(p.id).shown).length },
    { k: 'settings', icon: SlidersHorizontal, title: 'Settings', sub: 'Εμφάνιση, πρόσβαση, υποστήριξη' },
  ];
  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-3.5 text-[14px] text-charcoal hover:border-forest/30 disabled:opacity-40';
  const editBlock = editing ? mid.find((b) => b.key === editing) ?? null : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-semibold text-charcoal">Mobile App</h1>
        <p className="text-[14px] text-charcoal-600">Τι βλέπουν οι πελάτες σας και η ομάδα σας στο κινητό: αρχική οθόνη, περιεχόμενο και ρυθμίσεις.</p>
      </div>
      <HubCards cols={3} active={tab} onSelect={(k) => setTab(k as Tab)} cards={cards.map((c) => ({ key: c.k, icon: c.icon, title: c.title, value: c.n, sub: c.sub }))} />

      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-[14px] border border-stone-line bg-white/95 px-4 py-2.5 backdrop-blur">
        <p className="text-[17px] font-semibold text-charcoal">{tab === 'home' ? 'Home Builder' : tab === 'content' ? 'Content' : 'Settings'}</p>
        {!canEdit && <span className="inline-flex items-center gap-1 rounded-full border border-stone-line px-2.5 py-0.5 text-[12px] text-charcoal-600"><Lock size={12} /> Μόνο προβολή</span>}
        {dirty && <span className="rounded-full border border-forest/30 px-2.5 py-0.5 text-[12px] font-medium text-forest">Μη αποθηκευμένες αλλαγές</span>}
        {msg && <span className={`text-[13px] ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        {canEdit && (
          <span className="ml-auto flex flex-wrap gap-2">
            {tab === 'home' && <button type="button" className={btn} onClick={() => { if (window.confirm('Επαναφορά της αρχικής οθόνης στην προεπιλογή; Οι αλλαγές σας στη διάταξη χάνονται.')) set(kind === 'admin' ? { adminBlocks: defaultBlocks('admin') } : { blocks: defaultBlocks('customer') }); }}><RotateCcw size={14} /> Επαναφορά προεπιλογής</button>}
            {tab === 'home' && <button type="button" className={btn} onClick={() => setAdding(true)} disabled={!missing.length}><Plus size={14} /> Προσθήκη μπλοκ</button>}
            <button type="button" onClick={save} disabled={!dirty || pending} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-forest px-4 text-[14px] font-medium text-white hover:bg-forest/90 disabled:opacity-40"><Save size={14} /> {pending ? 'Αποθήκευση…' : tab === 'home' ? 'Αποθήκευση διάταξης' : 'Αποθήκευση'}</button>
          </span>
        )}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {tab === 'home' && (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <KindSwitch kind={kind} onChange={setKind} />
                <p className="text-[13px] text-charcoal-600">{kind === 'admin' ? 'Η αρχική οθόνη της ομάδας σας στο κινητό.' : 'Η αρχική οθόνη που βλέπουν ιδιοκτήτες, αγοραστές και επενδυτές.'}</p>
              </div>
              <ul className="space-y-2">
                <LockedRow label={head.title ?? DEF.header.label} hint={DEF.header.hint} />
                {mid.map((b, i) => (
                  <li key={b.key} {...dnd.item(i)} className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition ${b.on ? 'border-stone-line' : 'border-dashed border-stone-line opacity-60'} ${dnd.cls(i)}`}>
                    <GripVertical size={16} className={`${canEdit ? 'cursor-grab' : ''} shrink-0 text-charcoal-600/50`} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-semibold text-charcoal">{b.title ?? DEF[b.key]?.label}</span>
                      <span className="block truncate text-[12.5px] text-charcoal-600">{b.text || DEF[b.key]?.hint}</span>
                    </span>
                    {canEdit && <>
                      <button type="button" title="Επεξεργασία μπλοκ" aria-label="Επεξεργασία μπλοκ" onClick={() => setEditing(b.key)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-charcoal"><Pencil size={14} /></button>
                      <button type="button" title={b.on ? 'Απόκρυψη' : 'Εμφάνιση'} aria-label={b.on ? 'Απόκρυψη' : 'Εμφάνιση'} onClick={() => setMid(mid.map((x) => (x.key === b.key ? { ...x, on: !x.on } : x)))} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-charcoal">{b.on ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                    </>}
                  </li>
                ))}
                <LockedRow label={foot.title ?? DEF.footer.label} hint={DEF.footer.hint} />
              </ul>
              <p className="text-[12.5px] text-charcoal-600">Σύρετε από τη λαβή για να αλλάξετε σειρά. Τίποτα δεν φτάνει στο κινητό μέχρι να πατήσετε «Αποθήκευση διάταξης».</p>
            </>
          )}

          {tab === 'content' && (
            <div className="space-y-3">
              <p className="text-[14px] text-charcoal-600">Ποια έργα εμφανίζονται στην εφαρμογή πελατών, με ποια σειρά (σύρσιμο) και με ποια σύντομη περιγραφή.</p>
              {projList.length === 0 && <p className="rounded-[14px] border border-dashed border-stone-line p-6 text-center text-[14px] text-charcoal-600">Δεν υπάρχουν ακόμη έργα.</p>}
              <ul className="space-y-2">
                {projList.map((p, i) => {
                  const pc = projCfg(p.id);
                  return (
                    <li key={p.id} {...pdnd.item(i)} className={`flex flex-wrap items-center gap-3 rounded-xl border border-stone-line bg-white px-3 py-2.5 ${pdnd.cls(i)} ${pc.shown ? '' : 'opacity-60'}`}>
                      <GripVertical size={16} className="cursor-grab text-charcoal-600/50" />
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest/[0.09] text-forest"><Building2 size={16} /></span>
                      <span className="min-w-[160px] flex-1">
                        <span className="block text-[14px] font-semibold text-charcoal" data-no-tr>{p.name}</span>
                        <span className="flex flex-wrap gap-x-1.5 text-[12.5px] text-charcoal-600">
                          {p.location && <span data-no-tr>{p.location}</span>}
                          <span><span className="tabular-nums">{p.available}/{p.total}</span> <span>διαθέσιμες</span></span>
                          {p.fromPrice ? <span><span>από</span> <span className="tabular-nums">{formatCurrency(p.fromPrice)}</span></span> : null}
                        </span>
                      </span>
                      <input className="input h-8 w-full py-1 text-[13px] sm:w-64" disabled={!canEdit} placeholder="Σύντομη περιγραφή στην εφαρμογή" value={pc.tagline ?? ''} onChange={(e) => setProj(p.id, { tagline: e.target.value })} />
                      <button type="button" disabled={!canEdit} onClick={() => setProj(p.id, { shown: !pc.shown })} className={`rounded-full px-3 py-1 text-[12px] font-semibold ${pc.shown ? 'bg-forest text-white' : 'border border-stone-line text-charcoal-600'}`}>{pc.shown ? 'Εμφανίζεται' : 'Κρυφό'}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <Section title="Διαθεσιμότητα">
                <Toggle label="Εφαρμογή πελατών ενεργή" hint="Όταν είναι κλειστό, οι πελάτες βλέπουν μήνυμα ότι η εφαρμογή είναι προσωρινά μη διαθέσιμη." on={cfg.appEnabled} set={(v) => set({ appEnabled: v })} disabled={!canEdit} />
                <Toggle label="Εφαρμογή ομάδας ενεργή" hint="Η ομάδα βλέπει την αρχική οθόνη της στο κινητό." on={cfg.adminEnabled} set={(v) => set({ adminEnabled: v })} disabled={!canEdit} />
              </Section>
              <Section title="Τι εμφανίζεται στους πελάτες">
                <Toggle label="Τιμές ακινήτων" hint="Δείχνει τιμές στα διαθέσιμα ακίνητα." on={cfg.showPrices} set={(v) => set({ showPrices: v })} disabled={!canEdit} />
                <Toggle label="Διαθεσιμότητα μονάδων" hint="Πόσες μονάδες είναι διαθέσιμες σε κάθε έργο." on={cfg.showAvailability} set={(v) => set({ showAvailability: v })} disabled={!canEdit} />
                <Toggle label="Πρόοδος κατασκευής" hint="Ποσοστό και φωτογραφίες εργοταξίου για τους αγοραστές." on={cfg.showConstruction} set={(v) => set({ showConstruction: v })} disabled={!canEdit} />
                <Toggle label="Πληρωμές" hint="Πρόγραμμα πληρωμών και επόμενη δόση." on={cfg.showPayments} set={(v) => set({ showPayments: v })} disabled={!canEdit} />
                <Toggle label="Έγγραφα" hint="Συμβόλαια, τίτλοι, εγγυήσεις του πελάτη." on={cfg.showDocuments} set={(v) => set({ showDocuments: v })} disabled={!canEdit} />
              </Section>
              <Section title="Ενέργειες πελατών">
                <Toggle label="Κράτηση προβολής" hint="Ο πελάτης κλείνει μόνος του ραντεβού προβολής." on={cfg.allowViewings} set={(v) => set({ allowViewings: v })} disabled={!canEdit} />
                <Toggle label="Αιτήματα συντήρησης" hint="Ο ιδιοκτήτης δηλώνει βλάβη και η ομάδα ειδοποιείται αμέσως." on={cfg.allowMaintenance} set={(v) => set({ allowMaintenance: v })} disabled={!canEdit} />
              </Section>
              <Section title="Εγγραφή & σύνδεση">
                <Toggle label="Εγγραφή από την εφαρμογή" hint="Νέοι πελάτες κάνουν λογαριασμό μόνοι τους." on={cfg.selfRegister} set={(v) => set({ selfRegister: v })} disabled={!canEdit} />
                <Toggle label="Αυτόματη έγκριση" hint="Αλλιώς οι νέοι λογαριασμοί περιμένουν έγκριση από την ομάδα." on={cfg.autoApprove} set={(v) => set({ autoApprove: v })} disabled={!canEdit} />
                <div className="flex flex-wrap items-center gap-2 px-4 py-3">
                  <span className="w-full text-[14px] font-medium text-charcoal">Κωδικός σύνδεσης μέσω</span>
                  <span className="inline-flex gap-1 rounded-xl border border-stone-line p-1">
                    {(['email', 'sms'] as const).map((m) => <button key={m} type="button" disabled={!canEdit} onClick={() => set({ loginMethod: m })} className={`rounded-[10px] px-3 py-1.5 text-[13px] font-medium ${cfg.loginMethod === m ? 'bg-forest text-white' : 'text-charcoal-600 hover:bg-stone-100'}`}>{m === 'email' ? 'Email' : 'Κινητό (SMS)'}</button>)}
                  </span>
                </div>
              </Section>
              <Section title="Μηνύματα & υποστήριξη">
                <div className="grid gap-3 px-4 py-3 sm:grid-cols-2">
                  <Field label="Καλωσόρισμα πελατών"><input className="input" disabled={!canEdit} value={cfg.welcome} onChange={(e) => set({ welcome: e.target.value })} /></Field>
                  <Field label="Καλωσόρισμα ομάδας"><input className="input" disabled={!canEdit} value={cfg.adminWelcome} onChange={(e) => set({ adminWelcome: e.target.value })} /></Field>
                  <Field label="Τηλέφωνο υποστήριξης"><input className="input" disabled={!canEdit} value={cfg.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} placeholder="+357 …" /></Field>
                  <Field label="Email υποστήριξης"><input className="input" disabled={!canEdit} value={cfg.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} placeholder="info@…" /></Field>
                  <Field label="Instagram"><input className="input" disabled={!canEdit} value={cfg.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="https://instagram.com/…" /></Field>
                  <Field label="Facebook"><input className="input" disabled={!canEdit} value={cfg.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="https://facebook.com/…" /></Field>
                  <Field label="Website"><input className="input" disabled={!canEdit} value={cfg.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://…" /></Field>
                </div>
              </Section>
              <Section title="Εγκατάσταση στο κινητό">
                <div className="space-y-3 px-4 py-3 text-[14px] text-charcoal-600">
                  <p>Η εφαρμογή μπαίνει στο κινητό σαν κανονική εφαρμογή, χωρίς App Store και χωρίς κόστος. Στείλτε το link στους πελάτες και στην ομάδα.</p>
                  <CopyField url={installUrl} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-stone-50 p-3"><p className="mb-1 flex items-center gap-1.5 font-semibold text-charcoal"><Apple size={14} /> iPhone</p><p className="text-[12.5px]">Safari → Κοινοποίηση → «Προσθήκη στην οθόνη Αφετηρίας».</p></div>
                    <div className="rounded-xl bg-stone-50 p-3"><p className="mb-1 flex items-center gap-1.5 font-semibold text-charcoal"><Smartphone size={14} /> Android</p><p className="text-[12.5px]">Chrome → ⋮ → «Εγκατάσταση εφαρμογής».</p></div>
                  </div>
                </div>
              </Section>
            </div>
          )}
        </div>

        <div className="xl:sticky xl:top-32">
          <div className="mb-3 flex justify-center"><KindSwitch kind={kind} onChange={setKind} /></div>
          <Phone kind={kind} cfg={cfg} company={company} stats={stats}
            projects={projList.filter((p) => projCfg(p.id).shown).map((p) => ({ ...p, tagline: projCfg(p.id).tagline }))} />
        </div>
      </div>

      {adding && (
        <Modal open onClose={() => setAdding(false)} size="lg" title="Προσθήκη μπλοκ" description={kind === 'admin' ? 'Εφαρμογή ομάδας' : 'Εφαρμογή πελατών'}>
          <ModalBody>
            {missing.length === 0 ? <p className="text-[14px] text-charcoal-600">Όλα τα μπλοκ είναι ήδη στην οθόνη.</p> : (
              <div className="grid gap-2 sm:grid-cols-2">
                {missing.map((b) => (
                  <button key={b.key} type="button" onClick={() => { setMid([...mid, { key: b.key, on: true }]); setAdding(false); }} className="rounded-xl border border-stone-line bg-white p-3 text-left hover:border-forest/40">
                    <p className="text-[14px] font-semibold text-charcoal">{b.label}</p><p className="text-[12.5px] text-charcoal-600">{b.hint}</p>
                  </button>
                ))}
              </div>
            )}
          </ModalBody>
        </Modal>
      )}
      {editBlock && (
        <BlockDialog block={editBlock} def={DEF[editBlock.key]} onClose={() => setEditing(null)}
          onSave={(nb) => { setMid(mid.map((x) => (x.key === nb.key ? nb : x))); setEditing(null); }}
          onRemove={() => { setMid(mid.filter((x) => x.key !== editBlock.key)); setEditing(null); }} />
      )}
    </div>
  );
}

function KindSwitch({ kind, onChange }: { kind: MobileAppKind; onChange: (k: MobileAppKind) => void }) {
  return (
    <span className="inline-flex gap-1 rounded-xl border border-stone-line bg-white p-1" role="tablist">
      {KIND_OPTIONS.map(([k, l]) => (
        <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => onChange(k)}
          className={`inline-flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-[13px] font-medium transition-colors ${kind === k ? 'bg-forest text-white' : 'text-charcoal-600 hover:bg-stone-100'}`}>
          {k === 'admin' ? <Users size={13} /> : <User size={13} />} {l}
        </button>
      ))}
    </span>
  );
}

function BlockDialog({ block, def, onClose, onSave, onRemove }: { block: MobileBlock; def: BlockDef; onClose: () => void; onSave: (b: MobileBlock) => void; onRemove: () => void }) {
  const [title, setTitle] = useState(block.title ?? '');
  const [text, setText] = useState(block.text ?? '');
  const [on, setOn] = useState(block.on);
  const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
  return (
    <Modal open onClose={onClose} size="lg" title="Επεξεργασία μπλοκ" description={def.hint}>
      <ModalBody className="space-y-4">
        <label className="block"><span className={lbl}>Τίτλος</span>
          <input className="input text-sm" value={title} placeholder={def.label} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
        </label>
        {def.text && (
          <label className="block"><span className={lbl}>Κείμενο</span>
            <textarea rows={3} className="input text-sm" value={text} maxLength={400} onChange={(e) => setText(e.target.value)} placeholder="Το μήνυμα που θα δουν" />
          </label>
        )}
        <div className="flex items-center gap-3 rounded-xl border border-stone-line px-4 py-3">
          <span className="flex-1"><span className="block text-[14px] font-medium text-charcoal">Εμφανίζεται</span><span className="block text-[12.5px] text-charcoal-600">Κρυμμένο μπλοκ μένει στη λίστα αλλά δεν φαίνεται στο κινητό.</span></span>
          <Switch on={on} onChange={setOn} label="Εμφανίζεται" />
        </div>
      </ModalBody>
      <ModalFooter className="items-center">
        <button type="button" onClick={onRemove} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[14px] text-signal-danger hover:bg-signal-danger/10"><Trash2 size={14} /> Αφαίρεση</button>
        <span className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-[10px] border border-stone-line px-4 text-[14px] text-charcoal hover:border-forest/30">Άκυρο</button>
          <button type="button" onClick={() => onSave({ key: block.key, on, ...(title.trim() ? { title: title.trim() } : {}), ...(text.trim() ? { text: text.trim() } : {}) })} className="inline-flex h-9 items-center rounded-[10px] bg-forest px-4 text-[14px] font-medium text-white hover:bg-forest/90">Εφαρμογή</button>
        </span>
      </ModalFooter>
    </Modal>
  );
}

function LockedRow({ label, hint }: { label: string; hint: string }) {
  return <li className="flex items-center gap-3 rounded-xl border border-stone-line bg-stone-50 px-3 py-2.5"><Lock size={15} className="shrink-0 text-charcoal-600/60" /><span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold text-charcoal-600">{label}</span><span className="block truncate text-[12.5px] text-charcoal-600/80">{hint}</span></span></li>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[14px] border border-stone-line bg-white"><p className="border-b border-stone-line bg-stone-50/70 px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.08em] text-charcoal-600">{title}</p><div className="divide-y divide-stone-line/70">{children}</div></div>;
}
function Toggle({ label, hint, on, set, disabled }: { label: string; hint: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3">
      <span className="flex-1"><span className="block text-[14px] font-medium text-charcoal">{label}</span><span className="block text-[12.5px] text-charcoal-600">{hint}</span></span>
      <Switch on={on} onChange={set} disabled={disabled} label={label} />
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-[12px] font-medium text-charcoal-600">{label}</span><div className="mt-1">{children}</div></label>;
}
function CopyField({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return <div className="flex gap-2"><input readOnly className="input min-w-0 flex-1 text-xs" value={url} data-no-tr /><button type="button" onClick={() => { void navigator.clipboard.writeText(url).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-forest px-3.5 text-[13px] font-medium text-white">{ok ? <Check size={13} /> : <Copy size={13} />} {ok ? 'Αντιγράφηκε' : 'Αντιγραφή'}</button></div>;
}

/** Ζωντανή προεπισκόπηση της αρχικής οθόνης σε κινητό (πελάτες ή ομάδα). */
function Phone({ kind, cfg, projects, company, stats }: { kind: MobileAppKind; cfg: MobileAppSettings; projects: (MobileProjectInfo & { tagline?: string })[]; company: string; stats: AdminPreviewStats }) {
  const blocks = kind === 'admin' ? cfg.adminBlocks : cfg.blocks;
  const cat = catalogFor(kind);
  const t = (k: string) => blocks.find((b) => b.key === k)?.title ?? cat.find((c) => c.key === k)?.label ?? k;
  const tx = (k: string) => blocks.find((b) => b.key === k)?.text;
  const Head = ({ k, icon: I }: { k: string; icon: any }) => <p className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-charcoal"><span className="flex items-center gap-1.5"><I size={12} className="text-forest" /><span>{t(k)}</span></span><span className="text-[10px] font-normal text-forest">Όλα</span></p>;
  const card = 'rounded-xl bg-white p-2.5 shadow-sm';
  const sample = projects[0]?.name ?? 'Oramira';

  const customer: Record<string, React.ReactNode> = {
    banner: <div className="rounded-2xl bg-forest p-3 text-white"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/75"><Megaphone size={10} /> <span>{t('banner')}</span></p><p className="mt-1 text-[13px] font-semibold">{tx('banner') || 'Νέο έργο — δείτε τις πρώτες μονάδες'}</p></div>,
    my_unit: <div><Head k="my_unit" icon={Home} /><div className={card}><div className="h-16 rounded-lg bg-forest/20" /><p className="mt-1.5 text-[12px] font-semibold" data-no-tr>{sample}</p><p className="text-[10px] text-charcoal-600">Υπό κατασκευή</p></div></div>,
    construction: cfg.showConstruction ? <div><Head k="construction" icon={Hammer} /><div className={card}><div className="flex justify-between text-[11px]"><span>Σκελετός</span><b className="text-forest">62%</b></div><div className="mt-1 h-1.5 rounded-full bg-stone-100"><div className="h-full w-[62%] rounded-full bg-forest" /></div></div></div> : null,
    payments: cfg.showPayments ? <div><Head k="payments" icon={CreditCard} /><div className={`flex items-center justify-between ${card}`}><span><p className="text-[11px] text-charcoal-600">Επόμενη δόση</p><p className="text-[13px] font-semibold">{formatCurrency(72150)}</p></span><span className="rounded-full bg-forest/10 px-2 py-0.5 text-[10px] text-forest">σε 12 ημ.</span></div></div> : null,
    documents: cfg.showDocuments ? <div><Head k="documents" icon={FileText} /><div className="space-y-1">{['Συμβόλαιο αγοράς', 'Κάτοψη'].map((d) => <p key={d} className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] shadow-sm"><FileText size={11} className="text-forest" />{d}</p>)}</div></div> : null,
    maintenance: cfg.allowMaintenance ? <div className={`flex items-center gap-2 ${card}`}><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest/10 text-forest"><Wrench size={14} /></span><span><p className="text-[12px] font-semibold">{t('maintenance')}</p><p className="text-[10px] text-charcoal-600">Δηλώστε βλάβη με φωτογραφία</p></span></div> : null,
    projects: <div><Head k="projects" icon={Building2} /><div className="flex gap-2 overflow-hidden">{(projects.length ? projects : [{ id: 'x', name: 'Oramira', location: '', available: 4, total: 4, fromPrice: 650000 } as MobileProjectInfo & { tagline?: string }]).slice(0, 3).map((p) => <div key={p.id} className="w-36 shrink-0 rounded-xl bg-white p-2 shadow-sm"><div className="h-14 rounded-lg bg-forest/25" /><p className="mt-1 truncate text-[11px] font-semibold" data-no-tr>{p.name}</p><p className="truncate text-[10px] text-charcoal-600" data-no-tr>{p.tagline || p.location || ''}</p>{(cfg.showAvailability || cfg.showPrices) && <p className="mt-0.5 flex flex-wrap gap-x-1 text-[10px] text-forest">{cfg.showAvailability && <span><span>{p.available}</span> <span>διαθέσιμες</span></span>}{cfg.showPrices && p.fromPrice ? <span><span>από</span> <span>{formatCurrency(p.fromPrice)}</span></span> : null}</p>}</div>)}</div></div>,
    viewings: cfg.allowViewings ? <div className="flex items-center gap-2 rounded-xl bg-forest p-2.5 text-white"><Calendar size={14} /><span className="text-[12px] font-semibold">{t('viewings')}</span></div> : null,
    agent: <div><Head k="agent" icon={User} /><div className={`flex items-center gap-2 ${card}`}><span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white">O</span><span className="flex-1"><p className="text-[12px] font-semibold">{company}</p><p className="text-[10px] text-charcoal-600">Σύμβουλος πωλήσεων</p></span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/10 text-forest"><PhoneIcon size={12} /></span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/10 text-forest"><MessageCircle size={12} /></span></div></div>,
    notice: <div className={card}><p className="flex items-center gap-1.5 text-[12px] font-semibold"><StickyNote size={12} className="text-forest" /><span>{t('notice')}</span></p><p className="mt-1 text-[11px] text-charcoal-600">{tx('notice') || 'Το κείμενό σας εδώ.'}</p></div>,
  };

  const kpi = (n: number, l: string) => <div className="rounded-xl bg-white p-2 text-center shadow-sm"><p className="text-[15px] font-semibold tabular-nums text-charcoal">{n}</p><p className="text-[9.5px] leading-tight text-charcoal-600">{l}</p></div>;
  const admin: Record<string, React.ReactNode> = {
    kpis: <div><Head k="kpis" icon={LayoutTemplate} /><div className="grid grid-cols-3 gap-1.5">{kpi(stats.leadsToday, 'νέα leads')}{kpi(stats.followupsDue, 'follow-ups')}{kpi(stats.unitsAvailable, 'διαθέσιμες')}</div></div>,
    quick_actions: <div className="grid grid-cols-4 gap-1.5">{[[UserPlus, 'Lead'], [PhoneIcon, 'Κλήση'], [Calendar, 'Ραντεβού'], [ListChecks, 'Εργασία']].map(([I, l]: any) => <span key={l} className="flex flex-col items-center gap-1 rounded-xl bg-white py-2 text-[9.5px] text-charcoal shadow-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-white"><I size={13} /></span>{l}</span>)}</div>,
    agenda: <div><Head k="agenda" icon={Calendar} /><div className="space-y-1">{[['10:00', 'Προβολή'], ['13:30', 'Υπογραφή συμβολαίου']].map(([h, l]) => <p key={h} className="flex items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[11px] shadow-sm"><b className="tabular-nums text-forest">{h}</b><span>{l}</span></p>)}</div></div>,
    followups: <div><Head k="followups" icon={ListChecks} /><div className={`flex items-center justify-between ${card}`}><span className="text-[11px] text-charcoal-600">Για σήμερα</span><b className="text-[14px] tabular-nums text-charcoal">{stats.followupsDue}</b></div></div>,
    new_leads: <div><Head k="new_leads" icon={Inbox} /><div className={`flex items-center justify-between ${card}`}><span className="text-[11px] text-charcoal-600">Σήμερα</span><b className="text-[14px] tabular-nums text-charcoal">{stats.leadsToday}</b></div></div>,
    tasks: <div><Head k="tasks" icon={ClipboardCheck} /><div className={`flex items-center justify-between ${card}`}><span className="text-[11px] text-charcoal-600">Ανοιχτές</span><b className="text-[14px] tabular-nums text-charcoal">{stats.openTasks}</b></div></div>,
    approvals: <div><Head k="approvals" icon={Plane} /><div className={`flex items-center justify-between ${card}`}><span className="text-[11px] text-charcoal-600">Άδειες σε αναμονή</span><b className="text-[14px] tabular-nums text-charcoal">{stats.pendingLeave}</b></div></div>,
    availability: <div><Head k="availability" icon={Building2} /><div className="space-y-1">{(projects.length ? projects : []).slice(0, 3).map((p) => <p key={p.id} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5 text-[11px] shadow-sm"><span className="truncate" data-no-tr>{p.name}</span><b className="tabular-nums text-forest">{p.available}/{p.total}</b></p>)}</div></div>,
    announcement: <div className="rounded-2xl bg-forest p-3 text-white"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/75"><Megaphone size={10} /> <span>{t('announcement')}</span></p><p className="mt-1 text-[12px] font-semibold">{tx('announcement') || 'Μήνυμα της διοίκησης προς την ομάδα.'}</p></div>,
  };

  const enabled = kind === 'admin' ? cfg.adminEnabled : cfg.appEnabled;
  const body = kind === 'admin' ? admin : customer;
  const tabs: [any, string][] = kind === 'admin'
    ? [[Home, 'Αρχική'], [Inbox, 'Leads'], [Calendar, 'Ημερολόγιο'], [ListChecks, 'Εργασίες'], [User, 'Προφίλ']]
    : [[Home, 'Αρχική'], [Building2, 'Ακίνητα'], [Calendar, 'Ραντεβού'], [FileText, 'Έγγραφα'], [User, 'Προφίλ']];
  return (
    <div>
      <div className="mx-auto w-[300px] max-w-full rounded-[42px] bg-charcoal p-2.5 shadow-overlay">
        <div className="relative h-[600px] overflow-hidden rounded-[34px] bg-stone-50">
          <div className="flex items-center justify-between px-5 pb-1 pt-2.5 text-[10px] font-semibold text-charcoal"><span>9:41</span><span className="h-4 w-20 rounded-full bg-charcoal" /><span>●●●</span></div>
          <div className="h-[calc(100%-86px)] space-y-3 overflow-y-auto px-3 pb-4">
            {!enabled && <p className="rounded-xl border border-stone-line bg-white p-2 text-[11px] text-charcoal-600">Η εφαρμογή είναι προσωρινά απενεργοποιημένη.</p>}
            <div className="flex items-center justify-between pt-1">
              <span className="min-w-0"><p className="truncate text-[10px] text-charcoal-600" data-no-tr>{kind === 'admin' ? stats.me || company : company}</p><p className="truncate text-[14px] font-semibold text-charcoal">{(kind === 'admin' ? cfg.adminWelcome : cfg.welcome) || 'Καλώς ήρθατε'}</p></span>
              <span className="flex gap-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"><Search size={12} /></span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"><Bell size={12} /></span></span>
            </div>
            {blocks.filter((b) => b.on && b.key !== 'header' && b.key !== 'footer').map((b) => <div key={b.key}>{body[b.key]}</div>)}
            <p className="pt-2 text-center text-[9px] text-charcoal-600/70" data-no-tr>{company}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-around border-t border-stone-line bg-white px-2 pb-4 pt-2 text-[9px] text-charcoal-600">
            {tabs.map(([I, l], i) => <span key={l} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-forest' : ''}`}><I size={15} />{l}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
