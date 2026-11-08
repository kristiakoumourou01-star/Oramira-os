'use client';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightCircle, Archive, ArchiveRestore, Search, Inbox, AlertTriangle } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { dealTitle, dealValue } from '@/lib/leads-shared';
import { LABEL_CLASS, type PipelineSettings } from '@/lib/pipeline-shared';
import { activityState } from '@/lib/activity-types';
import { formatCurrency } from '@/lib/format';
import { setDealsArchived, setLeadsInbox, updateDeal } from '@/app/actions/sales-deals';
import { reassignLead } from '@/app/actions/leads';

const SRC: Record<string, string> = { website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Σύσταση', whatsapp: 'WhatsApp', walk_in: 'Walk-in', other: 'Άλλο' };
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

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => (tab === 'archived' ? !!l.archived_at : !l.archived_at))
      .filter((l) => !label || (l.labels ?? []).includes(label))
      .filter((l) => !t || [dealTitle(l), l.full_name, l.email, l.phone, l.source].some((x) => (x ?? '').toLowerCase().includes(t)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [leads, tab, q, label]);
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
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg bg-stone p-1 text-sm">
          <button type="button" onClick={() => { setTab('inbox'); setSel([]); }} className={`rounded-md px-3 py-1 ${tab === 'inbox' ? 'bg-white font-medium text-charcoal shadow-sm' : 'text-charcoal-600'}`}><Inbox size={13} className="mr-1 inline" /> Inbox ({leads.filter((l) => !l.archived_at).length})</button>
          <button type="button" onClick={() => { setTab('archived'); setSel([]); }} className={`rounded-md px-3 py-1 ${tab === 'archived' ? 'bg-white font-medium text-charcoal shadow-sm' : 'text-charcoal-600'}`}><Archive size={13} className="mr-1 inline" /> Αρχείο ({leads.filter((l) => l.archived_at).length})</button>
        </div>
        <label className="relative"><Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input className="input h-9 w-56 py-1 pl-8 text-sm" placeholder="Όνομα, τηλέφωνο, πηγή…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="input h-9 w-auto py-1 text-sm" value={label} onChange={(e) => setLabel(e.target.value)} aria-label="Label"><option value="">Όλα τα labels</option>{cfg.dealLabels.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select>
        <span className="ml-auto flex items-center gap-1.5 text-sm text-charcoal-600">Μετατροπή στο
          <select className="input h-9 w-auto py-1 text-sm" value={pipe} onChange={(e) => setPipe(e.target.value)} data-no-tr>{cfg.pipelines.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
        </span>
      </div>
      {sel.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-forest/30 bg-forest/[0.05] px-3 py-2 text-sm">
          <span className="font-medium text-charcoal">{sel.length} επιλεγμένα</span>
          {tab === 'inbox' && <button type="button" className="btn-primary text-sm" disabled={pending} onClick={() => convert(sel)}><ArrowRightCircle size={14} /> Μετατροπή σε deals</button>}
          <button type="button" className="btn-secondary text-sm" disabled={pending} onClick={() => archive(sel, tab === 'inbox')}>{tab === 'inbox' ? <><Archive size={14} /> Αρχείο</> : <><ArchiveRestore size={14} /> Επαναφορά</>}</button>
          <button type="button" className="btn-ghost text-sm" onClick={() => setSel([])}>Άκυρο</button>
        </div>
      )}
      {msg && <p className="text-sm text-forest">{msg}</p>}
      <div className="panel overflow-x-auto">
        <table className="table-base w-full min-w-[880px]">
          <thead><tr>
            <th className="w-8"><input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? rows.map((r) => r.id) : [])} aria-label="Επιλογή όλων" /></th>
            <th>Lead</th><th>Labels</th><th>Πηγή</th><th>Αξία</th><th>Υπεύθυνος</th><th>Ήρθε</th><th>Activity</th><th />
          </tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={9} className="py-10 text-center text-sm text-charcoal-600/70">{tab === 'inbox' ? 'Το Inbox είναι άδειο — όλα τα νέα leads έχουν μπει στο pipeline.' : 'Το αρχείο είναι άδειο.'}</td></tr>}
            {rows.map((l) => {
              const st = activityState(l.next_follow_up ?? l.next_action_date);
              return (
                <tr key={l.id} className={sel.includes(l.id) ? 'bg-forest/[0.04]' : ''}>
                  <td><input type="checkbox" checked={sel.includes(l.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))} aria-label="Επιλογή" /></td>
                  <td>
                    <Link href={`/crm/leads/${l.id}`} className="font-medium text-charcoal hover:text-forest" data-no-tr>{dealTitle(l)}</Link>
                    <p className="text-xs text-charcoal-600/70" data-no-tr>{[l.phone, l.email].filter(Boolean).join(' · ')}</p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {cfg.dealLabels.map((lb) => {
                        const on = (l.labels ?? []).includes(lb.key);
                        return <button key={lb.key} type="button" onClick={() => toggleLabel(l, lb.key)} title={on ? 'Αφαίρεση' : 'Προσθήκη'} className={`rounded border px-1.5 text-[11px] font-medium ${on ? LABEL_CLASS[lb.color] : 'border-dashed border-stone-line text-charcoal-600/40 hover:text-charcoal-600'}`}>{lb.name}</button>;
                      })}
                    </div>
                  </td>
                  <td>{SRC[l.source] ?? l.source}</td>
                  <td>{dealValue(l) ? formatCurrency(dealValue(l)) : '—'}</td>
                  <td>
                    <select className="input w-36 py-1 text-sm" value={l.owner_id ?? ''} disabled={pending}
                      onChange={(e) => { const v = e.target.value; if (!v) return; setLeads((xs) => xs.map((x) => (x.id === l.id ? { ...x, owner_id: v } : x))); start(async () => { await reassignLead(l.id, v); router.refresh(); }); }}>
                      <option value="">—</option>{agents.map((a) => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                    </select>
                  </td>
                  <td className="whitespace-nowrap text-charcoal-600">{ago(l.created_at)}</td>
                  <td>{st === 'none' ? <span className="inline-flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={13} /> καμία</span> : <span className={`text-xs ${st === 'overdue' ? 'font-medium text-signal-danger' : 'text-charcoal-600'}`}>{new Date((l.next_follow_up ?? l.next_action_date)!).toLocaleDateString('el-GR', { day: '2-digit', month: 'short' })}</span>}</td>
                  <td className="whitespace-nowrap text-right">
                    {tab === 'inbox'
                      ? <><button type="button" disabled={pending} className="btn-secondary px-2 py-1 text-xs" onClick={() => convert([l.id])} title="Μετατροπή σε deal"><ArrowRightCircle size={13} /> Σε deal</button>
                        <button type="button" disabled={pending} className="ml-1 rounded p-1.5 text-charcoal-600/60 hover:bg-stone hover:text-charcoal" onClick={() => archive([l.id], true)} title="Αρχείο" aria-label="Αρχείο"><Archive size={14} /></button></>
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
