'use client';

import { PopSelect } from '@/components/ui/PopSelect';

import { useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ListChecks, User, Users, AlertTriangle, CheckCircle2, Plus, Search, X, Pencil, Trash2, Circle, CheckCircle, CalendarClock } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { createTeamTask, updateTeamTask, completeTeamTask, deleteTeamTask } from '@/app/actions/team-tasks';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface TeamTask {
  id: string; title: string; description: string | null; assignedTo: string; assignee: string; dueAt: string | null; done: boolean; priority: string;
  createdBy: string | null; creator: string | null; groupId: string | null; list: string | null; completedAt: string | null; outcome: string | null; createdAt: string; href: string | null;
}
const PRI: Record<string, string> = { low: 'Χαμηλή', normal: 'Κανονική', high: 'Υψηλή', urgent: 'Επείγον' };
const iconBtn = 'flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 transition hover:bg-forest/10 hover:text-forest';
const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';
const fmt = (iso: string) => new Date(iso).toLocaleString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** Tasks: κάρτες (Δικά μου · Ανέθεσα · Όλη η ομάδα · Καθυστερούν · Ολοκληρωμένα) και από κάτω η λίστα. */
export function TeamTasks({ tasks, staff, me, isLead, initialView }: { tasks: TeamTask[]; staff: { id: string; name: string }[]; me: string; isLead: boolean; initialView?: string }) {
  const router = useRouter();
  const [view, setView] = useState(initialView && ['mine', 'assigned', 'team', 'overdue', 'done'].includes(initialView) ? initialView : 'mine');
  const [q, setQ] = useState('');
  const [who, setWho] = useState('');
  const [pri, setPri] = useState('');
  const [list, setList] = useState('');
  const [dlg, setDlg] = useState<TeamTask | 'new' | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const now = Date.now();
  const late = (t: TeamTask) => !t.done && !!t.dueAt && Date.parse(t.dueAt) < now;
  const groupSize = useMemo(() => { const m = new Map<string, { n: number; done: number }>(); for (const t of tasks) if (t.groupId) { const c = m.get(t.groupId) ?? { n: 0, done: 0 }; c.n++; if (t.done) c.done++; m.set(t.groupId, c); } return m; }, [tasks]);
  const lists = Array.from(new Set(tasks.map((t) => t.list).filter(Boolean) as string[])).sort();

  const base = {
    mine: tasks.filter((t) => t.assignedTo === me && !t.done),
    assigned: tasks.filter((t) => t.createdBy === me && t.assignedTo !== me),
    team: isLead ? tasks.filter((t) => !t.done) : tasks.filter((t) => !t.done && (t.assignedTo === me || t.createdBy === me)),
    overdue: tasks.filter((t) => late(t) && (isLead || t.assignedTo === me || t.createdBy === me)),
    done: tasks.filter((t) => t.done && (isLead || t.assignedTo === me || t.createdBy === me)),
  } as Record<string, TeamTask[]>;
  const ql = q.trim().toLowerCase();
  const shown = (base[view] ?? []).filter((t) => (!ql || [t.title, t.description ?? '', t.assignee, t.list ?? ''].join(' ').toLowerCase().includes(ql)) && (!who || t.assignedTo === who) && (!pri || t.priority === pri) && (!list || t.list === list))
    .sort((a, b) => (view === 'done' ? (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : (a.dueAt ?? '9999').localeCompare(b.dueAt ?? '9999')));

  const toggle = (t: TeamTask) => {
    const outcome = !t.done ? (prompt('Αποτέλεσμα (προαιρετικό, π.χ. «Απάντησε — κλείσαμε viewing»):') ?? undefined) : undefined;
    start(async () => { const r = await completeTeamTask(t.id, !t.done, outcome); if (!r.ok) setMsg({ ok: false, text: r.error }); router.refresh(); });
  };
  const del = (t: TeamTask) => {
    const g = t.groupId && (groupSize.get(t.groupId)?.n ?? 0) > 1;
    const all = g ? confirm(`Η εργασία έχει ανατεθεί σε ${groupSize.get(t.groupId!)!.n} άτομα.\n\nOK = διαγραφή για όλους · Άκυρο = μόνο για ${t.assignee}`) : false;
    if (!g && !confirm(`Διαγραφή της εργασίας «${t.title}»;`)) return;
    start(async () => { const r = await deleteTeamTask(t.id, all); setMsg(r.ok ? { ok: true, text: 'Η εργασία διαγράφηκε.' } : { ok: false, text: r.error }); router.refresh(); });
  };

  return (
    <div className="space-y-5">
      <HubCards cols={3} active={view} onSelect={setView} cards={[
        { key: 'mine', icon: User, title: 'Οι εργασίες μου', value: base.mine.length, sub: `${base.mine.filter(late).length} καθυστερούν` },
        { key: 'assigned', icon: ListChecks, title: 'Ανέθεσα', value: base.assigned.length, sub: `${base.assigned.filter((t) => t.done).length} ολοκληρώθηκαν` },
        { key: 'team', icon: Users, title: isLead ? 'Όλη η ομάδα' : 'Ανοιχτές', value: base.team.length, sub: 'Ανοιχτές εργασίες' },
        { key: 'overdue', icon: AlertTriangle, title: 'Καθυστερούν', value: base.overdue.length, sub: 'Πέρασε η προθεσμία' },
        { key: 'done', icon: CheckCircle2, title: 'Ολοκληρωμένες', value: base.done.length, sub: 'Με αποτέλεσμα' },
      ]} />

      {msg && <p className={`rounded-xl border px-4 py-2.5 text-sm ${msg.ok ? 'border-forest/20 bg-forest/[0.05] text-forest' : 'border-signal-danger/30 bg-rose-50 text-signal-danger'}`}>{msg.text}</p>}

      <div className="rounded-2xl border border-stone-line bg-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-center gap-2 p-4 sm:p-5">
          {(isLead || view === 'assigned') && <PopSelect searchable width="min-w-[160px]" ariaLabel="Άτομο" value={who} onChange={setWho} options={[['', 'Όλα τα άτομα'], ...staff.map((x) => [x.id, x.name] as [string, string])]} />}
          <PopSelect width="min-w-[150px]" ariaLabel="Προτεραιότητα" value={pri} onChange={setPri} options={[['', 'Κάθε προτεραιότητα'], ...(Object.entries(PRI) as [string, string][])]} />
          {lists.length > 0 && <PopSelect width="min-w-[140px]" ariaLabel="Λίστα" value={list} onChange={setList} options={[['', 'Όλες οι λίστες'], ...lists.map((l) => [l, l] as [string, string])]} />}
          <label className="relative w-full sm:w-[220px]"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση…" className="input h-8 py-1 pl-8 text-[13px]" /></label>
          <button type="button" onClick={() => setDlg('new')} className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-forest px-2.5 text-[14px] font-medium text-white transition-all hover:bg-forest/90 sm:ml-auto"><Plus size={15} /> Νέα εργασία</button>
        </div>
        <div className="overflow-x-auto border-t border-stone-line">
          <table className="o-table">
            <thead><tr><th className="w-10" /><th>Εργασία</th><th>Ανατέθηκε σε</th><th>Προθεσμία</th><th>Προτεραιότητα</th><th>Από</th><th className="text-right">Ενέργειες</th></tr></thead>
            <tbody>
              {shown.map((t) => {
                const g = t.groupId ? groupSize.get(t.groupId) : null;
                return (
                  <tr key={t.id} className={t.done ? 'opacity-70' : ''}>
                    <td><button type="button" onClick={() => toggle(t)} disabled={pending} aria-label={t.done ? 'Άνοιγμα ξανά' : 'Ολοκλήρωση'} className="text-forest">{t.done ? <CheckCircle size={20} /> : <Circle size={20} className="text-charcoal-600/50 hover:text-forest" />}</button></td>
                    <td>
                      <span className={`font-semibold text-charcoal ${t.done ? 'line-through' : ''}`} data-no-tr>{t.href ? <Link href={t.href} className="hover:text-forest hover:underline">{t.title}</Link> : t.title}</span>
                      {t.description && <span className="block max-w-md truncate text-[13px] text-charcoal-600" data-no-tr>{t.description}</span>}
                      <span className="mt-0.5 flex flex-wrap gap-1.5 text-[12px] text-charcoal-600">
                        {t.list && <span className="rounded-full border border-stone-line px-2 py-0.5" data-no-tr>{t.list}</span>}
                        {g && g.n > 1 && <span className="rounded-full bg-forest/[0.08] px-2 py-0.5 text-forest">Ομάδα · {g.done}/{g.n} ολοκλήρωσαν</span>}
                        {t.outcome && <span data-no-tr>Αποτέλεσμα: {t.outcome}</span>}
                      </span>
                    </td>
                    <td className="text-sm" data-no-tr>{t.assignee}</td>
                    <td className={`text-sm ${late(t) ? 'font-medium text-signal-danger' : 'text-charcoal-600'}`}>{t.dueAt ? <span className="inline-flex items-center gap-1"><CalendarClock size={13} /> {fmt(t.dueAt)}</span> : '—'}</td>
                    <td><span className={`rounded-full px-2 py-0.5 text-[12px] font-medium ${t.priority === 'urgent' || t.priority === 'high' ? 'bg-forest text-white' : 'bg-forest/[0.08] text-forest'}`}>{PRI[t.priority] ?? t.priority}</span></td>
                    <td className="text-sm text-charcoal-600" data-no-tr>{t.creator ?? '—'}</td>
                    <td><span className="flex justify-end gap-1">
                      {(isLead || t.createdBy === me || t.assignedTo === me) && <button type="button" onClick={() => setDlg(t)} className={iconBtn} title="Επεξεργασία" aria-label="Επεξεργασία"><Pencil size={15} /></button>}
                      {(isLead || t.createdBy === me) && <button type="button" onClick={() => del(t)} className="flex h-8 w-8 items-center justify-center rounded-full text-charcoal-600 hover:bg-rose-50 hover:text-signal-danger" title="Διαγραφή" aria-label="Διαγραφή"><Trash2 size={15} /></button>}
                    </span></td>
                  </tr>
                );
              })}
              {shown.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-sm text-charcoal-600">Καμία εργασία εδώ.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="border-t border-stone-line px-5 py-3 text-sm text-charcoal-600">Εμφάνιση {shown.length}</div>
      </div>

      {dlg && <TaskDialog task={dlg === 'new' ? null : dlg} staff={staff} me={me} lists={lists} onClose={() => setDlg(null)} onDone={(t) => { setDlg(null); setMsg({ ok: true, text: t }); router.refresh(); }} />}
    </div>
  );
}

function TaskDialog({ task, staff, me, lists, onClose, onDone }: { task: TeamTask | null; staff: { id: string; name: string }[]; me: string; lists: string[]; onClose: () => void; onDone: (msg: string) => void }) {
  const local = (iso: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const [title, setTitle] = useState(task?.title ?? '');
  const [desc, setDesc] = useState(task?.description ?? '');
  const [due, setDue] = useState(local(task?.dueAt ?? null));
  const [priority, setPriority] = useState(task?.priority ?? 'normal');
  const [list, setList] = useState(task?.list ?? '');
  const [mode, setMode] = useState<'people' | 'all'>('people');
  const [people, setPeople] = useState<Set<string>>(new Set(task ? [task.assignedTo] : [me]));
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const flip = (id: string) => setPeople((s) => { if (task) return new Set([id]); const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const save = () => start(async () => {
    const dueAt = due ? new Date(due).toISOString() : null;
    if (task) {
      const r = await updateTeamTask(task.id, { title, description: desc, dueAt, priority, list, assignedTo: [...people][0] });
      if (!r.ok) { setErr(r.error); return; } onDone('Η εργασία αποθηκεύτηκε.'); return;
    }
    const r = await createTeamTask({ title, description: desc, dueAt, priority, list, assignees: mode === 'all' ? 'all' : [...people] });
    if (!r.ok) { setErr(r.error); return; }
    onDone(r.count > 1 ? `Η εργασία ανατέθηκε σε ${r.count} άτομα — ειδοποιήθηκαν.` : 'Η εργασία ανατέθηκε.');
  });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal/30 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-[92vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-overlay sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-stone-line px-6 py-4"><h3 className="text-2xl">{task ? 'Επεξεργασία ' : 'Νέα '}<em className="text-forest">εργασία</em></h3><button type="button" onClick={onClose} aria-label="Κλείσιμο"><X size={18} /></button></div>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <label className="block"><span className={lbl}>Τίτλος *</span><input autoFocus className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="π.χ. Τηλεφωνήστε στα leads του Ισραήλ" /></label>
          <label className="block"><span className={lbl}>Περιγραφή</span><textarea className="input min-h-[80px]" value={desc} onChange={(e) => setDesc(e.target.value)} /></label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block sm:col-span-1"><span className={lbl}>Προθεσμία</span><input type="datetime-local" className="input text-sm" value={due} onChange={(e) => setDue(e.target.value)} /></label>
            <label className="block"><span className={lbl}>Προτεραιότητα</span><select className="input text-sm" value={priority} onChange={(e) => setPriority(e.target.value)}>{Object.entries(PRI).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <label className="block"><span className={lbl}>Λίστα</span><input className="input text-sm" list="task-lists" value={list} onChange={(e) => setList(e.target.value)} placeholder="π.χ. Κλήσεις" /><datalist id="task-lists">{lists.map((l) => <option key={l} value={l} />)}</datalist></label>
          </div>
          <div>
            <span className={lbl}>Ανάθεση σε</span>
            {!task && <div className="mb-2 flex gap-2">
              <button type="button" onClick={() => setMode('people')} className={`rounded-full border px-3 py-1 text-sm ${mode === 'people' ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>Συγκεκριμένα άτομα</button>
              <button type="button" onClick={() => setMode('all')} className={`rounded-full border px-3 py-1 text-sm ${mode === 'all' ? 'border-forest bg-forest text-white' : 'border-stone-line'}`}>Όλη η ομάδα ({staff.length})</button>
            </div>}
            {(task || mode === 'people') && <div className="flex flex-wrap gap-1.5">{staff.map((s) => <button key={s.id} type="button" onClick={() => flip(s.id)} className={`rounded-full border px-3 py-1 text-sm ${people.has(s.id) ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`} data-no-tr>{s.name}{s.id === me ? ' (εγώ)' : ''}</button>)}</div>}
            {!task && mode === 'all' && <p className="text-[13px] text-charcoal-600">Κάθε μέλος της ομάδας παίρνει τη δική του εργασία και ειδοποίηση· βλέπετε πόσοι την ολοκλήρωσαν.</p>}
          </div>
          {err && <p className="text-sm text-signal-danger">{err}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-stone-line px-6 py-4"><button type="button" className="btn-ghost" onClick={onClose}>Ακύρωση</button><button type="button" className="btn-primary" disabled={pending || !title.trim()} onClick={save}>{pending ? 'Αποθήκευση…' : task ? 'Αποθήκευση' : 'Ανάθεση'}</button></div>
      </div>
    </div>
  );
}
