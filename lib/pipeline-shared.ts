/**
 * Pipelines (βήμα 13) — client-safe.
 *
 * Κάθε lead έχει μία από τις σταθερές καταστάσεις του συστήματος (new,
 * contacted, …, won). Ένα pipeline είναι μια «διαδρομή» πάνω σε αυτές: ποιες
 * χρησιμοποιεί, με ποια ονόματα, με τι πιθανότητα κλεισίματος και πόσες μέρες
 * το πολύ μένει ένα lead σε κάθε στάδιο. Έτσι υπάρχουν πολλά pipelines (π.χ.
 * νέα έργα, μεταπωλήσεις, επενδυτές) χωρίς να αλλάζει τίποτα στους
 * αυτοματισμούς, στο scoring ή στις αναφορές που βασίζονται στις καταστάσεις.
 */

/** Working statuses in their natural order (won = the goal). */
export const FLOW = ['new', 'contacted', 'engaged', 'qualified', 'waiting', 'viewing', 'offer', 'negotiating', 'reserved', 'won'] as const;
export type FlowStatus = (typeof FLOW)[number];
export const CLOSED = ['lost', 'nurture', 'no_response', 'retargeting', 'reactivation'] as const;

export const STATUS_EL: Record<string, string> = {
  new: 'Νέο', contacted: 'Επικοινωνία', engaged: 'Ενδιαφέρον', qualified: 'Κατάλληλο', waiting: 'Αναμονή', viewing: 'Προβολή',
  offer: 'Προσφορά', negotiating: 'Διαπραγμάτευση', reserved: 'Κράτηση', won: 'Κλείσιμο (Won)',
  lost: 'Χάθηκε', nurture: 'Για αργότερα', no_response: 'Χωρίς απάντηση', retargeting: 'Retargeting', reactivation: 'Επανενεργοποίηση',
};

/**
 * Ένα στάδιο του pipeline. `key` = δικό του κλειδί (μπορείτε να έχετε όσα στάδια
 * θέλετε)· `status` = τι «σημαίνει» για το σύστημα (αυτοματισμοί, αναφορές,
 * προμήθειες). Πολλά στάδια μπορούν να σημαίνουν την ίδια κατάσταση.
 */
export interface StageDef { key: string; status: FlowStatus; label: string; probability: number; maxDays: number | null; /** Όνομα στα αγγλικά (προαιρετικό). */ en?: string }
export interface PipelineDef { key: string; name: string; stages: StageDef[]; en?: string }
/** Αποτέλεσμα κλεισίματος (Lost, Δεν ενδιαφέρεται…). `quick` = κουμπί με ένα κλικ στην καρτέλα του lead. */
export interface LostReason { key: string; label: string; status: 'lost' | 'nurture' | 'no_response'; quick?: boolean; en?: string }
export type CommissionMode = 'off' | 'prepare' | 'auto';
export interface CommissionSettings {
  /** off = τίποτα · prepare = ειδοποίηση + έτοιμο τιμολόγιο για έλεγχο · auto = εκδίδεται αμέσως */
  mode: CommissionMode;
  /** Όταν η μονάδα δεν έχει δικό της ποσοστό (σελίδα μονάδας → Υπολογισμός προμήθειας). */
  defaultPct: number;
  /** null = ο προεπιλεγμένος ΦΠΑ των τιμολογίων. */
  vatRate: number | null;
  /** Ποιος πληρώνει την προμήθεια. */
  billTo: 'buyer' | 'fixed';
  fixed: { name: string; vatNo: string; address: string; email: string };
}
export interface PipelineSettings {
  pipelines: PipelineDef[];
  /** Key of the pipeline new leads go to. */
  defaultKey: string;
  sources: string[];
  lostReasons: LostReason[];
  commission: CommissionSettings;
  /** Labels των deals (όπως Pipedrive: Hot / Warm / Cold). */
  dealLabels: DealLabel[];
}
export type LabelColor = 'red' | 'yellow' | 'green' | 'blue' | 'purple' | 'gray';
export interface DealLabel { key: string; name: string; color: LabelColor }
export const LABEL_COLORS: LabelColor[] = ['red', 'yellow', 'green', 'blue', 'purple', 'gray'];
export const LABEL_CLASS: Record<LabelColor, string> = {
  red: 'bg-rose-100 text-rose-700 border-rose-200', yellow: 'bg-amber-100 text-amber-800 border-amber-200', green: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  blue: 'bg-sky-100 text-sky-700 border-sky-200', purple: 'bg-violet-100 text-violet-700 border-violet-200', gray: 'bg-stone text-charcoal-600 border-stone-line',
};

const S = (status: FlowStatus, label: string, probability: number, maxDays: number | null): StageDef => ({ key: status, status, label, probability, maxDays });
export const DEFAULT_PIPELINE_SETTINGS: PipelineSettings = {
  pipelines: [
    { key: 'sales', name: 'Πωλήσεις νέων έργων', stages: [
      S('new', 'Νέο', 5, 1), S('contacted', 'Επικοινωνία', 10, 3), S('qualified', 'Κατάλληλο', 25, 7), S('viewing', 'Προβολή', 40, 14),
      S('offer', 'Προσφορά', 60, 7), S('negotiating', 'Διαπραγμάτευση', 75, 14), S('reserved', 'Κράτηση', 90, 30), S('won', 'Κλείσιμο', 100, null),
    ] },
    { key: 'resale', name: 'Μεταπωλήσεις', stages: [
      S('new', 'Νέο', 5, 1), S('contacted', 'Επικοινωνία', 15, 3), S('viewing', 'Προβολή', 40, 10), S('offer', 'Προσφορά', 65, 7),
      S('reserved', 'Προκαταβολή', 90, 21), S('won', 'Κλείσιμο', 100, null),
    ] },
    { key: 'investors', name: 'Επενδυτές', stages: [
      S('new', 'Νέο', 5, 2), S('contacted', 'Πρώτη συζήτηση', 15, 7), S('qualified', 'Due diligence', 35, 21), S('offer', 'Πρόταση', 60, 14),
      S('negotiating', 'Όροι', 80, 21), S('won', 'Συμφωνία', 100, null),
    ] },
  ],
  defaultKey: 'sales',
  sources: ['Website', 'Referral', 'Portal', 'Walk-in', 'Campaign', 'Social'],
  lostReasons: [
    { key: 'lost', label: 'Lost', status: 'lost', quick: true },
    { key: 'not_interested', label: 'Not interested', status: 'lost', quick: true },
    { key: 'bought_elsewhere', label: 'Αγόρασε αλλού', status: 'lost' },
    { key: 'price', label: 'Τιμή / budget', status: 'lost' },
    { key: 'no_match', label: 'Δεν βρέθηκε κατάλληλο ακίνητο', status: 'lost' },
    { key: 'financing', label: 'Δεν πήρε δάνειο / χρηματοδότηση', status: 'lost' },
    { key: 'location', label: 'Τοποθεσία', status: 'lost' },
    { key: 'duplicate', label: 'Διπλή εγγραφή / λάθος στοιχεία', status: 'lost' },
    { key: 'later', label: 'Όχι τώρα — αργότερα', status: 'nurture', quick: true },
    { key: 'unreachable', label: 'Δεν απαντά', status: 'no_response', quick: true },
  ],
  commission: { mode: 'prepare', defaultPct: 3, vatRate: null, billTo: 'buyer', fixed: { name: '', vatNo: '', address: '', email: '' } },
  dealLabels: [{ key: 'hot', name: 'Hot', color: 'red' }, { key: 'warm', name: 'Warm', color: 'yellow' }, { key: 'cold', name: 'Cold', color: 'blue' }],
};

const KEY_RE = /^[a-z0-9_]{1,30}$/;
export function slugKey(name: string, taken: string[]): string {
  const gr: Record<string, string> = { α: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', ζ: 'z', η: 'i', θ: 'th', ι: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x', ο: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', φ: 'f', χ: 'ch', ψ: 'ps', ω: 'o' };
  const base = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split('').map((c) => gr[c] ?? c).join('').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 24) || 'p';
  let k = base; let n = 2;
  while (taken.includes(k)) k = `${base}_${n++}`;
  return k;
}

/** Validate the slice. Also upgrades the old shape ({ stages:[{name,probability}] }). */
export function mergePipelines(x: any): PipelineSettings {
  const v = x && typeof x === 'object' ? x : {};
  const s = (t: any, n = 60) => (typeof t === 'string' ? t.trim().slice(0, n) : '');
  const num = (n: any, lo: number, hi: number, fb: number) => (Number.isFinite(Number(n)) && n !== '' && n !== null ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : fb);
  const pipelines: PipelineDef[] = [];
  for (const p of Array.isArray(v.pipelines) ? v.pipelines : DEFAULT_PIPELINE_SETTINGS.pipelines) {
    const name = s(p?.name); if (!name) continue;
    const key = typeof p?.key === 'string' && KEY_RE.test(p.key) && !pipelines.some((q) => q.key === p.key) ? p.key : slugKey(name, pipelines.map((q) => q.key));
    const stages: StageDef[] = [];
    for (const st of Array.isArray(p?.stages) ? p.stages : []) {
      if (!(FLOW as readonly string[]).includes(st?.status)) continue;
      if (st.status === 'won' && stages.some((y) => y.status === 'won')) continue; // ένα μόνο «κλείσιμο»
      const label = s(st?.label, 40) || STATUS_EL[st.status];
      const taken = stages.map((y) => y.key);
      const sk = typeof st?.key === 'string' && KEY_RE.test(st.key) && !taken.includes(st.key) ? st.key
        : !taken.includes(st.status) ? st.status : slugKey(label, taken);
      const md = st?.maxDays === null || st?.maxDays === '' || st?.maxDays === undefined ? null : num(st.maxDays, 1, 365, 7);
      const sen = s(st?.en, 40);
      stages.push({ key: sk, status: st.status, label, probability: num(st?.probability, 0, 100, 0), maxDays: st.status === 'won' ? null : md, ...(sen ? { en: sen } : {}) });
      if (stages.length >= 20) break;
    }
    // Η σειρά είναι αυτή που ορίσατε· το «κλείσιμο» πάντα τελευταίο, και ένα
    // στάδιο «Νέο» πρέπει να υπάρχει για τα leads που μόλις ήρθαν.
    const wonAt = stages.findIndex((y) => y.status === 'won');
    const won = wonAt >= 0 ? stages.splice(wonAt, 1)[0] : { key: 'won', status: 'won' as const, label: STATUS_EL.won, probability: 100, maxDays: null };
    stages.push(won);
    if (!stages.some((y) => y.status === 'new')) stages.unshift({ key: stages.some((y) => y.key === 'new') ? slugKey('new', stages.map((y) => y.key)) : 'new', status: 'new', label: STATUS_EL.new, probability: 5, maxDays: 1 });
    const pen = s(p?.en);
    pipelines.push({ key, name, stages, ...(pen ? { en: pen } : {}) });
    if (pipelines.length >= 12) break;
  }
  if (!pipelines.length) pipelines.push(...DEFAULT_PIPELINE_SETTINGS.pipelines);
  const lost: LostReason[] = [];
  const rawLost: any[] = Array.isArray(v.lostReasons) ? v.lostReasons : DEFAULT_PIPELINE_SETTINGS.lostReasons;
  // Παλιές ρυθμίσεις χωρίς «κουμπιά»: βάζουμε Lost / Not interested / Αργότερα / Δεν απαντά.
  const legacy = !rawLost.some((r) => typeof r?.quick === 'boolean');
  if (legacy && !rawLost.some((r) => r?.key === 'lost')) rawLost.unshift({ key: 'lost', label: 'Lost', status: 'lost', quick: true });
  for (const r of rawLost) {
    const label = s(r?.label, 80); if (!label) continue;
    const key = typeof r?.key === 'string' && KEY_RE.test(r.key) && !lost.some((q) => q.key === r.key) ? r.key : slugKey(label, lost.map((q) => q.key));
    const quick = legacy ? ['lost', 'not_interested', 'later', 'unreachable'].includes(key) : r?.quick === true;
    const len = s(r?.en, 80);
    lost.push({ key, label, status: (['lost', 'nurture', 'no_response'] as const).includes(r?.status) ? r.status : 'lost', quick, ...(len ? { en: len } : {}) });
    if (lost.length >= 40) break;
  }
  const c = v.commission ?? {};
  const vat = Number(c.vatRate);
  return {
    pipelines,
    defaultKey: pipelines.some((p) => p.key === v.defaultKey) ? v.defaultKey : pipelines[0].key,
    sources: (Array.isArray(v.sources) ? v.sources : DEFAULT_PIPELINE_SETTINGS.sources).map((x: any) => s(x, 40)).filter(Boolean).slice(0, 40),
    lostReasons: lost.length ? lost : DEFAULT_PIPELINE_SETTINGS.lostReasons,
    commission: {
      mode: (['off', 'prepare', 'auto'] as const).includes(c.mode) ? c.mode : 'prepare',
      defaultPct: Number.isFinite(Number(c.defaultPct)) && Number(c.defaultPct) >= 0 && Number(c.defaultPct) <= 50 ? Math.round(Number(c.defaultPct) * 100) / 100 : 3,
      vatRate: c.vatRate === null || c.vatRate === '' || c.vatRate === undefined || !Number.isFinite(vat) ? null : Math.min(100, Math.max(0, vat)),
      billTo: c.billTo === 'fixed' ? 'fixed' : 'buyer',
      fixed: { name: s(c.fixed?.name, 200), vatNo: s(c.fixed?.vatNo, 40), address: s(c.fixed?.address, 400), email: s(c.fixed?.email, 200) },
    },
    dealLabels: (() => {
      const out: DealLabel[] = [];
      for (const l of Array.isArray(v.dealLabels) ? v.dealLabels : DEFAULT_PIPELINE_SETTINGS.dealLabels) {
        const name = s(l?.name, 30); if (!name) continue;
        const key = typeof l?.key === 'string' && KEY_RE.test(l.key) && !out.some((q) => q.key === l.key) ? l.key : slugKey(name, out.map((q) => q.key));
        out.push({ key, name, color: LABEL_COLORS.includes(l?.color) ? l.color : 'gray' });
        if (out.length >= 20) break;
      }
      return out;
    })(),
  };
}

/* --------------------------------------------------------------- reads -- */

export function pipelineOf(cfg: PipelineSettings, key: string | null | undefined): PipelineDef {
  return cfg.pipelines.find((p) => p.key === key) ?? cfg.pipelines.find((p) => p.key === cfg.defaultKey) ?? cfg.pipelines[0];
}

/**
 * The pipeline stage a status shows as. A status the pipeline doesn't use
 * (e.g. «engaged» in a pipeline without it) shows as the last stage before it.
 */
export function stageIndex(p: PipelineDef, status: string, stageKey?: string | null): number {
  // Το δικό του στάδιο, αν ταιριάζει με την κατάσταση του lead.
  if (stageKey) {
    const byKey = p.stages.findIndex((s) => s.key === stageKey);
    if (byKey >= 0 && p.stages[byKey].status === status) return byKey;
  }
  const exact = p.stages.findIndex((s) => s.status === status);
  if (exact >= 0) return exact;
  const pos = FLOW.indexOf(status as FlowStatus);
  if (pos < 0) return -1; // closed statuses
  let idx = 0;
  p.stages.forEach((s, i) => { if (FLOW.indexOf(s.status) <= pos) idx = i; });
  return idx;
}

/** Το στάδιο ενός lead (ή null για κλειστά). */
export function stageOf(p: PipelineDef, status: string, stageKey?: string | null): StageDef | null {
  const i = stageIndex(p, status, stageKey);
  return i >= 0 ? p.stages[i] : null;
}

export function daysSince(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / 86400000)) : null;
}

/** Days over the stage's limit (0 = on time, null = no limit / not applicable). */
export function lateBy(p: PipelineDef, status: string, enteredAt: string | null | undefined, now = Date.now(), stageKey?: string | null): number | null {
  const i = stageIndex(p, status, stageKey);
  if (i < 0) return null;
  const st = p.stages[i];
  if (!st.maxDays || st.status === 'won') return null;
  const d = daysSince(enteredAt, now);
  if (d === null) return null;
  return Math.max(0, d - st.maxDays);
}

/** Weighted value of a lead (budget × stage probability) for forecasts. */
export function weightedValue(p: PipelineDef, status: string, budget: number | null, stageKey?: string | null): number {
  const i = stageIndex(p, status, stageKey);
  if (i < 0 || !budget) return 0;
  return Math.round(budget * (p.stages[i].probability / 100));
}

export const lostReasonLabel = (cfg: PipelineSettings, key: string | null | undefined) => (key ? cfg.lostReasons.find((r) => r.key === key)?.label ?? key : null);

/* ---------------------------------------------------------- commission -- */

export interface CommissionDraft {
  leadId: string;
  contactId: string | null;
  customer: { name: string; email: string; address: string; vatNo: string };
  projectId: string | null;
  unitId: string | null;
  description: string;
  base: number;
  pct: number;
  net: number;
  vatRate: number;
}

export function commissionNet(base: number, pct: number): number {
  return Math.round(base * pct) / 100;
}

/** Οι ενότητες «κλεισμένων» στο Lead Management: ένα ανά αποτέλεσμα, και ένα για όσα δεν έχουν λόγο. */
export const CLOSED_STATUS_EL: Record<string, string> = { lost: 'Lost', nurture: 'Για αργότερα', no_response: 'Χωρίς απάντηση', retargeting: 'Retargeting', reactivation: 'Επανενεργοποίηση' };
export function closedBucket(lostReasons: LostReason[], status: string, reasonKey: string | null | undefined): { key: string; label: string; status: string } | null {
  if (!(CLOSED as readonly string[]).includes(status)) return null;
  const r = reasonKey ? lostReasons.find((x) => x.key === reasonKey && x.status === status) : null;
  return r ? { key: `closed:${r.key}`, label: r.label, status } : { key: `closed:${status}`, label: CLOSED_STATUS_EL[status] ?? status, status };
}
