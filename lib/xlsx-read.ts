/**
 * Read .xlsx and .csv in the browser, with no library (client-safe; also runs
 * on Node 18+ for tests). An .xlsx is a ZIP of XML files: we read the ZIP's
 * central directory, inflate entries with DecompressionStream('deflate-raw')
 * and pull cell values out of the sheet XML. Old binary .xls is not supported —
 * the caller asks the user to "Save as .xlsx".
 */

export type Cell = string | number | boolean | null;
export interface Sheet { name: string; rows: Cell[][] }

/* ----------------------------------------------------------------- zip -- */

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const out = new Blob([data]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** All entries of a ZIP as name → bytes (only the ones `want` accepts). */
export async function unzip(buf: ArrayBuffer, want: (name: string) => boolean = () => true): Promise<Map<string, Uint8Array>> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('not-zip');
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const out = new Map<string, Uint8Array>();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('bad-zip');
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true);
    const xlen = dv.getUint16(p + 30, true);
    const clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (!want(name)) continue;
    const lnlen = dv.getUint16(local + 26, true);
    const lxlen = dv.getUint16(local + 28, true);
    const start = local + 30 + lnlen + lxlen;
    const raw = u8.subarray(start, start + csize);
    if (method === 0) out.set(name, raw);
    else if (method === 8) out.set(name, await inflateRaw(raw));
  }
  return out;
}

/* ----------------------------------------------------------------- xml -- */

export function xmlDecode(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e: string) => {
    const k = e.toLowerCase();
    if (k === 'amp') return '&'; if (k === 'lt') return '<'; if (k === 'gt') return '>';
    if (k === 'quot') return '"'; if (k === 'apos') return "'";
    const code = k.startsWith('#x') ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) ? String.fromCodePoint(code) : '';
  });
}
const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? xmlDecode(m[1]) : null;
};
/** Concatenated <t> texts inside a fragment (rich text runs; phonetic <rPh> skipped). */
const texts = (frag: string): string => {
  const clean = frag.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let s = '';
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += xmlDecode(m[1]);
  return s;
};

/** "AB" → 27 (0-based). */
export function colIndex(ref: string): number {
  const letters = (ref.match(/^[A-Z]+/i)?.[0] ?? 'A').toUpperCase();
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function parseSheetXml(xml: string, shared: string[]): Cell[][] {
  const rows: Cell[][] = [];
  let auto = 0;
  for (const rm of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rAttr = Number(attr(rm[1], 'r'));
    const ri = Number.isFinite(rAttr) && rAttr > 0 ? rAttr - 1 : auto;
    auto = ri + 1;
    const row: Cell[] = [];
    let ci = 0;
    for (const cm of (rm[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(cm[1], 'r');
      const idx = ref ? colIndex(ref) : ci;
      ci = idx + 1;
      const t = attr(cm[1], 't');
      const body = cm[2] ?? '';
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let val: Cell = null;
      if (t === 's') val = v != null ? shared[Number(v)] ?? '' : null;
      else if (t === 'inlineStr') val = texts(body);
      else if (t === 'str' || t === 'd' || t === 'e') val = v != null ? xmlDecode(v) : null;
      else if (t === 'b') val = v === '1';
      else if (v != null) { const n = Number(v); val = Number.isFinite(n) ? n : xmlDecode(v); }
      row[idx] = val;
    }
    for (let i = 0; i < row.length; i++) if (row[i] === undefined) row[i] = null;
    rows[ri] = row;
  }
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
  return rows;
}

/** Every sheet of an .xlsx, in workbook order. */
export async function readXlsx(buf: ArrayBuffer): Promise<Sheet[]> {
  const files = await unzip(buf, (n) => /^xl\/(workbook\.xml|sharedStrings\.xml|_rels\/workbook\.xml\.rels|worksheets\/[^/]+\.xml)$/i.test(n));
  const dec = new TextDecoder();
  const get = (n: string) => { const f = files.get(n); return f ? dec.decode(f) : null; };
  const wb = get('xl/workbook.xml');
  if (!wb) throw new Error('not-xlsx');
  const shared: string[] = [];
  const ss = get('xl/sharedStrings.xml');
  if (ss) for (const m of ss.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)) shared.push(texts(m[1] ?? ''));
  const rels = new Map<string, string>();
  for (const m of (get('xl/_rels/workbook.xml.rels') ?? '').matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id'); const target = attr(m[0], 'Target');
    if (id && target) rels.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
  }
  const sheets: Sheet[] = [];
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name') ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[0], 'r:id');
    const path = (rid && rels.get(rid)) || `xl/worksheets/sheet${sheets.length + 1}.xml`;
    const xml = get(path);
    if (xml != null) sheets.push({ name, rows: parseSheetXml(xml, shared) });
  }
  return sheets;
}

/* ----------------------------------------------------------------- csv -- */

/** Text of a CSV file: UTF-8 when valid, else Windows Greek (Excel's "CSV" on a Greek PC). */
export function decodeText(buf: ArrayBuffer): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
  catch { return new TextDecoder('windows-1253').decode(buf); }
}

export function parseCsv(text: string): Cell[][] {
  const first = text.split(/\r?\n/, 1)[0] ?? '';
  const count = (d: string) => { let n = 0; let q = false; for (const ch of first) { if (ch === '"') q = !q; else if (!q && ch === d) n++; } return n; };
  const delim = [';', ',', '\t'].sort((a, b) => count(b) - count(a))[0];
  const rows: Cell[][] = [];
  let row: Cell[] = []; let cell = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.map((r) => r.map((c) => (typeof c === 'string' && c.trim() === '' ? null : c)));
}

/** A picked file → its sheets. Throws an Error with a Greek message for unsupported files. */
export async function readSpreadsheet(file: { name: string; arrayBuffer(): Promise<ArrayBuffer> }): Promise<Sheet[]> {
  const buf = await file.arrayBuffer();
  const lower = file.name.toLowerCase();
  if (lower.endsWith('.csv') || lower.endsWith('.txt') || lower.endsWith('.tsv')) return [{ name: file.name, rows: parseCsv(decodeText(buf)) }];
  const head = new Uint8Array(buf.slice(0, 4));
  if (head[0] === 0xd0 && head[1] === 0xcf) throw new Error('Το αρχείο είναι παλιό Excel (.xls). Ανοίξτε το και κάντε «Αποθήκευση ως» → Βιβλίο εργασίας Excel (.xlsx).');
  if (!(head[0] === 0x50 && head[1] === 0x4b)) {
    // Not a ZIP: maybe a CSV with another extension.
    return [{ name: file.name, rows: parseCsv(decodeText(buf)) }];
  }
  try { return await readXlsx(buf); }
  catch { throw new Error('Το αρχείο δεν διαβάστηκε. Αποθηκεύστε το ως .xlsx ή .csv και δοκιμάστε ξανά.'); }
}
