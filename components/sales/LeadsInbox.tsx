'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightCircle, Archive, ArchiveRestore, Search, Inbox, AlertTriangle, Flame, Sparkles, CalendarClock } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { dealTitle, dealValue } from '@/lib/leads-shared';
import { LABEL_CLASS, type PipelineSettings } from '@/lib/pipeline-shared';
import { activityState } from '@/lib/activity-types';
import { formatCurrency } from '@/lib/format';
import { setDealsArchived, setLeadsInbox, updateDeal } from '@/app/actions/sales-deals';
import { reassignLead } from '@/app/actions/leads';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', other: 'Άλλο' };
const SRC_TONE: Record<string, string> = { website: 'bg-sky-50 text-sky-700 ring-sky-200', meta: 'bg-indigo-50 text-indigo-700 ring-indigo-200', google: 'bg-amber-50 text-amber-700 ring-amber-200', organic: 'bg-emerald-50 text-emerald-700 ring-emerald-200', referral: 'bg-violet-50 text-violet-700 ring-violet-200', whatsapp: 'bg-green-50 text-green-700 ring-green-200', walk_in: 'bg-orange-50 text-orange-700 ring-orange-200', other: 'bg-stone text-charcoal-600 ring-stone-line' };
const AV = ['bg-forest', 'bg-[#4a8668]', 'bg-[#c9a063]', 'bg-[#3f6fb0]', 'bg-[#b0607f]', 'bg-[#7c6bb5]', 'bg-[#c2554d]'];
const avatarOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; };
const initialsOf = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '•';
const ago = (iso: string) => {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 60 ? `${m}′` : m < 1440 ? `${Math.floor(m / 60)} ώρ.` : `${Math.floor(m / 1440)} μέρ.`;
};

/**
 * Sales → Leads Inbox (όπως Pipedrive): τα νέα εισερχόμενα πριν μπουν στο
 * pipeline. Labels Hot / Warm / Cold, ανάθεση, «Μετατροπή σε deal» και αρχείο.
 */
export function LeadsInbox({ leads: initial, cfg, agents }: { leads: LeadListItem[]; cfg: PipelineSettings; agents: { id: string; full_name: string | null }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [leads, setLeads] = useState(initial);
  const [tab, setTab] = useState<'inbox' | 'archived'>('inbox');
  const [q, setQ] = useState('');
  const [label, setLabel] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [pipe, setPipe] = useState(cfg.defaultKey);
  const [msg, setMsg] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => (tab === 'archived' ? !!l.archived_at : !l.archived_at))
      .filter((l) => !label || (l.labels ?? []).includes(label))
      .filter((l) => !t || [dealTitle(l), l.full_name, l.email, l.phone, l.source].some((x) => (x ?? '').toLowerCase().includes(t)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [leads, tab, q, label]);
  const inboxAll = leads.filter((l) => !l.archived_at);
  const allOn = rows.length > 0 && rows.every((r) => sel.includes(r.id));
  const drop = (ids: string[]) => { setLeads((xs) => xs.filter((x) => !ids.includes(x.id))); setSel([]); };
  const convert = (ids: string[]) => start(async () => { const r = await setLeadsInbox(ids, false, pipe); if (r.ok) { drop(ids); setMsg(`${ids.length} → deals στο pipeline.`); router.refresh(); } else setMsg(r.error); });
  const archive = (ids: string[], on: boolean) => start(async () => {
    const r = await setDealsArchived(ids, on);
    if (r.ok) { setLeads((xs) => xs.map((x) => (ids.includes(x.id) ? { ...x, archived_at: on ? new Date().toISOString() : null } : x))); setSel([]); setMsg(on ? 'Στο αρχείο.' : 'Επανήλθαν στο Inbox.'); router.refresh(); } else setMsg(r.error);
  });
  const toggleLabel = (l: LeadListItem, key: string) => {
    const next = (l.labels ?? []).includes(key) ? (l.labels ?? []).filter((x) => x !== key) : [...(l.labels ?? []), key];
    setLeads((xs) => xs.map((x) => (x.id === l.id ? { ...x, labels: next } : x)));
    start(async () => { await updateDeal(l.id, { labels: next }); });
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Στο Inbox', v: inboxAll.length, icon: Inbox, tone: 'text-forest bg-forest/10' },
          { label: 'Νέα σήμερα', v: inboxAll.filter((l) => Date.now() - new Date(l.created_at).getTime() < 864e5).length, icon: Sparkles, tone: 'text-sky-700 bg-sky-100' },
          { label: 'Hot', v: inboxAll.filter((l) => (l.labels ?? []).includes('hot')).length, icon: Flame, tone: 'text-rose-700 bg-rose-100' },
          { label: 'Χωρίς activity', v: inboxAll.filter((l) => activityState(l.next_follow_up ?? l.next_action_date) === 'none').length, icon: CalendarClock, tone: 'text-amber-700 bg-amber-100' },
        ].map((k) => (
          <div key={k.label} className="flex items-center gap-3 rounded-2xl border border-stone-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.tone}`}><k.icon size={18} /></span>
            <div><p className="text-2xl font-semibold leading-none tracking-tight text-charcoal">{k.v}</p><p className="mt-1 text-xs text-charcoal-600/70">{k.label}</p></div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-full bg-forest/[0.07] p-1 text-sm">
          <button type="button" onClick={() => { setTab('inbox'); setSel([]); }} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${tab === 'inbox' ? 'bg-forest font-medium text-white shadow-sm' : 'text-forest hover:bg-forest/10'}`}><Inbox size={14} /> Inbox <span className={`rounded-full px-1.5 text-[11px] ${tab === 'inbox' ? 'bg-white/20' : 'bg-forest/10'}`}>{inboxAll.length}</span></button>
          <button type="button" onClick={() => { setTab('archived'); setSel([]); }} className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 transition ${tab === 'archived' ? 'bg-forest font-medium text-white shadow-sm' : 'text-forest hover:bg-forest/10'}`}><Archive size={14} /> Αρχείο <span className={`rounded-full px-1.5 text-[11px] ${tab === 'archived' ? 'bg-white/20' : 'bg-forest/10'}`}>{leads.length - inboxAll.length}</span></button>
        </div>
        <label className="relative"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input className="input h-10 w-64 rounded-full py-1 pl-9 text-sm" placeholder="Όνομα, τηλέφωνο, πηγή…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <div className="flex flex-wrap gap-1.5">
          <button type="button" onClick={() => setLabel('')} className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition ${!label ? 'bg-forest text-white ring-forest' : 'bg-white text-charcoal-600 ring-stone-line hover:ring-forest/40'}`}>Όλα</button>
          {cfg.dealLabels.map((lb) => <button key={lb.key} type="button" onClick={() => setLabel(label === lb.key ? '' : lb.key)} className={`rounded-full border px-3 py-1 text-xs font-medium transition ${label === lb.key ? LABEL_CLASS[lb.color] + ' ring-2 ring-offset-1 ring-forest/30' : LABEL_CLASS[lb.color] + ' opacity-60 hover:opacity-100'}`}>{lb.name}</button>)}
        </div>
        <span className="ml-auto flex items-center gap-2 text-sm text-charcoal-600">Μετατροπή στο
          <select className="input h-10 w-auto rounded-full !border-forest/40 !bg-forest/[0.07] py-1 text-sm font-semibold text-forest" value={pipe} onChange={(e) => setPipe(e.target.value)} data-no-tr>{cfg.pipelines.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
        </span>
      </div>
      {sel.length > 0 && (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-2 rounded-2xl bg-forest px-4 py-2.5 text-sm text-white shadow-overlay">
          <span className="font-semibold">{sel.length} επιλεγμένα</span>
          {tab === 'inbox' && <button type="button" className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-sm font-semibold text-forest hover:bg-white/90" disabled={pending} onClick={() => convert(sel)}><ArrowRightCircle size={14} /> Μετατροπή σε deals</button>}
          <button type="button" className="flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-sm hover:bg-white/25" disabled={pending} onClick={() => archive(sel, tab === 'inbox')}>{tab === 'inbox' ? <><Archive size={14} /> Αρχείο</> : <><ArchiveRestore size={14} /> Επαναφορά</>}</button>
          <button type="button" className="ml-auto rounded-full px-3 py-1.5 text-sm text-white/80 hover:text-white" onClick={() => setSel([])}>Άκυρο</button>
        </div>
      )}
      {msg && <p className="text-sm text-forest">{msg}</p>}
      {openId && <LeadDrawer leadId={openId} agents={agents} onClose={() => { setOpenId(null); router.refresh(); }} />}
      <div className="overflow-x-auto rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <table className="w-full min-w-[920px] text-sm">
          <thead className="border-b border-stone-line bg-forest/[0.03] text-left text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70 [&_th]:px-3 [&_th]:py-3"><tr>
            <th className="w-8"><input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} aria-label="Επιλογή όλων" /></th>
            <th>Lead</th><th>Labels</th><th>Πηγή</th><th>Αξία</th><th>Υπεύθυνος</th><th>Ήρθε</th><th>Activity</th><th />
          </tr></thead>
          <tbody className="divide-y divide-stone-line/70 [&_td]:px-3 [&_td]:py-3 [&_td]:align-middle">
            {rows.length === 0 && <tr><td colSpan={9} className="!py-16 text-center text-sm text-charcoal-600/70"><span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-forest/10 text-forest"><Inbox size={22} /></span>{tab === 'inbox' ? 'Το Inbox είναι άδειο — όλα τα νέα leads έχουν μπει στο pipeline.' : 'Το αρχείο είναι άδειο.'}</td></tr>}
            {rows.map((l) => {
              const st = activityState(l.next_follow_up ?? l.next_action_date);
              return (
                <tr key={l.id} className={`group transition-colors ${sel.includes(l.id) ? 'bg-forest/[0.06]' : 'hover:bg-forest/[0.025]'}`}>
                  <td><input type="checkbox" checked={sel.includes(l.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))} aria-label="Επιλογή" /></td>
                  <td>
                    <div className="flex items-center gap-3">
                      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarOf(dealTitle(l))}`} data-no-tr>{initialsOf(l.full_name || dealTitle(l))}</span>
                      <div className="min-w-0">
                        <button type="button" onClick={() => setOpenId(l.id)} className="block truncate text-left font-semibold text-charcoal hover:text-forest" data-no-tr>{dealTitle(l)}</button>
                        <p className="truncate text-xs text-charcoal-600/70" data-no-tr>{[l.phone, l.email].filter(Boolean).join(' · ')}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {cfg.dealLabels.map((lb) => {
                        const on = (l.labels ?? []).includes(lb.key);
                        return <button key={lb.key} type="button" onClick={() => toggleLabel(l, lb.key)} title={on ? 'Αφαίρεση' : 'Προσθήκη'} className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition ${on ? LABEL_CLASS[lb.color] : 'border-dashed border-stone-line text-charcoal-600/40 opacity-0 group-hover:opacity-100 hover:text-charcoal-600'}`}>{lb.name}</button>;
                      })}
                    </div>
                  </td>
                  <td><span className={`rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${SRC_TONE[l.source] ?? SRC_TONE.other}`}>{SRC[l.source] ?? l.source}</span></td>
                  <td className="font-semibold text-charcoal">{dealValue(l) ? formatCurrency(dealValue(l)) : <span className="font-normal text-charcoal-600/40">—</span>}</td>
                  <td>
                    <select className={`input w-40 rounded-full py-1 text-sm ${l.owner_id ? '' : '!border-amber-300 !bg-amber-50 text-amber-800'}`} value={l.owner_id ?? ''} disabled={pending}
                      onChange={(e) => { const v = e.target.value; if (!v) return; setLeads((xs) => xs.map((x) => (x.id === l.id ? { ...x, owner_id: v } : x))); start(async () => { await reassignLead(l.id, v); router.refresh(); }); }}>
                      <option value="">Χωρίς υπεύθυνο</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap text-xs text-charcoal-600/80">{ago(l.created_at)}</td>
                  <td>{st === 'none' ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200"><AlertTriangle size={12} /> καμία</span> : <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${st === 'overdue' ? 'bg-rose-50 text-signal-danger ring-rose-200' : 'bg-forest/[0.06] text-forest ring-forest/20'}`}>{new Date((l.next_follow_up ?? l.next_action_date)!).toLocaleDateString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short' })}</span>}</td>
                  <td className="whitespace-nowrap text-right">
                    {tab === 'inbox'
                      ? <><button type="button" disabled={pending} className="inline-flex items-center gap-1 rounded-full bg-forest px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-forest/90" onClick={() => convert([l.id])} title="Μετατροπή σε deal"><ArrowRightCircle size={13} /> Σε deal</button>
                        <button type="button" disabled={pending} className="ml-1 rounded-full p-2 text-charcoal-600/60 hover:bg-stone hover:text-charcoal" onClick={() => archive([l.id], true)} title="Αρχείο" aria-label="Αρχείο"><Archive size={14} /></button></>
                      : <button type="button" disabled={pending} className="btn-ghost text-xs" onClick={() => archive([l.id], false)}><ArchiveRestore size={13} /> Επαναφορά</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
