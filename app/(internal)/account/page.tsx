import Link from 'next/link';
import { KeyRound, ShieldCheck, MonitorSmartphone, Bell, ChevronRight, User, History, Palette, LogOut, Sparkles, LifeBuoy } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { listTrustedDevices, listTotpFactors } from '@/lib/mfa';
import { requestLocale } from '@/lib/locale-server';
import { logout } from '@/app/actions/auth';
import { signOutEverywhere } from '@/app/actions/account';
import { AccountProfile } from '@/components/account/AccountProfile';
import { PersonalDisplay } from '@/components/account/PersonalDisplay';
import { NotificationPrefs } from '@/components/account/NotificationPrefs';

export const dynamic = 'force-dynamic';

type Tab = 'info' | 'logs' | 'display' | 'notifications' | 'news';
const TABS: { group: string; items: { key: Tab; label: string; icon: typeof User }[] }[] = [
  { group: 'Προφίλ', items: [{ key: 'info', label: 'Πληροφορίες', icon: User }, { key: 'logs', label: 'Ιστορικό', icon: History }] },
  { group: 'Υποστήριξη', items: [{ key: 'news', label: 'Τι νέο', icon: Sparkles }] },
  { group: 'Λογαριασμός', items: [{ key: 'display', label: 'Εμφάνιση', icon: Palette }, { key: 'notifications', label: 'Ειδοποιήσεις', icon: Bell }] },
];

const ACTION_LABEL: Record<string, string> = {
  login: 'Σύνδεση', logout: 'Αποσύνδεση', password_changed: 'Αλλαγή κωδικού', logout_everywhere: 'Αποσύνδεση από όλες τις συσκευές', profile_updated: 'Ενημέρωση προφίλ',
  created: 'Δημιουργία', updated: 'Αλλαγή', deleted: 'Διαγραφή', status_changed: 'Αλλαγή σταδίου', assigned: 'Ανάθεση', note_added: 'Σημείωση',
};
const ENTITY_LABEL: Record<string, string> = { lead: 'Lead', contact: 'Επαφή', auth: 'Λογαριασμός', profile: 'Προφίλ', unit: 'Μονάδα', project: 'Έργο', invoice: 'Τιμολόγιο', follow_up: 'Follow-up', org_settings: 'Ρυθμίσεις' };
const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const NEWS: { date: string; title: string; text: string }[] = [
  { date: 'Νοέ 2026', title: 'Ο λογαριασμός μου', text: 'Προφίλ, ασφάλεια, προσωπική εμφάνιση και ειδοποιήσεις σε ένα σημείο — χωριστά από τις ρυθμίσεις της εταιρείας.' },
  { date: 'Νοέ 2026', title: 'Admin στο μενού', text: 'My account, Settings, Mobile app και Staff (χρήστες, ρόλοι, προβολή ως χρήστης) κάτω από το Admin.' },
  { date: 'Νοέ 2026', title: 'Drag & drop', text: 'Dashboard, μενού, στάδια pipeline και στήλες leads αλλάζουν σειρά σέρνοντας.' },
  { date: 'Νοέ 2026', title: 'Πεδία πελατών & Επικοινωνία', text: 'Όλα τα πεδία σε έναν πίνακα, και ρυθμίσεις SMS / email / push.' },
  { date: 'Νοέ 2026', title: 'Lead management', text: 'Lost / Δεν ενδιαφέρεται, κλειστά leads, διαγραφή με αιτιολογία, λίστα με φίλτρα και μαζικές ενέργειες.' },
];

function fmt(d: string) {
  return new Date(d).toLocaleString('el-GR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' });
}

/** Ο λογαριασμός μου — όπως το My Account του demo, χωριστά από τις ρυθμίσεις εταιρείας. */
export default async function AccountPage({ searchParams }: { searchParams: { tab?: string } }) {
  const me = await requireProfile();
  const tab: Tab = (['info', 'logs', 'display', 'notifications', 'news'] as const).includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : 'info';
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: row } = await svc.from('profiles').select('full_name, phone, job_title, avatar_url, department').eq('id', me.id).maybeSingle();

  let body: React.ReactNode = null;
  if (tab === 'info') {
    const [devices, factors] = await Promise.all([listTrustedDevices(me.id), listTotpFactors()]);
    const twoFa = factors.length > 0;
    const sec = [
      { icon: KeyRound, title: 'Κωδικός', text: 'Αλλάξτε τον κωδικό σύνδεσης.', href: '/account/password', cta: 'Αλλαγή' },
      { icon: ShieldCheck, title: 'Έλεγχος δύο βημάτων', text: twoFa ? 'Ενεργός — κωδικός από εφαρμογή σε κάθε σύνδεση.' : 'Ανενεργός — προσθέστε κωδικό από εφαρμογή (Google Authenticator κ.ά.).', href: '/account/security', cta: twoFa ? 'Διαχείριση' : 'Ενεργοποίηση' },
      { icon: MonitorSmartphone, title: 'Συσκευές', text: devices.length ? `Αυτή η συσκευή · ${devices.length} αξιόπιστ${devices.length === 1 ? 'η' : 'ες'} συσκευ${devices.length === 1 ? 'ή' : 'ές'}` : 'Αυτή η συσκευή', href: '/account/security', cta: 'Προβολή' },
      { icon: Bell, title: 'Προτιμήσεις ειδοποιήσεων', text: 'Ήχος και ειδοποιήσεις στην οθόνη.', href: '/account?tab=notifications', cta: 'Διαχείριση' },
    ];
    body = (
      <div className="space-y-5">
        <AccountProfile readOnly={!!me.impersonator} initial={{ fullName: row?.full_name ?? me.fullName ?? '', email: auth.user?.email ?? '', phone: row?.phone ?? '', jobTitle: row?.job_title ?? '', avatarUrl: row?.avatar_url ?? null, roleName: me.roleName, department: row?.department ?? '' }} />
        <div className="panel overflow-hidden">
          <div className="border-b border-stone-line px-5 py-3.5"><p className="font-semibold text-charcoal">Ασφάλεια</p></div>
          <ul className="divide-y divide-stone-line">
            {sec.map((s) => (
              <li key={s.title} className="flex items-center gap-4 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone text-charcoal-600"><s.icon size={17} /></span>
                <span className="min-w-0 flex-1"><span className="block font-medium text-charcoal">{s.title}</span><span className="text-sm text-charcoal-600/75">{s.text}</span></span>
                <Link href={s.href} className="btn-secondary shrink-0 text-sm">{s.cta}</Link>
              </li>
            ))}
            <li className="flex items-center gap-4 px-5 py-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone text-charcoal-600"><LogOut size={17} /></span>
              <span className="min-w-0 flex-1"><span className="block font-medium text-charcoal">Αποσύνδεση από παντού</span><span className="text-sm text-charcoal-600/75">Αν χάσατε κινητό ή συνδεθήκατε σε ξένο υπολογιστή.</span></span>
              <form action={signOutEverywhere}><button className="btn-secondary shrink-0 text-sm text-signal-danger">Αποσύνδεση όλων</button></form>
            </li>
          </ul>
        </div>
      </div>
    );
  } else if (tab === 'logs') {
    const { data: logs } = await svc.from('activity_log').select('id, entity_type, action, created_at').eq('actor_id', me.id).order('created_at', { ascending: false }).limit(100);
    body = (
      <div className="panel overflow-hidden">
        <div className="border-b border-stone-line px-5 py-3.5"><p className="font-semibold text-charcoal">Ιστορικό</p><p className="text-sm text-charcoal-600/75">Οι τελευταίες 100 ενέργειές σας.</p></div>
        {(logs ?? []).length === 0
          ? <p className="p-5 text-sm text-charcoal-600/75">Δεν υπάρχει ακόμη ιστορικό.</p>
          : <ul className="divide-y divide-stone-line text-sm">
              {(logs as any[]).map((l) => (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5">
                  <span className="text-charcoal">{ACTION_LABEL[l.action] ?? pretty(l.action)} <span className="text-charcoal-600/60">· {ENTITY_LABEL[l.entity_type] ?? pretty(l.entity_type)}</span></span>
                  <span className="tabular-nums text-charcoal-600/70">{fmt(l.created_at)}</span>
                </li>
              ))}
            </ul>}
      </div>
    );
  } else if (tab === 'display') {
    const loc = requestLocale();
    body = <div className="panel p-5"><PersonalDisplay lang={loc.lang} num={loc.num} /></div>;
  } else if (tab === 'notifications') {
    body = <div className="panel p-5"><NotificationPrefs /></div>;
  } else {
    body = (
      <div className="panel overflow-hidden">
        <div className="border-b border-stone-line px-5 py-3.5"><p className="font-semibold text-charcoal">Τι νέο</p></div>
        <ul className="divide-y divide-stone-line">
          {NEWS.map((n) => (
            <li key={n.title} className="px-5 py-3.5"><p className="text-xs uppercase tracking-wide text-charcoal-600/60">{n.date}</p><p className="font-medium text-charcoal">{n.title}</p><p className="text-sm text-charcoal-600/80">{n.text}</p></li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="panel px-5 py-4">
        <h1 className="font-display text-2xl text-charcoal">Ο λογαριασμός μου</h1>
        <p className="text-sm text-charcoal-600/75">Τα δικά σας στοιχεία και προτιμήσεις. Οι ρυθμίσεις της εταιρείας είναι στο Settings.</p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[230px_1fr]">
        <nav className="panel space-y-4 p-3 lg:sticky lg:top-[72px]">
          {TABS.map((g) => (
            <div key={g.group}>
              <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/60">{g.group}</p>
              {g.items.map((t) => (
                <Link key={t.key} href={`/account?tab=${t.key}`} aria-current={tab === t.key ? 'page' : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 text-sm ${tab === t.key ? 'bg-forest/10 font-medium text-forest' : 'text-charcoal hover:bg-stone'}`}>
                  <t.icon size={15} /> <span className="flex-1">{t.label}</span>{tab === t.key && <ChevronRight size={14} />}
                </Link>
              ))}
              {g.group === 'Υποστήριξη' && (
                <a href="mailto:info@oramiraltd.com" className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-charcoal hover:bg-stone"><LifeBuoy size={15} /> Βοήθεια</a>
              )}
              {g.group === 'Λογαριασμός' && (
                <form action={logout}><button className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-signal-danger hover:bg-stone"><LogOut size={15} /> Αποσύνδεση</button></form>
              )}
            </div>
          ))}
        </nav>
        <div className="min-w-0">{body}</div>
      </div>
    </div>
  );
}
