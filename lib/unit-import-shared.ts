/**
 * Εισαγωγή μονάδων από Excel / CSV (βήμα 11) — client-safe.
 *
 * Ροή: ο browser διαβάζει το αρχείο (lib/xlsx-read), αντιστοιχίζει στήλες σε
 * πεδία μονάδας (αυτόματα από την επικεφαλίδα, διορθώνεται με το χέρι),
 * μετατρέπει τιμές ("250.000 €", "Ναι", "Πωλημένη") και δείχνει προεπισκόπηση με
 * τα λάθη ανά γραμμή. Ο server (app/actions/unit-import) ξαναελέγχει και γράφει,
 * κρατώντας ό,τι χρειάζεται για αναίρεση.
 */
import type { Cell } from '@/lib/xlsx-read';
import { cleanValues, typeKeyOf, type FieldValue, type UnitField, type UnitFormsSettings } from '@/lib/unit-forms-shared';

export const UNIT_STATUSES = ['available', 'reserved', 'sold', 'handed_over', 'blocked'] as const;
export type UnitStatus = (typeof UNIT_STATUSES)[number];
export const STATUS_LABEL: Record<UnitStatus, string> = {
  available: 'Διαθέσιμη', reserved: 'Κρατημένη', sold: 'Πωλημένη', handed_over: 'Παραδόθηκε', blocked: 'Εκτός πώλησης',
};

export type BaseKey =
  | 'unit_number' | 'building' | 'floor' | 'type' | 'status' | 'price' | 'sqm' | 'internal_sqm'
  | 'covered_veranda_sqm' | 'uncovered_veranda_sqm' | 'storage_sqm' | 'plot_size_sqm' | 'garden_sqm'
  | 'bedrooms' | 'bathrooms' | 'parking_spaces' | 'has_pool' | 'commission_pct' | 'description';

type Kind = 'text' | 'int' | 'num' | 'bool' | 'status' | 'type' | 'cf';
export interface ImportTarget { key: string; el: string; kind: Kind; hint: string; aliases: string[]; field?: UnitField }

const B = (key: BaseKey, el: string, kind: Kind, hint: string, aliases: string[]): ImportTarget => ({ key, el, kind, hint, aliases });

const BASE: ImportTarget[] = [
  B('unit_number', 'Αριθμός μονάδας', 'text', 'Υποχρεωτικό. Μοναδικό μέσα στο έργο (π.χ. A101). Αν υπάρχει ήδη, η μονάδα ενημερώνεται.', ['unit', 'unit no', 'unit number', 'unit #', 'no', 'αριθμος', 'αρ', 'αρ μοναδας', 'μοναδα', 'κωδικος', 'κωδικος μοναδας', 'διαμερισμα', 'apartment', 'apt', 'ref', 'reference']),
  B('building', 'Κτίριο', 'text', 'Όνομα κτιρίου/block. Αν δεν υπάρχει, δημιουργείται.', ['building', 'block', 'πολυκατοικια', 'κτηριο', 'μπλοκ', 'τομεας']),
  B('floor', 'Όροφος', 'int', 'Αριθμός. 0 ή «Ισόγειο» = ισόγειο, -1 = υπόγειο.', ['floor', 'level', 'οροφος', 'επιπεδο']),
  B('type', 'Τύπος', 'type', 'Ένας από τους τύπους στις Ρυθμίσεις → Φόρμες μονάδων (π.χ. Διαμέρισμα).', ['type', 'unit type', 'τυπος', 'κατηγορια', 'ειδος']),
  B('status', 'Κατάσταση', 'status', 'Διαθέσιμη, Κρατημένη, Πωλημένη, Παραδόθηκε ή Εκτός πώλησης. Κενό = Διαθέσιμη.', ['status', 'availability', 'κατασταση', 'διαθεσιμοτητα']),
  B('price', 'Τιμή (€)', 'num', 'Αριθμός, π.χ. 250000 ή 250.000.', ['price', 'price eur', 'asking price', 'τιμη', 'τιμη πωλησης', 'αξια']),
  B('sqm', 'Συνολικό εμβαδόν (m²)', 'num', 'Αριθμός.', ['sqm', 'm2', 'area', 'size', 'total area', 'εμβαδον', 'εμβαδο', 'συνολικο εμβαδον', 'τμ', 'τ μ']),
  B('internal_sqm', 'Εσωτερικό εμβαδόν (m²)', 'num', 'Αριθμός.', ['internal', 'internal area', 'internal sqm', 'εσωτερικο', 'εσωτερικο εμβαδον', 'καλυμμενο']),
  B('covered_veranda_sqm', 'Καλυμμένη βεράντα (m²)', 'num', 'Αριθμός.', ['covered veranda', 'covered verandas', 'καλυμμενη βεραντα', 'καλυμμενες βεραντες']),
  B('uncovered_veranda_sqm', 'Ακάλυπτη βεράντα (m²)', 'num', 'Αριθμός.', ['uncovered veranda', 'uncovered verandas', 'ακαλυπτη βεραντα', 'ακαλυπτες βεραντες', 'veranda', 'βεραντα']),
  B('storage_sqm', 'Αποθήκη (m²)', 'num', 'Αριθμός.', ['storage', 'storeroom', 'αποθηκη']),
  B('plot_size_sqm', 'Οικόπεδο (m²)', 'num', 'Αριθμός.', ['plot', 'plot size', 'land', 'οικοπεδο', 'εμβαδον οικοπεδου']),
  B('garden_sqm', 'Κήπος (m²)', 'num', 'Αριθμός.', ['garden', 'κηπος']),
  B('bedrooms', 'Υπνοδωμάτια', 'int', 'Αριθμός.', ['bedrooms', 'beds', 'bed', 'υπνοδωματια', 'υ δ', 'υδ', 'δωματια']),
  B('bathrooms', 'Μπάνια', 'num', 'Αριθμός (1,5 = μπάνιο + WC).', ['bathrooms', 'baths', 'bath', 'μπανια', 'μπανιο', 'λουτρα', 'wc']),
  B('parking_spaces', 'Θέσεις στάθμευσης', 'int', 'Αριθμός.', ['parking', 'parking spaces', 'parkings', 'σταθμευση', 'θεσεις σταθμευσης', 'παρκινγκ', 'garage', 'γκαραζ']),
  B('has_pool', 'Πισίνα', 'bool', 'Ναι / Όχι.', ['pool', 'swimming pool', 'πισινα']),
  B('commission_pct', 'Προμήθεια (%)', 'num', 'Αριθμός, π.χ. 3.', ['commission', 'commission %', 'προμηθεια']),
  B('description', 'Περιγραφή', 'text', 'Ελεύθερο κείμενο.', ['description', 'notes', 'περιγραφη', 'σημειωσεις', 'σχολια']),
];

/** Everything a column can be mapped to: the standard unit fields + your own fields (Settings → Φόρμες μονάδων). */
export function importTargets(cfg: UnitFormsSettings): ImportTarget[] {
  const taken = new Set(BASE.map((b) => norm(b.el)));
  const own = cfg.fields
    .filter((f) => !taken.has(norm(f.el)))
    .map<ImportTarget>((f) => ({
      key: `cf:${f.key}`, el: f.el, kind: 'cf', field: f,
      hint: f.type === 'yesno' ? 'Ναι / Όχι.' : f.type === 'number' ? `Αριθμός${f.suffix ? ` (${f.suffix})` : ''}.` : f.type === 'date' ? 'Ημερομηνία (ηη/μμ/εεεε).'
        : f.type === 'choice' ? `Μία από: ${f.options.join(', ')}.` : f.type === 'multi' ? `Μία ή περισσότερες, χωρισμένες με κόμμα: ${f.options.join(', ')}.` : 'Κείμενο.',
      aliases: [f.en, f.key.replace(/_/g, ' ')],
    }));
  return [...BASE, ...own];
}

/* ------------------------------------------------------------ matching -- */

const GR_ACCENTS: Record<string, string> = { ά: 'α', έ: 'ε', ή: 'η', ί: 'ι', ϊ: 'ι', ΐ: 'ι', ό: 'ο', ύ: 'υ', ϋ: 'υ', ΰ: 'υ', ώ: 'ω', ς: 'σ' };
/** "Αριθμός Μονάδας:" → "αριθμος μοναδας"; "m²" → "m2". */
export function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/²/g, '2').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split('').map((c) => GR_ACCENTS[c] ?? c).join('')
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9α-ω#]+/g, ' ').trim().replace(/\s+/g, ' ');
}

/** Best target for each column ('' = ignore). Each target is used at most once. */
export function autoMap(headers: Cell[], targets: ImportTarget[]): string[] {
  const used = new Set<string>();
  const out = headers.map(() => '');
  const score = (h: string, t: ImportTarget): number => {
    if (!h) return 0;
    const names = [t.el, ...t.aliases, t.key.replace(/^cf:/, '').replace(/_/g, ' ')].map(norm);
    if (names.includes(h)) return 3;
    if (names.some((n) => n.length >= 4 && (h.startsWith(n) || n.startsWith(h)) && h.length >= 3)) return 2;
    return 0;
  };
  for (const pass of [3, 2]) {
    headers.forEach((raw, i) => {
      if (out[i]) return;
      const h = norm(raw);
      const t = targets.find((x) => !used.has(x.key) && score(h, x) >= pass);
      if (t) { out[i] = t.key; used.add(t.key); }
    });
  }
  return out;
}

/** First row with at least two filled cells (titles above the table are skipped). */
export function guessHeaderRow(rows: Cell[][]): number {
  for (let i = 0; i < Math.min(rows.length, 20); i++) if ((rows[i] ?? []).filter((c) => c !== null && String(c).trim() !== '').length >= 2) return i;
  return 0;
}

/* -------------------------------------------------------------- values -- */

/**
 * "250.000 €" → 250000, "1,5" → 1.5, "1,234.50" → 1234.5, 85 → 85.
 * null = empty; undefined = not a number.
 */
export function parseNumber(v: Cell): number | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return undefined;
  let s = String(v).trim().replace(/[€$£%\s ]|m2|m²|τμ|eur/gi, '');
  if (!s || s === '-' || s === '—') return null;
  const neg = /^-/.test(s); s = s.replace(/^[-+]/, '');
  const hasDot = s.includes('.'); const hasComma = s.includes(',');
  if (hasDot && hasComma) {
    const dec = s.lastIndexOf('.') > s.lastIndexOf(',') ? '.' : ',';
    s = s.split(dec === '.' ? ',' : '.').join('').replace(',', '.');
  } else if (hasComma) {
    s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if (hasDot) {
    if (/^\d{1,3}(\.\d{3}){2,}$/.test(s) || /^\d{1,3}\.\d{3}$/.test(s)) s = s.replace(/\./g, '');
  }
  if (!/^\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return neg ? -n : n;
}

/** "Ναι" / "x" / 1 → true; "Όχι" / 0 → false; null = empty; undefined = not understood. */
export function parseBool(v: Cell): boolean | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v === 1 ? true : v === 0 ? false : undefined;
  const s = norm(v);
  if (!s) return null;
  if (['ναι', 'ν', 'yes', 'y', 'true', '1', 'x', 'nai', 'da', 'да', 'oui', 'si', 'υπαρχει', 'με'].includes(s) || String(v).trim() === '✓') return true;
  if (['οχι', 'ο', 'no', 'n', 'false', '0', 'oxi', 'net', 'нет', 'δεν', 'χωρις', 'none'].includes(s)) return false;
  return undefined;
}

const STATUS_ALIASES: Record<UnitStatus, string[]> = {
  available: ['available', 'free', 'for sale', 'διαθεσιμη', 'διαθεσιμο', 'διαθεσιμα', 'ελευθερη', 'ελευθερο', 'προς πωληση'],
  reserved: ['reserved', 'booked', 'on hold', 'hold', 'κρατημενη', 'κρατημενο', 'κρατηση', 'υπο κρατηση', 'προκαταβολη'],
  sold: ['sold', 'πωλημενη', 'πωλημενο', 'πουληθηκε', 'πωληθηκε', 'πωληση'],
  handed_over: ['handed over', 'delivered', 'handover', 'παραδοθηκε', 'παραδομενη', 'παραδοση', 'παραδοθεισα'],
  blocked: ['blocked', 'not for sale', 'withdrawn', 'εκτος πωλησης', 'μπλοκαρισμενη', 'δεσμευμενη', 'αποσυρθηκε'],
};
export function parseStatus(v: Cell): UnitStatus | null | undefined {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  const s = norm(v);
  for (const st of UNIT_STATUSES) if (st === s.replace(/ /g, '_') || STATUS_ALIASES[st].includes(s)) return st;
  return undefined;
}

/** Excel serial day (45292) or "31/12/2026" / "2026-12-31" → "2026-12-31". */
export function parseDate(v: Cell): string | null | undefined {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  if (typeof v === 'number') {
    if (v < 1 || v > 80000) return undefined;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})$/);
  if (m) return iso(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2], +m[1]);
  return undefined;
}
function iso(y: number, mo: number, d: number): string | undefined {
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return undefined;
  return dt.toISOString().slice(0, 10);
}

const text = (v: Cell): string => (v === null || v === undefined ? '' : typeof v === 'number' && Number.isInteger(v) ? String(v) : String(v)).trim();

/* --------------------------------------------------------------- parse -- */

export type BaseValues = Partial<Record<Exclude<BaseKey, 'unit_number' | 'building'>, string | number | boolean | null>>;
export interface ParsedUnit {
  /** 1-based row number in the file (what the user sees in Excel). */
  row: number;
  unit_number: string;
  building: string | null;
  /** Only the columns that were mapped AND filled. */
  values: BaseValues;
  custom: Record<string, FieldValue>;
}
export interface ImportIssue { row: number; column?: string; level: 'error' | 'warn'; msg: string }

export const MAX_IMPORT_ROWS = 2000;

/**
 * Turn sheet rows into units. A row with errors is left out (shown in the
 * preview); warnings keep the row but drop the bad value.
 */
export function parseImport(rows: Cell[][], headerRow: number, mapping: string[], cfg: UnitFormsSettings): { units: ParsedUnit[]; issues: ImportIssue[]; skippedEmpty: number } {
  const targets = new Map(importTargets(cfg).map((t) => [t.key, t]));
  const headers = rows[headerRow] ?? [];
  const units: ParsedUnit[] = [];
  const issues: ImportIssue[] = [];
  const seen = new Map<string, number>();
  let skippedEmpty = 0;
  const numIdx = mapping.indexOf('unit_number');

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (!row.some((c) => c !== null && String(c).trim() !== '')) { skippedEmpty++; continue; }
    const rowNo = r + 1;
    if (units.length >= MAX_IMPORT_ROWS) { issues.push({ row: rowNo, level: 'error', msg: `Έως ${MAX_IMPORT_ROWS} μονάδες ανά εισαγωγή. Χωρίστε το αρχείο.` }); break; }
    const err = (msg: string, column?: string) => issues.push({ row: rowNo, column, level: 'error', msg });
    const warn = (msg: string, column?: string) => issues.push({ row: rowNo, column, level: 'warn', msg });

    const unitNumber = numIdx >= 0 ? text(row[numIdx]).slice(0, 40) : '';
    if (!unitNumber) { err('Λείπει ο αριθμός μονάδας.'); continue; }
    const k = unitNumber.toLowerCase();
    if (seen.has(k)) { err(`Ο αριθμός «${unitNumber}» υπάρχει ξανά στη γραμμή ${seen.get(k)}.`); continue; }
    seen.set(k, rowNo);

    const u: ParsedUnit = { row: rowNo, unit_number: unitNumber, building: null, values: {}, custom: {} };
    let bad = false;
    mapping.forEach((key, ci) => {
      if (!key || key === 'unit_number') return;
      const t = targets.get(key); if (!t) return;
      const v = row[ci] ?? null;
      const col = String(headers[ci] ?? t.el);
      if (v === null || String(v).trim() === '') return;
      if (key === 'building') { u.building = text(v).slice(0, 80) || null; return; }
      const base = key as keyof BaseValues;
      switch (t.kind) {
        case 'text': u.values[base] = text(v).slice(0, 4000); break;
        case 'int': case 'num': {
          let n = parseNumber(v);
          if (n === undefined && key === 'floor') { const s = norm(v); if (['ισογειο', 'ground', 'g', 'gf', 'ισ'].includes(s)) n = 0; else if (['υπογειο', 'basement', 'b'].includes(s)) n = -1; }
          if (n === undefined) { err(`«${v}» δεν είναι αριθμός.`, col); bad = true; return; }
          if (n === null) return;
          if (key !== 'floor' && n < 0) { err(`Αρνητικός αριθμός (${n}).`, col); bad = true; return; }
          if (key === 'commission_pct' && n > 100) { err('Η προμήθεια είναι ποσοστό (0–100).', col); bad = true; return; }
          if (t.kind === 'int' && !Number.isInteger(n)) { warn(`Το ${n} στρογγυλοποιήθηκε σε ${Math.round(n)}.`, col); n = Math.round(n); }
          u.values[base] = n; break;
        }
        case 'bool': {
          const b = parseBool(v);
          if (b === undefined) { warn(`«${v}»: γράψτε Ναι ή Όχι — αγνοήθηκε.`, col); return; }
          if (b !== null) u.values[base] = b; break;
        }
        case 'status': {
          const st = parseStatus(v);
          if (st === undefined) { warn(`Άγνωστη κατάσταση «${v}» — αγνοήθηκε.`, col); return; }
          if (st) u.values.status = st; break;
        }
        case 'type': {
          const nv = norm(v);
          const tk = typeKeyOf(text(v), cfg.types);
          // "Βίλα" also finds "Μονοκατοικία / Βίλα"; accents and case don't matter.
          const tt = cfg.types.find((x) => x.key === tk)
            ?? cfg.types.find((x) => [x.el, x.en, ...x.el.split('/'), ...x.en.split('/')].some((n) => norm(n) === nv));
          if (!tt) warn(`Ο τύπος «${v}» δεν είναι στις Φόρμες μονάδων — κρατήθηκε όπως είναι.`, col);
          u.values.type = tt ? tt.el : text(v).slice(0, 60); break;
        }
        case 'cf': {
          const f = t.field!;
          let val: FieldValue | undefined;
          if (f.type === 'number') { const n = parseNumber(v); val = n === undefined ? undefined : n; }
          else if (f.type === 'yesno') { const b = parseBool(v); val = b === undefined ? undefined : b; }
          else if (f.type === 'date') { const d = parseDate(v); val = d === undefined ? undefined : d; }
          else if (f.type === 'choice') { const o = f.options.find((x) => norm(x) === norm(v)); val = o ?? undefined; }
          else if (f.type === 'multi') {
            const parts = String(v).split(/[,;|/]+/).map((s) => s.trim()).filter(Boolean);
            const ok = parts.map((p) => f.options.find((x) => norm(x) === norm(p))).filter(Boolean) as string[];
            if (ok.length < parts.length) warn(`Κάποιες τιμές δεν είναι στις επιλογές του «${f.el}» — αγνοήθηκαν.`, col);
            val = ok.length ? ok : null;
          } else val = text(v).slice(0, 500);
          if (val === undefined) { warn(`«${v}» δεν ταιριάζει στο πεδίο «${f.el}» — αγνοήθηκε.`, col); return; }
          if (val !== null) u.custom[f.key] = val;
          break;
        }
      }
    });
    if (bad) { seen.delete(k); continue; }
    units.push(u);
  }
  return { units, issues, skippedEmpty };
}

/* ----------------------------------------------------------- server use -- */

const NUM_KEYS = ['floor', 'price', 'sqm', 'internal_sqm', 'covered_veranda_sqm', 'uncovered_veranda_sqm', 'storage_sqm', 'plot_size_sqm', 'garden_sqm', 'bedrooms', 'bathrooms', 'parking_spaces', 'commission_pct'] as const;
const INT_KEYS = new Set(['floor', 'bedrooms', 'parking_spaces']);

/** Re-check what the browser sent (never trust it) → columns for `units`. */
export function toUnitColumns(u: ParsedUnit, cfg: UnitFormsSettings): { unit_number: string; building: string | null; cols: Record<string, unknown>; custom: Record<string, FieldValue> } | null {
  const unit_number = String(u?.unit_number ?? '').trim().slice(0, 40);
  if (!unit_number) return null;
  const v = (u?.values ?? {}) as Record<string, unknown>;
  const cols: Record<string, unknown> = {};
  for (const k of NUM_KEYS) {
    if (!(k in v)) continue;
    const n = Number(v[k]);
    if (v[k] === null || !Number.isFinite(n) || Math.abs(n) > 1e12) continue;
    if (k !== 'floor' && n < 0) continue;
    cols[k] = INT_KEYS.has(k) ? Math.round(n) : n;
  }
  if (typeof v.has_pool === 'boolean') cols.has_pool = v.has_pool;
  if (typeof v.status === 'string' && (UNIT_STATUSES as readonly string[]).includes(v.status)) cols.status = v.status;
  if (typeof v.type === 'string' && v.type.trim()) cols.type = v.type.trim().slice(0, 60);
  if (typeof v.description === 'string' && v.description.trim()) cols.description = v.description.slice(0, 4000);
  const building = typeof u.building === 'string' && u.building.trim() ? u.building.trim().slice(0, 80) : null;
  return { unit_number, building, cols, custom: cleanValues(u?.custom, cfg.fields) };
}

/* ------------------------------------------------------------- template -- */

/** Header row + one example row + an instructions sheet (for lib/xlsx-write). */
export function templateSheets(cfg: UnitFormsSettings): { name: string; rows: (string | number | null)[][]; widths: number[] }[] {
  const targets = importTargets(cfg);
  const example: Record<string, string | number> = {
    unit_number: 'A101', building: 'Block A', floor: 1, type: cfg.types[0]?.el ?? 'Διαμέρισμα', status: 'Διαθέσιμη',
    price: 250000, sqm: 98, internal_sqm: 85, covered_veranda_sqm: 13, uncovered_veranda_sqm: 8, storage_sqm: 4,
    bedrooms: 2, bathrooms: 2, parking_spaces: 1, has_pool: 'Όχι', commission_pct: 3, description: 'Γωνιακό, θέα θάλασσα',
  };
  const exampleCf = (f: UnitField): string | number | null =>
    f.type === 'yesno' ? 'Ναι' : f.type === 'number' ? 100 : f.type === 'choice' || f.type === 'multi' ? f.options[0] ?? null : f.type === 'date' ? '31/12/2026' : null;
  return [
    {
      name: 'Μονάδες',
      rows: [targets.map((t) => t.el), targets.map((t) => (t.field ? exampleCf(t.field) : example[t.key] ?? null))],
      widths: targets.map((t) => Math.max(12, Math.min(34, t.el.length + 4))),
    },
    {
      name: 'Οδηγίες',
      rows: [
        ['Στήλη', 'Τι γράφετε'],
        ...targets.map((t) => [t.el, t.hint]),
        [null, null],
        ['Συμβουλές', 'Μία γραμμή ανά μονάδα. Μπορείτε να σβήσετε στήλες που δεν χρειάζεστε ή να αφήσετε κενά κελιά. Η πρώτη γραμμή πρέπει να έχει τις επικεφαλίδες. Δουλεύουν και τα δικά σας ονόματα στηλών: στην εισαγωγή διαλέγετε σε ποιο πεδίο πάει η καθεμία.'],
      ],
      widths: [30, 110],
    },
  ];
}
