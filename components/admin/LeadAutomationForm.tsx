'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Shuffle, MessageCircle, BellRing, ListOrdered, Sun, Plus, Trash2, Palmtree } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import {
  ACTION_EL, LEAD_SOURCES, SEQUENCE_TEMPLATES, SOURCE_EL, TEMPLATE_EL, pickRoundRobin,
  type LeadAutomationSettings, type RouteTarget, type TeamMember, type SeqAction, type SeqStep, type SourceRule,
} from '@/lib/lead-automation-shared';


const TARGET_EL: Record<RouteTarget, string> = { round_robin: 'Round robin (σειρά)', agent: 'Συγκεκριμένος πωλητής', none: 'Κανένας — ανάθεση με το χέρι' };

/**
 * Ρυθμίσεις → Leads & αυτοματισμοί: ποιος παίρνει κάθε νέο lead, το καλωσόρισμα,
 * τι γίνεται όταν μείνει αναπάντητο, η σειρά follow-up και η πρωινή σύνοψη.
 */
export function LeadAutomationForm({ initial, canEdit, team }: { initial: LeadAutomationSettings; canEdit: boolean; team: TeamMember[] }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (f: (x: LeadAutomationSettings) => LeadAutomationSettings) => { setV(f); setMsg(null); };
  const routing = (p: Partial<LeadAutomationSettings['routing']>) => set((x) => ({ ...x, routing: { ...x.routing, ...p } }));
  const save = () => start(async () => {
    const r = await saveOrgSlice('leadAutomation', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); } else setMsg({ ok: false, text: r.error });
  });

  const name = (id: string | null) => team.find((t) => t.id === id)?.name ?? '—';
  const sales = team.filter((t) => t.role === 'sales');
  const poolIds = v.routing.pool.length ? v.routing.pool : sales.map((t) => t.id);
  const last = Object.fromEntries(team.map((t) => [t.id, t.lastAssigned]));
  const away = new Set(team.filter((t) => v.routing.skipOnLeave && t.onLeave).map((t) => t.id));
  const next = pickRoundRobin(poolIds, last, away);

  const ruleFor = (src: string): SourceRule | undefined => v.routing.rules.find((r) => r.source === src);
  const setRule = (src: (typeof LEAD_SOURCES)[number], t: RouteTarget | 'default', agentId?: string | null) => routing({
    rules: t === 'default'
      ? v.routing.rules.filter((r) => r.source !== src)
      : [...v.routing.rules.filter((r) => r.source !== src), { source: src, target: t, agentId: t === 'agent' ? (agentId ?? team[0]?.id ?? null) : null }],
  });
  const steps = v.sequence.steps;
  const setSteps = (s: SeqStep[]) => set((x) => ({ ...x, sequence: { ...x.sequence, steps: s } }));

  const TargetSelect = ({ value, agent, onChange, allowDefault }: { value: RouteTarget | 'default'; agent: string | null; onChange: (t: RouteTarget | 'default', a?: string | null) => void; allowDefault?: boolean }) => (
    <div className="flex flex-wrap gap-2">
      <select className="input w-auto py-1.5 text-sm" disabled={!canEdit} value={value} onChange={(e) => onChange(e.target.value as RouteTarget | 'default', agent)}>
        {allowDefault && <option value="default">Όπως όλα τα άλλα</option>}
        {(Object.keys(TARGET_EL) as RouteTarget[]).map((k) => <option key={k} value={k}>{TARGET_EL[k]}</option>)}
      </select>
      {value === 'agent' && (
        <select className="input w-auto py-1.5 text-sm" disabled={!canEdit} value={agent ?? ''} onChange={(e) => onChange('agent', e.target.value)}>
          {team.map((t) => <option key={t.id} value={t.id}>{t.name}{t.onLeave ? ' (σε άδεια)' : ''}</option>)}
        </select>
      )}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ── Ανάθεση ── */}
      <div className="panel space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2"><Shuffle size={16} /> Ποιος παίρνει κάθε νέο lead</h4>
            <p className="text-xs text-charcoal-600/60">Ισχύει όταν το lead έρχεται χωρίς υπεύθυνο (φόρμες, Meta, WhatsApp, ή όταν δεν διαλέξετε στη «Νέο lead»).</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" disabled={!canEdit} checked={v.routing.enabled} onChange={(e) => routing({ enabled: e.target.checked })} /> Αυτόματη ανάθεση
          </label>
        </div>

        <div className={v.routing.enabled ? 'space-y-4' : 'pointer-events-none space-y-4 opacity-50'}>
          <div className="rounded-lg border border-stone-line">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-line bg-sand-50 px-3 py-2">
              <span className="text-sm font-medium">Όλες οι πηγές</span>
              <TargetSelect value={v.routing.defaultTarget} agent={v.routing.defaultAgent} onChange={(t, a) => routing({ defaultTarget: t as RouteTarget, defaultAgent: t === 'agent' ? (a ?? team[0]?.id ?? null) : null })} />
            </div>
            <ul className="divide-y divide-stone-line">
              {LEAD_SOURCES.map((src) => {
                const r = ruleFor(src);
                return (
                  <li key={src} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                    <span className="text-sm">{SOURCE_EL[src]}</span>
                    <TargetSelect allowDefault value={r ? r.target : 'default'} agent={r?.agentId ?? null} onChange={(t, a) => setRule(src, t, a)} />
                  </li>
                );
              })}
            </ul>
          </div>

          <div>
            <p className="eyebrow mb-1">Ομάδα round robin</p>
            <div className="flex flex-wrap gap-2">
              {team.map((t) => {
                const on = v.routing.pool.includes(t.id);
                return (
                  <button key={t.id} type="button" disabled={!canEdit}
                    onClick={() => routing({ pool: on ? v.routing.pool.filter((x) => x !== t.id) : [...v.routing.pool, t.id] })}
                    className={`badge ${on ? 'badge-forest' : 'badge-neutral'}`}>
                    {on && <Check size={11} className="mr-1" />}{t.name}{t.onLeave && <Palmtree size={11} className="ml-1" />}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-[11px] text-charcoal-600/60">
              {v.routing.pool.length ? '' : 'Κανείς επιλεγμένος = όλοι οι ενεργοί πωλητές. '}
              Παίρνει όποιος πήρε lead πιο παλιά. Επόμενος τώρα: <b>{next ? name(next) : 'κανείς διαθέσιμος'}</b>.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" disabled={!canEdit} checked={v.routing.skipOnLeave} onChange={(e) => routing({ skipOnLeave: e.target.checked })} />
              <span>Παράλειψη όσων έχουν εγκεκριμένη άδεια σήμερα<span className="block text-[11px] text-charcoal-600/60">Αν λείπει ο υπεύθυνος μιας πηγής, πάει στην ομάδα.</span></span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-0.5" disabled={!canEdit} checked={v.routing.returningToPrevious} onChange={(e) => routing({ returningToPrevious: e.target.checked })} />
              <span>Επιστρέφων πελάτης → στον πωλητή που του πούλησε<span className="block text-[11px] text-charcoal-600/60">Ισχύει και με την αυτόματη ανάθεση κλειστή.</span></span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Καλωσόρισμα ── */}
      <div className="panel space-y-3 p-5">
        <div>
          <h4 className="flex items-center gap-2"><MessageCircle size={16} /> Καλωσόρισμα στη γλώσσα του πελάτη</h4>
          <p className="text-xs text-charcoal-600/60">Στέλνεται αμέσως με το πρότυπο «first_contact» στη γλώσσα της επαφής (αν δεν υπάρχει μετάφραση, στα αγγλικά). <Link href="/settings/templates" className="text-forest hover:underline">Πρότυπα & μεταφράσεις →</Link></p>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={v.welcome.enabled} onChange={(e) => set((x) => ({ ...x, welcome: { ...x.welcome, enabled: e.target.checked } }))} /> Ενεργό</label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit || !v.welcome.enabled} checked={v.welcome.whatsapp} onChange={(e) => set((x) => ({ ...x, welcome: { ...x.welcome, whatsapp: e.target.checked } }))} /> WhatsApp</label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit || !v.welcome.enabled} checked={v.welcome.email} onChange={(e) => set((x) => ({ ...x, welcome: { ...x.welcome, email: e.target.checked } }))} /> Email</label>
        </div>
      </div>

      {/* ── Αναπάντητο ── */}
      <div className="panel space-y-3 p-5">
        <div>
          <h4 className="flex items-center gap-2"><BellRing size={16} /> Αναπάντητο lead</h4>
          <p className="text-xs text-charcoal-600/60">Νέο lead χωρίς πρώτη απάντηση (μήνυμα, κλήση ή αλλαγή σταδίου).</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-1 block">Ειδοποίηση μετά από (λεπτά)</span>
            <input className="input" type="number" min={1} max={1440} disabled={!canEdit} value={v.unanswered.minutes}
              onChange={(e) => set((x) => ({ ...x, unanswered: { ...x.unanswered, minutes: Number(e.target.value) } }))} />
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Πάει στον επόμενο μετά από (λεπτά)</span>
            <input className="input" type="number" min={5} max={10080} placeholder="ποτέ" disabled={!canEdit} value={v.unanswered.reassignAfterMinutes ?? ''}
              onChange={(e) => set((x) => ({ ...x, unanswered: { ...x.unanswered, reassignAfterMinutes: e.target.value === '' ? null : Number(e.target.value) } }))} />
            <span className="mt-1 block text-[11px] text-charcoal-600/60">Κενό = δεν αλλάζει υπεύθυνο. Μία φορά ανά lead, στον επόμενο του round robin.</span>
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={v.unanswered.notifyOwner} onChange={(e) => set((x) => ({ ...x, unanswered: { ...x.unanswered, notifyOwner: e.target.checked } }))} /> Στον υπεύθυνο</label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={v.unanswered.notifyManagers} onChange={(e) => set((x) => ({ ...x, unanswered: { ...x.unanswered, notifyManagers: e.target.checked } }))} /> Στους managers</label>
        </div>
      </div>

      {/* ── Follow-up sequence ── */}
      <div className="panel space-y-3 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2"><ListOrdered size={16} /> Follow-up sequence</h4>
            <p className="text-xs text-charcoal-600/60">Για leads που μένουν στο «Νέο» ή «Επικοινωνία». Ώρες από τη στιγμή που ήρθε το lead.</p>
          </div>
          <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={!canEdit} checked={v.sequence.enabled} onChange={(e) => set((x) => ({ ...x, sequence: { ...x.sequence, enabled: e.target.checked } }))} /> Ενεργό</label>
        </div>
        <ol className={`space-y-2 ${v.sequence.enabled ? '' : 'opacity-50'}`}>
          {steps.map((s, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border border-stone-line px-3 py-2 text-sm">
              <span className="figure w-5 text-charcoal-600/60">{i + 1}.</span>
              <span>Μετά από</span>
              <input className="input w-20 py-1" type="number" min={1} max={1440} disabled={!canEdit} value={s.afterHours}
                onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, afterHours: Number(e.target.value) } : x)))} />
              <span>ώρες</span>
              <select className="input w-auto py-1" disabled={!canEdit} value={s.action}
                onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, action: e.target.value as SeqAction, templateKey: e.target.value === 'call_task' ? '' : x.templateKey || 'follow_up' } : x)))}>
                {(Object.keys(ACTION_EL) as SeqAction[]).map((a) => <option key={a} value={a}>{ACTION_EL[a]}</option>)}
              </select>
              {s.action !== 'call_task' && (
                <select className="input w-auto py-1" disabled={!canEdit} value={s.templateKey} onChange={(e) => setSteps(steps.map((x, j) => (j === i ? { ...x, templateKey: e.target.value } : x)))}>
                  {SEQUENCE_TEMPLATES.map((k) => <option key={k} value={k}>{TEMPLATE_EL[k]}</option>)}
                </select>
              )}
              {canEdit && <button type="button" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="ml-auto text-charcoal-600/50 hover:text-signal-danger" aria-label="Αφαίρεση βήματος"><Trash2 size={14} /></button>}
            </li>
          ))}
        </ol>
        {canEdit && steps.length < 12 && (
          <button type="button" className="btn-ghost text-xs" onClick={() => setSteps([...steps, { afterHours: (steps[steps.length - 1]?.afterHours ?? 0) + 24, action: 'whatsapp', templateKey: 'follow_up' }])}><Plus size={13} /> Βήμα</button>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" className="mt-0.5" disabled={!canEdit} checked={v.sequence.stopOnReply} onChange={(e) => set((x) => ({ ...x, sequence: { ...x.sequence, stopOnReply: e.target.checked } }))} />
          <span>Σταματά μόλις απαντήσει ο πελάτης<span className="block text-[11px] text-charcoal-600/60">Εισερχόμενο μήνυμα (WhatsApp, email, φόρμα) μετά τη δημιουργία του lead.</span></span>
        </label>
      </div>

      {/* ── Σύνοψη ── */}
      <div className="panel space-y-3 p-5">
        <div>
          <h4 className="flex items-center gap-2"><Sun size={16} /> Ημερήσια σύνοψη</h4>
          <p className="text-xs text-charcoal-600/60">Κάθε πρωί: νέα leads, αναπάντητα, καθυστερήσεις σταδίου, follow-ups και ξεναγήσεις της μέρας. Κανάλια: Ρυθμίσεις → Ειδοποιήσεις.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={v.digest.enabled} onChange={(e) => set((x) => ({ ...x, digest: { ...x.digest, enabled: e.target.checked } }))} /> Ενεργή</label>
          <label className="flex items-center gap-2">Ώρα
            <select className="input w-auto py-1" disabled={!canEdit} value={v.digest.hour} onChange={(e) => set((x) => ({ ...x, digest: { ...x.digest, hour: Number(e.target.value) } }))}>
              {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2"><input type="checkbox" disabled={!canEdit} checked={v.digest.managers} onChange={(e) => set((x) => ({ ...x, digest: { ...x.digest, managers: e.target.checked } }))} /> Οι managers βλέπουν όλο το γραφείο</label>
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="leadAutomation" />}
          <Link href="/crm/duplicates" className="ml-auto text-sm text-forest hover:underline">Διπλές επαφές →</Link>
        </div>
      )}
    </div>
  );
}
