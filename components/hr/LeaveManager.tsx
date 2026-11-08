'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, X, Trash2, CalendarPlus, Pencil } from 'lucide-react';
import { requestLeave, decideLeave, cancelLeave, setLeaveBalance } from '@/app/actions/hr';
import { DATE_TAG, currentLocale } from '@/lib/locale-shared';

export interface LeaveRow { id: string; profile_id: string; employee: string | null; leave_type: string; start_date: string; end_date: string; days: number | null; reason: string | null; status: string; created_at: string }
export interface BalanceRow { profile_id: string; leave_type: string; year: number; total_days: number; used_days: number }

const TYPES: [string, string][] = [['annual', 'Ετήσια'], ['sick', 'Ασθένεια'], ['unpaid', 'Άνευ αποδοχών'], ['maternity', 'Μητρότητας'], ['paternity', 'Πατρότητας'], ['other', 'Άλλη']];
const typeLabel = (k: string) => TYPES.find(([v]) => v === k)?.[1] ?? k;
const STATUS: Record<string, [string, string]> = { pending: ['Σε αναμονή', 'badge-champagne'], approved: ['Εγκρίθηκε', 'badge-forest'], rejected: ['Απορρίφθηκε', 'badge-neutral'] };
const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(DATE_TAG[currentLocale().lang], { day: '2-digit', month: 'short', year: 'numeric' });

/** HR → Άδειες: αιτήσεις (με φίλτρα), έγκριση, καταχώριση για υπάλληλο και υπόλοιπα ανά υπάλληλο. */
export function LeaveManager({ requests, balances, employees, me, canEdit }: { requests: LeaveRow[]; balances: BalanceRow[]; employees: { id: string; full_name: string | null }[]; me: string; canEdit: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const thisYear = new Date().getFullYear();
  const [emp, setEmp] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [year, setYear] = useState(thisYear);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [form, setForm] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [edit, setEdit] = useState<string | null>(null);

  const rows = useMemo(() => requests.filter((r) =>
    (!emp || r.profile_id === emp) && (!type || r.leave_type === type) && (!status || r.status === status) &&
    (!from || r.end_date >= from) && (!to || r.start_date <= to) &&
    (from || to || new Date(r.start_date).getFullYear() === year || new Date(r.end_date).getFullYear() === year),
  ).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || b.start_date.localeCompare(a.start_date)), [requests, emp, type, status, year, from, to]);

  const years = Array.from(new Set([thisYear + 1, thisYear, thisYear - 1, ...balances.map((b) => b.year)])).sort((a, b) => b - a);
  const bal = (pid: string, t: string) => balances.find((b) => b.profile_id === pid && b.leave_type === t && b.year === year);
  const pendingDays = (pid: string, t: string) => requests.filter((r) => r.profile_id === pid && r.leave_type === t && r.status === 'pending' && new Date(r.start_date).getFullYear() === year).reduce((s, r) => s + Number(r.days ?? 0), 0);
  const act = (fn: () => Promise<unknown>) => start(async () => { const r: any = await fn(); if (r && r.ok === false) setErr(r.error); else { setErr(null); router.refresh(); } });

  const submit = (fd: FormData) => act(async () => {
    const r = await requestLeave({ profileId: String(fd.get('who') || me), leaveType: String(fd.get('type')), startDate: String(fd.get('start')), endDate: String(fd.get('end')), halfDay: fd.get('half') === 'on', reason: String(fd.get('reason') || ''), approve: fd.get('approve') === 'on' });
    if (r.ok) setForm(false);
    return r;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input w-auto text-sm" value={emp} onChange={(e) => setEmp(e.target.value)} aria-label="Υπάλληλος" data-no-tr><option value="">Όλοι οι υπάλληλοι</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? '—'}</option>)}</select>
        <select className="input w-auto text-sm" value={type} onChange={(e) => setType(e.target.value)} aria-label="Τύπος"><option value="">Όλοι οι τύποι</option>{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className="input w-auto text-sm" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Κατάσταση"><option value="">Όλες οι καταστάσεις</option>{Object.entries(STATUS).map(([v, [l]]) => <option key={v} value={v}>{l}</option>)}</select>
        <select className="input w-auto text-sm" value={year} onChange={(e) => setYear(Number(e.target.value))} aria-label="Έτος">{years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
        <span className="flex items-center gap-1 text-sm text-charcoal-600"><input type="date" className="input w-auto text-sm" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Από" /> – <input type="date" className="input w-auto text-sm" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Έως" /></span>
        {(emp || type || status || from || to) && <button type="button" className="btn-ghost text-xs" onClick={() => { setEmp(''); setType(''); setStatus(''); setFrom(''); setTo(''); }}><X size={13} /> Καθαρισμός</button>}
        <button type="button" className="btn-primary ml-auto text-sm" onClick={() => { setErr(null); setForm((v) => !v); }}><CalendarPlus size={14} /> Αίτηση άδειας</button>
      </div>

      {form && (
        <form action={submit} className="panel grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {canEdit ? (
            <label className="block"><span className="text-xs text-charcoal-600/70">Υπάλληλος</span>
              <select name="who" defaultValue={me} className="input" data-no-tr>{employees.map((e) => <option key={e.id} value={e.id}>{e.full_name ?? '—'}{e.id === me ? ' (εγώ)' : ''}</option>)}</select></label>
          ) : <input type="hidden" name="who" value={me} />}
          <label className="block"><span className="text-xs text-charcoal-600/70">Τύπος</span><select name="type" defaultValue="annual" className="input">{TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          <label className="block"><span className="text-xs text-charcoal-600/70">Από</span><input name="start" type="date" required className="input" /></label>
          <label className="block"><span className="text-xs text-charcoal-600/70">Έως</span><input name="end" type="date" required className="input" /></label>
          <input name="reason" placeholder="Λόγος / σημείωση (προαιρετικό)" className="input sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="half" /> Μισή μέρα</label>
          {canEdit && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="approve" /> Έγκριση αμέσως</label>}
          <p className="text-xs text-charcoal-600/60 sm:col-span-2 lg:col-span-4">Μετρούν μόνο εργάσιμες (Δευ–Παρ). Οι αργίες δεν αφαιρούνται αυτόματα.</p>
          {err && <p className="text-sm text-signal-danger sm:col-span-2 lg:col-span-4">{err}</p>}
          <div className="flex justify-end gap-2 sm:col-span-2 lg:col-span-4"><button type="button" className="btn-ghost" onClick={() => setForm(false)}>Άκυρο</button><button type="submit" className="btn-primary" disabled={pending}>Υποβολή</button></div>
        </form>
      )}
      {!form && err && <p className="text-sm text-signal-danger">{err}</p>}

      {/* Υπόλοιπα */}
      <div className="panel overflow-x-auto p-0">
        <div className="border-b border-stone-line px-5 py-3"><h4>Υπόλοιπα αδειών {year}</h4><p className="text-xs text-charcoal-600/60">Δικαίωμα − εγκεκριμένες = υπόλοιπο· σε αναμονή φαίνονται ξεχωριστά.{canEdit ? ' Πατήστε ✎ για να αλλάξετε το δικαίωμα.' : ''}</p></div>
        <table className="table-base w-full min-w-[720px]">
          <thead><tr><th>Υπάλληλος</th>{['annual', 'sick', 'unpaid'].map((t) => <th key={t}>{typeLabel(t)}</th>)}<th /></tr></thead>
          <tbody>
            {employees.filter((e) => !emp || e.id === emp).map((e) => (
              <tr key={e.id}>
                <td className="font-medium text-charcoal" data-no-tr>{e.full_name ?? '—'}</td>
                {['annual', 'sick', 'unpaid'].map((t) => {
                  const b = bal(e.id, t); const total = Number(b?.total_days ?? 0); const used = Number(b?.used_days ?? 0); const pend = pendingDays(e.id, t); const left = total - used;
                  const key = `${e.id}:${t}`;
                  return (
                    <td key={t}>
                      {edit === key ? (
                        <form action={(fd) => act(async () => { const n = Number(String(fd.get('total')).replace(',', '.')); await setLeaveBalance({ profileId: e.id, leaveType: t, year, totalDays: Number.isFinite(n) ? n : 0 }); setEdit(null); })} className="flex items-center gap-1">
                          <input name="total" autoFocus defaultValue={total} inputMode="decimal" className="input h-8 w-16 py-1 text-sm" aria-label="Δικαίωμα" />
                          <button type="submit" className="rounded p-1 text-forest hover:bg-stone" aria-label="Αποθήκευση"><Check size={14} /></button>
                          <button type="button" className="rounded p-1 hover:bg-stone" onClick={() => setEdit(null)} aria-label="Άκυρο"><X size={14} /></button>
                        </form>
                      ) : (
                        <span className="inline-flex items-center gap-1.5">
                          <span className={`figure font-semibold ${t === 'unpaid' ? 'text-charcoal' : left < 0 ? 'text-signal-danger' : 'text-forest'}`}>{t === 'unpaid' ? used : left}</span>
                          <span className="text-xs text-charcoal-600/60">{t === 'unpaid' ? 'μέρες πήρε' : `/ ${total} · πήρε ${used}`}{pend ? ` · ${pend} σε αναμονή` : ''}</span>
                          {canEdit && t !== 'unpaid' && <button type="button" className="rounded p-0.5 text-charcoal-600/40 hover:text-charcoal" onClick={() => setEdit(key)} title="Αλλαγή δικαιώματος" aria-label="Αλλαγή δικαιώματος"><Pencil size={12} /></button>}
                        </span>
                      )}
                    </td>
                  );
                })}
                <td className="text-right"><button type="button" className="btn-ghost text-xs" onClick={() => setEmp(e.id === emp ? '' : e.id)}>{e.id === emp ? 'Όλοι' : 'Οι άδειές του'}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Αιτήσεις */}
      <div className="panel overflow-x-auto p-0">
        <div className="border-b border-stone-line px-5 py-3"><h4>Αιτήσεις άδειας · {rows.length}</h4></div>
        {rows.length === 0 ? <p className="px-5 py-8 text-center text-sm text-charcoal-600/70">Καμία αίτηση με αυτά τα φίλτρα.</p> : (
          <table className="table-base w-full min-w-[820px]">
            <thead><tr><th>Υπάλληλος</th><th>Τύπος</th><th>Διάστημα</th><th>Μέρες</th><th>Κατάσταση</th><th>Λόγος</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => { const [sl, sc] = STATUS[r.status] ?? [r.status, 'badge-neutral']; return (
                <tr key={r.id}>
                  <td className="font-medium text-charcoal" data-no-tr>{r.employee ?? '—'}</td>
                  <td>{typeLabel(r.leave_type)}</td>
                  <td className="whitespace-nowrap">{fmt(r.start_date)}{r.end_date !== r.start_date ? ` → ${fmt(r.end_date)}` : ''}</td>
                  <td className="figure">{r.days ?? '—'}</td>
                  <td><span className={sc}>{sl}</span></td>
                  <td className="max-w-[16rem] truncate text-xs text-charcoal-600/70" data-no-tr>{r.reason ?? ''}</td>
                  <td className="whitespace-nowrap text-right">
                    {r.status === 'pending' && canEdit && <>
                      <button type="button" disabled={pending} onClick={() => act(() => decideLeave(r.id, 'approved'))} className="btn-ghost text-xs text-signal-success"><Check size={13} /> Έγκριση</button>
                      <button type="button" disabled={pending} onClick={() => act(() => decideLeave(r.id, 'rejected'))} className="btn-ghost text-xs text-signal-danger"><X size={13} /> Απόρριψη</button>
                    </>}
                    {(canEdit || (r.profile_id === me && r.status === 'pending')) && <button type="button" disabled={pending} title={r.status === 'approved' ? 'Ακύρωση (οι μέρες επιστρέφουν στο υπόλοιπο)' : 'Διαγραφή'} aria-label="Διαγραφή" className="rounded p-1.5 text-charcoal-600/50 hover:bg-stone hover:text-signal-danger"
                      onClick={() => { if (confirm(r.status === 'approved' ? 'Ακύρωση εγκεκριμένης άδειας; Οι μέρες θα επιστρέψουν στο υπόλοιπο.' : 'Διαγραφή της αίτησης;')) act(() => cancelLeave(r.id)); }}><Trash2 size={14} /></button>}
                  </td>
                </tr>
              ); })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
