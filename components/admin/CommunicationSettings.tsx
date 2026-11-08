'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import type { CommunicationSettings } from '@/lib/org-settings-shared';
import { Switch, FieldLabel } from '@/components/admin/settings-ui';

function Card({ title, connected, children }: { title: string; connected: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-3.5">
          <p className="font-semibold text-charcoal">{title}</p>
          <span className={`rounded-full px-2.5 py-0.5 text-xs ${connected ? 'bg-forest/10 text-forest' : 'bg-stone text-charcoal-600'}`}>{connected ? 'Συνδεδεμένο' : 'Μη συνδεδεμένο'}</span>
        </div>
        <div className="space-y-4 p-5">{children}</div>
      </div>
      <p className="flex items-center gap-2 px-1 text-sm text-charcoal-600/80">Υπόλοιπο μονάδων <span className="rounded-full bg-stone px-2 py-0.5 text-xs">—</span></p>
    </div>
  );
}

/**
 * Settings → Επικοινωνία (όπως το Communication του demo): SMS με όνομα
 * αποστολέα, email με όνομα αποστολέα και διεύθυνση απάντησης, push.
 * Το email στέλνεται μόλις μπει ο λογαριασμός αποστολής (Resend)· SMS και push
 * αποθηκεύονται τώρα και ενεργοποιούνται όταν συνδεθεί πάροχος.
 */
export function CommunicationSettingsForm({ initial, canEdit, emailConnected }: { initial: CommunicationSettings; canEdit: boolean; emailConnected: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<CommunicationSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const dis = !canEdit;
  const set = (p: Partial<CommunicationSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const dirty = JSON.stringify(v) !== JSON.stringify(initial);
  const save = () => start(async () => {
    const r = await saveOrgSlice('communication', v);
    setMsg(r.ok ? { ok: true, text: 'Οι αλλαγές αποθηκεύτηκαν.' } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  const saved = 'Οι ρυθμίσεις αποθηκεύονται· η αποστολή ενεργοποιείται όταν συνδεθεί ο πάροχος.';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-xl text-charcoal">Επικοινωνία</h3>
        <p className="text-sm text-charcoal-600/75">Κανάλια SMS, email και push.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        <div className="space-y-5">
          <Card title="SMS" connected={false}>
            <p className="text-charcoal">Υπενθυμίσεις και καμπάνιες με SMS.</p>
            <label className="block max-w-xs">
              <FieldLabel>Όνομα αποστολέα</FieldLabel>
              <input className="input" disabled={dis} value={v.smsSender} maxLength={11} placeholder="Oramira" onChange={(e) => set({ smsSender: e.target.value.replace(/[^A-Za-z0-9]/g, '') })} />
            </label>
            <div className="flex gap-6 text-sm text-charcoal-600/80">
              <p className="max-w-xs">Έως 11 γράμματα ή ψηφία, χωρίς κενά — αυτό βλέπει ο πελάτης ως αποστολέα. Πρέπει να είναι καταχωρημένο στον πάροχο SMS για τη χώρα σας· αλλιώς τα μηνύματα φεύγουν με το όνομα του παρόχου.</p>
              <span className="shrink-0 tabular-nums">{v.smsSender.length}/11</span>
            </div>
            <p className="text-sm text-charcoal-600/80">{saved}</p>
          </Card>
          <Card title="Push ειδοποιήσεις" connected={false}>
            <p className="text-charcoal">Ειδοποιήσεις στο κινητό (portal πελατών).</p>
            <div className="flex items-center justify-between"><span className="font-medium text-charcoal">Ενεργοποίηση</span><Switch checked={v.pushEnabled} disabled={dis} label="Ενεργοποίηση push" onChange={(x) => set({ pushEnabled: x })} /></div>
            <p className="text-sm text-charcoal-600/80">{saved}</p>
          </Card>
        </div>
        <Card title="Email" connected={emailConnected}>
          <p className="text-charcoal">Email συναλλαγών και marketing.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><FieldLabel>Όνομα αποστολέα</FieldLabel><input className="input" disabled={dis} value={v.emailFromName} placeholder="Oramira Ltd" onChange={(e) => set({ emailFromName: e.target.value })} /></label>
            <label className="block"><FieldLabel>Email απάντησης</FieldLabel><input className="input" type="email" disabled={dis} value={v.emailReplyTo} placeholder="info@oramiraltd.com" onChange={(e) => set({ emailReplyTo: e.target.value })} /></label>
          </div>
          <p className="text-sm text-charcoal-600/80">{emailConnected ? 'Τα email φεύγουν με αυτό το όνομα και οι απαντήσεις έρχονται σε αυτή τη διεύθυνση.' : 'Οι ρυθμίσεις αποθηκεύονται· τα email θα φεύγουν μόλις συνδεθεί ο λογαριασμός αποστολής (Resend).'}</p>
        </Card>
      </div>
      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
          <button type="button" onClick={save} disabled={pending || !dirty} className="btn-primary disabled:opacity-50"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}</button>
        </div>
      )}
    </div>
  );
}
