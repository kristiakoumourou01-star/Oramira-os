'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarPlus, Check, X, UserX, Sparkles } from 'lucide-react';
import { scheduleViewing, setViewingStatus } from '@/app/actions/viewings';
import { getSchedulingSuggestion } from '@/app/actions/scheduling';
import { formatDateTime, formatWeekdayTime } from '@/lib/format';

/** ISO → value for a <input type="datetime-local"> (local time, no seconds). */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export interface ViewingRow {
  id: string;
  scheduled_at: string;
  status: string;
  unit_label: string | null;
  agent: string | null;
  notes: string | null;
}
export interface UnitOption { id: string; label: string; projectId: string | null }
export interface AgentOption { id: string; full_name: string | null }

const STATUS_CLASS: Record<string, string> = {
  scheduled: 'badge-champagne', attended: 'badge-forest', no_show: 'border-signal-danger/30 bg-champagne-50 text-signal-danger badge', cancelled: 'badge-neutral',
};

/** Viewing scheduler + outcome tracker on the lead profile. */
export function ViewingScheduler({
  leadId, contactId, units, agents, viewings,
}: { leadId: string; contactId: string; units: UnitOption[]; agents: AgentOption[]; viewings: ViewingRow[] }) {
  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function suggest() {
    startTransition(async () => {
      const r = await getSchedulingSuggestion({ leadId, durationMin: 60 });
      setSuggestions(r.slots);
      if (r.slots[0]) setScheduledAt(toLocalInput(r.slots[0]));
    });
  }

  function submit(fd: FormData) {
    const scheduledAt = String(fd.get('scheduledAt') || '');
    if (!scheduledAt) return;
    const unitId = String(fd.get('unitId') || '') || null;
    const unit = units.find((u) => u.id === unitId);
    startTransition(async () => {
      await scheduleViewing({
        leadId, contactId, unitId, projectId: unit?.projectId ?? null,
        agentId: String(fd.get('agentId') || '') || null,
        scheduledAt: new Date(scheduledAt).toISOString(),
        notes: String(fd.get('notes') || '') || undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  function mark(id: string, status: 'attended' | 'no_show' | 'cancelled') {
    startTransition(async () => { await setViewingStatus(id, status); router.refresh(); });
  }

  return (
    <div className="panel p-6">
      <div className="mb-4 flex items-center justify-between">
        <h4 className="flex items-center gap-2"><CalendarPlus size={15} className="text-olive" strokeWidth={1.75} /> Viewings</h4>
        <button onClick={() => setOpen((o) => !o)} className="btn-ghost text-xs">{open ? 'Cancel' : 'Schedule'}</button>
      </div>

      {open && (
        <form action={submit} className="mb-4 space-y-2 rounded border border-stone-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-charcoal-600/70">Date & time</span>
            <button type="button" onClick={suggest} disabled={isPending} className="inline-flex items-center gap-1 text-xs text-forest hover:underline"><Sparkles size={12} strokeWidth={1.75} /> Suggest time</button>
          </div>
          <input name="scheduledAt" type="datetime-local" required value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="input text-sm" />
          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((s) => (
                <button key={s} type="button" onClick={() => setScheduledAt(toLocalInput(s))} className="rounded bg-sand-100 px-2 py-1 text-[11px] text-charcoal-600 hover:bg-sand">
                  {formatWeekdayTime(s)}
                </button>
              ))}
            </div>
          )}
          <select name="unitId" className="input text-sm">
            <option value="">Unit / project (optional)…</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
          </select>
          <select name="agentId" className="input text-sm">
            <option value="">Assign agent (defaults to you)…</option>
            {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? 'Agent'}</option>)}
          </select>
          <textarea name="notes" placeholder="Notes (optional)" className="input min-h-[60px] text-sm" />
          <button type="submit" disabled={isPending} className="btn-primary w-full text-sm">{isPending ? 'Scheduling…' : 'Schedule viewing'}</button>
        </form>
      )}

      {viewings.length === 0 ? (
        <p className="text-sm text-charcoal-600/70">No viewings scheduled.</p>
      ) : (
        <ul className="divide-y divide-stone-line">
          {viewings.map((v) => (
            <li key={v.id} className="py-2.5">
              <div className="flex items-center justify-between">
                <p className="figure text-sm text-charcoal">{formatDateTime(v.scheduled_at)}</p>
                <span className={STATUS_CLASS[v.status] ?? 'badge-neutral'}>{v.status.replace('_', ' ')}</span>
              </div>
              <p className="text-xs text-charcoal-600/70">{[v.unit_label, v.agent].filter(Boolean).join(' · ') || '—'}</p>
              {v.notes && <p className="mt-0.5 text-xs text-charcoal-600/60">{v.notes}</p>}
              {v.status === 'scheduled' && (
                <div className="mt-1.5 flex gap-1.5">
                  <button onClick={() => mark(v.id, 'attended')} disabled={isPending} className="inline-flex items-center gap-1 rounded bg-sand-100 px-2 py-1 text-[11px] text-forest hover:bg-sand"><Check size={11} /> Attended</button>
                  <button onClick={() => mark(v.id, 'no_show')} disabled={isPending} className="inline-flex items-center gap-1 rounded bg-sand-100 px-2 py-1 text-[11px] text-signal-danger hover:bg-sand"><UserX size={11} /> No-show</button>
                  <button onClick={() => mark(v.id, 'cancelled')} disabled={isPending} className="inline-flex items-center gap-1 rounded bg-sand-100 px-2 py-1 text-[11px] text-charcoal-600 hover:bg-sand"><X size={11} /> Cancel</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
