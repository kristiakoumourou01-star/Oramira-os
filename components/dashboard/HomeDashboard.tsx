'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Sparkles, AlertTriangle, Info, ArrowRight, Plus, LayoutGrid, CalendarDays, Download, CreditCard, UserPlus, KeyRound, FileSignature, Eye, CalendarClock, Video } from 'lucide-react';
import type { HomeData } from '@/lib/dashboard-home';

const eur = (n: number) => `€${Math.round(n).toLocaleString('el-GR')}`;
const eurShort = (n: number) => (n >= 1_000_000 ? `€${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `€${Math.round(n / 1000)}k` : `€${Math.round(n)}`);
const card = 'rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]';
const head = 'flex items-center justify-between gap-2 px-5 pt-4 pb-3';
const title = 'text-[16px] font-semibold text-charcoal';
const muted = 'text-[13px] text-charcoal-600';
const dt = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const hm = (iso: string) => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** Dashboard με τη διάταξη του FitnessCRM και δεδομένα developer, σε ένα χρώμα (της εταιρείας). */
export function HomeDashboard({ d, name, planner }: { d: HomeData; name: string; planner?: React.ReactNode }) {
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Καλημέρα' : hour < 18 ? 'Καλησπέρα' : 'Καλό βράδυ';
  const date = new Date().toLocaleDateString('el-GR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const vsAvg = d.avgDailyIn > 0 ? Math.round(((d.todayIn - d.avgDailyIn) / d.avgDailyIn) * 100) : 0;
  const brief = [
    d.today.length ? `Σήμερα έχετε ${d.today.length === 1 ? '1 ραντεβού' : `${d.today.length} ραντεβού`}` : 'Σήμερα δεν έχετε ραντεβού',
    `${d.activeLeads} ενεργά leads με αξία ${eur(d.pipelineValue)}`,
    `${d.available} διαθέσιμες μονάδες από ${d.totalUnits}`,
  ].join(' · ') + '.';

  return (
    <div className="space-y-5">
      {/* ── Ενημέρωση ── */}
      <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest via-forest to-forest-deep p-5 text-white shadow-[0_8px_30px_-12px_rgb(var(--c-forest)/0.6)] sm:p-6">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]"><Sparkles size={12} /> Καθημερινή ενημέρωση</span>
            <h1 className="mt-3 font-display text-3xl leading-tight text-white">{greet}{name ? `, ${name.split(' ')[0]}` : ''}</h1>
            <p className="mt-0.5 text-[14px] capitalize text-white/80">{date}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/90">{brief}</p>
          </div>
          <div className="flex gap-3">
            <HeroStat label="Εισπράξεις σήμερα" value={eur(d.todayIn)} note={`${vsAvg >= 0 ? '+' : ''}${vsAvg}% από τον μέσο όρο`} />
            <HeroStat label="Ενεργά leads" value={String(d.activeLeads)} note={`+${d.newLeadsWeek} αυτή την εβδομάδα`} />
          </div>
        </div>
        {d.attention.length > 0 && (
          <div className="relative mt-6">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/75">Χρειάζονται προσοχή</p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {d.attention.map((a) => (
                <Link key={a.text} href={a.href} className="group flex items-start gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 text-[13.5px] leading-snug text-white transition hover:bg-white/20">
                  {a.tone === 'warn' ? <AlertTriangle size={15} className="mt-0.5 shrink-0" /> : <Info size={15} className="mt-0.5 shrink-0" />}
                  <span className="flex-1">{a.text}</span>
                  <ArrowRight size={14} className="mt-0.5 shrink-0 opacity-70 transition group-hover:translate-x-0.5" />
                </Link>
              ))}
            </div>
          </div>
        )}
        <div className="relative mt-5 flex flex-wrap gap-2">
          <Link href="/crm/customers" className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"><Plus size={14} /> Γρήγορη προσθήκη</Link>
          <Link href="/settings?section=dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-[13px] font-medium text-white hover:bg-white/20"><LayoutGrid size={14} /> Προσαρμογή διάταξης</Link>
          <Link href="/calendar" className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-[13px] font-semibold text-forest hover:bg-white/90"><CalendarDays size={14} /> Το πλάνο της ημέρας</Link>
        </div>
      </section>

      {/* ── Μετρήσεις ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Εισπράξεις σήμερα" value={eur(d.todayIn)} note={`${vsAvg >= 0 ? '+' : ''}${vsAvg}% από τον μέσο όρο`} spark={d.monthly.map((m) => m.thisYear)} />
        <Kpi label="Ενεργά leads" value={String(d.activeLeads)} note={`+${d.newLeadsWeek} αυτή την εβδομάδα`} spark={d.funnel.map((f) => f.n).reverse()} />
        <Kpi label="Αξία pipeline" value={eurShort(d.pipelineValue)} note={`${d.wonThisMonth} πωλήσεις αυτόν τον μήνα`} />
        <Kpi label="Lead → Αγοραστής" value={`${d.conversion}%`} note={`${d.conversion - d.conversionPrev >= 0 ? '+' : ''}${d.conversion - d.conversionPrev} μον. από το προηγούμενο τρίμηνο`} />
      </div>

      <RevenueChart monthly={d.monthly} yoy={d.yoy} />

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── Ζωντανή δραστηριότητα ── */}
        <section className={card}>
          <div className={head}><h3 className={title}>Ζωντανή δραστηριότητα</h3><span className="flex items-center gap-1.5 text-[12px] text-forest"><span className="h-2 w-2 animate-pulse rounded-full bg-forest" /> live</span></div>
          <ul className="max-h-[380px] divide-y divide-stone-line overflow-y-auto border-t border-stone-line">
            {d.activity.map((a, i) => {
              const Icon = a.kind === 'payment' ? CreditCard : a.kind === 'lead' ? UserPlus : a.kind === 'reservation' ? KeyRound : a.kind === 'contract' ? FileSignature : Eye;
              const body = (<><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest/[0.08] text-forest"><Icon size={15} /></span><span className="min-w-0"><span className="block text-[14px] text-charcoal" data-no-tr>{a.text}</span><span className="font-mono text-[12px] text-charcoal-600">{dt(a.at)}</span></span></>);
              return <li key={i}>{a.href ? <Link href={a.href} className="flex items-center gap-3 px-5 py-2.5 hover:bg-stone-50">{body}</Link> : <div className="flex items-center gap-3 px-5 py-2.5">{body}</div>}</li>;
            })}
            {d.activity.length === 0 && <li className={`px-5 py-8 text-center ${muted}`}>Καμία δραστηριότητα ακόμη.</li>}
          </ul>
        </section>

        <div className="space-y-5">
          {/* ── Ραντεβού σήμερα ── */}
          <section className={card}>
            <div className={head}><h3 className={`${title} flex items-center gap-2`}><CalendarClock size={17} className="text-forest" /> Ραντεβού σήμερα</h3><Link href="/calendar" className="text-[13px] font-medium text-forest hover:underline">Ημερολόγιο →</Link></div>
            <div className="px-5 pb-4">
              {d.today.length === 0 ? <p className={muted}>Κανένα ραντεβού σήμερα.</p> : (
                <ul className="space-y-2">{d.today.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 text-[14px]">
                    <span className="w-12 shrink-0 font-mono text-[13px] text-forest">{hm(t.at)}</span>
                    {t.href ? <Link href={t.href} className="min-w-0 flex-1 truncate text-charcoal hover:text-forest" data-no-tr>{t.title}</Link> : <span className="min-w-0 flex-1 truncate" data-no-tr>{t.title}</span>}
                    {t.link && <a href={t.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-forest/30 px-2 py-0.5 text-[12px] text-forest"><Video size={12} /> Σύνδεση</a>}
                  </li>
                ))}</ul>
              )}
            </div>
          </section>
          {/* ── Μετατροπή ── */}
          <section className={card}>
            <div className={head}><h3 className={title}>Μετατροπή leads</h3></div>
            <Gauge pct={d.conversion} label="LEADS → ΠΩΛΗΣΕΙΣ" />
            <div className="grid grid-cols-2 gap-3 border-t border-stone-line px-5 py-3">
              <div><p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Τελευταίοι 3 μήνες</p><p className="font-display text-xl text-charcoal">{d.conversion}%</p></div>
              <div><p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">Προηγούμενοι 3 μήνες</p><p className="font-display text-xl text-charcoal">{d.conversionPrev}%</p></div>
            </div>
            <Link href="/sales/insights" className="block px-5 pb-4 text-[13px] font-medium text-forest hover:underline">Λεπτομέρειες →</Link>
          </section>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── Πηγές leads ── */}
        <section className={card}>
          <div className={head}><div><h3 className={title}>Πηγές leads</h3><p className={muted}>Τελευταίες 30 μέρες</p></div><div className="text-right"><p className="font-display text-2xl text-charcoal">{d.sources.reduce((s, x) => s + x.n, 0)}</p><p className="text-[11px] font-semibold uppercase tracking-wide text-charcoal-600">Σύνολο · 30Μ</p></div></div>
          <ul className="space-y-1 px-5 pb-4">
            {d.sources.map((s) => { const max = Math.max(...d.sources.map((x) => x.n), 1); return (
              <li key={s.key} className="flex items-center gap-3 py-1.5 text-[14px]">
                <span className="w-40 shrink-0"><span className="block font-medium text-charcoal">{s.label}</span><span className="text-[12px] text-charcoal-600">{s.n} leads · {s.won} πωλήσεις</span></span>
                <span className="h-2 flex-1 rounded-full bg-stone-100"><span className="block h-2 rounded-full bg-gradient-to-r from-forest/60 to-forest" style={{ width: `${(s.n / max) * 100}%` }} /></span>
                <span className="w-8 text-right font-semibold tabular-nums">{s.n}</span>
              </li>); })}
            {d.sources.length === 0 && <li className={muted}>Κανένα lead τις τελευταίες 30 μέρες.</li>}
          </ul>
        </section>
        {/* ── Αγοραστές ανά χώρα ── */}
        <section className={card}>
          <div className={head}><h3 className={title}>Πελάτες ανά χώρα <span className="text-[13px] font-normal text-charcoal-600">εθνικότητα</span></h3><Link href="/crm/customers" className="text-[13px] font-medium text-forest hover:underline">Όλοι</Link></div>
          <ul className="divide-y divide-stone-line px-5 pb-3">
            {d.countries.map((c) => (
              <li key={c.name} className="flex items-center gap-3 py-2 text-[14px]">
                <span className="min-w-0 flex-1"><span className="block font-medium text-charcoal" data-no-tr>{c.name}</span><span className="text-[12px] text-charcoal-600">{c.share}% των leads</span></span>
                <span className="h-1.5 w-24 rounded-full bg-stone-100"><span className="block h-1.5 rounded-full bg-forest" style={{ width: `${c.share}%` }} /></span>
                <span className="w-8 text-right font-semibold tabular-nums">{c.n}</span>
              </li>
            ))}
            {d.countries.length === 0 && <li className={`py-3 ${muted}`}>Δεν υπάρχουν δεδομένα.</li>}
          </ul>
        </section>
      </div>

      <PaymentSchedule rows={d.schedule} />

      {/* ── Διαθεσιμότητα μονάδων ── */}
      <section className={card}>
        <div className={head}><h3 className={title}>Διαθεσιμότητα μονάδων · ανά έργο</h3><Link href="/projects" className="text-[13px] font-medium text-forest hover:underline">Έργα →</Link></div>
        <div className="overflow-x-auto px-5 pb-4">
          <table className="w-full min-w-[560px] text-[14px]">
            <thead><tr className="text-left text-[12px] font-semibold uppercase tracking-wide text-charcoal-600"><th className="pb-2">Έργο</th><th className="pb-2">Διαθέσιμες</th><th className="pb-2">Κρατημένες</th><th className="pb-2">Πουλημένες</th><th className="pb-2">Πρόοδος πωλήσεων</th></tr></thead>
            <tbody>{d.projects.map((p) => { const pct = p.total ? Math.round(((p.sold + p.reserved) / p.total) * 100) : 0; return (
              <tr key={p.name} className="border-t border-stone-line">
                <td className="py-2.5 font-medium text-charcoal" data-no-tr>{p.name}</td>
                <td className="tabular-nums">{p.available}</td><td className="tabular-nums">{p.reserved}</td><td className="tabular-nums">{p.sold}</td>
                <td><span className="flex items-center gap-2"><span className="h-2 w-40 rounded-full bg-stone-100"><span className="block h-2 rounded-full bg-forest" style={{ width: `${pct}%` }} /></span><span className="text-[13px] tabular-nums text-charcoal-600">{pct}%</span></span></td>
              </tr>); })}
              {d.projects.length === 0 && <tr><td colSpan={5} className={`py-4 ${muted}`}>Δεν υπάρχουν μονάδες ακόμη.</td></tr>}
            </tbody>
          </table>
          <p className="mt-3 flex flex-wrap gap-5 text-[13px] text-charcoal-600"><span><b className="text-charcoal">{d.available}</b> διαθέσιμες</span><span><b className="text-charcoal">{d.reservedUnits}</b> κρατημένες</span><span><b className="text-charcoal">{d.soldUnits}</b> πουλημένες</span></p>
        </div>
      </section>

      {/* ── Σε κίνδυνο ── */}
      <section className={card}>
        <div className={head}><h3 className={title}>Leads σε κίνδυνο</h3><Link href="/sales/leads" className="rounded-lg border border-stone-line px-3 py-1 text-[13px] font-medium text-charcoal hover:border-forest/40">Leads Inbox</Link></div>
        <div className="max-h-[420px] overflow-auto border-t border-stone-line">
          <table className="w-full min-w-[620px] text-[14px]">
            <thead className="sticky top-0 bg-white"><tr className="text-left text-[12px] font-semibold uppercase tracking-wide text-charcoal-600"><th className="px-5 py-2">Πελάτης</th><th className="py-2">Στάδιο</th><th className="py-2">Αξία</th><th className="py-2">Κίνδυνος</th></tr></thead>
            <tbody>{d.atRisk.map((r) => (
              <tr key={r.id} className="border-t border-stone-line">
                <td className="px-5 py-2"><span className="flex items-center gap-2.5"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[12px] font-semibold text-forest">{r.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span><span><Link href={`/crm/leads/${r.id}`} className="block font-medium text-charcoal hover:text-forest" data-no-tr>{r.name}</Link><span className="text-[12px] text-charcoal-600">{r.reason}</span></span></span></td>
                <td><span className="rounded-full bg-forest/[0.08] px-2 py-0.5 text-[12px] font-medium text-forest">{r.stage}</span></td>
                <td className="tabular-nums text-charcoal-600">{r.value ? eur(r.value) : '—'}</td>
                <td><span className="inline-flex items-center gap-1 rounded-full border border-signal-danger/30 px-2 py-0.5 text-[12px] font-semibold text-signal-danger"><span className="h-1.5 w-1.5 rounded-full bg-signal-danger" /> {r.risk}</span></td>
              </tr>
            ))}{d.atRisk.length === 0 && <tr><td colSpan={4} className={`px-5 py-6 text-center ${muted}`}>Κανένα lead σε κίνδυνο.</td></tr>}</tbody>
          </table>
        </div>
        <p className={`border-t border-stone-line px-5 py-2.5 text-center ${muted}`}>Εμφάνιση {d.atRisk.length}</p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {/* ── Funnel ── */}
        <section className={card}>
          <div className={head}><h3 className={title}>Funnel πωλήσεων · 60 μέρες</h3><span className="rounded-full bg-forest/[0.08] px-2.5 py-0.5 text-[12px] font-semibold text-forest">{d.funnel[0].n ? Math.round((d.funnel[d.funnel.length - 1].n / d.funnel[0].n) * 1000) / 10 : 0}% συνολικά</span></div>
          <ul className="space-y-3 px-5 pb-5">{d.funnel.map((f, i) => { const top = d.funnel[0].n || 1; const prev = i ? d.funnel[i - 1].n : f.n; return (
            <li key={f.label}>
              <p className="flex items-center justify-between text-[14px]"><span className="flex items-center gap-2 font-medium text-charcoal"><span className="h-2 w-2 rounded-full bg-forest" />{f.label}</span><span className="font-semibold tabular-nums">{f.n}{i > 0 && <span className="ml-2 text-[12px] font-normal text-charcoal-600">{top ? Math.round((f.n / top) * 100) : 0}%</span>}</span></p>
              <span className="mt-1 block h-2.5 rounded-full bg-stone-100"><span className="block h-2.5 rounded-full bg-gradient-to-r from-forest/50 to-forest" style={{ width: `${(f.n / top) * 100}%` }} /></span>
              {i > 0 && prev - f.n > 0 && <p className="mt-0.5 text-[12px] text-charcoal-600">{prev - f.n} έμειναν πίσω</p>}
            </li>); })}</ul>
        </section>
        {/* ── Πωλητές ── */}
        <section className={card}>
          <div className={head}><h3 className={title}>Κορυφαίοι πωλητές · 30 μέρες</h3></div>
          <ul className="divide-y divide-stone-line px-5 pb-3">{d.agents.map((a) => (
            <li key={a.name} className="flex items-center gap-3 py-2.5 text-[14px]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[12px] font-semibold text-forest">{a.name.split(' ').map((x) => x[0]).slice(0, 2).join('')}</span>
              <span className="flex-1 font-medium text-charcoal" data-no-tr>{a.name}</span>
              <span className="text-[13px] text-charcoal-600">{a.open} ανοιχτά</span>
              <span className="w-24 text-right font-semibold">{a.won} πωλήσεις</span>
            </li>))}
            {d.agents.length === 0 && <li className={`py-3 ${muted}`}>Δεν έχουν ανατεθεί leads ακόμη.</li>}
          </ul>
        </section>
      </div>

      {planner}
    </div>
  );
}

function HeroStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="min-w-[140px] rounded-xl border border-white/20 bg-white/10 px-4 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-white/75">{label}</p>
      <p className="mt-1 font-display text-2xl text-white">{value}</p>
      <p className="text-[12px] text-white/75">{note}</p>
    </div>
  );
}

function Kpi({ label, value, note, spark }: { label: string; value: string; note: string; spark?: number[] }) {
  return (
    <div className={`${card} relative overflow-hidden px-5 py-4`}>
      <p className="text-[12px] font-semibold uppercase tracking-wide text-charcoal-600">{label}</p>
      <p className="mt-1 font-display text-3xl text-charcoal">{value}</p>
      <p className="mt-0.5 text-[13px] text-forest">{note}</p>
      {spark && spark.some((v) => v > 0) && <Spark values={spark} />}
    </div>
  );
}

function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1); const w = 120; const h = 34;
  const pts = values.map((v, i) => `${(i / Math.max(values.length - 1, 1)) * w},${h - (v / max) * (h - 4) - 2}`).join(' ');
  return <svg viewBox={`0 0 ${w} ${h}`} className="absolute bottom-2 right-3 h-9 w-28 text-forest/50" preserveAspectRatio="none"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>;
}

function Gauge({ pct, label }: { pct: number; label: string }) {
  const r = 70; const c = Math.PI * r; const v = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex flex-col items-center pb-3">
      <svg viewBox="0 0 180 100" className="h-32 w-56">
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="rgb(var(--c-forest) / 0.12)" strokeWidth="16" strokeLinecap="round" />
        <path d="M20 90 A70 70 0 0 1 160 90" fill="none" stroke="rgb(var(--c-forest))" strokeWidth="16" strokeLinecap="round" strokeDasharray={`${(v / 100) * c} ${c}`} />
        <text x="90" y="80" textAnchor="middle" className="fill-charcoal font-display" fontSize="30">{v}%</text>
      </svg>
      <p className="-mt-1 text-[11px] font-semibold tracking-[0.12em] text-charcoal-600">{label}</p>
    </div>
  );
}

function RevenueChart({ monthly, yoy }: { monthly: HomeData['monthly']; yoy: number | null }) {
  const [range, setRange] = useState<3 | 6 | 12>(12);
  const [show, setShow] = useState({ a: true, b: true });
  const cur = new Date().getMonth();
  const rows = useMemo(() => (range === 12 ? monthly : monthly.slice(Math.max(0, cur - range + 1), cur + 1)), [monthly, range, cur]);
  const max = Math.max(1, ...rows.map((r) => Math.max(show.a ? r.thisYear : 0, show.b ? r.lastYear : 0)));
  const W = 1000; const H = 260; const P = 36;
  const x = (i: number) => P + (i / Math.max(rows.length - 1, 1)) * (W - P * 2);
  const yv = (v: number) => H - P - (v / max) * (H - P * 2);
  // Οι μελλοντικοί μήνες της φετινής χρονιάς δεν σχεδιάζονται (δεν πέφτει η γραμμή στο 0).
  const lastIdx = range === 12 ? cur : rows.length - 1;
  const path = (k: 'thisYear' | 'lastYear') => rows.map((r, i) => ({ r, i })).filter(({ i }) => k === 'lastYear' || i <= lastIdx).map(({ r, i }) => `${i ? 'L' : 'M'}${x(i)},${yv(r[k])}`).join(' ');
  const exportCsv = () => {
    const csv = '﻿Μήνας,Φέτος,Πέρσι\n' + monthly.map((m) => `${m.label},${m.thisYear},${m.lastYear}`).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'eispraxeis.csv'; a.click();
  };
  return (
    <section className={card}>
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-4">
        <h3 className={`${title} flex items-center gap-2`}>Εισπράξεις {yoy !== null && <span className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${yoy >= 0 ? 'bg-forest/[0.08] text-forest' : 'bg-rose-50 text-signal-danger'}`}>{yoy >= 0 ? '+' : ''}{yoy}% σε σχέση με πέρσι</span>}</h3>
        <div className="flex items-center gap-1.5">
          {([3, 6, 12] as const).map((n) => <button key={n} type="button" onClick={() => setRange(n)} className={`rounded-lg px-2.5 py-1 text-[13px] font-medium ${range === n ? 'bg-charcoal text-white' : 'border border-stone-line text-charcoal'}`}>{n === 12 ? '1Χ' : `${n}Μ`}</button>)}
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1 rounded-lg border border-stone-line px-2.5 py-1 text-[13px] text-charcoal"><Download size={13} /> Export</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 px-5 pt-3">
        <button type="button" onClick={() => setShow((s) => ({ ...s, a: !s.a }))} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${show.a ? 'border-forest/30 bg-forest/[0.06] text-charcoal' : 'border-stone-line text-charcoal-600 line-through'}`}><span className="h-2 w-2 rounded-full bg-forest" /> Εισπράξεις · φέτος</button>
        <button type="button" onClick={() => setShow((s) => ({ ...s, b: !s.b }))} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${show.b ? 'border-stone-line bg-stone-50 text-charcoal' : 'border-stone-line text-charcoal-600 line-through'}`}><span className="h-2 w-2 rounded-full bg-charcoal-600/50" /> Εισπράξεις · πέρσι</button>
      </div>
      <div className="px-3 pb-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-64 w-full" preserveAspectRatio="none">
          {[0, 0.25, 0.5, 0.75, 1].map((t) => <g key={t}><line x1={P} x2={W - P} y1={yv(max * t)} y2={yv(max * t)} stroke="#e7e5e4" strokeDasharray={t === 0 ? '' : '4 4'} /><text x={4} y={yv(max * t) + 4} fontSize="11" className="fill-charcoal-600">{eurShort(max * t)}</text></g>)}
          {show.a && <><path d={`${path('thisYear')} L${x(lastIdx)},${H - P} L${x(0)},${H - P} Z`} fill="rgb(var(--c-forest) / 0.1)" /><path d={path('thisYear')} fill="none" stroke="rgb(var(--c-forest))" strokeWidth="2.5" /></>}
          {show.b && <path d={path('lastYear')} fill="none" stroke="#78716c" strokeWidth="1.8" strokeDasharray="6 5" />}
          {rows.map((r, i) => <text key={r.label} x={x(i)} y={H - 10} textAnchor="middle" fontSize="12" className="fill-charcoal-600">{r.label}</text>)}
        </svg>
      </div>
    </section>
  );
}

function PaymentSchedule({ rows }: { rows: HomeData['schedule'] }) {
  const [f, setF] = useState<'all' | 'upcoming' | 'overdue' | 'paid'>('all');
  const n = (k: typeof f) => (k === 'all' ? rows.length : rows.filter((r) => r.status === k).length);
  const list = rows.filter((r) => f === 'all' || r.status === f);
  const L = { all: 'Όλες', upcoming: 'Επερχόμενες', overdue: 'Καθυστερούν', paid: 'Εξοφλημένες' } as const;
  return (
    <section className={card}>
      <div className={head}><h3 className={title}>Πρόγραμμα πληρωμών · επόμενες 30 μέρες</h3><Link href="/financials" className="text-[13px] font-medium text-forest hover:underline">Αναφορά</Link></div>
      <div className="flex flex-wrap gap-1.5 px-5 pb-3">{(Object.keys(L) as (keyof typeof L)[]).map((k) => <button key={k} type="button" onClick={() => setF(k)} className={`rounded-lg px-2.5 py-1 text-[13px] font-medium ${f === k ? 'bg-forest text-white' : 'border border-stone-line text-charcoal'}`}>{L[k]} · {n(k)}</button>)}</div>
      <div className="border-t border-stone-line px-5 py-3">
        {list.length === 0 ? <p className={muted}>Καμία δόση.</p> : (
          <ul className="divide-y divide-stone-line">{list.slice(0, 12).map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2 text-[14px]">
              <span className="min-w-0 flex-1"><span className="block font-medium text-charcoal" data-no-tr>{r.buyer}</span><span className="text-[12px] text-charcoal-600">Μονάδα {r.unit} · {new Date(r.due).toLocaleDateString('el-GR')}</span></span>
              <span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${r.status === 'overdue' ? 'bg-rose-50 text-signal-danger' : 'bg-forest/[0.08] text-forest'}`}>{L[r.status]}</span>
              <span className="w-24 text-right font-semibold tabular-nums">{eur(r.amount)}</span>
            </li>))}</ul>
        )}
      </div>
    </section>
  );
}
