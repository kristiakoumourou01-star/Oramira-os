'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { TrendingUp, Map, Home, Users, Wallet, Sparkles, Settings, History, Play, CheckCircle2, XCircle, Clock, Activity, AlertTriangle, type LucideIcon } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { PopSelect } from '@/components/ui/PopSelect';
import { Briefing, SideStat, Pager } from '@/components/ui/SidePanel';
import { runJobManual } from '@/app/actions/automation';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface AutoJob { key: string; label: string; description: string; schedule: string; category: string; lastStatus: string | null; lastAt: string | null; lastSummary: string | null }
export interface AutoRun { id: string; job: string; label: string; status: string; processed: number; summary: string | null; error: string | null; trigger: string; at: string }

const CAT_ICON: Record<string, LucideIcon> = { 'Πωλήσεις': TrendingUp, 'Αγορές γης': Map, 'Ακίνητα': Home, 'Ομάδα & HR': Users, 'Οικονομικά': Wallet, 'AI': Sparkles, 'Σύστημα': Settings };
const ST: Record<string, string> = { success: 'Επιτυχία', failed: 'Σφάλμα', partial: 'Μερική' };
const TRIG: Record<string, string> = { cron: 'Αυτόματα', manual: 'Χειροκίνητα', event: 'Από γεγονός' };
const dt = (iso: string) => new Date(iso).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Αυτοματισμοί (στο στυλ του FitnessCRM): κάρτες ανά κατηγορία, από κάτω οι αυτοματισμοί της, δεξιά η ενημέρωση. */
export function AutomationHub({ jobs, runs, categories }: { jobs: AutoJob[]; runs: AutoRun[]; categories: string[] }) {
  const router = useRouter();
  const [tab, setTab] = useState(categories[0] ?? 'history');
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, string>>({});
  const [rs, setRs] = useState('');
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const [, start] = useTransition();
  const run = (k: string) => { setRunning(k); start(async () => { const r = await runJobManual(k); setResult((x) => ({ ...x, [k]: r.summary })); setRunning(null); router.refresh(); }); };
  const failing = jobs.filter((j) => j.lastStatus === 'failed').length;
  const idle = jobs.filter((j) => !j.lastStatus).length;
  const day = Date.now() - 864e5;
  const runs24 = runs.filter((r) => Date.parse(r.at) >= day);
  const lastFail = runs.find((r) => r.status === 'failed');
  const health = (c: string) => { const js = jobs.filter((j) => j.category === c); const f = js.filter((j) => j.lastStatus === 'failed').length; return f ? `${f} με σφάλμα` : js.some((j) => !j.lastStatus) ? 'σε αναμονή' : 'όλα εντάξει'; };
  const hist = runs.filter((r) => !rs || r.status === rs);
  const pages = Math.max(1, Math.ceil(hist.length / per));
  const p = Math.min(pg, pages - 1);
  const shown = tab === 'history' ? hist.slice(p * per, p * per + per) : [];
  const list = jobs.filter((j) => j.category === tab);
  return (
    <div className="space-y-5">
      <HubCards active={tab} onSelect={(k) => { setTab(k); setPg(0); }} cards={[
        ...categories.map((c) => ({ key: c, icon: CAT_ICON[c] ?? Settings, title: c, value: jobs.filter((j) => j.category === c).length, sub: health(c) })),
        { key: 'history', icon: History, title: 'Ιστορικό', value: runs.length, sub: 'Όλες οι εκτελέσεις' },
      ]} />
      <div className="grid items-start gap-5 2xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          {tab !== 'history' ? (
            <>
              <p className="px-5 pt-4 text-[16px] font-semibold text-charcoal">{tab}</p>
              <p className="px-5 pb-3 text-[13px] text-charcoal-600">Τρέχουν μόνοι τους στη συχνότητα που φαίνεται. Πατήστε «Εκτέλεση τώρα» για να τρέξει αμέσως.</p>
              <div className="overflow-x-auto border-t border-stone-line">
                <table className="o-table">
                  <thead><tr><th>Αυτοματισμός</th><th>Συχνότητα</th><th>Τελευταία εκτέλεση</th><th>Κατάσταση</th><th className="text-right">Ενέργεια</th></tr></thead>
                  <tbody>
                    {list.map((j) => (
                      <tr key={j.key}>
                        <td className="o-strong whitespace-normal"><span className="block">{j.label}</span><span className="block max-w-[420px] text-[11px] font-normal leading-snug text-charcoal-600">{result[j.key] ?? j.description}</span></td>
                        <td>{j.schedule}</td>
                        <td>{j.lastAt ? dt(j.lastAt) : 'Ποτέ'}</td>
                        <td>{j.lastStatus ? <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${j.lastStatus === 'failed' ? 'bg-rose-50 text-signal-danger' : 'bg-forest/[0.09] text-forest'}`}>{j.lastStatus === 'failed' ? <XCircle size={11} /> : <CheckCircle2 size={11} />}{ST[j.lastStatus] ?? j.lastStatus}</span> : <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-0.5 text-[11px] text-charcoal-600"><Clock size={11} /> Σε αναμονή</span>}</td>
                        <td className="text-right"><button type="button" onClick={() => run(j.key)} disabled={running === j.key} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-line px-2.5 text-[13px] text-charcoal transition-colors hover:border-forest/40 disabled:opacity-50"><Play size={13} /> {running === j.key ? 'Εκτελείται…' : 'Εκτέλεση τώρα'}</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Εμφάνιση 1–{list.length} από {list.length}</p>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
                <span>Προβάλλονται</span>
                <PopSelect width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPg(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
                <span>εγγραφές</span>
                <span className="ml-auto"><PopSelect width="min-w-[160px]" value={rs} onChange={(v) => { setRs(v); setPg(0); }} options={[['', 'Όλες οι καταστάσεις'], ...Object.entries(ST)]} /></span>
              </div>
              <div className="overflow-x-auto border-t border-stone-line">
                <table className="o-table">
                  <thead><tr><th>Αυτοματισμός</th><th>Κατάσταση</th><th className="text-right">Εγγραφές</th><th>Αποτέλεσμα</th><th>Πώς</th><th>Πότε</th></tr></thead>
                  <tbody>
                    {shown.map((r) => (
                      <tr key={r.id}>
                        <td className="o-strong">{r.label}</td>
                        <td><span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${r.status === 'failed' ? 'bg-rose-50 text-signal-danger' : 'bg-forest/[0.09] text-forest'}`}>{ST[r.status] ?? r.status}</span></td>
                        <td className="text-right tabular-nums">{r.processed}</td>
                        <td><span className={`block max-w-[320px] truncate ${r.error ? 'text-signal-danger' : ''}`} title={r.error ?? r.summary ?? ''}>{r.error ?? r.summary ?? '—'}</span></td>
                        <td>{TRIG[r.trigger] ?? r.trigger}</td>
                        <td>{dt(r.at)}</td>
                      </tr>
                    ))}
                    {shown.length === 0 && <tr><td colSpan={6} className="!py-10 text-center">Δεν υπάρχουν εκτελέσεις ακόμη.</td></tr>}
                  </tbody>
                </table>
              </div>
              {hist.length ? <Pager from={p * per + 1} to={Math.min(hist.length, p * per + per)} total={hist.length} page={p} pages={pages} onPage={setPg} /> : null}
            </>
          )}
        </div>
        <aside className="grid items-start gap-4 sm:grid-cols-2 2xl:block 2xl:space-y-4">
          <Briefing tag="Ενημέρωση αυτοματισμών" title={failing ? 'Κάποιοι αυτοματισμοί χρειάζονται προσοχή.' : 'Όλοι οι αυτοματισμοί δουλεύουν κανονικά.'} text="Οι αυτοματισμοί κάνουν follow-up, υπενθυμίσεις πληρωμών και viewings, λήξεις κρατήσεων και εργασίες για την ομάδα — χωρίς να το θυμάται κανείς."
            metrics={[['Σύνολο', jobs.length, 'αυτοματισμοί'], ['Εντάξει', jobs.length - failing - idle, 'χωρίς σφάλμα'], ['Σφάλματα', failing, 'θέλουν έλεγχο']]} />
          <SideStat icon={Activity} label="Εκτελέσεις 24 ωρών" value={runs24.length} note="Πόσες φορές έτρεξαν οι αυτοματισμοί το τελευταίο 24ωρο." />
          <SideStat icon={CheckCircle2} label="Εγγραφές που επεξεργάστηκαν" value={runs24.reduce((n, r) => n + r.processed, 0)} note="Leads, κρατήσεις, πληρωμές και εργασίες που άγγιξαν οι αυτοματισμοί σε 24 ώρες." />
          <SideStat icon={Clock} label="Δεν έχουν τρέξει ακόμη" value={idle} note="Αυτοματισμοί χωρίς καμία εκτέλεση — θα τρέξουν στην επόμενη ώρα τους." />
          <SideStat icon={AlertTriangle} label="Τελευταίο σφάλμα" value={lastFail ? lastFail.label : '—'} note={lastFail ? `${dt(lastFail.at)} · ${lastFail.error ?? ''}` : 'Κανένα σφάλμα πρόσφατα.'} />
        </aside>
      </div>
    </div>
  );
}
