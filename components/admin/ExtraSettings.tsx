'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CreditCard, LogOut, MessageSquare, Mail, Sparkles, ScrollText } from 'lucide-react';
import Link from 'next/link';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { logout } from '@/app/actions/auth';
import { Switch } from '@/components/admin/settings-ui';
import { mergeExtra, type ExtraSettings } from '@/lib/settings-extra-shared';

type Msg = { ok: boolean; text: string } | null;

const Card = ({ title, chip, chipOn, children, sub }: { title: string; sub?: string; chip?: string; chipOn?: boolean; children?: React.ReactNode }) => (
  <section className="rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="font-semibold text-charcoal">{title}</h3>{sub && <p className="text-sm text-charcoal-600/75">{sub}</p>}</div>
      {chip && <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${chipOn ? 'bg-forest/[0.08] text-forest ring-forest/25' : 'bg-stone text-charcoal-600 ring-stone-line'}`}>{chip}</span>}
    </div>
    {children && <div className="mt-4 space-y-3">{children}</div>}
  </section>
);
const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4"><div><p className="text-sm font-medium text-charcoal">{title}</p>{hint && <p className="text-xs text-charcoal-600/70">{hint}</p>}</div>{children}</div>
);
function Seg<T extends string>({ value, options, onChange, disabled }: { value: T; options: [T, string][]; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-full border border-stone-line bg-white p-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" disabled={disabled} aria-pressed={value === v} onClick={() => onChange(v)}
          className={`rounded-full px-3.5 py-1 text-[13px] transition ${value === v ? 'bg-forest text-white' : 'text-charcoal hover:bg-stone'}`}>{l}</button>
      ))}
    </div>
  );
}

function useExtra(initial: ExtraSettings) {
  const router = useRouter();
  const [v, setV] = useState<ExtraSettings>(initial);
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  const patch = (p: Partial<ExtraSettings>) => { setV((x) => mergeExtra({ ...x, ...p })); setMsg(null); };
  const save = () => start(async () => {
    const r = await saveOrgSlice('extra', v);
    setMsg(r.ok ? { ok: true, text: 'Αποθηκεύτηκε.' } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });
  return { v, patch, save, msg, pending };
}

function SaveBar({ save, msg, pending, canEdit }: { save: () => void; msg: Msg; pending: boolean; canEdit: boolean }) {
  if (!canEdit) return null;
  return (
    <div className="flex items-center gap-3">
      <button type="button" onClick={save} disabled={pending} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση αλλαγών'}</button>
      {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
    </div>
  );
}

/** Settings → Κωδικός σύνδεσης: πώς παίρνουν οι πελάτες τον κωδικό μίας χρήσης στην εφαρμογή. */
export function SignInCodeSection({ initial, canEdit }: { initial: ExtraSettings; canEdit: boolean }) {
  const s = useExtra(initial);
  return (
    <div className="space-y-4">
      <Card title="Αποστολή κωδικού σύνδεσης" sub="Πώς παίρνουν οι πελάτες τον κωδικό μίας χρήσης όταν συνδέονται στην εφαρμογή.">
        <Seg value={s.v.signInCode} disabled={!canEdit} onChange={(x) => s.patch({ signInCode: x })} options={[['sms', 'SMS'], ['email', 'Email']]} />
        <p className="text-xs text-charcoal-600/70">Το email λειτουργεί μόνο αν ο πελάτης έχει email στο προφίλ του. Αν το κανάλι δεν είναι διαθέσιμο για κάποιον, χρησιμοποιείται αυτόματα το άλλο.</p>
      </Card>
      <SaveBar {...s} canEdit={canEdit} />
    </div>
  );
}

/** Settings → Αποδείξεις: έκδοση και αυτόματη αποστολή με email (πέρα από τη διάταξη του παραστατικού). */
export function ReceiptExtras({ initial, canEdit }: { initial: ExtraSettings; canEdit: boolean }) {
  const s = useExtra(initial);
  const r = s.v.receipts;
  const set = (p: Partial<ExtraSettings['receipts']>) => s.patch({ receipts: { ...r, ...p } });
  return (
    <div className="space-y-4">
      <Card title="Έκδοση αποδείξεων" sub="Κάθε πληρωμή (προκαταβολή, δόση, συντήρηση) παίρνει απόδειξη και, αν θέλετε, φεύγει αμέσως με email στον πελάτη.">
        <Row title="Έκδοση αποδείξεων" hint="Όταν είναι κλειστό, οι νέες πληρωμές δεν παίρνουν αριθμό απόδειξης ούτε PDF."><Switch checked={r.issue} disabled={!canEdit} label="Έκδοση αποδείξεων" onChange={(x) => set({ issue: x })} /></Row>
        <Row title="Αυτόματη αποστολή με email" hint="Η απόδειξη στέλνεται στον πελάτη μόλις καταχωριστεί η πληρωμή."><Switch checked={r.emailAutomatically} disabled={!canEdit || !r.issue} label="Αυτόματη αποστολή με email" onChange={(x) => set({ emailAutomatically: x })} /></Row>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-charcoal">Γλώσσα απόδειξης</p>
          <Seg value={r.language} disabled={!canEdit} onChange={(x) => set({ language: x })} options={[['el', 'Ελληνικά'], ['en', 'English'], ['ru', 'Русский']]} /></div>
      </Card>
      <Card title="Περιεχόμενο απόδειξης" sub="Ποιες ενότητες εμφανίζονται στην απόδειξη.">
        <Row title="Στοιχεία πελάτη"><Switch checked={r.showCustomer} disabled={!canEdit} label="Στοιχεία πελάτη" onChange={(x) => set({ showCustomer: x })} /></Row>
        <Row title="Ανάλυση πληρωμής"><Switch checked={r.showBreakdown} disabled={!canEdit} label="Ανάλυση πληρωμής" onChange={(x) => set({ showBreakdown: x })} /></Row>
        <Row title="Φορολογικά στοιχεία"><Switch checked={r.showTax} disabled={!canEdit} label="Φορολογικά στοιχεία" onChange={(x) => set({ showTax: x })} /></Row>
        <label className="block"><span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">Κείμενο στο κάτω μέρος</span>
          <textarea className="input min-h-[70px]" disabled={!canEdit} value={r.footer} onChange={(e) => set({ footer: e.target.value })} placeholder="π.χ. Ευχαριστούμε για την προτίμηση." /></label>
      </Card>
      <SaveBar {...s} canEdit={canEdit} />
    </div>
  );
}

const PROVIDERS: { key: ExtraSettings['paymentProvider']; name: string; text: string }[] = [
  { key: 'viva', name: 'Viva Wallet', text: 'Πληρωμές με κάρτα μέσω της σελίδας πληρωμής της Viva. Τα χρήματα πάνε στον δικό σας λογαριασμό Viva.' },
  { key: 'jcc', name: 'JCC', text: 'Ο δικός σας λογαριασμός JCC. Οι πελάτες πληρώνουν στη σελίδα πληρωμής της JCC.' },
  { key: 'stripe', name: 'Stripe', text: 'Ο δικός σας λογαριασμός Stripe. Οι πελάτες πληρώνουν στη σελίδα checkout της Stripe.' },
];

/** Settings → Πληρωμές: νόμισμα και πάροχος πληρωμών καρτών. Τα κλειδιά μπαίνουν από τον προγραμματιστή, όχι εδώ. */
export function PaymentsSection({ initial, canEdit, connected }: { initial: ExtraSettings; canEdit: boolean; connected: Record<string, boolean> }) {
  const s = useExtra(initial);
  return (
    <div className="space-y-4">
      <Card title="Νόμισμα" sub="Τιμές, πωλήσεις, αποδείξεις και η εφαρμογή πελάτη χρησιμοποιούν αυτό το νόμισμα.">
        <Seg value={s.v.currency} disabled={!canEdit} onChange={(x) => s.patch({ currency: x })} options={[['EUR', 'EUR (€)'], ['GBP', 'GBP (£)']]} />
      </Card>
      {PROVIDERS.map((p) => {
        const on = s.v.paymentProvider === p.key;
        return (
          <Card key={p.key} title={p.name} sub={p.text} chip={connected[p.key] ? 'Συνδεδεμένο' : 'Δεν έχει συνδεθεί'} chipOn={connected[p.key]}>
            <Row title={`Πληρωμές στην εφαρμογή μέσω ${p.name}`} hint="Αν το ενεργοποιήσετε, απενεργοποιούνται οι πληρωμές μέσω των άλλων παρόχων.">
              <Switch checked={on} disabled={!canEdit} label={p.name} onChange={(x) => s.patch({ paymentProvider: x ? p.key : 'none' })} />
            </Row>
          </Card>
        );
      })}
      <p className="flex items-start gap-2 rounded-xl bg-forest/[0.05] px-4 py-3 text-sm text-charcoal-600"><CreditCard size={15} className="mt-0.5 shrink-0 text-forest" /> Για ασφάλεια, τα κλειδιά των παρόχων δεν γράφονται εδώ — τα βάζει ο προγραμματιστής στον server. Μόλις μπουν, η κάρτα δείχνει «Συνδεδεμένο».</p>
      <SaveBar {...s} canEdit={canEdit} />
    </div>
  );
}

/** Settings → Atlas AI: ο βοηθός της πλατφόρμας. */
export function AtlasSection({ initial, canEdit, connected }: { initial: ExtraSettings; canEdit: boolean; connected: boolean }) {
  const s = useExtra(initial);
  const a = s.v.atlas;
  const set = (p: Partial<ExtraSettings['atlas']>) => s.patch({ atlas: { ...a, ...p } });
  return (
    <div className="space-y-4">
      <Card title="Ρύθμιση βοηθού" sub="Ανάλυση leads, προτάσεις για deals, πρόχειρα μηνύματα και η ημερήσια ενημέρωση στο Dashboard." chip={connected ? 'Συνδεδεμένο' : 'Δεν έχει συνδεθεί'} chipOn={connected}>
        <Row title="Atlas AI ενεργό" hint="Όταν είναι κλειστό, κρύβονται οι προτάσεις AI σε όλη την εφαρμογή."><Switch checked={a.enabled} disabled={!canEdit} label="Atlas AI" onChange={(x) => set({ enabled: x })} /></Row>
        <Row title="Ημερήσια ενημέρωση" hint="Η κάρτα «Καλημέρα» στο Dashboard με ό,τι χρειάζεται προσοχή."><Switch checked={a.dailyBriefing} disabled={!canEdit || !a.enabled} label="Ημερήσια ενημέρωση" onChange={(x) => set({ dailyBriefing: x })} /></Row>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-charcoal">Γλώσσα απαντήσεων</p>
          <Seg value={a.language} disabled={!canEdit} onChange={(x) => set({ language: x })} options={[['el', 'Ελληνικά'], ['en', 'English'], ['ru', 'Русский']]} /></div>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-medium text-charcoal">Ύφος</p>
          <Seg value={a.tone} disabled={!canEdit} onChange={(x) => set({ tone: x })} options={[['concise', 'Σύντομο'], ['detailed', 'Αναλυτικό']]} /></div>
      </Card>
      {!connected && <p className="flex items-start gap-2 rounded-xl bg-forest/[0.05] px-4 py-3 text-sm text-charcoal-600"><Sparkles size={15} className="mt-0.5 shrink-0 text-forest" /> Το κλειδί του μοντέλου AI το βάζει ο προγραμματιστής στον server. Μέχρι τότε οι λειτουργίες AI δείχνουν απλούς κανόνες.</p>}
      <SaveBar {...s} canEdit={canEdit} />
    </div>
  );
}

/** Settings → Ιδιωτικότητα & ασφάλεια: η κάρτα «Σύνδεση» στην κορυφή (όπως στο FitnessCRM). */
export function SessionCard({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Σύνδεση" sub="Μπορείτε να αποσυνδεθείτε από αυτή τη συσκευή οποιαδήποτε στιγμή.">
        <form action={logout}><button className="inline-flex h-9 items-center gap-2 rounded-full border border-rose-200 px-4 text-sm font-medium text-signal-danger transition hover:bg-signal-danger hover:text-white"><LogOut size={14} /> Αποσύνδεση</button></form>
      </Card>
      {isAdmin && (
        <Card title="Audit log" sub="Όλοι οι χρήστες: ποιος, πότε, από πού.">
          <Link href="/settings/audit" className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-line px-4 text-sm font-medium text-charcoal transition hover:border-forest/40"><ScrollText size={14} /> Άνοιγμα</Link>
        </Card>
      )}
    </div>
  );
}

export const CHANNEL_ICONS = { sms: MessageSquare, email: Mail };
