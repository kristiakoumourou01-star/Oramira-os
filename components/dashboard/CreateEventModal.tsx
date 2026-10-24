'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { X, Video, Sparkles, ChevronDown, Users, Settings2 } from 'lucide-react';
import { createCalendarEvent, updateCalendarEvent, updateRecurringEvent, checkCalendarConflicts, type PlannerEventType, type RecurScope, type CalendarConflict } from '@/app/actions/calendar';
import { getSchedulingSuggestion } from '@/app/actions/scheduling';
import type { CalendarEvent, EventType } from '@/components/dashboard/CalendarStrip';
import { formatWeekdayTime } from '@/lib/format';
import { AlertTriangle } from 'lucide-react';

export interface LeadOption { id: string; name: string; contactId: string | null }
export interface ProjectOption { id: string; name: string }
export interface TeamOption { id: string; name: string; email: string; avatar_url: string | null }

const TYPES: { v: PlannerEventType; label: string }[] = [
  { v: 'meeting', label: 'Meeting' }, { v: 'viewing', label: 'Viewing' }, { v: 'followup', label: 'Follow-up' }, { v: 'task', label: 'Task' }, { v: 'reminder', label: 'Reminder' },
];
const REMINDERS: { label: string; v?: number }[] = [
  { label: 'No reminder' }, { label: '15 min before', v: 15 }, { label: '30 min before', v: 30 }, { label: '1 hour before', v: 60 }, { label: '1 day before', v: 1440 },
];
const COLORS = [
  { v: '#1F4D3A', label: 'Forest' }, { v: '#C8A96B', label: 'Champagne' }, { v: '#6E59C7', label: 'Violet' }, { v: '#3B82C4', label: 'Blue' }, { v: '#8A8560', label: 'Olive' },
];

function toLocalInput(iso: string) { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }

export interface ModalPreset {
  type?: PlannerEventType; startISO?: string; title?: string;
  editId?: string | null; durationMin?: number; priority?: 'low' | 'normal' | 'high'; color?: string | null; notes?: string | null; location?: string | null;
  recurScope?: RecurScope; occurrenceISO?: string;
}

/** Rich create-event modal: team picker, entity links, priority, reminder,
 *  color, Google Meet, and smart slot suggestions. */
export function CreateEventModal({ preset, leads = [], projects = [], team = [], onClose, onCreated }: { preset: ModalPreset; leads?: LeadOption[]; projects?: ProjectOption[]; team?: TeamOption[]; onClose: () => void; onCreated?: (e: CalendarEvent) => void }) {
  const editing = !!preset.editId;
  const [type, setType] = useState<PlannerEventType>(preset.type ?? 'meeting');
  const [title, setTitle] = useState(preset.title ?? '');
  const [selectedTeam, setSelectedTeam] = useState<TeamOption[]>([]);
  const [teamQuery, setTeamQuery] = useState('');
  const [when, setWhen] = useState(preset.startISO ? toLocalInput(preset.startISO) : toLocalInput(new Date(Date.now() + 3600000).toISOString()));
  const [duration, setDuration] = useState(preset.durationMin ?? 45);
  const [withMeet, setWithMeet] = useState(!editing);
  const [location, setLocation] = useState(preset.location ?? '');
  const [note, setNote] = useState(preset.notes ?? '');
  const [leadId, setLeadId] = useState('');
  const [projectId, setProjectId] = useState('');
  const [attendees, setAttendees] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>(preset.priority ?? 'normal');
  const [reminder, setReminder] = useState<number | undefined>(30);
  const [repeat, setRepeat] = useState('');
  const [color, setColor] = useState(preset.color ?? COLORS[0].v);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [showPeople, setShowPeople] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const peopleCount = selectedTeam.length + (attendees.trim() ? attendees.split(',').filter((s) => s.trim()).length : 0);

  useEffect(() => { if (preset.startISO) setWhen(toLocalInput(preset.startISO)); if (preset.type) setType(preset.type); if (preset.title) setTitle(preset.title); }, [preset]);

  // Live conflict detection — warn (never block) when the chosen slot overlaps an
  // existing commitment. Debounced; tasks are all-day-ish and don't hold a slot.
  useEffect(() => {
    if (type === 'task' || !when) { setConflicts([]); return; }
    const startISO = new Date(when).toISOString();
    if (Number.isNaN(Date.parse(startISO))) { setConflicts([]); return; }
    let cancelled = false;
    const t = setTimeout(async () => {
      const c = await checkCalendarConflicts(startISO, duration, preset.editId ?? undefined);
      if (!cancelled) setConflicts(c);
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [when, duration, type, preset.editId]);

  const teamMatches = teamQuery.trim()
    ? team.filter((m) => !selectedTeam.some((s) => s.id === m.id) && (m.name.toLowerCase().includes(teamQuery.toLowerCase()) || m.email.toLowerCase().includes(teamQuery.toLowerCase()))).slice(0, 5)
    : [];

  function suggest() {
    startTransition(async () => {
      const r = await getSchedulingSuggestion({ leadId: leadId || undefined, durationMin: duration });
      setSuggestions(r.slots);
      if (r.slots[0]) setWhen(toLocalInput(r.slots[0]));
    });
  }

  function submit() {
    if (!title.trim() || !when) return;
    const lead = leads.find((l) => l.id === leadId);
    if (editing) {
      const patch = { title: title.trim(), startISO: new Date(when).toISOString(), durationMin: duration, notes: note || null, location: location || null, priority, color };
      startTransition(async () => {
        if (preset.recurScope) await updateRecurringEvent(preset.editId!, preset.recurScope, preset.occurrenceISO ?? patch.startISO, patch);
        else await updateCalendarEvent(preset.editId!, patch);
        onClose();
        router.refresh();
      });
      return;
    }
    const startISO = new Date(when).toISOString();
    const eventAttendees = [
      ...selectedTeam.map((t) => ({ email: t.email, name: t.name, avatar_url: t.avatar_url })),
      ...attendees.split(',').map((s) => s.trim()).filter(Boolean).map((e) => ({ email: e, name: null as string | null, avatar_url: null as string | null })),
    ].filter((a) => a.email);
    setErr(null);
    startTransition(async () => {
      const res = await createCalendarEvent({
        type, title: title.trim(), startISO, durationMin: duration,
        notes: note || undefined, location: location || undefined, withMeet,
        leadId: leadId || undefined, contactId: lead?.contactId ?? undefined, projectId: projectId || undefined,
        priority, reminderMinutes: reminder, color, recurringRule: repeat || undefined,
        attendees: eventAttendees,
      });
      if (res && !res.ok) { setErr(res.error || 'Could not create the event.'); return; }
      // Optimistic insert so the block appears instantly, before the refresh lands.
      onCreated?.({
        id: res?.id ? `ce_${res.id}` : `tmp_${Date.now()}`,
        eventId: res?.id ?? null,
        title: title.trim(), start: startISO,
        type: (type === 'reminder' ? 'task' : type) as EventType,
        durationMin: duration, color, priority, status: 'scheduled',
        attendees: eventAttendees, meetingLink: null,
        href: leadId ? `/crm/leads/${leadId}` : null, recurring: !!repeat, occurrenceISO: startISO,
      });
      onClose();
      router.refresh();
    });
  }

  const Label = ({ children }: { children: React.ReactNode }) => <span className="mb-1 block text-[11px] font-medium text-charcoal-600/60">{children}</span>;
  const SectionTitle = ({ children }: { children: React.ReactNode }) => <p className="text-[10px] font-semibold uppercase tracking-wide text-charcoal-600/40">{children}</p>;
  const Disclosure = ({ open, onToggle, icon: Icon, label, badge }: { open: boolean; onToggle: () => void; icon: any; label: string; badge?: number }) => (
    <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 rounded-lg border border-[#EBE3D3] bg-[#FAF7F0] px-3 py-2 text-left transition-colors hover:bg-[#F5F1E8]">
      <Icon size={14} className="text-forest" />
      <span className="text-sm font-medium text-charcoal">{label}</span>
      {badge ? <span className="figure rounded-full bg-forest/10 px-1.5 text-[10px] text-forest">{badge}</span> : null}
      <ChevronDown size={15} className={`ml-auto text-charcoal-600/40 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );

  return (
    <div className="ws-fade-in fixed inset-0 z-40 flex items-center justify-center bg-charcoal/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div className="ws-pop flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_24px_60px_rgba(31,77,58,0.18)]" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-line px-5 py-3.5">
          <h3 className="text-[17px] font-semibold text-charcoal">{editing ? 'Edit event' : 'New event'}</h3>
          <button onClick={onClose} className="text-charcoal-600/50 hover:text-charcoal"><X size={18} /></button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {/* Basic information */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button key={t.v} onClick={() => setType(t.v)} className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${type === t.v ? 'bg-forest text-white' : 'bg-[#F5F1E8] text-charcoal-600 hover:bg-[#EFE8DA]'}`}>{t.label}</button>
              ))}
            </div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Event title" className="input" autoFocus />
          </div>

          {/* Scheduling */}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><SectionTitle>Scheduling</SectionTitle><button type="button" onClick={suggest} disabled={isPending} className="inline-flex items-center gap-1 text-[11px] text-forest hover:underline"><Sparkles size={11} /> Suggest slot</button></div>
            <div className="grid grid-cols-3 gap-2.5">
              <label className="col-span-2"><Label>Date &amp; time</Label><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="input text-sm" /></label>
              <label><Label>Duration</Label><select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input text-sm">{[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select></label>
            </div>
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => <button key={s} type="button" onClick={() => setWhen(toLocalInput(s))} className="rounded bg-[#F5F1E8] px-2 py-1 text-[11px] text-charcoal-600 hover:bg-[#EFE8DA]">{formatWeekdayTime(new Date(s))}</button>)}
              </div>
            )}
            {conflicts.length > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-signal-warning/30 bg-champagne-50 px-2.5 py-2 text-[11.5px] text-signal-warning">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" strokeWidth={2} />
                <span>
                  Overlaps {conflicts.length === 1 ? '' : `${conflicts.length} events: `}
                  {conflicts.slice(0, 2).map((c, i) => (
                    <span key={i}>{i > 0 ? ', ' : ''}<span className="font-medium">{c.title}</span> at {formatWeekdayTime(new Date(c.startISO))}</span>
                  ))}
                  {conflicts.length > 2 && ` +${conflicts.length - 2} more`}. You can still book it.
                </span>
              </div>
            )}
          </div>

          {/* Integrations (essential toggle) */}
          {!editing && (
            <label className="flex cursor-pointer items-center justify-between rounded-lg bg-[#F5F1E8] px-3 py-2 text-sm text-charcoal">
              <span className="flex items-center gap-2"><Video size={14} className="text-forest" /> Generate Google Meet link</span>
              <input type="checkbox" checked={withMeet} onChange={(e) => setWithMeet(e.target.checked)} className="h-4 w-4 rounded border-[#E8E0D2]" />
            </label>
          )}

          {/* Participants (collapsible) */}
          <Disclosure open={showPeople} onToggle={() => setShowPeople((v) => !v)} icon={Users} label="Participants" badge={peopleCount || undefined} />
          {showPeople && (
            <div className="space-y-2">
              {selectedTeam.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedTeam.map((m) => (
                    <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-forest/8 py-1 pl-1 pr-2 text-xs text-charcoal">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest text-[9px] font-medium text-champagne">{m.name.slice(0, 1).toUpperCase()}</span>
                      {m.name}
                      <button type="button" onClick={() => setSelectedTeam((s) => s.filter((x) => x.id !== m.id))} className="text-charcoal-600/50 hover:text-charcoal">×</button>
                    </span>
                  ))}
                </div>
              )}
              <div className="relative">
                <input value={teamQuery} onChange={(e) => setTeamQuery(e.target.value)} placeholder="Search team members…" className="input text-sm" />
                {teamMatches.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-[#E8E0D2] bg-white shadow-overlay">
                    {teamMatches.map((m) => (
                      <button key={m.id} type="button" onClick={() => { setSelectedTeam((s) => [...s, m]); setTeamQuery(''); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[#F5F1E8]">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest text-[10px] font-medium text-champagne">{m.name.slice(0, 1).toUpperCase()}</span>
                        <span className="text-charcoal">{m.name}</span>
                        {m.email && <span className="ml-auto truncate text-xs text-charcoal-600/50">{m.email}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="External emails (comma-separated)" className="input text-sm" />
            </div>
          )}

          {/* Advanced options (collapsible) */}
          <Disclosure open={showAdvanced} onToggle={() => setShowAdvanced((v) => !v)} icon={Settings2} label="Advanced options" />
          {showAdvanced && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2.5">
                <label><Label>Priority</Label><select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="input text-sm"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
                <label><Label>Reminder</Label><select value={reminder ?? ''} onChange={(e) => setReminder(e.target.value ? Number(e.target.value) : undefined)} className="input text-sm">{REMINDERS.map((r) => <option key={r.label} value={r.v ?? ''}>{r.label}</option>)}</select></label>
                <label><Label>Repeat</Label><select value={repeat} onChange={(e) => setRepeat(e.target.value)} className="input text-sm"><option value="">Does not repeat</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select></label>
                <label><Label>Location</Label><input value={location} onChange={(e) => setLocation(e.target.value)} className="input text-sm" /></label>
                <label><Label>Related lead</Label><select value={leadId} onChange={(e) => setLeadId(e.target.value)} className="input text-sm"><option value="">None</option>{leads.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
                <label><Label>Related property</Label><select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="input text-sm"><option value="">None</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
              </div>
              <div><Label>Colour</Label><div className="flex gap-2">{COLORS.map((c) => <button key={c.v} type="button" onClick={() => setColor(c.v)} title={c.label} className={`h-6 w-6 rounded-full ring-offset-2 ${color === c.v ? 'ring-2 ring-charcoal/40' : ''}`} style={{ background: c.v }} />)}</div></div>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note" className="input min-h-[52px] text-sm" />
            </div>
          )}
        </div>

        {/* Sticky footer */}
        <div className="border-t border-stone-line px-5 py-3.5">
          {err && <p className="mb-2.5 rounded-lg bg-signal-danger/10 px-3 py-2 text-xs text-signal-danger">{err}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-stone-line px-4 py-2 text-sm font-medium text-charcoal-600 hover:bg-[#F5F1E8]">Cancel</button>
            <button onClick={submit} disabled={isPending || !title.trim()} className="btn-primary flex-1">{isPending ? 'Saving…' : editing ? 'Save changes' : 'Create event'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
