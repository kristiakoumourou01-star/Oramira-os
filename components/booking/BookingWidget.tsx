'use client';

import { useState } from 'react';
import { CalendarClock, Check, ChevronLeft, MapPin, Clock, Zap, Home, Video } from 'lucide-react';
import type { DaySlots } from '@/lib/availability';
import { formatTime, formatWeekdayDate } from '@/lib/format';
import { PhoneInput } from '@/components/ui/PhoneInput';

interface Agent { id: string; name: string | null; avatarUrl: string | null }
export interface ConsentWording { consent: string; marketing: string; required: boolean; marketingDefault: boolean }

/**
 * Public booking widget — the customer-facing surface. Two taps: pick a slot,
 * enter contact details, done. Premium Oramira identity (forest/champagne/ivory),
 * fully self-contained so it renders on the auth-free /book route.
 */
export function BookingWidget({ agent, days, totalSlots, project, consentWording, fields = { shown: ['name', 'phone', 'email', 'message'], required: [] } }: { agent: Agent; days: DaySlots[]; totalSlots: number; project: { id: string; name: string } | null; consentWording?: ConsentWording; fields?: { shown: string[]; required: string[] } }) {
  const [activeDay, setActiveDay] = useState(0);
  const [slot, setSlot] = useState<string | null>(null);
  const [meetingType, setMeetingType] = useState<'in_person' | 'video'>('in_person');
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [status, setStatus] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [marketing, setMarketing] = useState(!!consentWording?.marketingDefault);
  const soonest = days[0]?.slots[0] ?? null;

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });
  const initials = (agent.name ?? 'Oramira').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();

  async function confirm() {
    if (!slot || (!form.phone && !form.email)) { setError('Add a phone or email so we can confirm.'); return; }
    const miss = fields.required.filter((k) => !String((form as any)[k] ?? '').trim());
    if (miss.length) { setError(`Please fill in your ${miss.join(', ')}.`); return; }
    if (consentWording?.required && !consent) { setError('Please tick the consent box to continue.'); return; }
    setStatus('saving'); setError(null);
    try {
      const res = await fetch('/api/public/book', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, slotISO: slot, durationMin: 45, projectId: project?.id, meetingType, ...form, consent, marketing, lang: 'en' }),
      });
      const out = await res.json();
      if (!res.ok) { setError(out?.error ?? 'Could not book that slot.'); setStatus('error'); return; }
      setStatus('done');
    } catch { setError('Network error — please try again.'); setStatus('error'); }
  }

  if (status === 'done') {
    return (
      <Shell agent={agent} initials={initials}>
        <div className="flex flex-col items-center py-6 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-forest text-white"><Check size={26} strokeWidth={2.2} /></div>
          <h2 className="font-display text-2xl text-forest">You&apos;re booked</h2>
          <p className="mt-2 max-w-xs text-sm text-charcoal-600/80">Viewing with {agent.name ?? 'your agent'}{project ? ` at ${project.name}` : ''} on <span className="font-medium text-charcoal">{formatWeekdayDate(slot)}, {formatTime(slot)}</span>. A confirmation is on its way.</p>
        </div>
      </Shell>
    );
  }

  const day = days[activeDay];

  return (
    <Shell agent={agent} initials={initials}>
      <div className="mb-4 flex items-center gap-2 text-[13px] text-charcoal-600/70">
        <CalendarClock size={15} className="text-olive" strokeWidth={1.8} /> Book a viewing{project ? <> · <span className="font-medium text-charcoal">{project.name}</span></> : null}
        <span className="ml-auto flex items-center gap-1 text-xs text-charcoal-600/50"><Clock size={12} /> 45 min</span>
      </div>

      {days.length === 0 ? (
        <p className="py-10 text-center text-sm text-charcoal-600/70">No availability in the next few weeks. Please reach out directly.</p>
      ) : !slot ? (
        <>
          {/* Fastest available — zero-decision quick pick for the ready buyer. */}
          {soonest && (
            <button onClick={() => setSlot(soonest)} className="mb-3 flex w-full items-center gap-2.5 rounded-xl border border-forest/20 bg-forest/[0.05] px-3 py-2.5 text-left transition-colors hover:bg-forest/[0.09]">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-forest text-white"><Zap size={15} strokeWidth={2} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-charcoal">Fastest available</span>
                <span className="block text-[11px] text-charcoal-600/60">{formatWeekdayDate(soonest)} · {formatTime(soonest)}</span>
              </span>
              <span className="figure shrink-0 rounded-md bg-forest px-2 py-1 text-[11px] font-medium text-white">Book</span>
            </button>
          )}
          {/* Day selector */}
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
            {days.map((d, i) => (
              <button key={d.date} onClick={() => setActiveDay(i)}
                className={`shrink-0 rounded-xl px-3 py-2 text-center transition-colors ${i === activeDay ? 'bg-forest text-white' : 'bg-[#F5F1E8] text-charcoal-600 hover:bg-[#EFE8DA]'}`}>
                <span className="block text-[10px] font-semibold uppercase tracking-wide opacity-70">{formatWeekdayDate(d.slots[0]).split(',')[0]}</span>
                <span className="figure block text-sm">{formatWeekdayDate(d.slots[0]).split(', ')[1]}</span>
              </button>
            ))}
          </div>
          {/* Slot grid */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {day.slots.map((s) => (
              <button key={s} onClick={() => setSlot(s)} className="figure rounded-lg border border-stone-line py-2 text-sm text-charcoal transition-colors hover:border-forest hover:bg-forest/5">
                {formatTime(s)}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[11px] text-charcoal-600/45">{totalSlots} times available</p>
        </>
      ) : (
        <>
          {/* Details */}
          <button onClick={() => setSlot(null)} className="mb-3 inline-flex items-center gap-1 text-xs text-forest hover:underline"><ChevronLeft size={13} /> Change time</button>
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-forest/[0.06] px-3 py-2.5 text-sm">
            <CalendarClock size={16} className="text-forest" strokeWidth={1.9} />
            <span className="font-medium text-charcoal">{formatWeekdayDate(slot)}</span>
            <span className="figure ml-auto rounded-md bg-forest px-2 py-0.5 text-xs text-white">{formatTime(slot)}</span>
          </div>
          {/* Meeting type — in-person viewing vs video call. */}
          <div className="mb-3 grid grid-cols-2 gap-2">
            {([['in_person', Home, 'In person'], ['video', Video, 'Video call']] as const).map(([v, Icon, label]) => (
              <button key={v} onClick={() => setMeetingType(v)} className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-[13px] font-medium transition-colors ${meetingType === v ? 'border-forest bg-forest/[0.07] text-forest' : 'border-stone-line text-charcoal-600 hover:bg-[#F5F1E8]'}`}>
                <Icon size={14} strokeWidth={1.9} /> {label}
              </button>
            ))}
          </div>
          <div className="space-y-2.5">
            <input value={form.name} onChange={set('name')} placeholder="Your name" className="input" autoFocus />
            <div className="grid grid-cols-2 gap-2.5">
              <PhoneInput value={form.phone} onChange={(v) => setForm((f: any) => ({ ...f, phone: v }))} placeholder="Phone (WhatsApp)" />
              <input value={form.email} onChange={set('email')} type="email" placeholder="Email" className="input" />
            </div>
            {fields.shown.includes('message') && <textarea value={form.message} onChange={set('message')} placeholder={fields.required.includes('message') ? 'Anything we should know? *' : 'Anything we should know? (optional)'} className="input min-h-[64px]" />}
            {consentWording && (
              <div className="space-y-1.5 text-[12px] leading-snug text-charcoal-600/80">
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>{consentWording.consent}{consentWording.required ? ' *' : ''}</span></label>
                <label className="flex items-start gap-2"><input type="checkbox" className="mt-0.5" checked={marketing} onChange={(e) => setMarketing(e.target.checked)} /><span>{consentWording.marketing}</span></label>
              </div>
            )}
            {error && <p className="text-sm text-signal-danger">{error}</p>}
            <button onClick={confirm} disabled={status === 'saving'} className="btn-primary w-full">
              {status === 'saving' ? 'Booking…' : 'Confirm viewing'}
            </button>
            <p className="text-center text-[11px] text-charcoal-600/45">You&apos;ll get a WhatsApp & email confirmation.</p>
          </div>
        </>
      )}
    </Shell>
  );
}

function Shell({ agent, initials, children }: { agent: Agent; initials: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center gap-3 px-1">
          <span className="font-display text-lg text-forest">Oramira</span>
          <span className="text-charcoal-600/30">·</span>
          <span className="flex items-center gap-1.5 text-sm text-charcoal-600/70"><MapPin size={13} className="text-olive" /> Cyprus</span>
        </div>
        <div className="panel p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-3 border-b border-stone-line pb-4">
            {agent.avatarUrl
              ? <img src={agent.avatarUrl} alt="" className="h-11 w-11 rounded-full object-cover" />
              : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-forest/10 text-sm font-semibold text-forest">{initials}</span>}
            <div>
              <p className="text-[15px] font-semibold text-charcoal">{agent.name ?? 'Oramira'}</p>
              <p className="text-xs text-charcoal-600/60">Property consultant</p>
            </div>
          </div>
          {children}
        </div>
        <p className="mt-4 text-center text-[11px] text-charcoal-600/40">Powered by Oramira OS</p>
      </div>
    </div>
  );
}
