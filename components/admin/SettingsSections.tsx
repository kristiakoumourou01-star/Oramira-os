'use client';

import { Fragment, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, X, Trash2, Bell, TrendingUp, Building2, Wallet, Users, MessageSquare, ChevronDown } from 'lucide-react';
import { SettingsBlock, OptionBox, Switch, FieldLabel } from '@/components/admin/settings-ui';
import { readNotifPrefs, writeNotifPrefs, playChime, DEFAULT_NOTIF_PREFS, type NotifPrefs } from '@/lib/notify-prefs-shared';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import { NOTIF_EVENTS } from '@/lib/notification-events';
import {
  FIELD_TYPES, FIELD_TYPE_LABEL, START_SCREENS, DEFAULT_ORG_SETTINGS,
  type NotificationSettings, type SecuritySettings,
  type TagsSettings, type LayoutSettings,
} from '@/lib/org-settings-shared';

/* ------------------------------------------------------------------ shared -- */
function useSlice<T>(slice: string, initial: T) {
  const [v, setV] = useState<T>(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  const save = () =>
    start(async () => {
      const res = await saveOrgSlice(slice, v);
      if (res.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  const patch = (p: Partial<T>) => { setV((prev) => ({ ...prev, ...p })); setMsg(null); };
  return { v, setV, patch, save, pending, msg };
}

function SaveBar({ onSave, pending, msg, canEdit, slice, onReset }: { onSave: () => void; pending: boolean; msg: { ok: boolean; text: string } | null; canEdit: boolean; slice?: string; onReset?: () => void }) {
  if (!canEdit) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button onClick={onSave} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
      {onReset && <button type="button" onClick={() => { if (confirm('Επαναφορά αυτής της ενότητας στα αρχικά; Πατήστε μετά «Αποθήκευση» για να ισχύσει.')) onReset(); }} className="btn-secondary">Επαναφορά στα αρχικά</button>}
      {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
      {msg?.ok && slice && <UndoButton slice={slice} />}
    </div>
  );
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (b: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <div className="my-1.5 flex items-center justify-between gap-3 rounded-xl border border-stone-line bg-white px-4 py-3 transition-colors hover:border-forest/30">
      <span className="text-sm font-medium text-charcoal">{label}</span>
      <button type="button" role="switch" aria-checked={checked} disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-stone-line'} disabled:opacity-50`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[18px]' : 'left-0.5'}`} />
      </button>
    </div>
  );
}

export function ChipList({ items, onChange, placeholder, canEdit }: { items: string[]; onChange: (v: string[]) => void; placeholder: string; canEdit: boolean }) {
  const [draft, setDraft] = useState('');
  const add = () => { const t = draft.trim(); if (t && !items.includes(t)) onChange([...items, t]); setDraft(''); };
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span key={t} className="badge-neutral inline-flex items-center gap-1">{t}{canEdit && <button onClick={() => onChange(items.filter((x) => x !== t))} className="text-charcoal-600/50 hover:text-signal-danger"><X size={11} /></button>}</span>
        ))}
        {items.length === 0 && <span className="text-xs text-charcoal-600/50">—</span>}
      </div>
      {canEdit && (
        <div className="flex gap-2">
          <input className="input" value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
          <button onClick={add} className="btn-secondary px-3 py-1.5 text-xs"><Plus size={13} /> Προσθήκη</button>
        </div>
      )}
    </div>
  );
}

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;

/* ---------------------------------------------------------- Notifications -- */
const NOTIF_GROUP_META: Record<string, { icon: typeof Bell; hint: string }> = {
  'Πωλήσεις': { icon: TrendingUp, hint: 'Νέα leads, αναθέσεις, αναπάντητα, προβολές και κρατήσεις' },
  'Έργα & πελάτες': { icon: Building2, hint: 'Αιτήματα ιδιοκτητών, συντήρηση, εγγυήσεις και ενημερώσεις κατασκευής' },
  'Οικονομικά': { icon: Wallet, hint: 'Καθυστερημένες πληρωμές, εργολάβοι και προθεσμίες ΦΠΑ' },
  'Ομάδα & HR': { icon: Users, hint: 'Εργασίες, άδειες, μισθοδοσία, συμβάσεις και προμήθειες' },
  'Μηνύματα': { icon: MessageSquare, hint: 'Άμεσα μηνύματα προς την ομάδα' },
};
const CHANNELS = [['inApp', 'Εφαρμογή'], ['email', 'Email'], ['push', 'Push'], ['sms', 'SMS']] as const;
const VARS_BIRTHDAY = ['{{name}}', '{{company}}'];

function HourBar({ from, to }: { from: string; to: string }) {
  const m = (t: string) => { const [h, mm] = t.split(':').map(Number); return (h || 0) * 60 + (mm || 0); };
  const f = m(from) / 1440 * 100; const t = m(to) / 1440 * 100;
  const segs = f <= t ? [[f, t - f]] : [[f, 100 - f], [0, t]];
  return (
    <div className="mt-3">
      <div className="relative h-2.5 rounded-full bg-stone-line/60">
        {segs.map(([l, w], i) => <span key={i} className="absolute top-0 h-full rounded-full bg-forest/70" style={{ left: `${l}%`, width: `${w}%` }} />)}
      </div>
      <div className="mt-1 flex justify-between text-[10px] tabular-nums text-charcoal-600/70"><span>0</span><span>6</span><span>12</span><span>18</span><span>24</span></div>
    </div>
  );
}

function Segmented<T extends string>({ value, options, onChange, disabled }: { value: T; options: readonly (readonly [T, string])[]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-stone-line bg-white p-1">
      {options.map(([k, label]) => (
        <button key={k} type="button" disabled={disabled} onClick={() => onChange(k)}
          className={`rounded-lg px-3 py-1.5 text-[13px] transition-colors ${value === k ? 'bg-forest text-white' : 'text-charcoal hover:bg-forest/[0.06]'}`}>{label}</button>
      ))}
    </div>
  );
}

export function NotificationsSection({ initial, canEdit }: { initial: NotificationSettings; canEdit: boolean }) {
  const { v, setV, patch, save, pending, msg } = useSlice('notifications', initial);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  useEffect(() => { setPrefs(readNotifPrefs()); }, []);
  const setPref = async (p: NotifPrefs) => {
    if (p.desktop && !prefs.desktop && typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
      const r = await Notification.requestPermission().catch(() => 'denied');
      if (r !== 'granted') p = { ...p, desktop: false };
    }
    setPrefs(p); writeNotifPrefs(p);
  };
  const dis = !canEdit;
  const groups = Array.from(new Set(NOTIF_EVENTS.map((e) => e.group)));
  const rowsOf = (g: string) => v.rows.filter((r) => NOTIF_EVENTS.find((e) => e.key === r.key)?.group === g);
  const groupOn = (g: string) => rowsOf(g).some((r) => r.inApp || r.email || r.push || r.sms);
  const setGroup = (g: string, on: boolean) => {
    const keys = new Set(rowsOf(g).map((r) => r.key));
    setV({ ...v, rows: v.rows.map((r) => {
      if (!keys.has(r.key)) return r;
      const def = NOTIF_EVENTS.find((e) => e.key === r.key);
      return on ? { ...r, inApp: true, email: def?.email ?? false } : { ...r, inApp: false, email: false, push: false, sms: false };
    }) });
  };
  const toggle = (key: string, k: 'inApp' | 'email' | 'push' | 'sms') => setV({ ...v, rows: v.rows.map((r) => (r.key === key ? { ...r, [k]: !r[k] } : r)) });
  const pay = v.payments; const setPay = (p: Partial<typeof pay>) => patch({ payments: { ...pay, ...p } });
  const bd = v.birthday; const setBd = (p: Partial<typeof bd>) => patch({ birthday: { ...bd, ...p } });
  const sample = (t: string) => t.replace(/\{\{\s*name\s*\}\}/g, 'Μαρία').replace(/\{\{\s*company\s*\}\}/g, 'Oramira');

  return (
    <div className="space-y-6">
      <SettingsBlock title="Ειδοποιήσεις ανά θέμα" note="Ποια γεγονότα ενημερώνουν την ομάδα σας και με ποιο κανάλι. Πατήστε ένα θέμα για να διαλέξετε κανάλια ανά γεγονός.">
        {groups.map((g) => {
          const meta = NOTIF_GROUP_META[g] ?? { icon: Bell, hint: '' };
          const Icon = meta.icon; const isOpen = openGroup === g;
          return (
            <div key={g} className="rounded-xl border border-stone-line bg-white transition-colors hover:border-forest/30">
              <div className="flex items-center gap-3 px-4 py-3">
                <button type="button" onClick={() => setOpenGroup(isOpen ? null : g)} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-expanded={isOpen}>
                  <Icon size={17} className="shrink-0 text-charcoal-600" />
                  <span className="min-w-0"><span className="block text-sm font-medium text-charcoal">{g}</span><span className="block text-xs text-charcoal-600/75">{meta.hint}</span></span>
                  <ChevronDown size={15} className={`ml-auto shrink-0 text-charcoal-600/60 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                <Switch checked={groupOn(g)} disabled={dis} onChange={(on) => setGroup(g, on)} label={g} />
              </div>
              {isOpen && (
                <div className="space-y-1.5 border-t border-stone-line px-4 py-3">
                  {rowsOf(g).map((r) => (
                    <div key={r.key} className="flex flex-wrap items-center justify-between gap-2 py-1">
                      <span className="min-w-0"><span className="block text-[13px] text-charcoal">{r.event}</span><span className="block text-[11px] text-charcoal-600/70">{r.who}</span></span>
                      <span className="flex flex-wrap gap-1">
                        {CHANNELS.map(([k, label]) => (
                          <button key={k} type="button" disabled={dis} onClick={() => toggle(r.key, k)}
                            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition-colors ${r[k] ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal-600 hover:border-forest/30'}`}>{label}</button>
                        ))}
                      </span>
                    </div>
                  ))}
                  <p className="pt-1 text-[11px] text-charcoal-600/70">«Εφαρμογή» = το καμπανάκι πάνω δεξιά. Push και SMS στέλνονται μόλις συνδεθεί πάροχος στην Επικοινωνία.</p>
                </div>
              )}
            </div>
          );
        })}
      </SettingsBlock>

      <SettingsBlock title="Ειδοποιήσεις πληρωμών" note="Πολιτική λογαριασμού: τι μαθαίνουν οι αγοραστές για τις δόσεις τους.">
        <OptionBox title="Αποστολή ειδοποιήσεων πληρωμών" hint="Απενεργοποιημένο = δεν στέλνεται τίποτα στους αγοραστές για πληρωμές."><Switch checked={pay.enabled} disabled={dis} onChange={(b) => setPay({ enabled: b })} /></OptionBox>
        <div className={pay.enabled ? 'space-y-3' : 'pointer-events-none space-y-3 opacity-50'}>
          <OptionBox title="Δόση πλησιάζει" hint="Υπενθύμιση πριν τη λήξη μιας δόσης. Μία φορά ανά δόση."><Switch checked={pay.dueSoon} disabled={dis} onChange={(b) => setPay({ dueSoon: b })} /></OptionBox>
          <OptionBox title="Καθυστερημένη δόση" hint="Η δόση πέρασε την ημερομηνία της. Το πολύ μία φορά τη μέρα."><Switch checked={pay.overdue} disabled={dis} onChange={(b) => setPay({ overdue: b })} /></OptionBox>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><FieldLabel>Τρόπος αποστολής</FieldLabel><Segmented value={pay.delivery} disabled={dis} onChange={(d) => setPay({ delivery: d })} options={[['inapp', 'Εφαρμογή + push'], ['email', 'Email'], ['sms', 'SMS']] as const} /></div>
            <label className="block"><FieldLabel>Μέρες πριν τη λήξη</FieldLabel><input type="number" min={1} max={30} className="input w-28" disabled={dis} value={pay.daysBefore} onChange={(e) => setPay({ daysBefore: Number(e.target.value) })} /><span className="mt-1 block text-[11px] text-charcoal-600/70">Από 1 έως 30 μέρες.</span></label>
          </div>
          <p className="rounded-xl border border-stone-line bg-stone/50 px-4 py-2.5 text-xs text-charcoal-600">Οι ειδοποιήσεις πληρωμών ελέγχονται μία φορά τη μέρα το πρωί. Τα SMS χρεώνονται ανά μήνυμα από τον πάροχο SMS.</p>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Ευχές γενεθλίων" note="Στέλνονται στους πελάτες τη μέρα των γενεθλίων τους (μόνο σε όσους δέχονται μηνύματα στο κανάλι).">
        <OptionBox title="Αποστολή ευχών γενεθλίων" hint="Ένα μήνυμα τον χρόνο σε κάθε πελάτη με ημερομηνία γέννησης στην καρτέλα του."><Switch checked={bd.enabled} disabled={dis} onChange={(b) => setBd({ enabled: b })} /></OptionBox>
        <div className={bd.enabled ? 'space-y-3' : 'pointer-events-none space-y-3 opacity-50'}>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><FieldLabel>Ώρα αποστολής</FieldLabel><input type="time" className="input w-32" disabled={dis} value={bd.time} onChange={(e) => setBd({ time: e.target.value })} /><span className="mt-1 block text-[11px] text-charcoal-600/70">Ώρα Κύπρου.</span></label>
            <div><FieldLabel>Κανάλι</FieldLabel><Segmented value={bd.channel} disabled={dis} onChange={(c) => setBd({ channel: c })} options={[['sms', 'SMS'], ['email', 'Email']] as const} /></div>
          </div>
          {([['messageActive', 'Μήνυμα για ενεργούς πελάτες'], ['messageInactive', 'Μήνυμα για παλιούς πελάτες']] as const).map(([k, label]) => (
            <label key={k} className="block">
              <FieldLabel>{label}</FieldLabel>
              <textarea className="input min-h-[70px]" disabled={dis} value={bd[k]} onChange={(e) => setBd({ [k]: e.target.value } as any)} />
              <span className="mt-1 flex flex-wrap gap-1">{VARS_BIRTHDAY.map((x) => <button key={x} type="button" disabled={dis} onClick={() => setBd({ [k]: `${bd[k]} ${x}` } as any)} className="rounded-md border border-stone-line px-1.5 py-0.5 font-mono text-[11px] text-charcoal-600 hover:border-forest/40" data-no-tr>{x}</button>)}</span>
              <span className="mt-2 block rounded-xl border border-stone-line bg-stone/40 px-3 py-2 text-xs text-charcoal"><span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-charcoal-600/70">Προεπισκόπηση</span><span data-no-tr>{sample(bd[k])}</span></span>
            </label>
          ))}
          <p className="rounded-xl border border-stone-line bg-stone/50 px-4 py-2.5 text-xs text-charcoal-600">«Ενεργός» = πελάτης με ενεργό lead ή συμβόλαιο. Πελάτες χωρίς ημερομηνία γέννησης παραλείπονται.</p>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Ώρες ησυχίας" note="Χωρίς SMS και push προς πελάτες αυτές τις ώρες (ώρα Κύπρου).">
        <div className="flex flex-wrap items-end gap-4">
          <label><FieldLabel>Από</FieldLabel><input className="input" type="time" disabled={dis} value={v.quietFrom} onChange={(e) => patch({ quietFrom: e.target.value })} /></label>
          <label><FieldLabel>Έως</FieldLabel><input className="input" type="time" disabled={dis} value={v.quietTo} onChange={(e) => patch({ quietTo: e.target.value })} /></label>
        </div>
        <HourBar from={v.quietFrom} to={v.quietTo} />
        <OptionBox title="Εξαίρεση για τα επείγοντα" hint="Νέο lead, αναπάντητο lead, καθυστερημένη πληρωμή και αιτήματα ιδιοκτητών περνούν και στις ώρες ησυχίας."><Switch checked={v.urgentBypass} disabled={dis} onChange={(b) => patch({ urgentBypass: b })} /></OptionBox>
      </SettingsBlock>

      <SettingsBlock title="Ήχοι" note="Ισχύουν για αυτή τη συσκευή και αποθηκεύονται αμέσως.">
        <OptionBox title="Ήχος σε νέα ειδοποίηση" hint="Ένα σύντομο «ding» όταν έρχεται νέο lead ή άλλη ειδοποίηση."><Switch checked={prefs.sound} onChange={(b) => { void setPref({ ...prefs, sound: b }); if (b) playChime(prefs.volume); }} /></OptionBox>
        <OptionBox title="Ειδοποιήσεις υπολογιστή" hint="Αναδυόμενο μήνυμα του υπολογιστή όταν η καρτέλα δεν είναι μπροστά (χρειάζεται άδεια του browser)."><Switch checked={prefs.desktop} onChange={(b) => void setPref({ ...prefs, desktop: b })} /></OptionBox>
        <div className="rounded-xl border border-stone-line bg-white px-4 py-3">
          <div className="flex items-center justify-between text-sm"><span className="font-medium text-charcoal">Ένταση</span><span className="tabular-nums text-charcoal-600">{prefs.volume}%</span></div>
          <input type="range" min={0} max={100} step={5} value={prefs.volume} onChange={(e) => void setPref({ ...prefs, volume: Number(e.target.value) })} onMouseUp={() => playChime(prefs.volume)} onTouchEnd={() => playChime(prefs.volume)} className="mt-2 w-full accent-[color:rgb(var(--c-forest))]" aria-label="Ένταση" />
        </div>
      </SettingsBlock>

      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} slice="notifications" onReset={() => setV(DEFAULT_ORG_SETTINGS.notifications as any)} />
    </div>
  );
}

/* --------------------------------------------------------------- Security -- */
export function SecuritySection({ initial, canEdit, currentIp }: { initial: SecuritySettings; canEdit: boolean; currentIp?: string | null }) {
  const { v, setV, patch, save, pending, msg } = useSlice('security', initial);
  return (
    <div className="space-y-4">
      <div className="panel space-y-3 p-5">
        <h4>Σύνδεση</h4>
        <label className="block max-w-xs"><Lbl>Αποσύνδεση μετά από αδράνεια</Lbl>
          <select className="input" disabled={!canEdit} value={v.sessionTimeoutHours} onChange={(e) => patch({ sessionTimeoutHours: Number(e.target.value) })}>
            {[1, 2, 4, 8, 12, 24, 72].map((h) => <option key={h} value={h}>{h} {h === 1 ? 'ώρα' : 'ώρες'}</option>)}
            <option value={0}>Ποτέ</option>
          </select>
        </label>
        <p className="text-xs text-charcoal-600/60">Όποιος δεν κάνει τίποτα για τόσο διάστημα αποσυνδέεται αυτόματα και ξανασυνδέεται με τον κωδικό του.</p>
      </div>
      <div className="panel space-y-2 p-5">
        <h4>Κωδικός μίας χρήσης (2FA)</h4>
        <p className="text-xs text-charcoal-600/60">Μετά τον κωδικό, ο χρήστης γράφει κι έναν 6ψήφιο κωδικό από εφαρμογή στο κινητό (Google / Microsoft Authenticator). Ο καθένας το ενεργοποιεί από το «Ασφάλεια» δίπλα στο όνομά του, πάνω δεξιά.</p>
        <Toggle label="Υποχρεωτικό για όλο το προσωπικό" checked={v.otp} onChange={(b) => patch({ otp: b })} disabled={!canEdit} />
        <p className="text-xs text-charcoal-600/60">Όποιος δεν το έχει ρυθμίσει, στην επόμενη σύνδεση οδηγείται να το ρυθμίσει πριν συνεχίσει. Πελάτες, ιδιοκτήτες και εργολάβοι δεν αναγκάζονται. Αν κάποιος χάσει το κινητό, ο admin το μηδενίζει από τους Χρήστες.</p>
        <Toggle label="Να θυμάται εμπιστευμένες συσκευές για 30 μέρες" checked={v.trustedDevices} onChange={(b) => patch({ trustedDevices: b })} disabled={!canEdit} />
        <p className="text-xs text-charcoal-600/60">Στη σύνδεση εμφανίζεται «Να με θυμάται αυτή η συσκευή»: εκεί δεν ξαναζητείται κωδικός για 30 μέρες. Κάθε νέα συσκευή θέλει τον κωδικό. Ο χρήστης βλέπει και ανακαλεί τις συσκευές του.</p>
      </div>
      <div className="panel space-y-3 p-5">
        <h4>Κωδικοί</h4>
        <label className="block max-w-xs"><Lbl>Ελάχιστο μήκος</Lbl>
          <select className="input" disabled={!canEdit} value={v.pwLength} onChange={(e) => patch({ pwLength: Number(e.target.value) })}>
            {[8, 10, 12, 14, 16].map((n) => <option key={n} value={n}>{n} χαρακτήρες</option>)}
          </select>
        </label>
        <Toggle label="Να έχει αριθμό και σύμβολο" checked={v.pwSymbols} onChange={(b) => patch({ pwSymbols: b })} disabled={!canEdit} />
        <Toggle label="Αλλαγή κωδικού κάθε 90 μέρες" checked={v.pwExpire90} onChange={(b) => patch({ pwExpire90: b })} disabled={!canEdit} />
        <p className="text-xs text-charcoal-600/60">Ισχύει σε κάθε νέο κωδικό: όταν δημιουργείτε χρήστη, όταν του βάζετε κωδικό, και όταν τον αλλάζει ο ίδιος.</p>
      </div>
      <div className="panel space-y-2 p-5">
        <h4>Επιτρεπτές διευθύνσεις IP</h4>
        <p className="text-xs text-charcoal-600/60">Μία διεύθυνση ή περιοχή ανά γραμμή (π.χ. 203.0.113.4 ή 198.51.100.0/24). Κενό = σύνδεση από παντού.{currentIp ? ` Η δική σας διεύθυνση τώρα: ${currentIp}.` : ''}</p>
        <textarea className="input min-h-[90px] font-mono text-xs" disabled={!canEdit} value={v.ipAllowList} placeholder={currentIp ?? '203.0.113.4'} onChange={(e) => patch({ ipAllowList: e.target.value })} />
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} slice="security" onReset={() => setV(DEFAULT_ORG_SETTINGS.security as any)} />
    </div>
  );
}

/* ------------------------------------------------------------------- Tags -- */
export function TagsSection({ initial, canEdit }: { initial: TagsSettings; canEdit: boolean }) {
  const { v, setV, save, pending, msg } = useSlice('tags', initial);
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <h4 className="mb-1">Tags επαφών</h4>
        <p className="mb-3 text-xs text-charcoal-600/60">Σύντομες ετικέτες (π.χ. Cash buyer, VIP). Μπαίνουν σε κάθε επαφή και χρησιμοποιούνται σε φίλτρα και καμπάνιες.</p>
        <ChipList items={v.tags} onChange={(tags) => setV({ ...v, tags })} placeholder="Νέο tag" canEdit={canEdit} />
      </div>
      <div className="panel p-5">
        <h4 className="mb-1">Ομάδες</h4>
        <p className="mb-3 text-xs text-charcoal-600/60">Λίστες επαφών (π.χ. Ρωσόφωνοι αγοραστές, Παλιοί πελάτες) για στοχευμένα μηνύματα.</p>
        <ChipList items={v.groups} onChange={(groups) => setV({ ...v, groups })} placeholder="Νέα ομάδα" canEdit={canEdit} />
      </div>
      <p className="text-sm text-charcoal-600/70">Τα πεδία (και τα δικά σας) ρυθμίζονται όλα μαζί στα <a href="/settings?section=customerFields" className="text-forest underline">Πεδία πελατών</a>.</p>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} slice="tags" onReset={() => setV({ ...(DEFAULT_ORG_SETTINGS.tags as any), fields: v.fields })} />
    </div>
  );
}

/* -------------------------------------------------------------- Pipelines -- */
/* ----------------------------------------------------------------- Layout -- */
export function LayoutSection({ initial, canEdit }: { initial: LayoutSettings; canEdit: boolean }) {
  const { v, setV, patch, save, pending, msg } = useSlice('layout', initial);
  return (
    <div className="space-y-4">
      <div className="panel p-5">
        <label className="block max-w-[280px]"><Lbl>Οθόνη έναρξης (πού μπαίνει το προσωπικό)</Lbl>
          <select className="input" disabled={!canEdit} value={v.startScreen} onChange={(e) => patch({ startScreen: e.target.value })}>
            {START_SCREENS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </label>
        <p className="mt-1 text-xs text-charcoal-600/60">Η σελίδα που ανοίγει μετά τη σύνδεση. Πελάτες και εργολάβοι μπαίνουν πάντα στο δικό τους portal.</p>
      </div>
      <div className="panel space-y-1 p-5">
        <Toggle label="Μενού μόνο με εικονίδια" checked={v.sidebarCompact} onChange={(b) => patch({ sidebarCompact: b })} disabled={!canEdit} />
        <Toggle label="Πυκνές λίστες και πίνακες (περισσότερες γραμμές στην οθόνη)" checked={v.denseLists} onChange={(b) => patch({ denseLists: b })} disabled={!canEdit} />
        <p className="pt-1 text-xs text-charcoal-600/60">Ισχύουν για όλους ως προεπιλογή. Το πλάτος και η πυκνότητα του περιεχομένου ρυθμίζονται και στην <strong>Εμφάνιση</strong>.</p>
      </div>
      <SaveBar onSave={save} pending={pending} msg={msg} canEdit={canEdit} slice="layout" onReset={() => setV(DEFAULT_ORG_SETTINGS.layout as any)} />
    </div>
  );
}
