'use client';

import { HubCards } from '@/components/ui/HubCards';
import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutTemplate, Layers, SlidersHorizontal, GripVertical, Lock, Eye, EyeOff, Pencil, Plus, RotateCcw, Save, HelpCircle, ChevronDown, Bell, Search, Home, Calendar, Wrench, FileText, User, Phone as PhoneIcon, MessageCircle, Hammer, CreditCard, Building2, Megaphone, Check, Copy, Apple, Smartphone } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { useDragSort, moveItem } from '@/components/ui/useDragSort';
import { BLOCK_CATALOG, DEFAULT_MOBILE, type MobileAppSettings, type MobileBlock } from '@/lib/mobile-app-shared';

type Tab = 'home' | 'content' | 'settings';
export interface MobileProjectInfo { id: string; name: string; location: string | null; available: number; total: number; fromPrice: number | null }

const LABEL = Object.fromEntries(BLOCK_CATALOG.map((b) => [b.key, b]));
const eur = (n: number) => new Intl.NumberFormat('el-GR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

/** Admin → Mobile app (όπως στο FitnessCRM): Home builder με ζωντανή προεπισκόπηση, Content, Settings. */
export function MobileAppBuilder({ initial, projects, installUrl, company }: { initial: MobileAppSettings; projects: MobileProjectInfo[]; installUrl: string; company: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('home');
  const [cfg, setCfg] = useState<MobileAppSettings>(initial);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [help, setHelp] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const set = (p: Partial<MobileAppSettings>) => { setCfg((c) => ({ ...c, ...p })); setDirty(true); setMsg(null); };
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const save = () => start(async () => { const r = await saveOrgSlice('mobileApp', cfg); if (r.ok) { setDirty(false); setMsg('Αποθηκεύτηκε — οι πελάτες το βλέπουν στην επόμενη ανανέωση της εφαρμογής.'); router.refresh(); } else setMsg(r.error); });

  const mid = cfg.blocks.filter((b) => b.key !== 'header' && b.key !== 'footer');
  const setMid = (m: MobileBlock[]) => set({ blocks: [{ key: 'header', on: true }, ...m, { key: 'footer', on: true }] });
  const dnd = useDragSort((a, b) => setMid(moveItem(mid, a, b)), true, 'mblocks');
  const missing = BLOCK_CATALOG.filter((b) => !b.locked && !cfg.blocks.some((x) => x.key === b.key));
  const projList = (() => {
    const order = cfg.projects.map((p) => p.id);
    return [...projects].sort((a, b) => { const ia = order.indexOf(a.id), ib = order.indexOf(b.id); return (ia < 0 ? 999 : ia) - (ib < 0 ? 999 : ib); });
  })();
  const projCfg = (id: string) => cfg.projects.find((p) => p.id === id) ?? { id, shown: true };
  const setProj = (id: string, p: Partial<{ shown: boolean; tagline: string }>) => {
    const base = projList.map((x) => projCfg(x.id));
    set({ projects: base.map((x) => (x.id === id ? { ...x, ...p } : x)) });
  };
  const pdnd = useDragSort((a, b) => set({ projects: moveItem(projList.map((x) => projCfg(x.id)), a, b) }), true, 'mprojects');

  const cards: { k: Tab; icon: any; title: string; sub: string; n?: number }[] = [
    { k: 'home', icon: LayoutTemplate, title: 'Home', sub: 'Μπλοκ στην αρχική οθόνη', n: cfg.blocks.filter((b) => b.on).length },
    { k: 'content', icon: Layers, title: 'Content', sub: 'Έργα και ακίνητα που εμφανίζονται' },
    { k: 'settings', icon: SlidersHorizontal, title: 'Settings', sub: 'Εμφάνιση, πρόσβαση, υποστήριξη' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-3xl text-charcoal">Mobile App</h1>
        <p className="text-sm text-charcoal-600/75">Τι βλέπουν οι πελάτες σας (ιδιοκτήτες, αγοραστές, επενδυτές) στην εφαρμογή — αρχική οθόνη, περιεχόμενο και ρυθμίσεις.</p>
      </div>
      <HubCards cols={3} active={tab} onSelect={(k) => setTab(k as typeof tab)} cards={cards.map((c) => ({ key: c.k, icon: c.icon, title: c.title, value: c.n, sub: c.sub }))} />

      <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 rounded-2xl border border-stone-line bg-white/95 px-4 py-2.5 backdrop-blur">
        <p className="font-display text-xl text-charcoal">{tab === 'home' ? 'Home Builder' : tab === 'content' ? 'Content' : 'Settings'}</p>
        {dirty && <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Μη αποθηκευμένες αλλαγές</span>}
        {msg && <span className="text-xs text-forest">{msg}</span>}
        <span className="ml-auto flex gap-2">
          {tab === 'home' && <button type="button" onClick={() => set({ blocks: DEFAULT_MOBILE.blocks })} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-stone-line px-3.5 text-sm text-charcoal-600 hover:border-forest/40 hover:text-forest"><RotateCcw size={14} /> Επαναφορά</button>}
          {tab === 'home' && <button type="button" onClick={() => setAdding((a) => !a)} disabled={!missing.length} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-forest/40 bg-forest/[0.07] px-3.5 text-sm font-medium text-forest hover:bg-forest hover:text-white disabled:opacity-40"><Plus size={14} /> Προσθήκη μπλοκ</button>}
          <button type="button" onClick={save} disabled={!dirty || pending} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-forest px-4 text-sm font-semibold text-white shadow-sm hover:bg-forest/90 disabled:opacity-40"><Save size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
        </span>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          {tab === 'home' && (
            <>
              <div className="overflow-hidden rounded-2xl border border-stone-line bg-white">
                <button type="button" onClick={() => setHelp((h) => !h)} className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-charcoal"><span className="flex items-center gap-2"><HelpCircle size={15} className="text-forest" /> Πώς λειτουργεί η αρχική οθόνη</span><ChevronDown size={16} className={`transition ${help ? 'rotate-180' : ''}`} /></button>
                {help && (
                  <div className="space-y-2 border-t border-stone-line px-4 py-3 text-sm text-charcoal-600">
                    <p>Αυτή είναι η οθόνη που βλέπουν οι πελάτες όταν ανοίγουν την εφαρμογή. Αποτελείται από μπλοκ, το ένα κάτω από το άλλο, με τη σειρά που φαίνονται εδώ. Η προεπισκόπηση δεξιά αλλάζει αμέσως.</p>
                    <ul className="list-disc space-y-1 pl-5">
                      <li><b>Προσθήκη μπλοκ</b> βάζει νέα ενότητα στην οθόνη.</li>
                      <li>Σύρετε από τη λαβή <GripVertical size={12} className="inline" /> για να αλλάξετε σειρά.</li>
                      <li>Το <Eye size={12} className="inline" /> κρύβει ή εμφανίζει ένα μπλοκ, το <Pencil size={12} className="inline" /> αλλάζει τον τίτλο του.</li>
                      <li>Κεφαλίδα και υποσέλιδο έχουν λουκέτο και δεν μετακινούνται.</li>
                      <li>Τίποτα δεν φτάνει στους πελάτες μέχρι να πατήσετε <b>Αποθήκευση</b>.</li>
                    </ul>
                  </div>
                )}
              </div>
              {adding && (
                <div className="grid gap-2 rounded-2xl border border-forest/20 bg-forest/[0.03] p-3 sm:grid-cols-2">
                  {missing.map((b) => (
                    <button key={b.key} type="button" onClick={() => { setMid([...mid, { key: b.key, on: true }]); setAdding(false); }} className="rounded-xl bg-white p-3 text-left ring-1 ring-inset ring-stone-line hover:ring-forest/40">
                      <p className="text-sm font-semibold text-charcoal">{b.label}</p><p className="text-xs text-charcoal-600/70">{b.hint}</p>
                    </button>
                  ))}
                </div>
              )}
              <ul className="space-y-2">
                <LockedRow label={LABEL.header.label} hint={LABEL.header.hint} />
                {mid.map((b, i) => (
                  <li key={b.key} {...dnd.item(i)} className={`flex items-center gap-3 rounded-xl border bg-white px-3 py-2.5 transition ${b.on ? 'border-stone-line' : 'border-dashed border-stone-line opacity-60'} ${dnd.cls(i)}`}>
                    <GripVertical size={16} className="cursor-grab text-charcoal-600/40" />
                    <span className="min-w-0 flex-1">
                      {editing === b.key
                        ? <input autoFocus className="input h-8 py-1 text-sm" defaultValue={b.title ?? LABEL[b.key].label} onBlur={(e) => { setMid(mid.map((x) => (x.key === b.key ? { ...x, title: e.target.value.trim() || undefined } : x))); setEditing(null); }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                        : <><span className="block text-sm font-semibold text-charcoal">{b.title ?? LABEL[b.key].label}</span><span className="block text-xs text-charcoal-600/60">{LABEL[b.key].hint}</span></>}
                    </span>
                    <button type="button" title="Αλλαγή τίτλου" onClick={() => setEditing(b.key)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-forest/10 hover:text-forest"><Pencil size={14} /></button>
                    <button type="button" title={b.on ? 'Απόκρυψη' : 'Εμφάνιση'} onClick={() => setMid(mid.map((x) => (x.key === b.key ? { ...x, on: !x.on } : x)))} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-forest/10 hover:text-forest">{b.on ? <Eye size={15} /> : <EyeOff size={15} />}</button>
                  </li>
                ))}
                <LockedRow label={LABEL.footer.label} hint={LABEL.footer.hint} />
              </ul>
            </>
          )}

          {tab === 'content' && (
            <div className="space-y-3">
              <p className="text-sm text-charcoal-600/80">Διαλέξτε ποια έργα εμφανίζονται στην εφαρμογή, με ποια σειρά (σύρσιμο) και με ποια σύντομη περιγραφή.</p>
              {projList.length === 0 && <p className="rounded-2xl border border-dashed border-stone-line p-6 text-center text-sm text-charcoal-600/70">Δεν υπάρχουν ακόμη έργα.</p>}
              <ul className="space-y-2">
                {projList.map((p, i) => {
                  const pc = projCfg(p.id);
                  return (
                    <li key={p.id} {...pdnd.item(i)} className={`flex flex-wrap items-center gap-3 rounded-xl border border-stone-line bg-white px-3 py-2.5 ${pdnd.cls(i)} ${pc.shown ? '' : 'opacity-60'}`}>
                      <GripVertical size={16} className="cursor-grab text-charcoal-600/40" />
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-forest/10 text-forest"><Building2 size={16} /></span>
                      <span className="min-w-[180px] flex-1">
                        <span className="block text-sm font-semibold text-charcoal" data-no-tr>{p.name}</span>
                        <span className="block text-xs text-charcoal-600/60">{[p.location, `${p.available}/${p.total} διαθέσιμες`, p.fromPrice ? `από ${eur(p.fromPrice)}` : null].filter(Boolean).join(' · ')}</span>
                      </span>
                      <input className="input h-8 w-64 py-1 text-xs" placeholder="Σύντομη περιγραφή στην εφαρμογή" value={pc.tagline ?? ''} onChange={(e) => setProj(p.id, { tagline: e.target.value })} />
                      <button type="button" onClick={() => setProj(p.id, { shown: !pc.shown })} className={`rounded-full px-3 py-1 text-xs font-semibold ${pc.shown ? 'bg-forest text-white' : 'border border-stone-line text-charcoal-600'}`}>{pc.shown ? 'Εμφανίζεται' : 'Κρυφό'}</button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {tab === 'settings' && (
            <div className="space-y-4">
              <Section title="Διαθεσιμότητα">
                <Toggle label="Εφαρμογή ενεργή" hint="Όταν είναι κλειστό, οι πελάτες βλέπουν μήνυμα ότι η εφαρμογή είναι προσωρινά μη διαθέσιμη." on={cfg.appEnabled} set={(v) => set({ appEnabled: v })} />
              </Section>
              <Section title="Τι εμφανίζεται">
                <Toggle label="Τιμές ακινήτων" hint="Δείχνει τιμές στα διαθέσιμα ακίνητα." on={cfg.showPrices} set={(v) => set({ showPrices: v })} />
                <Toggle label="Διαθεσιμότητα μονάδων" hint="Πόσες μονάδες είναι διαθέσιμες σε κάθε έργο." on={cfg.showAvailability} set={(v) => set({ showAvailability: v })} />
                <Toggle label="Πρόοδος κατασκευής" hint="Ποσοστό και φωτογραφίες εργοταξίου για τους αγοραστές." on={cfg.showConstruction} set={(v) => set({ showConstruction: v })} />
                <Toggle label="Πληρωμές" hint="Πρόγραμμα πληρωμών και επόμενη δόση." on={cfg.showPayments} set={(v) => set({ showPayments: v })} />
                <Toggle label="Έγγραφα" hint="Συμβόλαια, τίτλοι, εγγυήσεις του πελάτη." on={cfg.showDocuments} set={(v) => set({ showDocuments: v })} />
              </Section>
              <Section title="Ενέργειες πελατών">
                <Toggle label="Κράτηση προβολής" hint="Ο πελάτης κλείνει μόνος του ραντεβού προβολής." on={cfg.allowViewings} set={(v) => set({ allowViewings: v })} />
                <Toggle label="Αιτήματα συντήρησης" hint="Ο ιδιοκτήτης δηλώνει βλάβη — η ομάδα ειδοποιείται αμέσως." on={cfg.allowMaintenance} set={(v) => set({ allowMaintenance: v })} />
              </Section>
              <Section title="Εγγραφή & σύνδεση">
                <Toggle label="Εγγραφή από την εφαρμογή" hint="Νέοι πελάτες κάνουν λογαριασμό μόνοι τους." on={cfg.selfRegister} set={(v) => set({ selfRegister: v })} />
                <Toggle label="Αυτόματη έγκριση" hint="Αλλιώς οι νέοι λογαριασμοί περιμένουν έγκριση από την ομάδα." on={cfg.autoApprove} set={(v) => set({ autoApprove: v })} />
                <div className="flex flex-wrap gap-2 px-4 py-3">
                  <span className="w-full text-sm font-medium text-charcoal">Κωδικός σύνδεσης μέσω</span>
                  {(['email', 'sms'] as const).map((m) => <button key={m} type="button" onClick={() => set({ loginMethod: m })} className={`rounded-xl px-3 py-2 text-left text-sm ring-1 ring-inset ${cfg.loginMethod === m ? 'bg-forest/[0.07] text-forest ring-forest/40' : 'ring-stone-line text-charcoal-600'}`}>{m === 'email' ? 'Email' : 'Κινητό (SMS)'}</button>)}
                </div>
              </Section>
              <Section title="Μήνυμα & υποστήριξη">
                <Field label="Μήνυμα καλωσορίσματος"><input className="input" value={cfg.welcome} onChange={(e) => set({ welcome: e.target.value })} /></Field>
                <div className="grid gap-3 px-4 pb-3 sm:grid-cols-2">
                  <Field label="Τηλέφωνο υποστήριξης" bare><input className="input" value={cfg.supportPhone} onChange={(e) => set({ supportPhone: e.target.value })} placeholder="+357 …" /></Field>
                  <Field label="Email υποστήριξης" bare><input className="input" value={cfg.supportEmail} onChange={(e) => set({ supportEmail: e.target.value })} placeholder="info@…" /></Field>
                  <Field label="Instagram" bare><input className="input" value={cfg.instagram} onChange={(e) => set({ instagram: e.target.value })} placeholder="https://instagram.com/…" /></Field>
                  <Field label="Facebook" bare><input className="input" value={cfg.facebook} onChange={(e) => set({ facebook: e.target.value })} placeholder="https://facebook.com/…" /></Field>
                  <Field label="Website" bare><input className="input" value={cfg.website} onChange={(e) => set({ website: e.target.value })} placeholder="https://…" /></Field>
                </div>
              </Section>
              <Section title="Εγκατάσταση στο κινητό">
                <div className="space-y-3 px-4 py-3 text-sm text-charcoal-600">
                  <p>Η εφαρμογή μπαίνει στο κινητό σαν κανονική εφαρμογή, χωρίς App Store και χωρίς κόστος. Στείλτε το link στους πελάτες και στο προσωπικό.</p>
                  <CopyField url={installUrl} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-stone/50 p-3"><p className="mb-1 flex items-center gap-1.5 font-semibold text-charcoal"><Apple size={14} /> iPhone</p><p className="text-xs">Safari → Κοινοποίηση → «Προσθήκη στην οθόνη Αφετηρίας».</p></div>
                    <div className="rounded-xl bg-stone/50 p-3"><p className="mb-1 flex items-center gap-1.5 font-semibold text-charcoal"><Smartphone size={14} /> Android</p><p className="text-xs">Chrome → ⋮ → «Εγκατάσταση εφαρμογής».</p></div>
                  </div>
                </div>
              </Section>
            </div>
          )}
        </div>

        <Phone cfg={cfg} projects={projList.filter((p) => projCfg(p.id).shown).map((p) => ({ ...p, tagline: projCfg(p.id).tagline }))} company={company} />
      </div>
    </div>
  );
}

function LockedRow({ label, hint }: { label: string; hint: string }) {
  return <li className="flex items-center gap-3 rounded-xl border border-stone-line bg-stone/40 px-3 py-2.5"><Lock size={15} className="text-charcoal-600/50" /><span className="flex-1"><span className="block text-sm font-semibold text-charcoal-600">{label}</span><span className="block text-xs text-charcoal-600/60">{hint}</span></span></li>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-2xl border border-stone-line bg-white"><p className="border-b border-stone-line bg-forest/[0.03] px-4 py-2.5 text-[12px] font-semibold uppercase tracking-[0.1em] text-forest">{title}</p><div className="divide-y divide-stone-line/70">{children}</div></div>;
}
function Toggle({ label, hint, on, set }: { label: string; hint: string; on: boolean; set: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-4 px-4 py-3">
      <span className="flex-1"><span className="block text-sm font-medium text-charcoal">{label}</span><span className="block text-xs text-charcoal-600/65">{hint}</span></span>
      <button type="button" role="switch" aria-checked={on} onClick={() => set(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-forest' : 'bg-stone-line'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${on ? 'left-[22px]' : 'left-0.5'}`} /></button>
    </label>
  );
}
function Field({ label, children, bare }: { label: string; children: React.ReactNode; bare?: boolean }) {
  return <label className={`block ${bare ? '' : 'px-4 py-3'}`}><span className="text-xs font-medium text-charcoal-600">{label}</span><div className="mt-1">{children}</div></label>;
}
function CopyField({ url }: { url: string }) {
  const [ok, setOk] = useState(false);
  return <div className="flex gap-2"><input readOnly className="input flex-1 text-xs" value={url} /><button type="button" onClick={() => { void navigator.clipboard.writeText(url).then(() => { setOk(true); setTimeout(() => setOk(false), 1500); }); }} className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 text-xs font-semibold text-white">{ok ? <Check size={13} /> : <Copy size={13} />} {ok ? 'Αντιγράφηκε' : 'Αντιγραφή'}</button></div>;
}

/** Ζωντανή προεπισκόπηση της αρχικής οθόνης σε κινητό. */
function Phone({ cfg, projects, company }: { cfg: MobileAppSettings; projects: (MobileProjectInfo & { tagline?: string })[]; company: string }) {
  const t = (k: string) => cfg.blocks.find((b) => b.key === k)?.title ?? LABEL[k]?.label;
  const Head = ({ k, icon: I }: { k: string; icon: any }) => <p className="mb-1.5 flex items-center justify-between text-[12px] font-semibold text-charcoal"><span className="flex items-center gap-1.5"><I size={12} className="text-forest" />{t(k)}</span><span className="text-[10px] font-normal text-forest">Όλα</span></p>;
  const body: Record<string, React.ReactNode> = {
    banner: <div className="rounded-2xl bg-gradient-to-br from-forest to-[#2f6e54] p-3 text-white"><p className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-white/70"><Megaphone size={10} /> {t('banner')}</p><p className="mt-1 text-sm font-semibold">Νέο έργο στη Λεμεσό — δείτε τις πρώτες μονάδες</p></div>,
    my_unit: <div><Head k="my_unit" icon={Home} /><div className="rounded-xl bg-white p-2.5 shadow-sm"><div className="h-16 rounded-lg bg-gradient-to-br from-[#bfab88] to-[#8a6a33]" /><p className="mt-1.5 text-[12px] font-semibold">UNIT A · {projects[0]?.name ?? 'ORA HOMES'}</p><p className="text-[10px] text-charcoal-600/70">Υπό κατασκευή · Παράδοση 2027</p></div></div>,
    construction: cfg.showConstruction ? <div><Head k="construction" icon={Hammer} /><div className="rounded-xl bg-white p-2.5 shadow-sm"><div className="flex justify-between text-[11px]"><span>Σκελετός</span><b className="text-forest">62%</b></div><div className="mt-1 h-1.5 rounded-full bg-stone"><div className="h-full w-[62%] rounded-full bg-forest" /></div></div></div> : null,
    payments: cfg.showPayments ? <div><Head k="payments" icon={CreditCard} /><div className="flex items-center justify-between rounded-xl bg-white p-2.5 shadow-sm"><span><p className="text-[11px] text-charcoal-600/70">Επόμενη δόση</p><p className="text-[13px] font-semibold">€72.150</p></span><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">σε 12 ημ.</span></div></div> : null,
    documents: cfg.showDocuments ? <div><Head k="documents" icon={FileText} /><div className="space-y-1">{['Συμβόλαιο αγοράς', 'Κάτοψη UNIT A'].map((d) => <p key={d} className="flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-[11px] shadow-sm"><FileText size={11} className="text-forest" />{d}</p>)}</div></div> : null,
    maintenance: cfg.allowMaintenance ? <button type="button" className="flex w-full items-center gap-2 rounded-xl bg-white p-2.5 text-left shadow-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-rose-50 text-signal-danger"><Wrench size={14} /></span><span><p className="text-[12px] font-semibold">{t('maintenance')}</p><p className="text-[10px] text-charcoal-600/70">Δηλώστε βλάβη με φωτογραφία</p></span></button> : null,
    projects: <div><Head k="projects" icon={Building2} /><div className="flex gap-2 overflow-hidden">{(projects.length ? projects : [{ id: 'x', name: 'ORA HOMES', location: 'Πύργος', available: 4, total: 4, fromPrice: 650000 } as any]).slice(0, 3).map((p: any) => <div key={p.id} className="w-36 shrink-0 rounded-xl bg-white p-2 shadow-sm"><div className="h-14 rounded-lg bg-gradient-to-br from-[#4a8668] to-[#113124]" /><p className="mt-1 truncate text-[11px] font-semibold">{p.name}</p><p className="truncate text-[10px] text-charcoal-600/70">{p.tagline || p.location || ''}</p>{(cfg.showAvailability || cfg.showPrices) && <p className="mt-0.5 text-[10px] text-forest">{[cfg.showAvailability ? `${p.available} διαθέσιμες` : null, cfg.showPrices && p.fromPrice ? `από ${eur(p.fromPrice)}` : null].filter(Boolean).join(' · ')}</p>}</div>)}</div></div>,
    viewings: cfg.allowViewings ? <button type="button" className="flex w-full items-center gap-2 rounded-xl bg-forest p-2.5 text-left text-white"><Calendar size={14} /><span className="text-[12px] font-semibold">{t('viewings')}</span></button> : null,
    agent: <div><Head k="agent" icon={User} /><div className="flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-forest text-[11px] font-semibold text-white">K</span><span className="flex-1"><p className="text-[12px] font-semibold">Kristia</p><p className="text-[10px] text-charcoal-600/70">Σύμβουλος πωλήσεων</p></span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/10 text-forest"><PhoneIcon size={12} /></span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest/10 text-forest"><MessageCircle size={12} /></span></div></div>,
  };
  return (
    <div className="xl:sticky xl:top-32">
      <p className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-charcoal-600/60">Ζωντανή προεπισκόπηση</p>
      <div className="mx-auto w-[300px] rounded-[42px] bg-charcoal p-2.5 shadow-[0_20px_50px_-20px_rgba(17,49,36,0.6)]">
        <div className="relative h-[600px] overflow-hidden rounded-[34px] bg-[#f6f2ec]">
          <div className="flex items-center justify-between px-5 pb-1 pt-2.5 text-[10px] font-semibold text-charcoal"><span>9:41</span><span className="h-4 w-20 rounded-full bg-charcoal" /><span>●●● ▮</span></div>
          <div className="h-[calc(100%-86px)] space-y-3 overflow-y-auto px-3 pb-4">
            {!cfg.appEnabled && <p className="rounded-xl bg-amber-50 p-2 text-[11px] text-amber-800">Η εφαρμογή είναι προσωρινά απενεργοποιημένη.</p>}
            <div className="flex items-center justify-between pt-1"><span><p className="text-[10px] text-charcoal-600/70">{company}</p><p className="text-[14px] font-semibold text-charcoal">{cfg.welcome || 'Καλώς ήρθατε'}</p></span><span className="flex gap-1.5"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"><Search size={12} /></span><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm"><Bell size={12} /></span></span></div>
            {cfg.blocks.filter((b) => b.on && b.key !== 'header' && b.key !== 'footer').map((b) => <div key={b.key}>{body[b.key]}</div>)}
            <p className="pt-2 text-center text-[9px] text-charcoal-600/50">Powered by {company}</p>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-around border-t border-stone-line bg-white px-2 pb-4 pt-2 text-[9px] text-charcoal-600">
            {[[Home, 'Αρχική'], [Building2, 'Ακίνητα'], [Calendar, 'Ραντεβού'], [FileText, 'Έγγραφα'], [User, 'Προφίλ']].map(([I, l]: any, i) => <span key={l} className={`flex flex-col items-center gap-0.5 ${i === 0 ? 'text-forest' : ''}`}><I size={15} />{l}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
