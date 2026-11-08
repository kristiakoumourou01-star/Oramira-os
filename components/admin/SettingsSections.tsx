'use client';

import { Fragment, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, X, Trash2 } from 'lucide-react';
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
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-charcoal">{label}</span>
      <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-forest' : 'bg-stone-line'} disabled:opacity-50`}>
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
export function NotificationsSection({ initial, canEdit }: { initial: NotificationSettings; canEdit: boolean }) {
  const { v, setV, patch, save, pending, msg } = useSlice('notifications', initial);
  const toggle = (key: string, k: 'inApp' | 'email' | 'push' | 'sms') =>
    setV({ ...v, rows: v.rows.map((r) => (r.key === key ? { ...r, [k]: !r[k] } : r)) });
  const groups = Array.from(new Set(NOTIF_EVENTS.map((e) => e.group)));
  return (
    <div className="space-y-4">
      <div className="panel overflow-x-auto p-0">
        <table className="table-base w-full min-w-[640px]">
          <thead>
            <tr>
              <th>Γεγονός</th><th>Ποιος ενημερώνεται</th>
              <th className="text-center">Στην εφαρμογή</th><th className="text-center">Email</th>
              <th className="text-center" title="Ενεργοποιείται όταν συνδεθεί πάροχος push">Push</th>
              <th className="text-center" title="Ενεργοποιείται όταν συνδεθεί πάροχος SMS">SMS</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Fragment key={g}>
                <tr><td colSpan={6} className="bg-stone/60 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/60">{g}</td></tr>
                {v.rows.filter((r) => NOTIF_EVENTS.find((e) => e.key === r.key)?.group === g).map((r) => (
                  <tr key={r.key}>
                    <td className="font-medium text-charcoal">{r.event}</td>
                    <td className="text-sm text-charcoal-600">{r.who}</td>
                    {(['inApp', 'email', 'push', 'sms'] as const).map((c) => (
                      <td key={c} className="text-center">
                        <input type="checkbox" disabled={!canEdit} checked={r[c]} onChange={() => toggle(r.key, c)}
                          aria-label={`${r.event}: ${c}`} className="h-4 w-4 accent-[color:rgb(var(--c-forest))]" />
                      </td>
                    ))}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-charcoal-600/60">
        «Στην εφαρμογή» = το καμπανάκι πάνω δεξιά. Το email πηγαίνει στη διεύθυνση σύνδεσης του χρήστη (χρειάζεται ρυθμισμένο email αποστολής).
        Push και SMS αποθηκεύονται από τώρα και ενεργοποιούνται μόλις συνδεθεί πάροχος στο Integrations.
      </p>
      <div className="panel space-y-2 p-5">
        <h4>Ώρες ησυχίας</h4>
        <p className="text-xs text-charcoal-600/60">Χωρίς SMS και push προς πελάτες σε αυτές τις ώρες (ώρα Κύπρου). Τα επείγοντα (νέο lead, αναπάντητο lead, καθυστερημένη πληρωμή) εξαιρούνται για την ομάδα.</p>
        <div className="flex flex-wrap items-end gap-4">
          <label><Lbl>Από</Lbl><input className="input" type="time" disabled={!canEdit} value={v.quietFrom} onChange={(e) => patch({ quietFrom: e.target.value })} /></label>
          <label><Lbl>Έως</Lbl><input className="input" type="time" disabled={!canEdit} value={v.quietTo} onChange={(e) => patch({ quietTo: e.target.value })} /></label>
        </div>
      </div>
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
