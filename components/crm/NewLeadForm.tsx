'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronDown } from 'lucide-react';
import { createLead } from '@/app/actions/leads';
import { AREAS } from '@/lib/areas';
import { Modal, ModalBody, ModalFooter } from '@/components/ui/Modal';
import { useAutoOpen } from '@/lib/use-auto-open';
import { formatCurrency } from '@/lib/format';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { LABEL_CLASS, type LabelColor } from '@/lib/pipeline-shared';
import { parseAmount } from '@/lib/amount';

export interface DealFormCfg { pipelines: { key: string; name: string; stages: { key: string; label: string }[] }[]; labels: { key: string; name: string; color: LabelColor }[] }

/** Στοιχεία deal (όπως το «Add deal» του Pipedrive): τίτλος, αξία, pipeline, στάδιο, labels, αναμ. κλείσιμο. */
function DealFields({ cfg }: { cfg: DealFormCfg }) {
  const [pipe, setPipe] = useState(cfg.pipelines[0]?.key ?? '');
  const stages = cfg.pipelines.find((p) => p.key === pipe)?.stages ?? [];
  const [stage, setStage] = useState(stages[0]?.key ?? '');
  const [labels, setLabels] = useState<string[]>([]);
  const cur = stages.findIndex((x) => x.key === stage);
  return (
    <div className="grid grid-cols-2 gap-3">
      <label className="col-span-2 block"><span className="text-xs text-charcoal-600/70">Τίτλος deal</span><input name="title" placeholder="π.χ. Διαμέρισμα A12" className="input" /></label>
      <label className="block"><span className="text-xs text-charcoal-600/70">Αξία (€)</span><input name="value" inputMode="decimal" placeholder="π.χ. 650.000" className="input" /></label>
      <label className="block"><span className="text-xs text-charcoal-600/70">Αναμενόμενο κλείσιμο</span><input name="expectedClose" type="date" className="input" /></label>
      {cfg.pipelines.length > 1 && (
        <label className="col-span-2 block"><span className="text-xs text-charcoal-600/70">Pipeline</span>
          <select name="pipeline" className="input" value={pipe} onChange={(e) => { setPipe(e.target.value); setStage(cfg.pipelines.find((p) => p.key === e.target.value)?.stages[0]?.key ?? ''); }} data-no-tr>{cfg.pipelines.map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select>
        </label>
      )}
      {cfg.pipelines.length <= 1 && <input type="hidden" name="pipeline" value={pipe} />}
      <div className="col-span-2">
        <span className="text-xs text-charcoal-600/70">Στάδιο: <b className="font-medium text-charcoal">{stages[cur]?.label ?? '—'}</b></span>
        <input type="hidden" name="stageKey" value={stage} />
        <div className="mt-1 flex h-7 overflow-hidden rounded-md">
          {stages.map((st, i) => (
            <button key={st.key} type="button" title={st.label} aria-label={st.label} onClick={() => setStage(st.key)}
              className={`-ml-1 flex-1 first:ml-0 ${i <= cur ? 'bg-forest' : 'bg-stone hover:bg-stone-200'}`}
              style={{ clipPath: 'polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%, 8px 50%)' }} />
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <span className="text-xs text-charcoal-600/70">Labels</span>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {cfg.labels.map((l) => { const on = labels.includes(l.key); return (
            <button key={l.key} type="button" onClick={() => setLabels((xs) => (on ? xs.filter((x) => x !== l.key) : [...xs, l.key]))}
              className={`rounded border px-2 py-0.5 text-xs font-medium ${on ? LABEL_CLASS[l.color] : 'border-dashed border-stone-line text-charcoal-600/60 hover:text-charcoal'}`}>{l.name}</button>
          ); })}
        </div>
        <input type="hidden" name="labels" value={labels.join(',')} />
      </div>
    </div>
  );
}

const BUDGET_MAX = 5_000_000;
const BUDGET_STEP = 25_000;

/** Dual-thumb budget range. Submits budgetMin / budgetMax via hidden inputs;
 *  0 / full-range read as "no limit" by the create action. */
function BudgetRange() {
  const [min, setMin] = useState(0);
  const [max, setMax] = useState(BUDGET_MAX);
  const fmt = (n: number) => formatCurrency(n);
  const pct = (n: number) => (n / BUDGET_MAX) * 100;

  return (
    <div className="col-span-2 rounded-md border border-stone-line px-3 py-2.5">
      <input type="hidden" name="budgetMin" value={min} />
      <input type="hidden" name="budgetMax" value={max === BUDGET_MAX ? '' : max} />
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="text-charcoal-600/70">Budget range</span>
        <span className="figure text-charcoal">{min === 0 ? 'Any' : fmt(min)} – {max >= BUDGET_MAX ? 'Any' : fmt(max)}</span>
      </div>
      <div className="relative h-5">
        <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-stone-200" />
        <div className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-forest" style={{ left: `${pct(min)}%`, right: `${100 - pct(max)}%` }} />
        <input
          type="range" min={0} max={BUDGET_MAX} step={BUDGET_STEP} value={min}
          onChange={(e) => setMin(Math.min(Number(e.target.value), max - BUDGET_STEP))}
          className="range-thumb absolute top-0 h-5 w-full appearance-none bg-transparent"
          aria-label="Budget minimum"
        />
        <input
          type="range" min={0} max={BUDGET_MAX} step={BUDGET_STEP} value={max}
          onChange={(e) => setMax(Math.max(Number(e.target.value), min + BUDGET_STEP))}
          className="range-thumb absolute top-0 h-5 w-full appearance-none bg-transparent"
          aria-label="Budget maximum"
        />
      </div>
    </div>
  );
}

const SOURCES = ['website', 'meta', 'google', 'organic', 'referral', 'whatsapp', 'walk_in', 'other'];
const TIMELINES = ['Immediately', '0-3 months', '3-6 months', '6-12 months', '12+ months', 'Just exploring'];
const BUYER_TYPES = [
  { value: 'russian_cis', label: 'Russian / CIS' },
  { value: 'local_cypriot', label: 'Local Cypriot' },
  { value: 'international', label: 'International' },
  { value: 'other', label: 'Other' },
];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Russian' },
  { value: 'el', label: 'Greek' },
];
const COMM_PREFS = ['whatsapp', 'call', 'email'];

export function NewLeadForm({ projects, agents = [], required = [], pipelines = [], deal }: { projects: { id: string; name: string }[]; agents?: { id: string; full_name: string | null }[]; required?: string[]; pipelines?: { key: string; name: string }[]; deal?: DealFormCfg }) {
  const [open, setOpen] = useAutoOpen('lead');
  const req = (k: string) => required.includes(k);
  const [showMore, setShowMore] = useState(['buyerType', 'language', 'assignedTo', 'timeline', 'message'].some((k) => required.includes(k)));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      try {
      const res: any = await createLead({
        fullName: String(formData.get('fullName')),
        email: String(formData.get('email')),
        phone: String(formData.get('phone') || '') || undefined,
        source: String(formData.get('source')),
        budgetMin: Number(formData.get('budgetMin')) || undefined,
        budgetMax: Number(formData.get('budgetMax')) || undefined,
        preferredProjectId: String(formData.get('projectId') || '') || undefined,
        timelineToBuy: String(formData.get('timeline') || '') || undefined,
        message: String(formData.get('message') || '') || undefined,
        buyerType: String(formData.get('buyerType') || '') || undefined,
        language: String(formData.get('language') || '') || undefined,
        communicationPreference: String(formData.get('commPref') || '') || undefined,
        assignedTo: String(formData.get('assignedTo') || '') || undefined,
        areas: String(formData.get('areas') || '').split(',').map((x) => x.trim()).filter(Boolean),
        pipeline: String(formData.get('pipeline') || '') || undefined,
        title: String(formData.get('title') || '') || undefined,
        value: parseAmount(formData.get('value')) || undefined,
        expectedCloseDate: String(formData.get('expectedClose') || '') || undefined,
        labels: String(formData.get('labels') || '').split(',').filter(Boolean),
        stageKey: String(formData.get('stageKey') || '') || undefined,
      });
      if (res && typeof res === 'object' && 'error' in res && typeof res.error === 'string') { setError(res.error); return; }
      } catch (e) {
        setError(e instanceof Error ? e.message.replace(/^Error:\s*/, '') : 'Δεν αποθηκεύτηκε.');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> {deal ? 'Deal' : 'New lead'}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={deal ? 'Νέο deal' : 'New lead'} size="lg">
      <form action={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        {/* Scrollable body */}
        <ModalBody>
          {deal && <><DealFields cfg={deal} /><p className="mb-3 mt-4 border-t border-stone-line pt-3 text-xs font-semibold uppercase tracking-wide text-charcoal-600/60">Πρόσωπο</p></>}
          {/* Essentials */}
          <div className="grid grid-cols-2 gap-3">
            <input name="fullName" required placeholder="Full name" className="input col-span-2" autoFocus />
            <input name="email" type="email" required placeholder="Email" className="input col-span-2" />
            <PhoneInput name="phone" required={req('phone')} placeholder={req('phone') ? 'Phone *' : 'Phone'} />
            <select name="source" required className="input capitalize">
              {SOURCES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <BudgetRange />
            <input name="areas" list="nl-areas" placeholder="Περιοχές (π.χ. Λεμεσός, Γερμασόγεια)" className="input col-span-2" />
            <datalist id="nl-areas">{AREAS.map((a) => <option key={a.key} value={a.el}>{a.en}</option>)}</datalist>
            <select name="projectId" required={req('project')} className="input col-span-2">
              <option value="">{req('project') ? 'Project… *' : 'No specific project'}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          {/* More details (kept in the DOM so FormData still captures them) */}
          <button type="button" onClick={() => setShowMore((v) => !v)} className="mt-3 flex w-full items-center gap-2 rounded-lg border border-[#EBE3D3] bg-[#FAF7F0] px-3 py-2 text-left text-sm font-medium text-charcoal transition-colors hover:bg-[#F5F1E8]">
            Qualification &amp; assignment
            <ChevronDown size={15} className={`ml-auto text-charcoal-600/40 transition-transform ${showMore ? 'rotate-180' : ''}`} />
          </button>
          <div className={`mt-3 grid grid-cols-2 gap-3 ${showMore ? '' : 'hidden'}`}>
            <select name="buyerType" required={req('buyerType')} className="input" defaultValue="">
              <option value="">Buyer type…{req('buyerType') ? ' *' : ''}</option>
              {BUYER_TYPES.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
            <select name="language" required={req('language')} className="input" defaultValue="">
              <option value="">Language…{req('language') ? ' *' : ''}</option>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <select name="commPref" className="input col-span-2 capitalize" defaultValue="">
              <option value="">Communication preference…</option>
              {COMM_PREFS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {!deal && pipelines.length > 1 && (
              <select name="pipeline" className="input col-span-2" defaultValue="">
                <option value="">Pipeline: {pipelines[0].name}</option>
                {pipelines.slice(1).map((p) => <option key={p.key} value={p.key}>Pipeline: {p.name}</option>)}
              </select>
            )}
            <select name="assignedTo" required={req('assignedTo')} className="input col-span-2" defaultValue="">
              <option value="">Assigned agent — unassigned (optional)</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.full_name ?? 'Agent'}</option>)}
            </select>
            <select name="timeline" required={req('timeline')} defaultValue="" className="input col-span-2">
              <option value="">Timeline to buy…{req('timeline') ? ' *' : ''}</option>
              {TIMELINES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <textarea name="message" required={req('message')} placeholder={req('message') ? 'Notes / inquiry message *' : 'Notes / inquiry message'} className="input col-span-2 min-h-[64px]" />
          </div>
          {error && <p className="mt-3 rounded-md bg-signal-danger/10 px-3 py-2 text-sm text-signal-danger">{error}</p>}
        </ModalBody>

        <ModalFooter>
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isPending} className="btn-primary flex-1">{isPending ? 'Creating…' : deal ? 'Αποθήκευση deal' : 'Create lead'}</button>
        </ModalFooter>
      </form>
      </Modal>
    </>
  );
}
