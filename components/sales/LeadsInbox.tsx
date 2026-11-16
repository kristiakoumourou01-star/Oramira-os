'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRightCircle, Archive, ArchiveRestore, Search, Inbox, AlertTriangle } from 'lucide-react';
import type { LeadListItem } from '@/lib/leads-shared';
import { dealTitle, dealValue } from '@/lib/leads-shared';
import { type PipelineSettings } from '@/lib/pipeline-shared';
import { activityState } from '@/lib/activity-types';
import { formatCurrency } from '@/lib/format';
import { setDealsArchived, setLeadsInbox, updateDeal } from '@/app/actions/sales-deals';
import { reassignLead } from '@/app/actions/leads';
import { LeadDrawer } from '@/components/crm/LeadDrawer';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';
import { PopSelect } from '@/components/ui/PopSelect';
import { Pager } from '@/components/ui/SidePanel';

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [per, setPer] = useState(25);
  const [pageNo, setPageNo] = useState(0);

  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return leads.filter((l) => (tab === 'archived' ? !!l.archived_at : !l.archived_at))
      .filter((l) => !label || (l.labels ?? []).includes(label))
      .filter((l) => !t || [dealTitle(l), l.full_name, l.email, l.phone, l.source].some((x) => (x ?? '').toLowerCase().includes(t)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [leads, tab, q, label]);
  const inboxAll = leads.filter((l) => !l.archived_at);
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

  const pages = Math.max(1, Math.ceil(rows.length / per));
  const pg = Math.min(pageNo, pages - 1);
  const page = rows.slice(pg * per, pg * per + per);
  const allOn = page.length > 0 && page.every((r) => sel.includes(r.id));
  const chip = (on: boolean) => `inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition-colors ${on ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal hover:border-forest/30'}`;

  return (
    <div className="space-y-4">
      {msg && <p className="rounded-xl border border-forest/20 bg-forest/[0.05] px-4 py-2.5 text-sm text-forest">{msg}</p>}
      {openId && <LeadDrawer leadId={openId} agents={agents} onClose={() => { setOpenId(null); router.refresh(); }} />}
      <div className="flex min-w-0 flex-col rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2 text-[14px] text-charcoal-600">
            <span>Εμφάνιση</span>
            <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); setPageNo(0); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
            <span>εγγραφές</span>
            <span className="ml-auto flex items-center gap-2 text-[13px]">Μετατροπή στο
              <PopSelect ariaLabel="Pipeline" width="min-w-[150px]" value={pipe} onChange={setPipe} options={cfg.pipelines.map((p) => [p.key, p.name] as [string, string])} />
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => { setTab('inbox'); setSel([]); setPageNo(0); }} className={chip(tab === 'inbox')}><Inbox size={13} /> Inbox · {inboxAll.length}</button>
            <button type="button" onClick={() => { setTab('archived'); setSel([]); setPageNo(0); }} className={chip(tab === 'archived')}><Archive size={13} /> Αρχείο · {leads.length - inboxAll.length}</button>
            <PopSelect width="min-w-[140px]" value={label} onChange={(v) => { setLabel(v); setPageNo(0); }} options={[['', 'Όλα τα labels'], ...cfg.dealLabels.map((lb) => [lb.key, lb.name] as [string, string])]} />
            <label className="relative w-full sm:ml-auto sm:w-[220px]">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" />
              <input value={q} onChange={(e) => { setQ(e.target.value); setPageNo(0); }} placeholder="Όνομα, τηλέφωνο, πηγή…" className="input h-8 py-1 pl-8 text-[13px]" />
            </label>
          </div>
          {sel.length > 0 && (
            <div className="anim-pop flex flex-wrap items-center gap-2 rounded-xl border border-forest/30 bg-forest/[0.05] px-3 py-2 text-[13px] text-forest">
              <span className="font-semibold">{sel.length} επιλεγμένα</span>
              {tab === 'inbox' && <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-3 text-[13px] font-medium text-white hover:bg-forest/90" disabled={pending} onClick={() => convert(sel)}><ArrowRightCircle size={14} /> Μετατροπή σε deals</button>}
              <button type="button" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-3 text-[13px] text-charcoal hover:border-forest/30" disabled={pending} onClick={() => archive(sel, tab === 'inbox')}>{tab === 'inbox' ? <><Archive size={14} /> Αρχείο</> : <><ArchiveRestore size={14} /> Επαναφορά</>}</button>
              <button type="button" className="ml-auto text-charcoal-600 hover:text-charcoal" onClick={() => setSel([])}>Άκυρο</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr>
              <th className="w-8"><input type="checkbox" checked={allOn} onChange={(e) => setSel(e.target.checked ? page.map((r) => r.id) : [])} aria-label="Επιλογή όλων" /></th>
              <th>Lead</th><th>Τηλέφωνο</th><th>Labels</th><th>Πηγή</th><th>Αξία</th><th>Υπεύθυνος</th><th>Ήρθε</th><th>Activity</th><th className="text-right">Ενέργειες</th>
            </tr></thead>
            <tbody>
              {page.map((l) => {
                const st = activityState(l.next_follow_up ?? l.next_action_date);
                return (
                  <tr key={l.id} className={`group ${sel.includes(l.id) ? 'bg-forest/[0.05]' : ''}`}>
                    <td><input type="checkbox" checked={sel.includes(l.id)} onChange={(e) => setSel((s) => (e.target.checked ? [...s, l.id] : s.filter((x) => x !== l.id)))} aria-label="Επιλογή" /></td>
                    <td className="o-strong" data-no-tr><button type="button" onClick={() => setOpenId(l.id)} className="block max-w-[200px] truncate text-left hover:text-forest" title={dealTitle(l)}>{dealTitle(l)}</button></td>
                    <td data-no-tr>{l.phone || '—'}</td>
                    <td>
                      <span className="flex gap-1">
                        {cfg.dealLabels.map((lb) => {
                          const on = (l.labels ?? []).includes(lb.key);
                          return <button key={lb.key} type="button" onClick={() => toggleLabel(l, lb.key)} title={on ? 'Αφαίρεση' : 'Προσθήκη'} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium transition ${on ? 'border-forest/30 bg-forest/[0.08] text-forest' : 'hidden border-dashed border-stone-line text-charcoal-600/50 hover:text-charcoal group-hover:inline'}`}>{lb.name}</button>;
                        })}
                        {!(l.labels ?? []).length && <span className="group-hover:hidden">—</span>}
                      </span>
                    </td>
                    <td>{SRC[l.source] ?? l.source}</td>
                    <td className="o-strong">{dealValue(l) ? formatCurrency(dealValue(l)) : '—'}</td>
                    <td>
                      <PopSelect searchable width="min-w-[140px]" ariaLabel="Υπεύθυνος" value={l.owner_id ?? ''} placeholder="Χωρίς υπεύθυνο"
                        onChange={(v) => { if (!v) return; setLeads((xs) => xs.map((x) => (x.id === l.id ? { ...x, owner_id: v } : x))); start(async () => { await reassignLead(l.id, v); router.refresh(); }); }}
                        options={[['', 'Χωρίς υπεύθυνο'], ...agents.map((a) => [a.id, a.full_name ?? '—'] as [string, string])]} />
                    </td>
                    <td>{ago(l.created_at)}</td>
                    <td>{st === 'none' ? <span className="inline-flex items-center gap-1 text-charcoal-600"><AlertTriangle size={12} /> καμία</span> : <span className={st === 'overdue' ? 'font-medium text-signal-danger' : 'text-forest'}>{new Date((l.next_follow_up ?? l.next_action_date)!).toLocaleDateString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short' })}</span>}</td>
                    <td>
                      <span className="flex justify-end gap-1">
                        {tab === 'inbox'
                          ? <><button type="button" disabled={pending} className="inline-flex h-8 items-center gap-1 rounded-[10px] bg-forest px-2.5 text-[12px] font-medium text-white hover:bg-forest/90" onClick={() => convert([l.id])} title="Μετατροπή σε deal"><ArrowRightCircle size={13} /> Σε deal</button>
                            <button type="button" disabled={pending} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-stone-100 hover:text-charcoal" onClick={() => archive([l.id], true)} title="Αρχείο" aria-label="Αρχείο"><Archive size={15} /></button></>
                          : <button type="button" disabled={pending} className="inline-flex h-8 items-center gap-1 rounded-[10px] border border-stone-line px-2.5 text-[12px] text-charcoal hover:border-forest/30" onClick={() => archive([l.id], false)}><ArchiveRestore size={13} /> Επαναφορά</button>}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && <tr><td colSpan={10} className="py-12 text-center text-sm text-charcoal-600">{tab === 'inbox' ? 'Το Inbox είναι άδειο — όλα τα νέα leads έχουν μπει στο pipeline.' : 'Το αρχείο είναι άδειο.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <Pager from={rows.length ? pg * per + 1 : 0} to={Math.min(rows.length, pg * per + per)} total={rows.length} page={pg} pages={pages} onPage={setPageNo} />
      </div>
    </div>
  );
}
