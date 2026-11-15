'use client';

import { useMemo, useState } from 'react';
import { Activity, CalendarDays, Download, LogIn, ShieldAlert, PencilLine, X, Search } from 'lucide-react';

export interface LogRow { id: string; at: string; actor: string; action: string; actionLabel: string; entity: string; details: string }

const day = (iso: string) => iso.slice(0, 10);

/**
 * Logs (όπως στο FitnessCRM → My Account → Logs): κάρτες με αριθμούς, φίλτρα
 * ενέργεια / χρήστης / από–έως, πίνακας και εξαγωγή CSV — με τα χρώματα Oramira.
 */
export function LogsView({ rows, showActor, lang }: { rows: LogRow[]; showActor: boolean; lang: string }) {
  const [action, setAction] = useState('');
  const [actor, setActor] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [q, setQ] = useState('');

  const now = Date.now();
  const kpi = {
    events: rows.filter((r) => now - new Date(r.at).getTime() < 864e5).length,
    logins: rows.filter((r) => r.action === 'login').length,
    failed: rows.filter((r) => r.action === 'login_failed').length,
    changes: rows.filter((r) => now - new Date(r.at).getTime() < 864e5 && !['login', 'logout', 'login_failed'].includes(r.action)).length,
  };
  const actions = useMemo(() => Array.from(new Map(rows.map((r) => [r.action, r.actionLabel])).entries()).sort((a, b) => a[1].localeCompare(b[1])), [rows]);
  const actors = useMemo(() => Array.from(new Set(rows.map((r) => r.actor))).sort(), [rows]);
  const list = rows.filter((r) => (!action || r.action === action) && (!actor || r.actor === actor) && (!from || day(r.at) >= from) && (!to || day(r.at) <= to)
    && (!q.trim() || `${r.actionLabel} ${r.entity} ${r.details} ${r.actor}`.toLowerCase().includes(q.trim().toLowerCase())));
  const filtered = !!(action || actor || from || to || q);
  const fmt = (iso: string) => new Date(iso).toLocaleString(lang, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Nicosia' });

  const exportCsv = () => {
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = ['Ώρα,Χρήστης,Ενέργεια,Στοιχείο,Λεπτομέρειες', ...list.map((r) => [fmt(r.at), r.actor, r.actionLabel, r.entity, r.details].map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `oramira-logs-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  const cards = [
    { label: 'Ενέργειες · 24ω', v: kpi.events, icon: Activity, tone: 'bg-forest/10 text-forest' },
    { label: 'Συνδέσεις · 30 ημ.', v: kpi.logins, icon: LogIn, tone: 'bg-[#4a8668]/15 text-[#2f6e54]' },
    { label: 'Αποτυχημένες συνδέσεις', v: kpi.failed, icon: ShieldAlert, tone: kpi.failed ? 'bg-rose-100 text-signal-danger' : 'bg-stone text-charcoal-600' },
    { label: 'Αλλαγές · 24ω', v: kpi.changes, icon: PencilLine, tone: 'bg-[#c9a063]/20 text-[#8a6a33]' },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl text-charcoal">Logs</h2>
          <p className="text-sm text-charcoal-600/75">{showActor ? 'Ιστορικό ενεργειών όλων των χρηστών' : 'Ιστορικό ενεργειών του λογαριασμού σας'} · τελευταίες 30 ημέρες</p>
        </div>
        <button type="button" onClick={exportCsv} disabled={!list.length} className="inline-flex items-center gap-1.5 rounded-full border border-forest/40 bg-forest/[0.07] px-4 py-2 text-sm font-medium text-forest transition hover:bg-forest hover:text-white disabled:opacity-40"><Download size={15} /> Export CSV</button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${c.tone}`}><c.icon size={14} /></span>{c.label}</div>
            <p className="mt-2 font-display text-3xl text-charcoal">{c.v}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <div className="flex flex-wrap items-end gap-3 [&>label]:min-w-[170px] [&>label]:flex-1">
          <label className="block"><span className="text-xs font-medium text-charcoal-600">Αναζήτηση</span>
            <span className="relative mt-1 block"><Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" /><input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Λέξη, IP, συσκευή…" /></span></label>
          <label className="block"><span className="text-xs font-medium text-charcoal-600">Ενέργεια</span>
            <select className="input mt-1" value={action} onChange={(e) => setAction(e.target.value)}><option value="">Όλες οι ενέργειες</option>{actions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
          {showActor && <label className="block"><span className="text-xs font-medium text-charcoal-600">Χρήστης</span>
            <select className="input mt-1" value={actor} onChange={(e) => setActor(e.target.value)} data-no-tr><option value="">Όλοι</option>{actors.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>}
          <label className="block !flex-none sm:w-[160px]"><span className="text-xs font-medium text-charcoal-600">Από</span><input type="date" className="input mt-1" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="block !flex-none sm:w-[160px]"><span className="text-xs font-medium text-charcoal-600">Έως</span><input type="date" className="input mt-1" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <button type="button" disabled={!filtered} onClick={() => { setAction(''); setActor(''); setFrom(''); setTo(''); setQ(''); }} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-stone-line px-4 text-sm text-charcoal-600 transition hover:border-forest/40 hover:text-forest disabled:opacity-40"><X size={14} /> Καθαρισμός</button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b border-stone-line bg-forest/[0.03] text-left text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70"><tr>
            <th className="px-4 py-3">Ώρα</th>{showActor && <th className="px-4 py-3">Χρήστης</th>}<th className="px-4 py-3">Ενέργεια</th><th className="px-4 py-3">Λεπτομέρειες</th>
          </tr></thead>
          <tbody className="divide-y divide-stone-line/70">
            {list.length === 0 && <tr><td colSpan={showActor ? 4 : 3} className="px-4 py-14 text-center text-charcoal-600/70"><span className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-forest/10 text-forest"><CalendarDays size={20} /></span>Δεν υπάρχει δραστηριότητα για εμφάνιση.</td></tr>}
            {list.slice(0, 500).map((r) => (
              <tr key={r.id} className="transition-colors hover:bg-forest/[0.025]">
                <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-charcoal-600">{fmt(r.at)}</td>
                {showActor && <td className="whitespace-nowrap px-4 py-2.5 font-medium text-charcoal" data-no-tr>{r.actor}</td>}
                <td className="px-4 py-2.5"><span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${r.action === 'login_failed' ? 'bg-rose-50 text-signal-danger ring-rose-200' : r.action === 'login' || r.action === 'logout' ? 'bg-forest/[0.07] text-forest ring-forest/20' : r.action.includes('delet') ? 'bg-rose-50 text-rose-700 ring-rose-200' : r.action.includes('creat') ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-[#c9a063]/15 text-[#8a6a33] ring-[#c9a063]/30'}`}>{r.actionLabel}</span> <span className="ml-1 text-xs text-charcoal-600/60">{r.entity}</span></td>
                <td className="px-4 py-2.5 text-xs text-charcoal-600/80" data-no-tr>{r.details || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {list.length > 500 && <p className="border-t border-stone-line px-4 py-2 text-xs text-charcoal-600/70">Εμφανίζονται οι 500 πιο πρόσφατες· το Export CSV τις περιέχει όλες.</p>}
      </div>
    </div>
  );
}
