'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, MessageCircle, FileBarChart, Gift, Plus, Search, X, Trash2, Copy, Send, Bell, Handshake, MailOpen, FileText, CheckCircle2, Layers, Pencil, Power, Clock } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { Briefing, SideStat, Pager } from '@/components/ui/SidePanel';
import { saveReferralCode, setReferralActive, addRedemption, setRedemptionStatus } from '@/app/actions/referrals';
import { HubCards } from '@/components/ui/HubCards';
import { saveCampaign, deleteCampaign, previewAudience } from '@/app/actions/campaigns';
import { STATUS_LABEL, audienceLabel, parseAddresses, type CampaignAudience, type CampaignChannel, type CampaignRow } from '@/lib/campaigns-shared';
import { ROLE_EL, ALL_ROLES } from '@/lib/contacts-hub-shared';
import { formatDate } from '@/lib/format';

export interface PickContact { id: string; name: string; email: string | null; phone: string | null; optIn: boolean }
export interface Prefill { tab?: string; group?: string; tag?: string; role?: string; ids?: string }

const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const CH_NAME: Record<CampaignChannel, string> = { email: 'Email', whatsapp: 'WhatsApp', push: 'Push' };
const BRIEF: Record<CampaignChannel, [string, string, string]> = {
  email: ['Ενημέρωση email', 'Τα email campaigns φέρνουν τη μεγαλύτερη ανταπόκριση.', 'Προσωποποιήστε το θέμα, κρατήστε το κείμενο κάτω από 200 λέξεις και στείλτε Τρίτη–Πέμπτη πρωί για περισσότερα ανοίγματα.'],
  whatsapp: ['Ενημέρωση WhatsApp', 'Το WhatsApp διαβάζεται σχεδόν αμέσως.', 'Κρατήστε το μήνυμα σύντομο και προσωπικό, με μία σαφή κίνηση (π.χ. «Κλείστε viewing»). Μην στέλνετε πάνω από μία φορά την εβδομάδα.'],
  push: ['Ενημέρωση push', 'Ειδοποιήσεις στην εφαρμογή αγοραστών και ιδιοκτητών.', 'Ιδανικό για νέα του έργου, πρόοδο κατασκευής, παραδόσεις και προσφορές συνεργατών. Μόνο όσοι έχουν λογαριασμό στην εφαρμογή τα λαμβάνουν.'],
};

/**
 * Marketing (όπως στο FitnessCRM): κάρτες Email · WhatsApp · Push · Συστάσεις ·
 * Αναφορές · Benefits — από κάτω ο πίνακας του καναλιού και δεξιά η ενημέρωση.
 */
export function MarketingHub({ campaigns, groups, contacts, tags, prefill, referrals, canEdit }: { campaigns: CampaignRow[]; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[]; prefill: Prefill; referrals: ReferralData; canEdit: boolean }) {
  const router = useRouter();
  const startTab = ['whatsapp', 'push', 'referrals'].includes(prefill.tab ?? '') ? prefill.tab! : 'email';
  const [tab, setTab] = useState<string>(startTab);
  const wantsNew = !!(prefill.group || prefill.tag || prefill.role || prefill.ids);
  const [dlg, setDlg] = useState<{ row?: CampaignRow; copy?: boolean } | null>(wantsNew ? {} : null);
  const [view, setView] = useState<CampaignRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const [, start] = useTransition();
  const channel: CampaignChannel = tab === 'whatsapp' ? 'whatsapp' : tab === 'push' ? 'push' : 'email';
  const mine = campaigns.filter((c) => c.channel === channel);
  const filtered = mine.filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()));
  const pages = Math.max(1, Math.ceil(filtered.length / per));
  const p = Math.min(pg, pages - 1);
  const list = filtered.slice(p * per, p * per + per);
  const st = (k: CampaignRow['status']) => mine.filter((c) => c.status === k).length;
  const sentMsgs = mine.reduce((n, c) => n + c.sent, 0);
  const failedMsgs = mine.reduce((n, c) => n + c.failed, 0);
  const openedMsgs = mine.reduce((n, c) => n + (c.opened ?? 0), 0);
  const roleLabel = (r: string) => `Όλοι: ${ROLE_EL[r] ?? r}`;
  const n = (ch: CampaignChannel) => campaigns.filter((c) => c.channel === ch).length;

  const go = (k: string) => {
    if (k === 'reports') { router.push('/reports'); return; }
    if (k === 'benefits') { router.push('/benefits'); return; }
    setTab(k); setPg(0); setQ('');
  };
  const del = (c: CampaignRow) => {
    if (!confirm(`Διαγραφή του προχείρου «${c.name}»;`)) return;
    start(async () => { const r = await deleteCampaign(c.id); setMsg(r.ok ? { ok: true, text: 'Το πρόχειρο διαγράφηκε.' } : { ok: false, text: r.error }); router.refresh(); });
  };

  return (
    <div className="space-y-5">
      <HubCards cols={3} active={tab} onSelect={go} cards={[
        { key: 'email', icon: Mail, title: 'Email', value: 'Email', sub: 'Email campaigns σε ομάδες πελατών' },
        { key: 'whatsapp', icon: MessageCircle, title: 'WhatsApp', value: 'WhatsApp', sub: 'Μαζικά μηνύματα WhatsApp' },
        { key: 'push', icon: Bell, title: 'Push', value: 'Push', sub: 'Ειδοποιήσεις στην εφαρμογή πελατών' },
        { key: 'referrals', icon: Gift, title: 'Συστάσεις', value: 'Κωδικοί', sub: 'Κωδικοί σύστασης και εξαργυρώσεις' },
        { key: 'reports', icon: FileBarChart, title: 'Αναφορές', value: 'Stats', sub: 'Ανάλυση campaigns και αναφορές' },
        { key: 'benefits', icon: Handshake, title: 'Benefits', value: 'Partners', sub: 'Εκπτώσεις συνεργατών για τους πελάτες σας' },
      ]} />

      {msg && <p className={`anim-fade rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {tab === 'referrals' && <ReferralsPanel data={referrals} contacts={contacts} canEdit={canEdit} />}

      {['email', 'whatsapp', 'push'].includes(tab) && (
        <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
              <span>Εμφάνιση</span>
              <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPg(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
              <span>εγγραφές</span>
              <span className="ml-auto flex items-center gap-2">
                <label className="relative w-[190px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => { setQ(e.target.value); setPg(0); }} placeholder="Αναζήτηση…" className="input h-8 py-1 pl-8 text-[13px]" /></label>
                {canEdit && <button type="button" onClick={() => setDlg({})} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-2.5 text-[14px] font-medium text-white transition-all hover:bg-forest/90 active:translate-y-px"><Plus size={15} /> Νέο campaign</button>}
              </span>
            </div>
            <div className="overflow-x-auto border-t border-stone-line">
              <table className="o-table">
                <thead><tr><th>Campaign</th><th>Κατάσταση</th><th>Κοινό</th><th className="text-right">Στάλθηκαν</th>{channel === 'email' && <th className="text-right">Άνοιξαν</th>}<th className="text-right">Απέτυχαν</th><th>Ημερομηνία</th><th className="text-right">Ενέργειες</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id} className="cursor-pointer" onClick={() => setView(c)}>
                      <td className="o-strong" data-no-tr><span className="block max-w-[240px] truncate">{c.name}</span>{c.subject && <span className="block max-w-[240px] truncate text-[11px] font-normal text-charcoal-600">{c.subject}</span>}</td>
                      <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.status === 'sent' ? 'bg-forest/[0.09] text-forest' : 'bg-stone-100 text-charcoal-600'}`}>{STATUS_LABEL[c.status]}</span></td>
                      <td data-no-tr><span className="block max-w-[180px] truncate">{audienceLabel(c.audience, roleLabel)}</span></td>
                      <td className="text-right tabular-nums">{c.status === 'draft' ? '—' : c.sent}</td>
                      {channel === 'email' && <td className="text-right tabular-nums">{c.status === 'draft' ? '—' : c.opened ?? 0}</td>}
                      <td className="text-right tabular-nums">{c.status === 'draft' ? '—' : c.failed}</td>
                      <td>{formatDate(c.sentAt ?? c.createdAt)}</td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <span className="flex justify-end gap-1">
                          {canEdit && c.status === 'draft' && <button type="button" onClick={() => setDlg({ row: c })} title="Συνέχεια / αποστολή" aria-label="Συνέχεια" className={iconBtn}><Send size={15} /></button>}
                          {canEdit && <button type="button" onClick={() => setDlg({ row: c, copy: true })} title="Αντίγραφο" aria-label="Αντίγραφο" className={iconBtn}><Copy size={15} /></button>}
                          {canEdit && c.status === 'draft' && <button type="button" onClick={() => del(c)} title="Διαγραφή" aria-label="Διαγραφή" className="flex h-8 w-8 items-center justify-center rounded-full text-signal-danger transition hover:bg-rose-50"><Trash2 size={15} /></button>}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {list.length === 0 && <tr><td colSpan={8} className="!py-10 text-center">Δεν υπάρχουν ακόμη campaigns. Δημιουργήστε το πρώτο.</td></tr>}
                </tbody>
              </table>
            </div>
            {filtered.length ? <Pager from={p * per + 1} to={Math.min(filtered.length, p * per + per)} total={filtered.length} page={p} pages={pages} onPage={setPg} /> : <p className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Καμία εγγραφή</p>}
          </div>
          <aside className="grid items-start gap-4 sm:grid-cols-2 2xl:block 2xl:space-y-4">
            <Briefing tag={BRIEF[channel][0]} title={BRIEF[channel][1]} text={BRIEF[channel][2]} metrics={[['Σε εξέλιξη', st('sending'), 'ενεργά'], ['Στάλθηκαν', sentMsgs, 'μηνύματα'], ['Απέτυχαν', failedMsgs, 'σφάλματα']]} />
            {channel === 'email' && <SideStat icon={MailOpen} label="Άνοιξαν" value={openedMsgs} note="Μηνύματα που άνοιξαν οι παραλήπτες. Δείχνει πόσο καλό είναι το θέμα. (Χρειάζεται πάροχο email με παρακολούθηση.)" />}
            <SideStat icon={FileText} label="Πρόχειρα" value={st('draft')} note="Campaigns που αποθηκεύτηκαν αλλά δεν στάλθηκαν. Ελέγξτε τα και στείλτε τα." />
            <SideStat icon={CheckCircle2} label="Ολοκληρωμένες αποστολές" value={st('sent')} note="Campaigns που στάλθηκαν. Ανοίξτε το καθένα για τα αποτελέσματα." />
            <SideStat icon={Layers} label="Σύνολο campaigns" value={mine.length} note={`Όλα τα ${CH_NAME[channel]} campaigns, πρόχειρα και σταλμένα.`} />
          </aside>
        </div>
      )}

      {dlg && <CampaignDialog channel={dlg.row?.channel ?? channel} row={dlg.row} copy={dlg.copy} groups={groups} contacts={contacts} tags={tags} prefill={dlg.row ? {} : prefill}
        onClose={() => { setDlg(null); if (wantsNew) router.replace('/marketing'); }}
        onDone={(t, ok = true) => { setDlg(null); setMsg({ ok, text: t }); router.replace('/marketing'); router.refresh(); }} />}
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
      <aside className="grid items-start gap-4 sm:grid-cols-2 2xl:block 2xl:space-y-4">
        <Briefing tag="Ενημέρωση συστάσεων" title="Οι ικανοποιημένοι αγοραστές είναι το καλύτερο κανάλι πωλήσεων." text="Δώστε αμοιβή και σε αυτόν που συστήνει και στον νέο αγοραστή — η διπλή ανταμοιβή φέρνει περίπου διπλάσιες συστάσεις από τη μονή."
          metrics={[['Κωδικοί', data.codes.length, 'σύνολο'], ['Χρήσεις', data.redemptions.length, 'εξαργυρώσεις'], ['Αμείφθηκαν', data.redemptions.filter((r) => r.status === 'rewarded').length, 'πληρώθηκαν']]} />
        <SideStat icon={Gift} label="Ενεργοί κωδικοί" value={activeCodes} note="Κωδικοί που δέχονται νέες εξαργυρώσεις. Απενεργοποιήστε όσους δεν ανήκουν σε ενεργή προσφορά." />
        <SideStat icon={CheckCircle2} label="Πληρούν τους όρους" value={data.redemptions.filter((r) => r.status === 'qualified').length} note="Ο νέος πελάτης έκανε κράτηση ή συμβόλαιο — δικαιούνται αμοιβή." />
        <SideStat icon={Clock} label="Σε αναμονή" value={data.redemptions.filter((r) => r.status === 'pending').length} note="Περιμένουν να ολοκληρώσει ο νέος πελάτης την αγορά." />
        <SideStat icon={Power} label="Ανενεργοί κωδικοί" value={data.codes.length - activeCodes} note="Ξαναενεργοποιήστε τους όποτε θέλετε." />
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

type Kind = CampaignAudience['kind'];

function CampaignDialog({ channel: ch0, row, copy, groups, contacts, tags, prefill, onClose, onDone }: { channel: CampaignChannel; row?: CampaignRow; copy?: boolean; groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[]; prefill: Prefill; onClose: () => void; onDone: (msg: string, ok?: boolean) => void }) {
  const a0 = row?.audience;
  const preIds = prefill.ids ? prefill.ids.split(',').filter(Boolean) : [];
  const [channel, setChannel] = useState<CampaignChannel>(ch0);
  const [name, setName] = useState(row ? `${row.name}${copy ? ' (αντίγραφο)' : ''}` : '');
  const [kind, setKind] = useState<Kind>(a0?.kind ?? (preIds.length ? 'contacts' : prefill.tag ? 'tag' : prefill.role ? 'role' : 'groups'));
  const [selGroups, setSelGroups] = useState<string[]>(a0?.kind === 'groups' ? a0.groups : prefill.group ? [prefill.group] : []);
  const [ids, setIds] = useState<Set<string>>(new Set(a0?.kind === 'contacts' ? a0.ids : preIds));
  const [addrText, setAddrText] = useState(a0?.kind === 'addresses' ? a0.addresses.join('\n') : '');
  const [tag, setTag] = useState(a0?.kind === 'tag' ? a0.tag : prefill.tag ?? '');
  const [role, setRole] = useState(a0?.kind === 'role' ? a0.role : prefill.role ?? 'buyer');
  const [subject, setSubject] = useState(row?.subject ?? '');
  const [preview, setPreview] = useState(row?.preview ?? '');
  const [body, setBody] = useState(row?.body ?? '');
  const [q, setQ] = useState('');
  const [count, setCount] = useState<{ total: number; reachable: number; noConsent: number; noAddress: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const audience: CampaignAudience | null = kind === 'groups' ? { kind, groups: selGroups } : kind === 'contacts' ? { kind, ids: [...ids] } : kind === 'addresses' ? { kind, addresses: parseAddresses(addrText) } : kind === 'tag' ? { kind, tag } : { kind: 'role', role };
  const key = JSON.stringify([audience, channel]);
  useEffect(() => { setCount(null); const t = setTimeout(() => { void previewAudience(audience, channel).then((r) => { if (r.ok) setCount(r); }); }, 350); return () => clearTimeout(t); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const ql = q.trim().toLowerCase();
  const shown = contacts.filter((c) => !ql || [c.name, c.email ?? '', c.phone ?? ''].join(' ').toLowerCase().includes(ql)).slice(0, 150);
  const flip = (id: string) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const insert = (t: string) => setBody((b) => `${b}${t}`);

  const submit = (send: boolean) => start(async () => {
    setErr(null);
    if (send && !confirm(`Αποστολή σε ${count?.reachable ?? 'όλους τους'} παραλήπτες τώρα;`)) return;
    const r = await saveCampaign({ id: row && !copy ? row.id : undefined, name, channel, audience, subject, preview, body }, send);
    if (!r.ok) { setErr(r.error); return; }
    if (!send) { onDone(`Το «${name}» αποθηκεύτηκε ως πρόχειρο.`); return; }
    if (r.providerMissing) onDone(`Το «${name}» καταγράφηκε για ${r.queued ?? 0} παραλήπτες, αλλά δεν έχει συνδεθεί πάροχος ${channel === 'email' ? 'email (Resend / Postmark)' : 'WhatsApp'} — δεν στάλθηκε πραγματικά.`, false);
    else onDone(`Το «${name}» στάλθηκε: ${r.sent ?? 0} επιτυχίες${r.failed ? `, ${r.failed} αποτυχίες` : ''}.`);
  });

  const KINDS: [Kind, string][] = [['groups', 'Ομάδα πελατών'], ['contacts', 'Συγκεκριμένοι πελάτες'], ['tag', 'Tag'], ['role', 'Ιδιότητα'], ...(channel === 'push' ? [] : [['addresses', channel === 'email' ? 'Γραπτές διευθύνσεις' : 'Γραπτά τηλέφωνα'] as [Kind, string]])];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">Νέο <em className="text-forest">{channel === 'email' ? 'email campaign' : channel === 'push' ? 'push ειδοποίηση' : 'WhatsApp campaign'}</em></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button></div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Βασικά</p>
          <label className="block"><span className={lbl}>Όνομα campaign *</span><input autoFocus className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="π.χ. Νέο έργο Λεμεσός — προπώληση" /></label>
          <div className="flex flex-wrap gap-2">
            {(['email', 'whatsapp', 'push'] as const).map((c) => <button key={c} type="button" onClick={() => { setChannel(c); if (c === 'push' && kind === 'addresses') setKind('groups'); }} className={`rounded-full border px-3 py-1 text-sm ${channel === c ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`}>{c === 'email' ? 'Email' : c === 'push' ? 'Push' : 'WhatsApp'}</button>)}
          </div>
          <div>
            <span className={lbl}>Κοινό *</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="input w-auto text-sm">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="mt-2">
              {kind === 'groups' && (groups.length ? (
                <div className="flex flex-wrap gap-1.5">{groups.map((g) => { const on = selGroups.includes(g.name); return <button key={g.name} type="button" onClick={() => setSelGroups((x) => (on ? x.filter((y) => y !== g.name) : [...x, g.name]))} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`} data-no-tr>{g.name} <span className="text-charcoal-600">· {g.n}</span></button>; })}</div>
              ) : <p className="text-sm text-charcoal-600">Δεν υπάρχουν ομάδες. Φτιάξτε μία στους Πελάτες → Ομάδες.</p>)}
              {kind === 'contacts' && (
                <div>
                  <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση πελάτη…" className="input pl-9" /></label>
                  <div className="mt-2 max-h-56 divide-y divide-stone-line overflow-y-auto rounded-xl border border-stone-line">
                    {shown.map((c) => (
                      <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
                        <input type="checkbox" checked={ids.has(c.id)} onChange={() => flip(c.id)} />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-charcoal" data-no-tr>{c.name}</span><span className="block truncate text-[12px] text-charcoal-600" data-no-tr>{channel === 'email' ? c.email ?? 'χωρίς email' : c.phone ?? 'χωρίς τηλέφωνο'}</span></span>
                        {!c.optIn && <span className="text-[12px] text-charcoal-600">χωρίς συγκατάθεση</span>}
                      </label>
                    ))}
                  </div>
                  <p className="mt-1 text-[13px] text-charcoal-600">{ids.size} επιλεγμένοι</p>
                </div>
              )}
              {kind === 'tag' && <select value={tag} onChange={(e) => setTag(e.target.value)} className="input text-sm"><option value="">Διαλέξτε tag…</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
              {kind === 'role' && <select value={role} onChange={(e) => setRole(e.target.value)} className="input text-sm">{ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_EL[r]}</option>)}</select>}
              {kind === 'addresses' && <textarea value={addrText} onChange={(e) => setAddrText(e.target.value)} className="input min-h-[90px] text-sm" placeholder={channel === 'email' ? 'ένα email ανά γραμμή ή με κόμμα' : 'ένα τηλέφωνο ανά γραμμή, με κωδικό χώρας (+357…)'} />}
            </div>
            <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600">
              {count === null ? 'Υπολογισμός παραληπτών…' : kind === 'addresses' ? `${count.reachable} έγκυρες διευθύνσεις.` : <>Θα το λάβουν <b className="text-charcoal">{count.reachable}</b> από {count.total}{count.noConsent ? ` · ${count.noConsent} χωρίς συγκατάθεση marketing (GDPR)` : ''}{count.noAddress ? ` · ${count.noAddress} χωρίς ${channel === 'email' ? 'email' : channel === 'push' ? 'λογαριασμό στην εφαρμογή' : 'τηλέφωνο'}` : ''}.</>}
            </p>
          </div>

          <p className="pt-2 text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">Μήνυμα</p>
          {channel === 'push' && <label className="block"><span className={lbl}>Τίτλος ειδοποίησης</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="π.χ. Νέα φωτογραφίες από το εργοτάξιο" /></label>}
          {channel === 'email' && <>
            <label className="block"><span className={lbl}>Θέμα</span><input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} /></label>
            <label className="block"><span className={lbl}>Κείμενο προεπισκόπησης</span><input className="input" value={preview} onChange={(e) => setPreview(e.target.value)} /></label>
          </>}
          <div>
            <div className="mb-1 flex items-center justify-between"><span className={lbl}>Μήνυμα *</span>
              <span className="flex gap-1 text-[12px]"><button type="button" onClick={() => insert('{{first_name}}')} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ Μικρό όνομα</button><button type="button" onClick={() => insert('{{name}}')} className="rounded-full border border-stone-line px-2 py-0.5 hover:border-forest/40">+ Ονοματεπώνυμο</button></span></div>
            <textarea className="input min-h-[180px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder={'Αγαπητέ/ή {{first_name}},\n\n…'} />
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-stone-line px-6 py-4">
          <button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button>
          <button type="button" className="rounded-full border border-stone-line px-4 py-2 text-sm font-medium text-charcoal hover:border-forest/40" disabled={pending || !name.trim()} onClick={() => submit(false)}>Αποθήκευση προχείρου</button>
          <button type="button" className="btn-primary" disabled={pending || !name.trim() || !body.trim() || !count?.reachable} onClick={() => submit(true)}>{pending ? 'Αποστολή…' : 'Δημιουργία & αποστολή'}</button>
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
          <p className="text-[13px] text-charcoal-600">{c.sentAt ? `Στάλθηκε ${formatDate(c.sentAt)}` : `Δημιουργήθηκε ${formatDate(c.createdAt)}`}</p>
        </div>
      </div>
    </div>
  );
}
