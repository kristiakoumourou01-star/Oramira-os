'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Hand, UserCheck, Users, Inbox, PhoneOff, Timer, Search } from 'lucide-react';
import type { AssignedLeadRow } from '@/lib/sales-hub-shared';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { Pager, SideStat } from '@/components/ui/SidePanel';
import { StatusPill } from '@/components/ui/StatusPill';
import { PopSelect } from '@/components/ui/PopSelect';
import { reassignLead } from '@/app/actions/leads';

const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', portal: 'Portal', other: 'Άλλο' };
const SRC_BLUE = new Set(['website', 'meta', 'google', 'portal', 'whatsapp']);
const PERIODS = [['7', '7 μέρες'], ['30', '30 μέρες'], ['60', '60 μέρες']] as const;
const SIZES = [10, 25, 50, 100];

type AgentStat = { id: string; name: string; total: number; self: number; given: number; notContacted: number; avgMin: number | null };

/** «45 λ.» / «3 ώ.» / «2 μ.» — μέσος χρόνος πρώτης επικοινωνίας. */
function dur(min: number | null) {
  if (min == null) return '—';
  if (min < 60) return `${min} λ.`;
  if (min < 60 * 24) return `${Math.round(min / 60)} ώ.`;
  return `${Math.round(min / 1440)} μ.`;
}

/**
 * Για τον Owner / Manager: ποιος συνεργάτης ανέλαβε ποιο lead και πότε.
 * Φτιαγμένο για πολλούς συνεργάτες: πίνακας ανά συνεργάτη (με όσους δεν έχουν
 * κανένα lead), φίλτρα, αναζήτηση και αλλαγή υπευθύνου από τη γραμμή.
 */
export function AssignedLeads({ rows, agents }: { rows: AssignedLeadRow[]; agents: { id: string; full_name: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [agent, setAgent] = useState<string>('all');
  const [period, setPeriod] = useState<string>('30');
  const [source, setSource] = useState('all');
  const [how, setHow] = useState('all');
  const [contact, setContact] = useState('all');
  const [q, setQ] = useState('');
  const [aq, setAq] = useState('');
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(25);
  const [aPage, setAPage] = useState(0);
  const aSize = 10;
  const [moved, setMoved] = useState<Record<string, string>>({});
  const tag = DATE_TAG[currentLocale().lang];
  const since = Date.now() - Number(period) * 86400000;
  const nameOf = useMemo(() => new Map(agents.map((a) => [a.id, a.full_name ?? '—'])), [agents]);

  const inPeriod = useMemo(
    () => rows.map((r) => (moved[r.id] ? { ...r, assignedTo: moved[r.id], assignedToName: nameOf.get(moved[r.id]) ?? r.assignedToName } : r))
      .filter((r) => Date.parse(r.assignedAt ?? r.createdAt) >= since),
    [rows, since, moved, nameOf],
  );

  const byAgent = useMemo(() => {
    const m = new Map<string, AgentStat & { _r: number[] }>();
    for (const a of agents) m.set(a.id, { id: a.id, name: a.full_name ?? '—', total: 0, self: 0, given: 0, notContacted: 0, avgMin: null, _r: [] });
    for (const r of inPeriod) {
      if (!r.assignedTo) continue;
      const x = m.get(r.assignedTo) ?? { id: r.assignedTo, name: r.assignedToName ?? '—', total: 0, self: 0, given: 0, notContacted: 0, avgMin: null, _r: [] };
      x.total += 1;
      if (r.assignedBy && r.assignedBy === r.assignedTo) x.self += 1; else x.given += 1;
      if (!r.contacted) x.notContacted += 1;
      if (r.responseMin != null) x._r.push(r.responseMin);
      m.set(r.assignedTo, x);
    }
    return Array.from(m.values())
      .map(({ _r, ...x }) => ({ ...x, avgMin: _r.length ? Math.round(_r.reduce((s, n) => s + n, 0) / _r.length) : null }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [inPeriod, agents]);

  const totals = useMemo(() => {
    const self = inPeriod.filter((r) => r.assignedBy && r.assignedBy === r.assignedTo).length;
    const resp = inPeriod.map((r) => r.responseMin).filter((n): n is number => n != null);
    return {
      all: inPeriod.length, self, given: inPeriod.length - self,
      notContacted: inPeriod.filter((r) => !r.contacted).length,
      avg: resp.length ? Math.round(resp.reduce((s, n) => s + n, 0) / resp.length) : null,
      idle: byAgent.filter((a) => a.total === 0).length,
    };
  }, [inPeriod, byAgent]);

  const agentList = aq ? byAgent.filter((a) => a.name.toLowerCase().includes(aq.toLowerCase())) : byAgent;
  const aPages = Math.max(1, Math.ceil(agentList.length / aSize));
  const agentShown = agentList.slice(aPage * aSize, (aPage + 1) * aSize);
  const maxTotal = Math.max(1, ...byAgent.map((a) => a.total));

  const sources = useMemo(() => Array.from(new Set(inPeriod.map((r) => r.source).filter(Boolean))) as string[], [inPeriod]);
  const list = inPeriod.filter((r) =>
    (agent === 'all' || r.assignedTo === agent)
    && (source === 'all' || r.source === source)
    && (how === 'all' || (how === 'self') === (!!r.assignedBy && r.assignedBy === r.assignedTo))
    && (contact === 'all' || (contact === 'yes') === r.contacted)
    && (!q || (r.name ?? '').toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const shown = list.slice(page * size, (page + 1) * size);
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString(tag, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
  const reset = () => setPage(0);
  const agentOpts: [string, string][] = [['all', 'Όλοι οι συνεργάτες'], ...byAgent.map((a) => [a.id, a.name] as [string, string])];
  const ownerOpts: [string, string][] = agents.map((a) => [a.id, a.full_name ?? '—']);

  const move = (leadId: string, to: string) => {
    setMoved((m) => ({ ...m, [leadId]: to }));
    start(async () => { await reassignLead(leadId, to, 'Reassigned'); router.refresh(); });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-[14rem] flex-1 text-sm text-charcoal-600">Ποιος ανέλαβε ποιο lead και πότε. Πατήστε έναν συνεργάτη για να δείτε μόνο τα δικά του.</p>
        <span className="inline-flex rounded-xl border border-stone-line bg-white p-1">
          {PERIODS.map(([k, label]) => (
            <button key={k} type="button" onClick={() => { setPeriod(k); reset(); }} className={`rounded-lg px-3 py-1 text-[13px] ${period === k ? 'bg-forest text-white' : 'text-charcoal hover:bg-forest/[0.06]'}`}>{label}</button>
          ))}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SideStat icon={Inbox} label="Leads με υπεύθυνο" value={totals.all} note={`Τα πήραν μόνοι τους: ${totals.self}`} />
        <SideStat icon={PhoneOff} label="Χωρίς επικοινωνία" value={totals.notContacted} note="Leads που δεν έχει γίνει ακόμη επαφή." />
        <SideStat icon={Timer} label="Μέσος χρόνος απάντησης" value={dur(totals.avg)} note="Από την ανάληψη μέχρι την πρώτη επαφή." />
        <SideStat icon={Users} label="Συνεργάτες χωρίς lead" value={totals.idle} note="Μπορούν να πάρουν τα επόμενα leads." />
      </div>

      {/* Ανά συνεργάτη */}
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-line px-5 py-3">
          <h3 className="text-[15px] font-semibold text-charcoal">Ανά συνεργάτη</h3>
          <div className="flex flex-wrap items-center gap-2">
            {agent !== 'all' && <button type="button" onClick={() => { setAgent('all'); reset(); }} className="rounded-lg border border-stone-line px-2.5 py-1 text-[13px] text-charcoal hover:border-forest/40">Όλοι</button>}
            <label className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
              <input value={aq} onChange={(e) => { setAq(e.target.value); setAPage(0); }} placeholder="Αναζήτηση συνεργάτη" className="input h-8 w-48 py-1 pl-7 text-[13px]" />
            </label>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="o-table">
            <thead><tr><th>Συνεργάτης</th><th>Leads</th><th>Μόνος/η</th><th>Με ανάθεση</th><th>Χωρίς επικοινωνία</th><th>Μέσος χρόνος απάντησης</th></tr></thead>
            <tbody>
              {agentShown.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-sm text-charcoal-600">Δεν βρέθηκε συνεργάτης.</td></tr>}
              {agentShown.map((a) => (
                <tr key={a.id} onClick={() => { setAgent(agent === a.id ? 'all' : a.id); reset(); }} className={`cursor-pointer ${agent === a.id ? 'bg-forest/[0.06]' : ''}`}>
                  <td>
                    <span className="flex items-center gap-2.5">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest/[0.1] text-[11px] font-semibold text-forest" data-no-tr>{a.name.slice(0, 1).toUpperCase()}</span>
                      <span className="font-medium text-charcoal" data-no-tr>{a.name}</span>
                    </span>
                  </td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span className="w-6 tabular-nums font-semibold text-charcoal">{a.total}</span>
                      <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-forest/[0.08] sm:block"><span className="block h-full rounded-full bg-forest" style={{ width: `${(a.total / maxTotal) * 100}%` }} /></span>
                    </span>
                  </td>
                  <td className="tabular-nums">{a.self}</td>
                  <td className="tabular-nums">{a.given}</td>
                  <td>{a.notContacted > 0 ? <StatusPill tone="red">{a.notContacted}</StatusPill> : <span className="tabular-nums text-charcoal-600">0</span>}</td>
                  <td className="tabular-nums">{dur(a.avgMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {agentList.length > aSize && <Pager from={aPage * aSize + 1} to={Math.min(agentList.length, (aPage + 1) * aSize)} total={agentList.length} page={aPage} pages={aPages} onPage={setAPage} />}
      </div>

      {/* Όλα τα leads με φίλτρα */}
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-stone-line px-5 py-3">
          <label className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
            <input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Αναζήτηση lead" className="input h-8 w-44 py-1 pl-7 text-[13px]" />
          </label>
          <PopSelect value={agent} onChange={(v) => { setAgent(v); reset(); }} options={agentOpts} searchable ariaLabel="Συνεργάτης" width="min-w-[170px]" />
          <PopSelect value={source} onChange={(v) => { setSource(v); reset(); }} options={[['all', 'Όλες οι πηγές'], ...sources.map((s) => [s, SRC[s] ?? s] as [string, string])]} ariaLabel="Πηγή" />
          <PopSelect value={how} onChange={(v) => { setHow(v); reset(); }} options={[['all', 'Όλοι οι τρόποι'], ['self', 'Το πήρε μόνος/η'], ['given', 'Με ανάθεση']]} ariaLabel="Πώς" />
          <PopSelect value={contact} onChange={(v) => { setContact(v); reset(); }} options={[['all', 'Επικοινωνία: όλα'], ['no', 'Χωρίς επικοινωνία'], ['yes', 'Με επικοινωνία']]} ariaLabel="Επικοινωνία" />
          <span className="ml-auto flex items-center gap-1.5 text-[13px] text-charcoal-600">
            <span>Γραμμές</span>
            <PopSelect value={String(size)} onChange={(v) => { setSize(Number(v)); reset(); }} options={SIZES.map((n) => [String(n), String(n)] as [string, string])} width="min-w-[64px]" ariaLabel="Γραμμές" />
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="o-table">
            <thead><tr><th>Lead</th><th>Πηγή</th><th>Υπεύθυνος</th><th>Πώς</th><th>Πότε</th><th>Επικοινωνία</th></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-sm text-charcoal-600">Δεν υπάρχουν αναθέσεις σε αυτό το διάστημα.</td></tr>}
              {shown.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/crm/leads/${r.id}`} className="font-medium text-charcoal hover:text-forest" data-no-tr>{r.name ?? '—'}</Link></td>
                  <td>{r.source ? <StatusPill tone={SRC_BLUE.has(r.source) ? 'blue' : 'neutral'}>{SRC[r.source] ?? r.source}</StatusPill> : '—'}</td>
                  <td>
                    <PopSelect value={r.assignedTo ?? ''} onChange={(v) => { if (v && v !== r.assignedTo) move(r.id, v); }} options={ownerOpts} searchable placeholder={r.assignedToName ?? '—'} ariaLabel="Αλλαγή υπευθύνου" width="min-w-[150px]" />
                  </td>
                  <td>
                    {r.assignedBy && r.assignedBy === r.assignedTo
                      ? <StatusPill tone="green"><Hand size={12} /> <span>Το πήρε μόνος/η</span></StatusPill>
                      : r.assignedByName
                        ? <StatusPill tone="blue"><UserCheck size={12} /> <span>Ανάθεση από</span> <span data-no-tr>{r.assignedByName}</span></StatusPill>
                        : <StatusPill tone="blue"><UserCheck size={12} /> <span>Αυτόματη ανάθεση</span></StatusPill>}
                  </td>
                  <td className="tabular-nums">{when(r.assignedAt ?? r.createdAt)}</td>
                  <td>{r.contacted ? <StatusPill tone="green" dot>Ναι</StatusPill> : <StatusPill tone="red" dot>Όχι ακόμη</StatusPill>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pager from={list.length ? page * size + 1 : 0} to={Math.min(list.length, (page + 1) * size)} total={list.length} page={page} pages={pages} onPage={setPage} />
        {pending && <p className="px-5 pb-3 text-xs text-charcoal-600">Αποθήκευση…</p>}
      </div>
    </div>
  );
}
