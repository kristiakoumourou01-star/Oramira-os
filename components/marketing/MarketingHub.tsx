'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { FileBarChart, Gift, Plus, Search, X, Trash2, Copy, Send, Handshake, Pencil, Power, Zap } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { Briefing, Pager } from '@/components/ui/SidePanel';
import { saveReferralCode, setReferralActive, addRedemption, setRedemptionStatus } from '@/app/actions/referrals';
import { HubCards } from '@/components/ui/HubCards';
import { saveCampaign, deleteCampaign } from '@/app/actions/campaigns';
import { STATUS_LABEL, CHANNEL_NAME, audienceLabel, smsParts, type CampaignAudience, type CampaignChannel, type CampaignRow } from '@/lib/campaigns-shared';
import { ROLE_EL } from '@/lib/contacts-hub-shared';
import { localParts } from '@/lib/marketing-automations-shared';
import { formatDate, formatDateTime } from '@/lib/format';

import { AudiencePicker, type PickContact, type AudienceCount } from '@/components/marketing/AudiencePicker';
export type { PickContact };
export interface Prefill { tab?: string; channel?: string; cat?: string; group?: string; tag?: string; role?: string; ids?: string }

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const BRIEF: Record<CampaignChannel, [string, string, string]> = {
  email: ['Ενημέρωση email', 'Τα email campaigns φέρνουν τη μεγαλύτερη ανταπόκριση.', 'Προσωποποιήστε το θέμα, κρατήστε το κείμενο κάτω από 200 λέξεις και στείλτε Τρίτη–Πέμπτη πρωί για περισσότερα ανοίγματα.'],
  sms: ['Ενημέρωση SMS', 'Το SMS φτάνει σε όλους — ακόμη και χωρίς internet.', 'Ένα σύντομο μήνυμα (έως 160 λατινικοί ή 70 ελληνικοί χαρακτήρες ανά SMS) με μία σαφή κίνηση, π.χ. «Κλείστε viewing». Ιδανικό για υπενθυμίσεις και επείγοντα νέα.'],
  whatsapp: ['Ενημέρωση WhatsApp', 'Το WhatsApp διαβάζεται σχεδόν αμέσως.', 'Κρατήστε το μήνυμα σύντομο και προσωπικό, με μία σαφή κίνηση (π.χ. «Κλείστε viewing»). Μην στέλνετε πάνω από μία φορά την εβδομάδα.'],
  push: ['Ενημέρωση push', 'Ειδοποιήσεις στην εφαρμογή αγοραστών και ιδιοκτητών.', 'Ιδανικό για νέα του έργου, πρόοδο κατασκευής, παραδόσεις και προσφορές συνεργατών. Μόνο όσοι έχουν λογαριασμό στην εφαρμογή τα λαμβάνουν.'],
};

const BRIEF_ALL: [string, string, string] = ['Καμπάνιες', 'Ένα μήνυμα σε πολλούς πελάτες, μία φορά.', 'Στείλτε τώρα ή προγραμματίστε ημερομηνία και ώρα. Για μηνύματα που επαναλαμβάνονται ή φεύγουν όταν συμβεί κάτι, χρησιμοποιήστε τους Αυτοματισμούς.'];
type Main = 'campaigns' | 'automations' | 'referrals';
type ChanFilter = 'all' | CampaignChannel;
const CHANNELS: CampaignChannel[] = ['email', 'sms', 'whatsapp', 'push'];

/** Παλιοί σύνδεσμοι (?tab=email|sms|whatsapp|push) → Καμπάνιες με φίλτρο καναλιού. */
function fromPrefill(p: Prefill): { main: Main; channel: ChanFilter } {
  const t = p.tab ?? '';
  if (t === 'automations') return { main: 'automations', channel: 'all' };
  if (t === 'referrals') return { main: 'referrals', channel: 'all' };
  const ch = (CHANNELS as string[]).includes(p.channel ?? '') ? (p.channel as CampaignChannel) : (CHANNELS as string[]).includes(t) ? (t as CampaignChannel) : 'all';
  return { main: 'campaigns', channel: ch };
}

/**
 * Marketing (όπως στο FitnessCRM): δύο επιλογές — «Καμπάνιες» (μία φορά, τώρα ή
 * σε ημερομηνία) και «Αυτοματισμοί» (μηνύματα που φεύγουν μόνα τους).
 * Συστάσεις, Αναφορές και Benefits ως δευτερεύοντες σύνδεσμοι.
 */
export function MarketingHub({ campaigns, groups, contacts, tags, prefill, referrals, canEdit, leadAutomation, automations, activeAutomations = 0 }: { automations?: React.ReactNode; activeAutomations?: number; campaigns: CampaignRow[]; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[]; prefill: Prefill; referrals: ReferralData; canEdit: boolean; leadAutomation?: React.ReactNode }) {
  const router = useRouter();
  const init = fromPrefill(prefill);
  const [tab, setTab] = useState<Main>(init.main);
  const [chan, setChan] = useState<ChanFilter>(init.channel);
  const wantsNew = !!(prefill.group || prefill.tag || prefill.role || prefill.ids);
  const [dlg, setDlg] = useState<{ row?: CampaignRow; copy?: boolean } | null>(wantsNew ? {} : null);
  const [view, setView] = useState<CampaignRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const [, start] = useTransition();
  const mine = chan === 'all' ? campaigns : campaigns.filter((c) => c.channel === chan);
  const filtered = mine.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const p = Math.min(pg, pages - 1);
  const list = filtered.slice(p * per, p * per + per);
  const sentMsgs = mine.reduce((n, c) => n + c.sent, 0);
  const failedMsgs = mine.reduce((n, c) => n + c.failed, 0);
  const openedMsgs = mine.reduce((n, c) => n + (c.opened ?? 0), 0);
  const tracksOpens = chan === 'email';
  const brief = chan === 'all' ? BRIEF_ALL : BRIEF[chan];
  const roleLabel = (r: string) => `Όλοι: ${ROLE_EL[r] ?? r}`;
  const go = (k: string) => {
    setTab(k as Main); setPg(0); setQ('');
    const u = new URL(window.location.href);
    u.search = k === 'campaigns' ? (chan === 'all' ? '?tab=campaigns' : `?tab=campaigns&channel=${chan}`) : `?tab=${k}`;
    window.history.replaceState(null, '', u.toString());
  };
  const del = (c: CampaignRow) => {
    if (!confirm(`Διαγραφή της καμπάνιας «${c.name}»;`)) return;
    start(async () => { const r = await deleteCampaign(c.id); setMsg(r.ok ? { ok: true, text: 'Η καμπάνια διαγράφηκε.' } : { ok: false, text: r.error }); router.refresh(); });
  };
  const link = 'inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-3 text-[13px] font-medium text-charcoal transition-colors hover:border-forest/40';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button type="button" onClick={() => go('referrals')} className={`${link} ${tab === 'referrals' ? '!border-forest !bg-forest !text-white' : ''}`}><Gift size={14} /> Συστάσεις <span className="tabular-nums opacity-70">{referrals.codes.length}</span></button>
        <button type="button" onClick={() => router.push('/reports?tab=campaigns')} className={link}><FileBarChart size={14} /> Αναφορές</button>
        <button type="button" onClick={() => router.push('/benefits')} className={link}><Handshake size={14} /> Benefits</button>
      </div>
      <HubCards cols={2} active={tab} onSelect={go} cards={[
        { key: 'campaigns', icon: Send, title: 'Καμπάνιες', value: campaigns.length, sub: 'Μηνύματα μία φορά: τώρα ή σε ημερομηνία' },
        { key: 'automations', icon: Zap, title: 'Αυτοματισμοί', value: activeAutomations, sub: 'Μηνύματα που φεύγουν μόνα τους, κάθε μέρα' },
      ]} />

      {msg && <p className={`anim-fade rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {tab === 'referrals' && <ReferralsPanel data={referrals} contacts={contacts} canEdit={canEdit} />}
      {tab === 'automations' && (
        <div className="space-y-8">
          {automations}
          {leadAutomation && (
            <section id="lead-messages" className="scroll-mt-24 space-y-3">
              <h2 className="font-display text-xl text-charcoal">Μηνύματα συστήματος</h2>
              <p className="text-[14px] text-charcoal-600">Καλωσόρισμα, follow-up και μηνύματα ραντεβού που στέλνει η πλατφόρμα.</p>
              {leadAutomation}
            </section>
          )}
          <p className="text-[13px] text-charcoal-600">
            <span>Θέλετε να δείτε πότε έτρεξε κάθε αυτόματη εργασία και αν είχε σφάλμα;</span>{' '}
            <a href="/automation" className="text-forest hover:underline">Ιστορικό αυτόματων εργασιών →</a>
          </p>
        </div>
      )}

      {tab === 'campaigns' && (
        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-stone-line px-4 pb-3 pt-4 sm:px-5">
              {(['all', ...CHANNELS] as ChanFilter[]).map((c) => {
                const n = c === 'all' ? campaigns.length : campaigns.filter((x) => x.channel === c).length;
                return <button key={c} type="button" onClick={() => { setChan(c); setPg(0); window.history.replaceState(null, '', c === 'all' ? '?tab=campaigns' : `?tab=campaigns&channel=${c}`); }} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-medium transition-colors ${chan === c ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal-600 hover:text-charcoal'}`}>{c === 'all' ? <span>Όλα</span> : <span data-no-tr>{CHANNEL_NAME[c]}</span>}<span className="tabular-nums opacity-70">{n}</span></button>;
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
              <span>Εμφάνιση</span>
              <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPg(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
              <span>εγγραφές</span>
              <span className="ml-auto flex items-center gap-2">
                <label className="relative w-[150px] sm:w-[190px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} placeholder="Αναζήτηση…" className="input h-8 py-1 pl-8 text-[13px]" /></label>
                {canEdit && <button type="button" onClick={() => setDlg({})} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-2.5 text-[14px] font-medium text-white transition-all hover:bg-forest/90 active:translate-y-px"><Plus size={15} /> Νέα καμπάνια</button>}
              </span>
            </div>
            <div className="overflow-x-auto border-t border-stone-line">
              <table className="o-table">
                <thead><tr><th>Καμπάνια</th><th>Κανάλι</th><th>Κατάσταση</th><th>Κοινό</th><th className="text-right">Στάλθηκαν</th><th className="text-right">Άνοιξαν</th><th className="text-right">Απέτυχαν</th><th className="w-24" /></tr></thead>
                <tbody>
                  {list.map((c) => {
                    const open = c.status === 'draft' || c.status === 'scheduled';
                    return (
                      <tr key={c.id} className="cursor-pointer" onClick={() => setView(c)}>
                        <td className="o-strong"><span className="block max-w-[260px] truncate" data-no-tr>{c.name}</span><span className="block text-[11px] font-normal text-charcoal-600">{formatDate(c.sentAt ?? c.createdAt)}</span></td>
                        <td><span data-no-tr>{CHANNEL_NAME[c.channel]}</span></td>
                        <td>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.status === 'sent' ? 'bg-forest/[0.09] text-forest' : c.status === 'scheduled' ? 'bg-forest text-white' : 'bg-stone-100 text-charcoal-600'}`}>{STATUS_LABEL[c.status]}</span>
                          {c.status === 'scheduled' && c.scheduledAt && <span className="mt-0.5 block whitespace-nowrap text-[11px] tabular-nums text-charcoal-600">{formatDateTime(c.scheduledAt)}</span>}
                        </td>
                        <td data-no-tr><span className="block max-w-[180px] truncate">{audienceLabel(c.audience, roleLabel)}</span></td>
                        <td className="text-right tabular-nums">{open ? '—' : c.sent}</td>
                        <td className="text-right tabular-nums">{open || c.channel !== 'email' ? '—' : c.opened ?? 0}</td>
                        <td className="text-right tabular-nums">{open ? '—' : c.failed}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <span className="flex justify-end gap-1">
                            {canEdit && open && <button type="button" onClick={() => setDlg({ row: c })} title="Συνέχεια / αποστολή" aria-label="Συνέχεια" className={iconBtn}><Pencil size={15} /></button>}
                            {canEdit && <button type="button" onClick={() => setDlg({ row: c, copy: true })} title="Αντίγραφο" aria-label="Αντίγραφο" className={iconBtn}><Copy size={15} /></button>}
                            {canEdit && open && <button type="button" onClick={() => del(c)} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-signal-danger transition hover:bg-rose-50"><Trash2 size={15} /></button>}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                  {list.length === 0 && <tr><td colSpan={8} className="!py-10 text-center">Δεν υπάρχουν ακόμη καμπάνιες. Δημιουργήστε την πρώτη.</td></tr>}
                </tbody>
              </table>
            </div>
            {filtered.length ? <Pager from={p * per + 1} to={Math.min(filtered.length, p * per + per)} total={filtered.length} page={p} pages={pages} onPage={setPg} /> : <p className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Καμία εγγραφή</p>}
          </div>
          <aside className="min-w-0">
            <Briefing tag={brief[0]} title={brief[1]} text={brief[2]} metrics={[['Στάλθηκαν', sentMsgs, 'μηνύματα'], tracksOpens ? ['Άνοιξαν', openedMsgs, 'μηνύματα'] : ['Καμπάνιες', mine.length, 'σύνολο'], ['Απέτυχαν', failedMsgs, 'σφάλματα']]} />
          </aside>
        </div>
      )}

      {dlg && <CampaignDialog channel={dlg.row?.channel ?? (chan === 'all' ? 'email' : chan)} row={dlg.row} copy={dlg.copy} groups={groups} contacts={contacts} tags={tags} prefill={dlg.row ? {} : prefill}
        onClose={() => { setDlg(null); if (wantsNew) router.replace('/marketing?tab=campaigns'); }}
        onDone={(t, ok = true) => { setDlg(null); setMsg({ ok, text: t }); router.replace(chan === 'all' ? '/marketing?tab=campaigns' : `/marketing?tab=campaigns&channel=${chan}`); router.refresh(); }} />}
      {view && <ViewDialog c={view} roleLabel={roleLabel} onClose={() => setView(null)} />}
    </div>
  );
}

/* ── Συστάσεις ─────────────────────────────────────────────────────────── */

export interface ReferralCode { id: string; code: string; referrer: string | null; referrerId: string | null; refType: string; refValue: number | null; eeType: string; eeValue: number | null; active: boolean; note: string | null; createdAt: string; uses: number }
export interface ReferralRedemption { id: string; codeId: string; code: string; referee: string | null; status: string; createdAt: string }
export interface ReferralData { codes: ReferralCode[]; redemptions: ReferralRedemption[] }
const REWARD: [string, string][] = [['credit', 'Πίστωση (€)'], ['percent', 'Έκπτωση στην τιμή (%)'], ['fixed', 'Έκπτωση στην τιμή (€)'], ['commission', 'Προμήθεια (€)'], ['gift', 'Δώρο']];
const REWARD_EL = Object.fromEntries(REWARD);
const RSTATUS: Record<string, string> = { pending: 'Σε αναμονή', qualified: 'Πληροί τους όρους', rewarded: 'Αμείφθηκε', rejected: 'Απορρίφθηκε' };
const rewardText = (t: string, v: number | null) => (v == null ? (t === 'gift' ? 'Δώρο' : '—') : t === 'percent' ? `${v}% έκπτωση` : t === 'gift' ? `Δώρο · ${v}` : `€${v.toLocaleString('el-GR')} ${t === 'credit' ? 'πίστωση' : t === 'commission' ? 'προμήθεια' : 'έκπτωση'}`);

function ReferralsPanel({ data, contacts, canEdit }: { data: ReferralData; contacts: PickContact[]; canEdit: boolean }) {
  const router = useRouter();
  const [codeDlg, setCodeDlg] = useState<ReferralCode | 'new' | null>(null);
  const [redDlg, setRedDlg] = useState(false);
  const [rs, setRs] = useState('');
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [, start] = useTransition();
  const reds = data.redemptions.filter((r) => !rs || r.status === rs);
  const pages = Math.max(1, Math.ceil(reds.length / per));
  const p = Math.min(pg, pages - 1);
  const shown = reds.slice(p * per, p * per + per);
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) => start(async () => { const r = await fn(); setMsg(r.ok ? ok : r.error ?? 'Σφάλμα'); router.refresh(); });
  const activeCodes = data.codes.filter((c) => c.active).length;
  return (
    <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {msg && <p className="anim-fade rounded-xl border border-forest/20 bg-forest/[0.05] px-4 py-2.5 text-sm text-forest">{msg}</p>}
        <div className="flex justify-end">{canEdit && <button type="button" onClick={() => setCodeDlg('new')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-2.5 text-[14px] font-medium text-white transition-all hover:bg-forest/90 active:translate-y-px"><Plus size={15} /> Νέος κωδικός σύστασης</button>}</div>
        <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <p className="px-5 pt-4 text-[16px] font-semibold text-charcoal">Κωδικοί σύστασης</p>
          <div className="mt-3 overflow-x-auto border-t border-stone-line">
            <table className="o-table">
              <thead><tr><th>Κωδικός</th><th>Κατάσταση</th><th>Ποιος συστήνει</th><th>Αμοιβή για αυτόν</th><th>Αμοιβή για τον νέο πελάτη</th><th className="text-right">Εξαργυρώσεις</th><th className="text-right">Ενέργειες</th></tr></thead>
              <tbody>
                {data.codes.map((c) => (
                  <tr key={c.id}>
                    <td className="o-strong font-mono" data-no-tr>{c.code}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.active ? 'bg-forest/[0.09] text-forest' : 'bg-stone-100 text-charcoal-600'}`}>{c.active ? 'Ενεργός' : 'Ανενεργός'}</span></td>
                    <td data-no-tr>{c.referrer ?? '—'}</td>
                    <td>{rewardText(c.refType, c.refValue)}</td>
                    <td>{rewardText(c.eeType, c.eeValue)}</td>
                    <td className="text-right tabular-nums">{c.uses}</td>
                    <td><span className="flex justify-end gap-1">
                      {canEdit && <button type="button" onClick={() => setCodeDlg(c)} className={iconBtn} title="Επεξεργασία" aria-label="Επεξεργασία"><Pencil size={15} /></button>}
                      {canEdit && <button type="button" onClick={() => act(() => setReferralActive(c.id, !c.active), c.active ? 'Ο κωδικός απενεργοποιήθηκε.' : 'Ο κωδικός ενεργοποιήθηκε.')} className={iconBtn} title={c.active ? 'Απενεργοποίηση' : 'Ενεργοποίηση'} aria-label="Ενεργοποίηση"><Power size={15} /></button>}
                    </span></td>
                  </tr>
                ))}
                {data.codes.length === 0 && <tr><td colSpan={7} className="!py-8 text-center">Δεν υπάρχουν κωδικοί σύστασης ακόμη.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
            <span className="mr-2 text-[16px] font-semibold text-charcoal">Εξαργυρώσεις</span>
            <span>Εμφάνιση</span>
            <PopSelect width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPg(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            <span>εγγραφές</span>
            <span className="ml-auto flex items-center gap-2">
              <PopSelect width="min-w-[160px]" value={rs} onChange={(v) => { setRs(v); setPg(0); }} options={[['', 'Όλες οι καταστάσεις'], ...Object.entries(RSTATUS)]} />
              {canEdit && data.codes.length > 0 && <button type="button" onClick={() => setRedDlg(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-line px-2.5 text-[13px] text-charcoal hover:border-forest/40"><Plus size={14} /> Καταχώριση</button>}
            </span>
          </div>
          <div className="overflow-x-auto border-t border-stone-line">
            <table className="o-table">
              <thead><tr><th>Νέος πελάτης</th><th>Κωδικός</th><th>Κατάσταση</th><th>Ημερομηνία</th><th className="text-right">Ενέργειες</th></tr></thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td className="o-strong" data-no-tr>{r.referee ?? '—'}</td>
                    <td className="font-mono" data-no-tr>{r.code}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status === 'rejected' ? 'bg-stone-100 text-charcoal-600' : 'bg-forest/[0.09] text-forest'}`}>{RSTATUS[r.status] ?? r.status}</span></td>
                    <td>{formatDate(r.createdAt)}</td>
                    <td>{canEdit && <span className="flex justify-end"><PopSelect width="min-w-[150px]" value={r.status} onChange={(v) => act(() => setRedemptionStatus(r.id, v), 'Η κατάσταση άλλαξε.')} options={Object.entries(RSTATUS)} /></span>}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={5} className="!py-8 text-center">Δεν υπάρχουν εξαργυρώσεις ακόμη.</td></tr>}
              </tbody>
            </table>
          </div>
          {reds.length ? <Pager from={p * per + 1} to={Math.min(reds.length, p * per + per)} total={reds.length} page={p} pages={pages} onPage={setPg} /> : <p className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Καμία εγγραφή</p>}
        </div>
      </div>
      <aside className="min-w-0">
        <Briefing tag="Ενημέρωση συστάσεων" title="Οι ικανοποιημένοι αγοραστές είναι το καλύτερο κανάλι πωλήσεων." text="Δώστε αμοιβή και σε αυτόν που συστήνει και στον νέο αγοραστή — η διπλή ανταμοιβή φέρνει περίπου διπλάσιες συστάσεις από τη μονή."
          metrics={[['Ενεργοί', activeCodes, 'κωδικοί'], ['Χρήσεις', data.redemptions.length, 'εξαργυρώσεις'], ['Αμείφθηκαν', data.redemptions.filter((r) => r.status === 'rewarded').length, 'πληρώθηκαν']]} />
      </aside>
      {codeDlg && <CodeDialog code={codeDlg === 'new' ? null : codeDlg} contacts={contacts} onClose={() => setCodeDlg(null)} onDone={(t) => { setCodeDlg(null); setMsg(t); router.refresh(); }} />}
      {redDlg && <RedemptionDialog codes={data.codes.filter((c) => c.active)} contacts={contacts} onClose={() => setRedDlg(false)} onDone={(t) => { setRedDlg(false); setMsg(t); router.refresh(); }} />}
    </div>
  );
}

function ContactPicker({ value, onChange, contacts }: { value: string; onChange: (v: string) => void; contacts: PickContact[] }) {
  return <PopSelect searchable width="w-full" value={value} onChange={onChange} options={[['', 'Διαλέξτε πελάτη…'], ...contacts.map((c) => [c.id, c.name] as [string, string])]} />;
}

function CodeDialog({ code, contacts, onClose, onDone }: { code: ReferralCode | null; contacts: PickContact[]; onClose: () => void; onDone: (t: string) => void }) {
  const [f, setF] = useState({ referrer: code?.referrerId ?? '', code: code?.code ?? '', refType: code?.refType ?? 'credit', refValue: code?.refValue?.toString() ?? '', eeType: code?.eeType ?? 'percent', eeValue: code?.eeValue?.toString() ?? '', note: code?.note ?? '' });
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const suggest = () => { const c = contacts.find((x) => x.id === f.referrer); const base = (c?.name ?? 'ORA').split(' ')[0].normalize('NFD').replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 8) || 'ORA'; set({ code: `${base}${Math.floor(100 + Math.random() * 900)}` }); };
  const save = () => start(async () => { const r = await saveReferralCode(code?.id ?? null, { referrerId: f.referrer || null, code: f.code, refType: f.refType, refValue: f.refValue === '' ? null : Number(f.refValue), eeType: f.eeType, eeValue: f.eeValue === '' ? null : Number(f.eeValue), note: f.note }); if (!r.ok) { setErr(r.error ?? 'Σφάλμα'); return; } onDone(code ? 'Ο κωδικός αποθηκεύτηκε.' : `Δημιουργήθηκε ο κωδικός ${f.code.toUpperCase()}.`); });
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="anim-zoom flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b border-stone-line px-6 py-4"><div><h3 className="text-2xl">{code ? 'Επεξεργασία ' : 'Νέος '}<em className="text-forest">κωδικός σύστασης</em></h3><p className="text-[13px] text-charcoal-600">Ορίστε τον κωδικό και την αμοιβή και για τους δύο.</p></div><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="space-y-3 overflow-y-auto px-6 py-5">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Βασικά</p>
          <div><span className={lbl}>Ποιος συστήνει *</span><ContactPicker value={f.referrer} onChange={(v) => set({ referrer: v })} contacts={contacts} /></div>
          <label className="block"><span className={lbl}>Κωδικός *</span><span className="flex gap-2"><input className="input font-mono uppercase" value={f.code} onChange={(e) => set({ code: e.target.value.toUpperCase() })} placeholder="π.χ. MARIA250" /><button type="button" onClick={suggest} className="shrink-0 rounded-lg border border-stone-line px-3 text-sm">Πρόταση</button></span></label>
          <p className="pt-2 text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Αμοιβή για αυτόν που συστήνει</p>
          <div className="grid gap-3 sm:grid-cols-2"><div><span className={lbl}>Τύπος</span><PopSelect width="w-full" value={f.refType} onChange={(v) => set({ refType: v })} options={REWARD} /></div><label className="block"><span className={lbl}>Ποσό</span><input type="number" className="input" value={f.refValue} onChange={(e) => set({ refValue: e.target.value })} /></label></div>
          <p className="pt-2 text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Αμοιβή για τον νέο πελάτη</p>
          <div className="grid gap-3 sm:grid-cols-2"><div><span className={lbl}>Τύπος</span><PopSelect width="w-full" value={f.eeType} onChange={(v) => set({ eeType: v })} options={REWARD} /></div><label className="block"><span className={lbl}>Ποσό</span><input type="number" className="input" value={f.eeValue} onChange={(e) => set({ eeValue: e.target.value })} /></label></div>
          <label className="block"><span className={lbl}>Σημείωση</span><input className="input" value={f.note} onChange={(e) => set({ note: e.target.value })} /></label>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-6 py-4"><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !f.referrer || !f.code.trim()} onClick={save}>{pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button></div>
      </div>
    </div>
  );
}

function RedemptionDialog({ codes, contacts, onClose, onDone }: { codes: ReferralCode[]; contacts: PickContact[]; onClose: () => void; onDone: (t: string) => void }) {
  const [codeId, setCodeId] = useState(codes[0]?.id ?? '');
  const [who, setWho] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () => start(async () => { const r = await addRedemption(codeId, who); if (!r.ok) { setErr(r.error ?? 'Σφάλμα'); return; } onDone('Η εξαργύρωση καταχωρίστηκε.'); });
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="anim-zoom w-full max-w-md rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">Νέα <em className="text-forest">εξαργύρωση</em></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="space-y-3 px-6 py-5">
          <div><span className={lbl}>Κωδικός</span><PopSelect searchable width="w-full" value={codeId} onChange={setCodeId} options={codes.map((c) => [c.id, `${c.code}${c.referrer ? ` · ${c.referrer}` : ''}`] as [string, string])} /></div>
          <div><span className={lbl}>Νέος πελάτης</span><ContactPicker value={who} onChange={setWho} contacts={contacts} /></div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-6 py-4"><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !codeId || !who} onClick={save}>Καταχώριση</button></div>
      </div>
    </div>
  );
}

function CampaignDialog({ channel: ch0, row, copy, groups, contacts, tags, prefill, onClose, onDone }: { channel: CampaignChannel; row?: CampaignRow; copy?: boolean; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[]; prefill: Prefill; onClose: () => void; onDone: (msg: string, ok?: boolean) => void }) {
  const [channel, setChannel] = useState<CampaignChannel>(ch0);
  const [name, setName] = useState(row ? `${row.name}${copy ? ' (αντίγραφο)' : ''}` : '');
  const [audience, setAudience] = useState<CampaignAudience | null>(row?.audience ?? null);
  const [subject, setSubject] = useState(row?.subject ?? '');
  const [preview, setPreview] = useState(row?.preview ?? '');
  const [body, setBody] = useState(row?.body ?? '');
  const [count, setCount] = useState<AudienceCount | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const insert = (t: string) => setBody((b) => `${b}${t}`);
  // «Αποστολή τώρα | Προγραμματισμός»: ημερομηνία και ώρα Κύπρου.
  const sch0 = row?.status === 'scheduled' && !copy && row.scheduledAt ? localParts(new Date(row.scheduledAt)) : null;
  const pad = (n: number) => String(n).padStart(2, '0');
  const [mode, setMode] = useState<'now' | 'later'>(sch0 ? 'later' : 'now');
  const [date, setDate] = useState(sch0 ? `${sch0.y}-${pad(sch0.m)}-${pad(sch0.d)}` : '');
  const [time, setTime] = useState(sch0 ? `${pad(sch0.hh)}:${pad(sch0.mm)}` : '10:00');
  const later = mode === 'later';

  const submit = (send: boolean) => start(async () => {
    setErr(null);
    if (send && !later && !confirm(`Αποστολή σε ${count?.reachable ?? 'όλους τους'} παραλήπτες τώρα;`)) return;
    const r = await saveCampaign({ id: row && !copy ? row.id : undefined, name, channel, audience, subject, preview, body, ...(send && later ? { scheduleDate: date, scheduleTime: time } : {}) }, send);
    if (!r.ok) { setErr(r.error); return; }
    if (!send) { onDone(`Το «${name}» αποθηκεύτηκε ως πρόχειρο.`); return; }
    if (r.scheduledAt) { onDone(`Το «${name}» προγραμματίστηκε για ${formatDateTime(r.scheduledAt)}.`); return; }
    if (r.providerMissing) onDone(`Το «${name}» καταγράφηκε για ${r.queued ?? 0} παραλήπτες, αλλά δεν έχει συνδεθεί πάροχος ${channel === 'email' ? 'email (Resend / Postmark)' : channel === 'sms' ? 'SMS (Twilio)' : 'WhatsApp'} — δεν στάλθηκε πραγματικά.`, false);
    else onDone(`Το «${name}» στάλθηκε: ${r.sent ?? 0} επιτυχίες${r.failed ? `, ${r.failed} αποτυχίες` : ''}.`);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">Νέα <em className="text-forest">καμπάνια</em> <span data-no-tr>{CHANNEL_NAME[channel]}</span></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button></div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Βασικά</p>
          <label className="block"><span className={lbl}>Όνομα καμπάνιας *</span><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Νέο έργο Λεμεσός — προπώληση" /></label>
          <div className="flex flex-wrap gap-2">
            {(['email', 'sms', 'whatsapp', 'push'] as const).map((c) => <button key={c} type="button" onClick={() => setChannel(c)} className={`rounded-full border px-3 py-1 text-sm ${channel === c ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`}>{CHANNEL_NAME[c]}</button>)}
          </div>
          <AudiencePicker channel={channel} initial={row?.audience ?? null} prefill={prefill} groups={groups} contacts={contacts} tags={tags} onChange={setAudience} onCount={setCount} />

          <p className="pt-2 text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Μήνυμα</p>
          {channel === 'push' && <label className="block"><span className={lbl}>Τίτλος ειδοποίησης</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="π.χ. Νέα φωτογραφίες από το εργοτάξιο" /></label>}
          {channel === 'email' && <>
            <label className="block"><span className={lbl}>Θέμα</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="block"><span className={lbl}>Κείμενο προεπισκόπησης</span><input className="input" value={preview} onChange={(e) => setPreview(e.target.value)} /></label>
          </>}
          <div>
            <div className="mb-1 flex items-center justify-between"><span className={lbl}>Μήνυμα *</span>
              <span className="flex gap-1 text-[12px]"><button type="button" onClick={() => insert('{{first_name}}')} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ Μικρό όνομα</button><button type="button" onClick={() => insert('{{name}}')} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ Ονοματεπώνυμο</button></span></div>
            <textarea className={`input ${channel === 'sms' ? 'min-h-[110px]' : 'min-h-[180px]'}`} value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Αγαπητέ/ή {{first_name}},\n\n…'} />
            {channel === 'sms' && <SmsCounter text={body} />}
          </div>
          <p className="pt-2 text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Αποστολή</p>
          <div className="flex flex-wrap items-end gap-3">
            <span className="inline-flex rounded-[10px] border border-stone-line p-0.5">
              {([['now', 'Αποστολή τώρα'], ['later', 'Προγραμματισμός']] as const).map(([m, l]) => <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-lg px-3 py-1.5 text-[13px] font-medium ${mode === m ? 'bg-forest text-white' : 'text-charcoal-600 hover:text-charcoal'}`}>{l}</button>)}
            </span>
            {later && <>
              <label className="block"><span className={lbl}>Ημερομηνία</span><input type="date" className="input h-9" value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <label className="block"><span className={lbl}>Ώρα (Κύπρου)</span><input type="time" className="input h-9 w-28" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            </>}
          </div>
          {later && <p className="text-[12px] text-charcoal-600">Θα σταλεί αυτόματα την ώρα που ορίσατε (με απόκλιση έως 15 λεπτά). Μέχρι τότε μπορείτε να την αλλάξετε ή να τη διαγράψετε.</p>}
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-line px-6 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button>
          <button type="button" className="rounded-full border border-stone-line px-4 py-2 text-sm font-medium text-charcoal hover:border-forest/40" disabled={pending || !name.trim()} onClick={() => submit(false)}>Αποθήκευση προχείρου</button>
          <button type="button" className="btn-primary" disabled={pending || !name.trim() || !body.trim() || !count?.reachable || (later && !date)} onClick={() => submit(true)}>{pending ? 'Αποθήκευση…' : later ? 'Προγραμματισμός' : 'Δημιουργία & αποστολή'}</button>
        </div>
      </div>
    </div>
  );
}

function ViewDialog({ c, roleLabel, onClose }: { c: CampaignRow; roleLabel: (r: string) => string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-xl" data-no-tr>{c.name}</h3><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="space-y-3 px-6 py-5 text-sm">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[['Κατάσταση', STATUS_LABEL[c.status]], ['Παραλήπτες', c.recipients], ['Στάλθηκαν', c.sent], ['Απέτυχαν', c.failed]].map(([l, v]) => <div key={String(l)} className="rounded-xl border border-stone-line p-3"><p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">{l}</p><p className="text-lg font-semibold text-charcoal">{v}</p></div>)}
          </div>
          <p><span className="text-charcoal-600">Κοινό:</span> <span data-no-tr>{audienceLabel(c.audience, roleLabel)}</span>{c.skipped ? ` · ${c.skipped} παραλείφθηκαν (χωρίς συγκατάθεση ή διεύθυνση)` : ''}</p>
          {c.subject && <p><span className="text-charcoal-600">Θέμα:</span> <span data-no-tr>{c.subject}</span></p>}
          <div className="whitespace-pre-wrap rounded-xl border border-stone-line bg-stone-50 p-4 text-charcoal" data-no-tr>{c.body || '—'}</div>
          <p className="text-[13px] text-charcoal-600"><span data-no-tr>{CHANNEL_NAME[c.channel]}</span> · <span>{c.sentAt ? `Στάλθηκε ${formatDate(c.sentAt)}` : c.status === 'scheduled' && c.scheduledAt ? `Προγραμματισμένη για ${formatDateTime(c.scheduledAt)}` : `Δημιουργήθηκε ${formatDate(c.createdAt)}`}</span></p>
        </div>
      </div>
    </div>
  );
}

function SmsCounter({ text }: { text: string }) {
  const p = smsParts(text);
  return (
    <p className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-charcoal-600">
      <span>{`${p.chars} χαρακτήρες`}</span>
      <span>{`${p.parts} SMS ανά παραλήπτη`}</span>
      {p.unicode && <span>Ελληνικά: 70 χαρακτήρες ανά SMS</span>}
    </p>
  );
}
