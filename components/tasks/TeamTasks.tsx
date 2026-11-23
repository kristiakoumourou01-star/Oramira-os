'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Search, X, Pencil, Trash2, Circle, CheckCircle, PhoneCall, ListChecks, Phone } from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';
import { StatusPill, type Tone } from '@/components/ui/StatusPill';
import { Pager } from '@/components/ui/SidePanel';
import { createTeamTask, updateTeamTask, completeTeamTask, deleteTeamTask } from '@/app/actions/team-tasks';
import { createCallList, previewCallList, getCallListItems, markCallItem, updateCallList, deleteCallList } from '@/app/actions/call-lists';
import { STATUS_EL, PRIORITY_EL, CALL_OUTCOMES, PRESETS, type BoardRow, type BoardStatus, type CallItem, type CallSource } from '@/lib/tasks-board-shared';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

type Staff = { id: string; name: string };
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';
const fmt = (iso: string) => new Date(iso).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const local = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const CHIP: Record<BoardStatus, Tone> = { done: 'green', progress: 'amber', open: 'blue', overdue: 'red' };

/**
 * Tasks όπως στο FitnessCRM: «Λίστες κλήσεων από μια αναφορά, ανατεθειμένες
 * στην ομάδα σας». Πίνακας ΕΡΓΑΣΙΑ | ΠΡΟΘΕΣΜΙΑ | ΠΡΟΟΔΟΣ (x από N) | ΚΑΤΑΣΤΑΣΗ,
 * με φίλτρα κατάστασης και ατόμου. Οι εργασίες ομάδας δουλεύουν όπως πριν.
 */
export function TeamTasks({ rows, staff, me, isLead, initialView, reports, groups, callListsReady }: { rows: BoardRow[]; staff: Staff[]; me: string; isLead: boolean; initialView?: string; reports: { id: string; name: string }[]; groups: string[]; callListsReady: boolean }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialView === 'overdue' ? 'overdue' : initialView === 'done' ? 'done' : 'active');
  const [who, setWho] = useState(initialView === 'mine' || !isLead ? me : '');
  const [kind, setKind] = useState('');
  const [q, setQ] = useState('');
  const [per, setPer] = useState(25);
  const [pg, setPg] = useState(0);
  const [open, setOpen] = useState<BoardRow | null>(null);
  const [dlg, setDlg] = useState<'task' | 'call' | BoardRow | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const ql = q.trim().toLowerCase();
  const shown = useMemo(() => rows
    .filter((r) => (status === 'all' || (status === 'active' ? r.status !== 'done' : r.status === status))
      && (!who || r.assigneeIds.includes(who) || (who === me && r.createdBy === me && !r.assigneeIds.length))
      && (!kind || r.kind === kind)
      && (!ql || [r.title, r.description ?? '', r.list ?? '', r.source ?? '', ...r.assignees].join(' ').toLowerCase().includes(ql)))
    .sort((a, b) => (status === 'done' ? b.createdAt.localeCompare(a.createdAt) : (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'))), [rows, status, who, kind, ql, me]);
  const pages = Math.max(1, Math.ceil(shown.length / per));
  const p = Math.min(pg, pages - 1);
  const list = shown.slice(p * per, p * per + per);
  const reset = () => setPg(0);
  const done = (t: string, ok = true) => { setDlg(null); setOpen(null); setMsg({ ok, text: t }); router.refresh(); };
  // Μετά από refresh, η ανοιχτή γραμμή παίρνει τα νέα νούμερα.
  useEffect(() => { if (open) { const n = rows.find((r) => r.key === open.key); if (n && n !== open) setOpen(n); } }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-5">
      {msg && <p className={`anim-fade rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}
      {!callListsReady && <p className="rounded-xl border border-stone-line bg-stone-50 px-4 py-2.5 text-sm text-charcoal-600">Οι λίστες κλήσεων ενεργοποιούνται μόλις περάσει το migration 0105 στη βάση.</p>}

      <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 p-4 text-[14px] text-charcoal-600 sm:p-5">
          <span>Εμφάνιση</span>
          <PopSelect ariaLabel="Εγγραφές ανά σελίδα" width="w-[72px]" value={String(per)} onChange={(v) => { setPer(Number(v)); reset(); }} options={[['10', '10'], ['25', '25'], ['50', '50'], ['100', '100']]} />
          <span>εγγραφές</span>
          <span className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <PopSelect ariaLabel="Κατάσταση" width="min-w-[150px]" value={status} onChange={(v) => { setStatus(v); reset(); }} options={[['active', 'Όλες οι ενεργές'], ['open', STATUS_EL.open], ['progress', STATUS_EL.progress], ['overdue', STATUS_EL.overdue], ['done', STATUS_EL.done], ['all', 'Όλες']]} />
            <PopSelect searchable ariaLabel="Άτομο" width="min-w-[150px]" value={who} onChange={(v) => { setWho(v); reset(); }} options={[['', 'Όλη η ομάδα'], ...staff.map((s) => [s.id, s.id === me ? `${s.name} (εγώ)` : s.name] as [string, string])]} />
            <PopSelect ariaLabel="Τύπος" width="min-w-[140px]" value={kind} onChange={(v) => { setKind(v); reset(); }} options={[['', 'Όλοι οι τύποι'], ['call', 'Λίστες κλήσεων'], ['task', 'Εργασίες']]} />
            <label className="relative w-full sm:w-[180px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => { setQ(e.target.value); reset(); }} placeholder="Αναζήτηση…" className="input h-8 py-1 pl-8 text-[13px]" /></label>
            <button type="button" onClick={() => setDlg('task')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-stone-line bg-white px-2.5 text-[14px] font-medium text-charcoal hover:border-forest/40"><Plus size={15} /> Εργασία</button>
            {callListsReady && <button type="button" onClick={() => setDlg('call')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-2.5 text-[14px] font-medium text-white transition-all hover:bg-forest/90 active:translate-y-px"><PhoneCall size={15} /> Λίστα κλήσεων</button>}
          </span>
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th>Εργασία</th><th>Προθεσμία</th><th>Πρόοδος</th><th>Κατάσταση</th></tr></thead>
            <tbody>
              {list.map((r) => {
                const pct = r.total ? Math.round((r.done / r.total) * 100) : 0;
                return (
                  <tr key={r.key} className="cursor-pointer" onClick={() => setOpen(r)}>
                    <td className="min-w-[220px]">
                      <span className="flex items-center gap-2">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-forest/[0.09] text-forest">{r.kind === 'call' ? <PhoneCall size={14} /> : <ListChecks size={14} />}</span>
                        <span className="min-w-0">
                          <span className={`block max-w-[340px] truncate font-semibold text-charcoal ${r.status === 'done' ? 'line-through decoration-charcoal-600/40' : ''}`} data-no-tr>{r.title}</span>
                          <span className="flex flex-wrap gap-x-2 text-[12px] text-charcoal-600">
                            <span>{r.kind === 'call' ? 'Λίστα κλήσεων' : r.total > 1 ? 'Εργασία ομάδας' : 'Εργασία'}</span>
                            <span data-no-tr>{r.assignees.length > 2 ? `${r.assignees.slice(0, 2).join(', ')} +${r.assignees.length - 2}` : r.assignees.join(', ')}</span>
                          </span>
                        </span>
                      </span>
                    </td>
                    <td className={`whitespace-nowrap text-sm ${r.status === 'overdue' ? 'font-medium text-signal-danger' : 'text-charcoal-600'}`}>{r.deadline ? fmt(r.deadline) : '—'}</td>
                    <td className="w-44">
                      <span className="text-sm tabular-nums text-charcoal">{`${r.done} από ${r.total}`}</span>
                      <span className="mt-1 block h-1.5 w-full overflow-hidden rounded-full bg-stone-100"><span className="block h-full rounded-full bg-forest" style={{ width: `${pct}%` }} /></span>
                    </td>
                    <td><span className="flex items-center gap-1.5"><StatusPill tone={CHIP[r.status]} dot>{STATUS_EL[r.status]}</StatusPill>{(r.priority === 'high' || r.priority === 'urgent') && r.status !== 'done' && <StatusPill tone="red">{PRIORITY_EL[r.priority]}</StatusPill>}</span></td>
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={4} className="!py-10 text-center text-sm text-charcoal-600">Καμία εργασία εδώ.</td></tr>}
            </tbody>
          </table>
        </div>
        {shown.length ? <Pager from={p * per + 1} to={Math.min(shown.length, p * per + per)} total={shown.length} page={p} pages={pages} onPage={setPg} /> : <p className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Καμία εγγραφή</p>}
      </div>

      {open && open.kind === 'call' && <CallListPanel row={open} staff={staff} me={me} isLead={isLead} onClose={() => setOpen(null)} onChanged={() => router.refresh()} onDone={done} />}
      {open && open.kind === 'task' && <TaskPanel row={open} me={me} isLead={isLead} onClose={() => setOpen(null)} onEdit={() => setDlg(open)} onChanged={() => router.refresh()} onDone={done} />}
      {dlg === 'call' && <CallListDialog staff={staff} me={me} reports={reports} groups={groups} onClose={() => setDlg(null)} onDone={done} />}
      {(dlg === 'task' || (dlg && typeof dlg === 'object')) && <TaskDialog row={typeof dlg === 'object' ? dlg : null} staff={staff} me={me} lists={Array.from(new Set(rows.map((r) => r.list).filter(Boolean) as string[]))} onClose={() => setDlg(null)} onDone={done} />}
    </div>
  );
}

function Shell({ title, sub, onClose, children, footer, wide }: { title: React.ReactNode; sub?: React.ReactNode; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className={`anim-zoom flex max-h-[92vh] w-full ${wide ? 'max-w-2xl' : 'max-w-xl'} flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-stone-line px-6 py-4">
          <div className="min-w-0"><h3 className="text-2xl">{title}</h3>{sub && <div className="mt-0.5 text-[13px] text-charcoal-600">{sub}</div>}</div>
          <button type="button" onClick={onClose} aria-label="Κλείσιμο" className="text-charcoal-600 hover:text-charcoal"><X size={18} /></button>
        </div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-stone-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

/* ── Λίστα κλήσεων: οι επαφές, με «κλήθηκε» και αποτέλεσμα ─────────────── */

function CallListPanel({ row, staff, me, isLead, onClose, onChanged, onDone }: { row: BoardRow; staff: Staff[]; me: string; isLead: boolean; onClose: () => void; onChanged: () => void; onDone: (t: string, ok?: boolean) => void }) {
  const [items, setItems] = useState<CallItem[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState(false);
  const [title, setTitle] = useState(row.title);
  const [due, setDue] = useState(local(row.deadline));
  const [owner, setOwner] = useState(row.assigneeIds[0] ?? '');
  const [pending, start] = useTransition();
  const canManage = isLead || row.createdBy === me;
  const load = () => { void getCallListItems(row.id).then((r) => (r.ok ? setItems(r.items) : setErr(r.error))); };
  useEffect(load, [row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const mark = (it: CallItem, done: boolean, outcome?: string) => {
    setItems((xs) => xs?.map((x) => (x.id === it.id ? { ...x, done, outcome: done ? outcome ?? null : null } : x)) ?? null);
    start(async () => { const r = await markCallItem(it.id, done, outcome); if (!r.ok) setErr(r.error); onChanged(); });
  };
  const save = () => start(async () => { const r = await updateCallList(row.id, { title, dueAt: due ? new Date(due).toISOString() : null, assignedTo: owner }); if (!r.ok) { setErr(r.error); return; } onDone('Η λίστα αποθηκεύτηκε.'); });
  const del = () => { if (!confirm(`Διαγραφή της λίστας «${row.title}»;`)) return; start(async () => { const r = await deleteCallList(row.id); if (!r.ok) { setErr(r.error); return; } onDone('Η λίστα διαγράφηκε.'); }); };
  const doneN = items ? items.filter((i) => i.done).length : row.done;
  const total = items ? items.length : row.total;
  return (
    <Shell wide onClose={onClose} title={<span data-no-tr>{row.title}</span>}
      sub={<span className="flex flex-wrap gap-x-2"><span>Λίστα κλήσεων</span><span data-no-tr>{row.assignees.join(', ')}</span>{row.source && <span data-no-tr>{row.source}</span>}<span>{`${doneN} από ${total} κλήσεις`}</span></span>}
      footer={canManage ? <>
        <button type="button" onClick={del} disabled={pending} className="mr-auto inline-flex items-center gap-1.5 text-sm text-charcoal-600 hover:text-signal-danger"><Trash2 size={15} /> Διαγραφή</button>
        {edit ? <button type="button" className="btn-primary" disabled={pending || !title.trim()} onClick={save}>Αποθήκευση</button> : <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={() => setEdit(true)}><Pencil size={15} /> Επεξεργασία</button>}
      </> : undefined}>
      {edit && (
        <div className="grid gap-3 rounded-xl border border-stone-line bg-stone-50/60 p-3 sm:grid-cols-3">
          <label className="block sm:col-span-3"><span className={lbl}>Τίτλος</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block"><span className={lbl}>Προθεσμία</span><input type="datetime-local" className="input text-sm" value={due} onChange={(e) => setDue(e.target.value)} /></label>
          <div className="sm:col-span-2"><span className={lbl}>Ανάθεση σε</span><PopSelect searchable width="w-full" value={owner} onChange={setOwner} options={staff.map((s) => [s.id, s.name] as [string, string])} /></div>
        </div>
      )}
      {row.description && <p className="whitespace-pre-wrap text-sm text-charcoal-600" data-no-tr>{row.description}</p>}
      {err && <p className="text-sm text-signal-danger">{err}</p>}
      {!items ? <p className="py-6 text-center text-sm text-charcoal-600">Φόρτωση…</p> : (
        <div className="overflow-x-auto rounded-xl border border-stone-line">
          <table className="o-table">
            <thead><tr><th className="w-10" /><th>Επαφή</th><th>Τηλέφωνο</th><th>Αποτέλεσμα</th></tr></thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.id} className={it.done ? 'opacity-75' : ''}>
                  <td><button type="button" disabled={pending} onClick={() => mark(it, !it.done, it.done ? undefined : 'Απάντησε')} aria-label={it.done ? 'Άνοιγμα ξανά' : 'Κλήθηκε'} className="text-forest">{it.done ? <CheckCircle size={20} /> : <Circle size={20} className="text-charcoal-600/50 hover:text-forest" />}</button></td>
                  <td className="o-strong">{it.contactId ? <Link href={`/crm/${it.contactId}`} className="hover:text-forest hover:underline" data-no-tr>{it.name}</Link> : <span data-no-tr>{it.name}</span>}</td>
                  <td className="whitespace-nowrap">{it.phone ? <a href={`tel:${it.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center gap-1 text-forest hover:underline" data-no-tr><Phone size={13} /> {it.phone}</a> : <span className="text-charcoal-600">—</span>}</td>
                  <td className="min-w-[170px]"><PopSelect width="w-full" ariaLabel="Αποτέλεσμα" value={it.done ? it.outcome ?? '' : ''} onChange={(v) => mark(it, !!v, v)} options={[['', 'Δεν κλήθηκε ακόμη'], ...CALL_OUTCOMES.map((o) => [o, o] as [string, string]), ...(it.outcome && !CALL_OUTCOMES.includes(it.outcome) ? [[it.outcome, it.outcome] as [string, string]] : [])]} /></td>
                </tr>
              ))}
              {items.length === 0 && <tr><td colSpan={4} className="!py-8 text-center">Η λίστα είναι κενή.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}

/* ── Εργασία (μία ή ομάδας): ποιοι την ολοκλήρωσαν ─────────────────────── */

function TaskPanel({ row, me, isLead, onClose, onEdit, onChanged, onDone }: { row: BoardRow; me: string; isLead: boolean; onClose: () => void; onEdit: () => void; onChanged: () => void; onDone: (t: string, ok?: boolean) => void }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const canManage = isLead || row.createdBy === me;
  const toggle = (taskId: string, now: boolean) => {
    const outcome = !now ? (prompt('Αποτέλεσμα (προαιρετικό, π.χ. «Απάντησε — κλείσαμε viewing»):') ?? undefined) : undefined;
    start(async () => { const r = await completeTeamTask(taskId, !now, outcome); if (!r.ok) setErr(r.error); onChanged(); });
  };
  const del = () => {
    const all = row.members.length > 1;
    if (!confirm(all ? `Διαγραφή της εργασίας «${row.title}» για όλα τα άτομα;` : `Διαγραφή της εργασίας «${row.title}»;`)) return;
    start(async () => { const r = await deleteTeamTask(row.id, all); if (!r.ok) { setErr(r.error); return; } onDone('Η εργασία διαγράφηκε.'); });
  };
  return (
    <Shell onClose={onClose} title={row.href ? <Link href={row.href} className="hover:text-forest hover:underline" data-no-tr>{row.title}</Link> : <span data-no-tr>{row.title}</span>}
      sub={<span className="flex flex-wrap gap-x-2"><span>{row.total > 1 ? 'Εργασία ομάδας' : 'Εργασία'}</span><span>{PRIORITY_EL[row.priority] ?? row.priority}</span>{row.deadline && <span>{fmt(row.deadline)}</span>}{row.creator && <span data-no-tr>{row.creator}</span>}</span>}
      footer={canManage ? <>
        <button type="button" onClick={del} disabled={pending} className="mr-auto inline-flex items-center gap-1.5 text-sm text-charcoal-600 hover:text-signal-danger"><Trash2 size={15} /> Διαγραφή</button>
        <button type="button" className="btn-ghost inline-flex items-center gap-1.5" onClick={onEdit}><Pencil size={15} /> Επεξεργασία</button>
      </> : undefined}>
      {row.description && <p className="whitespace-pre-wrap text-sm text-charcoal" data-no-tr>{row.description}</p>}
      {row.list && <p className="text-[13px] text-charcoal-600"><span>Λίστα:</span> <span data-no-tr>{row.list}</span></p>}
      {err && <p className="text-sm text-signal-danger">{err}</p>}
      <div className="divide-y divide-stone-line rounded-xl border border-stone-line">
        {row.members.map((m) => {
          const can = isLead || m.userId === me || row.createdBy === me;
          return (
            <div key={m.taskId} className="flex items-center gap-3 px-3 py-2.5">
              <button type="button" disabled={!can || pending} onClick={() => toggle(m.taskId, m.done)} aria-label={m.done ? 'Άνοιγμα ξανά' : 'Ολοκλήρωση'} className="text-forest disabled:opacity-40">{m.done ? <CheckCircle size={20} /> : <Circle size={20} className="text-charcoal-600/50 hover:text-forest" />}</button>
              <span className="min-w-0 flex-1"><span className="block font-medium text-charcoal" data-no-tr>{m.name}{m.userId === me ? ' (εγώ)' : ''}</span>{m.outcome && <span className="block truncate text-[12px] text-charcoal-600" data-no-tr>{m.outcome}</span>}</span>
              <StatusPill tone={m.done ? 'green' : 'blue'} dot>{m.done ? 'Ολοκληρώθηκε' : 'Ανοιχτή'}</StatusPill>
            </div>
          );
        })}
      </div>
    </Shell>
  );
}

/* ── Νέα / επεξεργασία εργασίας ─────────────────────────────────────────── */

function TaskDialog({ row, staff, me, lists, onClose, onDone }: { row: BoardRow | null; staff: Staff[]; me: string; lists: string[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [title, setTitle] = useState(row?.title ?? '');
  const [desc, setDesc] = useState(row?.description ?? '');
  const [due, setDue] = useState(local(row?.deadline ?? null));
  const [priority, setPriority] = useState(row?.priority ?? 'normal');
  const [list, setList] = useState(row?.list ?? '');
  const [mode, setMode] = useState<'people' | 'all'>('people');
  const [people, setPeople] = useState<Set<string>>(new Set(row ? row.assigneeIds : [me]));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const group = !!row && row.members.length > 1;
  const flip = (id: string) => setPeople((s) => { if (row) return new Set([id]); const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => start(async () => {
    const dueAt = due ? new Date(due).toISOString() : null;
    if (row) {
      const r = await updateTeamTask(row.id, { title, description: desc, dueAt, priority, list, ...(group ? {} : { assignedTo: [...people][0] }) }, group);
      if (!r.ok) { setErr(r.error); return; } onDone('Η εργασία αποθηκεύτηκε.'); return;
    }
    const r = await createTeamTask({ title, description: desc, dueAt, priority, list, assignees: mode === 'all' ? 'all' : [...people] });
    if (!r.ok) { setErr(r.error); return; }
    onDone(r.count > 1 ? `Η εργασία ανατέθηκε σε ${r.count} άτομα — ειδοποιήθηκαν.` : 'Η εργασία ανατέθηκε.');
  });
  return (
    <Shell onClose={onClose} title={<>{row ? 'Επεξεργασία ' : 'Νέα '}<em className="text-forest">εργασία</em></>}
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !title.trim() || (!row && mode === 'people' && !people.size)} onClick={save}>{pending ? 'Αποθήκευση…' : row ? 'Αποθήκευση' : 'Ανάθεση'}</button></>}>
      <label className="block"><span className={lbl}>Τίτλος *</span><input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Ετοιμάστε τα συμβόλαια του Block B" /></label>
      <label className="block"><span className={lbl}>Περιγραφή</span><textarea className="input min-h-[80px]" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className={lbl}>Προθεσμία</span><input type="datetime-local" className="input text-sm" value={due} onChange={(e) => setDue(e.target.value)} /></label>
        <div><span className={lbl}>Προτεραιότητα</span><PopSelect width="w-full" value={priority} onChange={setPriority} options={Object.entries(PRIORITY_EL) as [string, string][]} /></div>
        <label className="block"><span className={lbl}>Λίστα</span><input className="input text-sm" list="task-lists" value={list} onChange={(e) => setList(e.target.value)} placeholder="π.χ. Συμβόλαια" /><datalist id="task-lists">{lists.map((l) => <option key={l} value={l} />)}</datalist></label>
      </div>
      {!group && (
        <div>
          <span className={lbl}>Ανάθεση σε</span>
          {!row && <div className="mb-2 flex gap-2">
            <button type="button" onClick={() => setMode('people')} className={`rounded-full border px-3 py-1 text-sm ${mode === 'people' ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>Συγκεκριμένα άτομα</button>
            <button type="button" onClick={() => setMode('all')} className={`rounded-full border px-3 py-1 text-sm ${mode === 'all' ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>{`Όλη η ομάδα (${staff.length})`}</button>
          </div>}
          {(row || mode === 'people') && <div className="flex flex-wrap gap-1.5">{staff.map((s) => <button key={s.id} type="button" onClick={() => flip(s.id)} className={`rounded-full border px-3 py-1 text-sm ${people.has(s.id) ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`} data-no-tr>{s.name}{s.id === me ? ' ✓' : ''}</button>)}</div>}
          {!row && mode === 'all' && <p className="text-[13px] text-charcoal-600">Κάθε μέλος της ομάδας παίρνει τη δική του εργασία και ειδοποίηση· βλέπετε πόσοι την ολοκλήρωσαν.</p>}
        </div>
      )}
      {group && <p className="text-[13px] text-charcoal-600">Οι αλλαγές ισχύουν για όλα τα άτομα της εργασίας.</p>}
      {err && <p className="text-sm text-signal-danger">{err}</p>}
    </Shell>
  );
}

/* ── Νέα λίστα κλήσεων (από αναφορά, ομάδα ή έτοιμο φίλτρο) ─────────────── */

/** Χρησιμοποιείται και από το Custom report («Λίστα κλήσεων από αυτούς»). */
export function CallListDialog({ staff, me, reports = [], groups = [], fixed, onClose, onDone }: { staff: Staff[]; me: string; reports?: { id: string; name: string }[]; groups?: string[]; fixed?: { ids: string[]; label: string }; onClose: () => void; onDone: (msg: string, ok?: boolean) => void }) {
  const [title, setTitle] = useState(fixed?.label ?? '');
  const [desc, setDesc] = useState('');
  const [due, setDue] = useState('');
  const [src, setSrc] = useState<string>(fixed ? 'ids' : reports.length ? `report:${reports[0].id}` : `preset:${PRESETS[0][0]}`);
  const [people, setPeople] = useState<Set<string>>(new Set([me]));
  const [onlyPhone, setOnlyPhone] = useState(true);
  const [count, setCount] = useState<{ count: number; withPhone: number; label: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const source: CallSource = fixed ? { kind: 'ids', ids: fixed.ids, label: fixed.label }
    : src.startsWith('report:') ? { kind: 'report', id: src.slice(7) } : src.startsWith('group:') ? { kind: 'group', name: src.slice(6) } : { kind: 'preset', key: src.slice(7) };
  useEffect(() => { setCount(null); void previewCallList(source).then((r) => { if (r.ok) { setCount(r); setTitle((t) => t || r.label); } }); }, [src]); // eslint-disable-line react-hooks/exhaustive-deps
  const flip = (id: string) => setPeople((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const n = count ? (onlyPhone ? count.withPhone : count.count) : 0;
  const save = () => start(async () => {
    const r = await createCallList({ title, description: desc, dueAt: due ? new Date(due).toISOString() : null, assignees: [...people], source, onlyWithPhone: onlyPhone });
    if (!r.ok) { setErr(r.error); return; }
    onDone(r.lists > 1 ? `Δημιουργήθηκαν ${r.lists} λίστες κλήσεων με ${r.contacts} επαφές.` : `Δημιουργήθηκε λίστα κλήσεων με ${r.contacts} επαφές.`);
  });
  const opts: [string, string][] = [
    ...reports.map((r) => [`report:${r.id}`, `Αναφορά: ${r.name}`] as [string, string]),
    ...PRESETS.map(([k, l]) => [`preset:${k}`, l] as [string, string]),
    ...groups.map((g) => [`group:${g}`, `Ομάδα: ${g}`] as [string, string]),
  ];
  return (
    <Shell onClose={onClose} title={<>Νέα <em className="text-forest">λίστα κλήσεων</em></>} sub="Μια λίστα επαφών από αναφορά, που ανατίθεται σε ένα ή περισσότερα άτομα της ομάδας."
      footer={<><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !title.trim() || !people.size || !n} onClick={save}>{pending ? 'Δημιουργία…' : 'Δημιουργία λίστας'}</button></>}>
      {!fixed && <div><span className={lbl}>Από</span><PopSelect searchable width="w-full" value={src} onChange={setSrc} options={opts} /></div>}
      <p className="rounded-lg bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600">
        {count === null ? 'Υπολογισμός επαφών…' : <><span>{`${count.count} επαφές`}</span> · <span>{`${count.withPhone} με τηλέφωνο`}</span></>}
      </p>
      <label className="flex items-center gap-2 text-sm text-charcoal"><input type="checkbox" checked={onlyPhone} onChange={(e) => setOnlyPhone(e.target.checked)} /> Μόνο όσοι έχουν τηλέφωνο</label>
      <label className="block"><span className={lbl}>Τίτλος *</span><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Κλήσεις επενδυτών — Νοέμβριος" /></label>
      <label className="block"><span className={lbl}>Οδηγίες</span><textarea className="input min-h-[70px]" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="π.χ. Προτείνετε viewing στο νέο έργο της Λεμεσού." /></label>
      <label className="block sm:w-1/2"><span className={lbl}>Προθεσμία</span><input type="datetime-local" className="input text-sm" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <div>
        <span className={lbl}>Ανάθεση σε</span>
        <div className="flex flex-wrap gap-1.5">{staff.map((s) => <button key={s.id} type="button" onClick={() => flip(s.id)} className={`rounded-full border px-3 py-1 text-sm ${people.has(s.id) ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`} data-no-tr>{s.name}</button>)}</div>
        {people.size > 1 && <p className="mt-1.5 text-[13px] text-charcoal-600">Οι επαφές μοιράζονται ισόποσα — κάθε άτομο παίρνει τη δική του λίστα.</p>}
      </div>
      {err && <p className="text-sm text-signal-danger">{err}</p>}
    </Shell>
  );
}
