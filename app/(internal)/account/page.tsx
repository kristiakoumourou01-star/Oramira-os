import Link from 'next/link';
import { KeyRound, ShieldCheck, MonitorSmartphone, Bell, LogOut } from 'lucide-react';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { listTrustedDevices, listTotpFactors } from '@/lib/mfa';
import { requestLocale } from '@/lib/locale-server';
import { LanguagePick } from '@/components/account/LanguagePick';
import { TicketsView, type TicketRow } from '@/components/account/TicketsView';
import { FaqView, NewsView } from '@/components/account/HelpContent';
import { tx } from '@/lib/locale-shared';
import { logout } from '@/app/actions/auth';
import { signOutEverywhere } from '@/app/actions/account';
import { AccountProfile } from '@/components/account/AccountProfile';
import { NotificationPrefs } from '@/components/account/NotificationPrefs';
import { LogsView, type LogRow } from '@/components/account/LogsView';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { SettingsFrame, type FrameGroup } from '@/components/ui/SettingsFrame';
import { isCalendarConnected } from '@/lib/calendar-sync';
import { GoogleCalendarConnect } from '@/components/dashboard/GoogleCalendarConnect';

export const dynamic = 'force-dynamic';

type Tab = 'info' | 'logs' | 'tickets' | 'faq' | 'news' | 'notifications' | 'logout';

const ACTION_LABEL: Record<string, string> = {
  login: 'Σύνδεση', login_failed: 'Αποτυχημένη σύνδεση', logout: 'Αποσύνδεση', impersonation_started: 'Προβολή ως χρήστης', impersonation_stopped: 'Τέλος προβολής ως χρήστης', reassigned: 'Ανάθεση', completed: 'Ολοκλήρωση', created_from_deal: 'Δημιουργία από Deal Analyzer', converted_to_project: 'Μετατροπή σε έργο', prices_changed: 'Αλλαγή τιμών', role_changed: 'Αλλαγή ρόλου', permissions_changed: 'Αλλαγή δικαιωμάτων', follow_up_done: 'Follow-up ολοκληρώθηκε', milestone_added: 'Νέο στάδιο κατασκευής', contacts_merged: 'Συγχώνευση επαφών', communication_logged: 'Καταγραφή επικοινωνίας', password_changed: 'Αλλαγή κωδικού', logout_everywhere: 'Αποσύνδεση από όλες τις συσκευές', profile_updated: 'Ενημέρωση προφίλ',
  created: 'Δημιουργία', updated: 'Αλλαγή', deleted: 'Διαγραφή', status_changed: 'Αλλαγή σταδίου', assigned: 'Ανάθεση', note_added: 'Σημείωση',
};
const ENTITY_LABEL: Record<string, string> = { deal: 'Deal', task: 'Εργασία', impersonation: 'Admin', invite: 'Πρόσκληση', lead: 'Lead', contact: 'Επαφή', auth: 'Λογαριασμός', profile: 'Προφίλ', unit: 'Μονάδα', project: 'Έργο', invoice: 'Τιμολόγιο', follow_up: 'Follow-up', org_settings: 'Ρυθμίσεις' };
const pretty = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());


function fmt(d: string) {
  return new Date(d).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' });
}

/** Ο λογαριασμός μου — όπως το My Account του demo, χωριστά από τις ρυθμίσεις εταιρείας. */
export default async function AccountPage({ searchParams }: { searchParams: { tab?: string; t?: string } }) {
  const me = await requireProfile();
  const isAdmin = me.role === 'admin';
  const allowed: Tab[] = ['info', 'logs', 'tickets', 'faq', 'news', 'notifications', 'logout'];
  const tab: Tab = allowed.includes(searchParams.tab as Tab) ? (searchParams.tab as Tab) : 'info';
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  const svc = createSupabaseServiceRoleClient() as any;
  const { data: row } = await svc.from('profiles').select('full_name, phone, job_title, avatar_url, department, notification_prefs').eq('id', me.id).maybeSingle();

  let body: React.ReactNode = null;
  if (tab === 'info') {
    const [devices, factors, cal] = await Promise.all([listTrustedDevices(me.id), listTotpFactors(), isCalendarConnected(me.id)]);
    const twoFa = factors.length > 0;
    const sec = [
      { icon: KeyRound, title: 'Κωδικός', text: 'Αλλάξτε τον κωδικό σύνδεσης.', href: '/account/password', cta: 'Αλλαγή' },
      { icon: ShieldCheck, title: 'Έλεγχος δύο βημάτων', text: twoFa ? 'Ενεργός — κωδικός από εφαρμογή σε κάθε σύνδεση.' : 'Ανενεργός — προσθέστε κωδικό από εφαρμογή (Google Authenticator κ.ά.).', href: '/account/security', cta: twoFa ? 'Διαχείριση' : 'Ενεργοποίηση' },
      { icon: MonitorSmartphone, title: 'Συσκευές', text: devices.length ? `${tx('Αυτή η συσκευή', 'This device', 'Это устройство')} · ${devices.length} ${devices.length === 1 ? tx('αξιόπιστη συσκευή', 'trusted device', 'доверенное устройство') : tx('αξιόπιστες συσκευές', 'trusted devices', 'доверенных устройств')}` : 'Αυτή η συσκευή', href: '/account/security', cta: 'Προβολή' },
      { icon: Bell, title: 'Προτιμήσεις ειδοποιήσεων', text: 'Ήχος και ειδοποιήσεις στην οθόνη.', href: '/account?tab=notifications', cta: 'Διαχείριση' },
    ];
    body = (
      <div className="space-y-5">
        <h2 className="font-display text-xl text-charcoal">Πληροφορίες</h2>
        <AccountProfile readOnly={!!me.impersonator} initial={{ fullName: row?.full_name ?? me.fullName ?? '', email: auth.user?.email ?? '', phone: row?.phone ?? '', jobTitle: row?.job_title ?? '', avatarUrl: row?.avatar_url ?? null, roleName: me.roleName, department: row?.department ?? '' }} />
        <LanguagePick lang={requestLocale().lang} num={requestLocale().num} />
        {cal.configured && (
          <section className="space-y-3 rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
            <div><p className="text-lg font-semibold text-charcoal">Το ημερολόγιό μου</p><p className="text-sm text-charcoal-600/75">Συνδέστε το δικό σας Google Calendar: τα ραντεβού σας περνούν αυτόματα και προς τις δύο μεριές.</p></div>
            <GoogleCalendarConnect big connected={cal.connected} configured={cal.configured} />
          </section>
        )}
        <section className="space-y-3 rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
          <p className="text-lg font-semibold text-charcoal">Ασφάλεια</p>
          {sec.slice(0, 3).map((s) => (
            <div key={s.title} className="flex items-center gap-3 rounded-xl border border-stone-line px-4 py-3 transition-colors hover:border-forest/30">
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-charcoal">{s.title}</span><span className="block text-xs leading-snug text-charcoal-600/70">{s.text}</span></span>
              <Link href={s.href} className="shrink-0 rounded-full border border-stone-line px-3.5 py-1 text-xs font-medium text-charcoal transition hover:border-forest/40">{s.cta}</Link>
            </div>
          ))}
          <div className="flex items-center gap-3 rounded-xl border border-stone-line px-4 py-3">
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-charcoal">Αποσύνδεση από παντού</span><span className="block text-xs leading-snug text-charcoal-600/70">Αν χάσατε κινητό ή συνδεθήκατε σε ξένο υπολογιστή.</span></span>
            <form action={signOutEverywhere}><button className="shrink-0 rounded-full border border-rose-200 px-3.5 py-1 text-xs font-medium text-signal-danger transition hover:bg-signal-danger hover:text-white">Όλες</button></form>
          </div>
        </section>
        <section className="flex items-center gap-3 rounded-2xl border border-stone-line bg-white p-5 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
          <span className="min-w-0 flex-1"><span className="block text-lg font-semibold text-charcoal">Προτιμήσεις ειδοποιήσεων</span><span className="block text-sm text-charcoal-600/75">Διαχειριστείτε πώς σας ενημερώνουμε.</span></span>
          <Link href="/account?tab=notifications" className="btn-secondary shrink-0">Διαχείριση</Link>
        </section>
      </div>
    );
  } else if (tab === 'logs') {
    const since = new Date(Date.now() - 30 * 864e5).toISOString();
    let qy = svc.from('activity_log').select('id, entity_type, action, actor_id, metadata, created_at').gte('created_at', since).order('created_at', { ascending: false }).limit(2000);
    if (!isAdmin) qy = qy.or(`actor_id.eq.${me.id},and(action.eq.login_failed,metadata->>email.eq."${(auth.user?.email ?? '').toLowerCase()}")`);
    const { data: logs } = await qy;
    const ids = Array.from(new Set(((logs ?? []) as any[]).map((l) => l.actor_id).filter(Boolean)));
    const { data: people } = ids.length ? await svc.from('profiles').select('id, full_name').in('id', ids) : { data: [] };
    const nameOf = new Map(((people ?? []) as any[]).map((p) => [p.id, p.full_name as string]));
    const device = (ua?: string) => !ua ? '' : `${/iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Συσκευή'} · ${/Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser'}`;
    const rows: LogRow[] = ((logs ?? []) as any[]).map((l) => {
      const m = (l.metadata ?? {}) as Record<string, any>;
      const extra = Object.entries(m).filter(([k, v]) => !['ip', 'ua', 'email', 'reason', 'role'].includes(k) && v != null && typeof v !== 'object').slice(0, 3).map(([k, v]) => `${pretty(k)}: ${String(v).slice(0, 40)}`);
      const details = [l.action === 'login_failed' ? m.email : null, l.action === 'login_failed' && m.reason ? m.reason : null, ...extra, m.ip ? `IP ${m.ip}` : null, device(m.ua) || null].filter(Boolean).join(' · ');
      return { id: l.id, at: l.created_at, actor: l.actor_id ? (nameOf.get(l.actor_id) ?? '—') : (m.email ?? 'Άγνωστος'), action: l.action, actionLabel: ACTION_LABEL[l.action] ?? pretty(l.action), entity: ENTITY_LABEL[l.entity_type] ?? pretty(l.entity_type), details };
    });
    body = <LogsView rows={rows} showActor={isAdmin} lang={DATE_TAG[currentLocale().lang]} />;
  } else if (tab === 'tickets') {
    let tq = svc.from('staff_tickets').select('id, created_by, subject, body, priority, status, first_response_at, resolved_at, created_at, updated_at').order('updated_at', { ascending: false }).limit(500);
    if (!isAdmin) tq = tq.eq('created_by', me.id);
    const { data: tks } = await tq;
    const tIds = ((tks ?? []) as any[]).map((x) => x.id);
    const { data: reps } = tIds.length ? await svc.from('staff_ticket_replies').select('id, ticket_id, author_id, body, created_at').in('ticket_id', tIds).order('created_at') : { data: [] };
    const pIds = Array.from(new Set([...((tks ?? []) as any[]).map((x) => x.created_by), ...((reps ?? []) as any[]).map((x) => x.author_id)].filter(Boolean)));
    const { data: ppl } = pIds.length ? await svc.from('profiles').select('id, full_name').in('id', pIds) : { data: [] };
    const nm = new Map(((ppl ?? []) as any[]).map((x) => [x.id, (x.full_name as string) ?? '—']));
    const rows: TicketRow[] = ((tks ?? []) as any[]).map((x) => ({
      id: x.id, subject: x.subject, body: x.body, priority: x.priority, status: x.status, createdBy: nm.get(x.created_by) ?? '—', mine: x.created_by === me.id,
      createdAt: x.created_at, updatedAt: x.updated_at, firstResponseAt: x.first_response_at, resolvedAt: x.resolved_at,
      replies: ((reps ?? []) as any[]).filter((r) => r.ticket_id === x.id).map((r) => ({ id: r.id, author: nm.get(r.author_id) ?? '—', mine: r.author_id === me.id, body: r.body, at: r.created_at })),
    }));
    body = <TicketsView rows={rows} isAdmin={isAdmin} lang={DATE_TAG[currentLocale().lang]} openId={searchParams.t} />;
  } else if (tab === 'faq') {
    body = <FaqView />;
  } else if (tab === 'news') {
    body = <NewsView />;
  } else if (tab === 'notifications') {
    const np = (row?.notification_prefs ?? {}) as Record<string, unknown>;
    body = <div className="panel p-5"><NotificationPrefs marketing={{ inApp: np.marketingInApp !== false, email: np.marketingEmail !== false, push: np.marketingPush !== false }} /></div>;
  } else {
    body = (
      <div className="panel flex flex-col items-start gap-3 p-6">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-signal-danger"><LogOut size={20} /></span>
        <div><p className="font-semibold text-charcoal">Αποσύνδεση</p><p className="text-sm text-charcoal-600/75">Θα αποσυνδεθείτε από αυτή τη συσκευή.</p></div>
        <form action={logout}><button className="inline-flex h-10 items-center gap-2 rounded-full bg-signal-danger px-5 text-sm font-medium text-white transition hover:opacity-90"><LogOut size={15} /> Αποσύνδεση</button></form>
      </div>
    );
  }

  const groups: FrameGroup[] = [
    { label: 'Προφίλ', items: [
      { label: 'Πληροφορίες', href: '/account?tab=info', icon: 'user', sub: 'Το προφίλ σας και τα στοιχεία σύνδεσης.' },
      { label: 'Logs', href: '/account?tab=logs', icon: 'logs' },
    ] },
    { label: 'Υποστήριξη', items: [
      { label: 'Τα tickets μου', href: '/account?tab=tickets', icon: 'tickets' },
      { label: 'Συχνές ερωτήσεις', href: '/account?tab=faq', icon: 'help' },
      { label: 'Τι νέο', href: '/account?tab=news', icon: 'news' },
    ] },
    { label: 'Λογαριασμός', items: [
      { label: 'Ειδοποιήσεις', href: '/account?tab=notifications', icon: 'notifications' },
      { label: 'Αποσύνδεση', href: '/account?tab=logout', icon: 'logout' },
    ] },
  ];

  return (
    <SettingsFrame icon="user" title="Ο λογαριασμός μου" subtitle="Διαχειριστείτε το προφίλ σας και την υποστήριξη."
      groups={groups} activeHref={`/account?tab=${tab}`}
      aside={<span className="flex flex-wrap items-center gap-2"><span data-no-tr>{me.fullName}</span><span className="text-charcoal-600/60">·</span><span className="text-charcoal-600">{me.roleName}</span></span>}>
      {body}
    </SettingsFrame>
  );
}
