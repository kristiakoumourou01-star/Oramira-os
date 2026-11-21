'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, Mail, Building2, Wallet, Clock, PhoneOff, Search, UserPlus, Inbox, RotateCcw, MessageSquareText, CalendarClock } from 'lucide-react';
import { claimLead, assignNewLead } from '@/app/actions/lead-claim';
import { dayKey, type NewLead } from '@/lib/sales-hub-shared';
import { formatCurrency } from '@/lib/format';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { PopSelect } from '@/components/ui/PopSelect';
import { LeadDrawer } from '@/components/crm/LeadDrawer';

interface Agent { id: string; full_name: string | null }

const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', portal: 'Portal', other: 'Άλλο' };
const PAGE = 24;

function ago(iso: string): string {
  const m = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 60000));
  if (m < 1) return 'μόλις τώρα';
  if (m < 60) return `πριν ${m} λεπτά`;
  if (m < 1440) return `πριν ${Math.floor(m / 60)} ώρες`;
  return `πριν ${Math.floor(m / 1440)} μέρες`;
}
function budget(min: number | null, max: number | null): string | null {
  if (!min && !max) return null;
  if (min && max) return min === max ? formatCurrency(max) : `${formatCurrency(min)} – ${formatCurrency(max)}`;
  return min ? `${formatCurrency(min)}+` : `≤ ${formatCurrency(max!)}`;
}

/**
 * Νέα leads: όλα τα εισερχόμενα που δεν έχουν ακόμη υπεύθυνο, σε κάρτες με ό,τι
 * συμπλήρωσε ο πελάτης, ομαδοποιημένα ανά μέρα άφιξης (Σήμερα · Χθες · ημερομηνίες).
 * «Ανάληψη» ή (Admin / Manager) ανάθεση σε συνεργάτη → το lead φεύγει από εδώ
 * και εμφανίζεται στο pipeline στο στάδιο της κατάστασής του.
 */
export function NewLeadsInbox({ leads: initial, agents, currentUserId, canClaim, canAssign }: { leads: NewLead[]; agents: Agent[]; currentUserId: string; canClaim: boolean; canAssign: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');
  const [source, setSource] = useState('');
  const [onlyNotCalled, setOnlyNotCalled] = useState(false);
  const [shown, setShown] = useState(PAGE);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const live = useMemo(() => initial.filter((l) => !gone.has(l.id)), [initial, gone]);
  const sources = useMemo(() => [...new Set(live.map((l) => l.source).filter(Boolean))].sort(), [live]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return live.filter((l) => (!source || l.source === source) && (!onlyNotCalled || l.notContacted)
      && (!t || [l.name, l.email, l.phone, l.project, l.message].some((x) => (x ?? '').toLowerCase().includes(t))));
  }, [live, q, source, onlyNotCalled]);
  const notCalled = live.filter((l) => l.notContacted).length;
  const visible = rows.slice(0, shown);
  const groups = useMemo(() => {
    const g: { key: string; items: NewLead[] }[] = [];
    for (const l of visible) { const k = dayKey(l.createdAt); const last = g[g.length - 1]; if (last && last.key === k) last.items.push(l); else g.push({ key: k, items: [l] }); }
    return g;
  }, [visible]);
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 86400000).toISOString());
  const dayLabel = (k: string) => (k === today ? 'Σήμερα' : k === yesterday ? 'Χθες' : new Date(`${k}T12:00:00`).toLocaleDateString(DATE_TAG[currentLocale().lang], { weekday: 'long', day: 'numeric', month: 'long' }));
  const time = (iso: string) => new Date(iso).toLocaleTimeString(DATE_TAG[currentLocale().lang], { hour: '2-digit', minute: '2-digit' });

  const act = (l: NewLead, to: string | null) => {
    setBusy(l.id); setMsg(null);
    start(async () => {
      const r = to && to !== currentUserId ? await assignNewLead(l.id, to) : await claimLead(l.id);
      setBusy(null);
      if (r.ok) {
        setGone((s) => new Set(s).add(l.id));
        const who = to && to !== currentUserId ? agents.find((a) => a.id === to)?.full_name ?? '' : '';
        setMsg({ ok: true, text: who ? `«${l.name ?? l.email ?? 'Lead'}» → ${who}. Εμφανίζεται στο pipeline.` : `«${l.name ?? l.email ?? 'Lead'}» είναι τώρα δικό σας — στο pipeline, στάδιο «Νέο».` });
      } else { setMsg({ ok: false, text: r.error }); if (/ήδη υπεύθυνο/.test(r.error)) setGone((s) => new Set(s).add(l.id)); }
      router.refresh();
    });
  };
  const chip = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line bg-white text-charcoal hover:border-forest/30'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={chip(!onlyNotCalled)} role="button" tabIndex={0} onClick={() => setOnlyNotCalled(false)} onKeyDown={(e) => { if (e.key === 'Enter') setOnlyNotCalled(false); }}><Inbox size={13} /> <span>Όλα</span> <span className="tabular-nums">{live.length}</span></span>
        <span className={chip(onlyNotCalled)} role="button" tabIndex={0} onClick={() => setOnlyNotCalled(true)} onKeyDown={(e) => { if (e.key === 'Enter') setOnlyNotCalled(true); }}><PhoneOff size={13} /> <span>Χωρίς κλήση</span> <span className="tabular-nums">{notCalled}</span></span>
        <PopSelect width="min-w-[140px]" ariaLabel="Πηγή" value={source} onChange={(v) => { setSource(v); setShown(PAGE); }} options={[['', 'Όλες οι πηγές'], ...sources.map((x) => [x, SRC[x] ?? x] as [string, string])]} />
        <label className="relative w-full sm:ml-auto sm:w-[240px]">
          <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE); }} placeholder="Όνομα, τηλέφωνο, έργο…" className="input h-8 py-1 pl-8 text-[13px]" />
        </label>
      </div>

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-rose-200 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      {rows.length === 0 && (
        <div className="rounded-2xl border border-dashed border-stone-line bg-white px-6 py-14 text-center">
          <Inbox size={28} className="mx-auto text-forest/60" />
          <p className="mt-3 font-semibold text-charcoal">{live.length ? 'Κανένα lead με αυτά τα φίλτρα.' : 'Όλα τα νέα leads έχουν υπεύθυνο.'}</p>
          <p className="mt-1 text-sm text-charcoal-600">Ό,τι έρχεται από φόρμες, Meta, WhatsApp ή κράτηση προβολής εμφανίζεται εδώ μέχρι να το αναλάβει κάποιος.</p>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-2.5">
          <h2 className="flex items-baseline gap-2 text-[13px] font-semibold uppercase tracking-wide text-charcoal-600">
            <span>{dayLabel(g.key)}</span><span className="rounded-full bg-stone-100 px-2 py-px text-[11px] tabular-nums text-charcoal-600">{g.items.length}</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((l) => {
              const b = budget(l.budgetMin, l.budgetMax);
              const tel = (l.phone ?? '').replace(/[^\d+]/g, '');
              const hours = (Date.now() - Date.parse(l.createdAt)) / 3600000;
              return (
                <article key={l.id} className={`anim-fade flex min-w-0 flex-col rounded-2xl border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)] ${l.notContacted && hours >= 1 ? 'border-amber-300' : 'border-stone-line'}`}>
                  <div className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => setOpenId(l.id)} className="min-w-0 text-left">
                        <p className="truncate text-[15px] font-semibold text-charcoal hover:text-forest" data-no-tr>{l.name || l.email || '—'}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-charcoal-600/80"><Clock size={11} /> <span>{time(l.createdAt)}</span> · <span>{ago(l.createdAt)}</span></p>
                      </button>
                      <span className="shrink-0 rounded-full border border-stone-line bg-stone-50 px-2.5 py-0.5 text-[11px] font-medium text-charcoal-600">{SRC[l.source] ?? l.source}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {l.notContacted && <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-px text-[11px] font-semibold text-amber-800"><PhoneOff size={11} /> Δεν έγινε κλήση ακόμη</span>}
                      {l.isReturning && <span className="inline-flex items-center gap-1 rounded-full border border-forest/25 bg-forest/[0.06] px-2 py-px text-[11px] font-semibold text-forest"><RotateCcw size={11} /> Ξανά πελάτης</span>}
                    </div>
                    <dl className="space-y-1.5 text-[13px]">
                      {l.phone && <div className="flex items-center gap-2"><Phone size={13} className="shrink-0 text-charcoal-600/60" /><a href={`tel:${tel}`} className="truncate text-charcoal hover:text-forest" data-no-tr>{l.phone}</a></div>}
                      {l.email && <div className="flex items-center gap-2"><Mail size={13} className="shrink-0 text-charcoal-600/60" /><a href={`mailto:${l.email}`} className="truncate text-charcoal hover:text-forest" data-no-tr>{l.email}</a></div>}
                      {(l.project || l.unit) && <div className="flex items-center gap-2"><Building2 size={13} className="shrink-0 text-charcoal-600/60" /><span className="truncate text-charcoal" data-no-tr>{[l.project, l.unit].filter(Boolean).join(' · ')}</span></div>}
                      {b && <div className="flex items-center gap-2"><Wallet size={13} className="shrink-0 text-charcoal-600/60" /><span className="truncate font-medium text-charcoal">{b}</span></div>}
                      {l.timeline && <div className="flex items-center gap-2"><CalendarClock size={13} className="shrink-0 text-charcoal-600/60" /><span className="truncate text-charcoal" data-no-tr>{l.timeline}</span></div>}
                    </dl>
                    {l.message && <p className="flex gap-2 rounded-xl bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600"><MessageSquareText size={13} className="mt-0.5 shrink-0 text-charcoal-600/50" /><span className="line-clamp-3" data-no-tr>{l.message}</span></p>}
                  </div>
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-stone-line px-4 py-3">
                    {canClaim && <button type="button" disabled={pending} onClick={() => act(l, null)} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90 disabled:opacity-60"><UserPlus size={14} /> {busy === l.id ? '…' : 'Ανάληψη'}</button>}
                    {canAssign && <PopSelect searchable width="min-w-[150px]" ariaLabel="Ανάθεση σε" value="" placeholder="Ανάθεση σε…" onChange={(v) => { if (v) act(l, v); }}
                      options={agents.filter((a) => a.id !== currentUserId).map((a) => [a.id, a.full_name ?? '—'] as [string, string])} />}
                    {tel && <a href={`tel:${tel}`} className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-forest" title="Κλήση" aria-label="Κλήση"><Phone size={15} /></a>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      {rows.length > shown && (
        <div className="flex justify-center"><button type="button" className="btn-secondary" onClick={() => setShown((n) => n + PAGE)}>Περισσότερα ({rows.length - shown})</button></div>
      )}
      {openId && <LeadDrawer leadId={openId} agents={agents} onClose={() => { setOpenId(null); router.refresh(); }} />}
    </div>
  );
}
