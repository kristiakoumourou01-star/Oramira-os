/**
 * Υδατογράφημα φωτογραφιών (βήμα 11) — client-safe.
 *
 * Settings → Φόρμες μονάδων → «Υδατογράφημα». Όταν είναι ενεργό, κάθε
 * φωτογραφία μονάδας που ανεβαίνει παίρνει το κείμενο ή το logo της εταιρείας
 * πριν φύγει από τον browser (canvas), άρα δεν κυκλοφορεί ποτέ χωρίς αυτό.
 * Οι φωτογραφίες που έχουν ήδη ανέβει δεν αλλάζουν.
 */

export type WatermarkPosition = 'center' | 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'tile';
export const WATERMARK_POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: 'bottom-right', label: 'Κάτω δεξιά' },
  { value: 'bottom-left', label: 'Κάτω αριστερά' },
  { value: 'top-right', label: 'Πάνω δεξιά' },
  { value: 'top-left', label: 'Πάνω αριστερά' },
  { value: 'center', label: 'Στο κέντρο' },
  { value: 'tile', label: 'Επανάληψη σε όλη τη φωτογραφία' },
];

export interface WatermarkSettings {
  enabled: boolean;
  mode: 'text' | 'logo';
  text: string;
  /** data: URL or https URL. Empty = the company logo (Εμφάνιση). */
  logo: string | null;
  position: WatermarkPosition;
  /** 5–90 % */
  opacity: number;
  /** Width of the mark as % of the photo width, 5–60. */
  size: number;
  /** Longest side of the uploaded photo in px (0 = keep). Smaller files, faster pages. */
  maxSide: number;
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false, mode: 'text', text: '', logo: null, position: 'bottom-right', opacity: 45, size: 22, maxSide: 2560,
};

const IMG = /^(https?:\/\/|data:image\/(png|jpeg|webp|svg\+xml);base64,)/i;

/** Validate the slice (used on read AND before save). */
export function mergeWatermark(x: any): WatermarkSettings {
  const v = x && typeof x === 'object' ? x : {};
  const num = (n: any, lo: number, hi: number, fb: number) => (Number.isFinite(Number(n)) && n !== '' && n !== null ? Math.min(hi, Math.max(lo, Math.round(Number(n)))) : fb);
  const maxSide = Number(v.maxSide);
  return {
    enabled: !!v.enabled,
    mode: v.mode === 'logo' ? 'logo' : 'text',
    text: typeof v.text === 'string' ? v.text.trim().slice(0, 60) : '',
    logo: typeof v.logo === 'string' && IMG.test(v.logo) && v.logo.length <= 600_000 ? v.logo : null,
    position: WATERMARK_POSITIONS.some((p) => p.value === v.position) ? v.position : DEFAULT_WATERMARK.position,
    opacity: num(v.opacity, 5, 90, DEFAULT_WATERMARK.opacity),
    size: num(v.size, 5, 60, DEFAULT_WATERMARK.size),
    maxSide: maxSide === 0 ? 0 : num(v.maxSide, 800, 6000, DEFAULT_WATERMARK.maxSide),
  };
}

/** What the gallery needs at upload time (text / logo already resolved). */
export interface WatermarkPlan extends WatermarkSettings {
  /** Logo to draw in logo mode: the slice's own, else the company logo. */
  logoUrl: string | null;
  /** Text to draw in text mode: the slice's own, else the company name. */
  label: string;
}

export function watermarkPlan(w: WatermarkSettings, companyName: string, companyLogo: string | null): WatermarkPlan {
  return { ...w, logoUrl: w.logo ?? companyLogo ?? null, label: w.text || companyName || '' };
}

/** Whether the plan would actually draw something. */
export function watermarkActive(p: WatermarkPlan | null | undefined): boolean {
  if (!p?.enabled) return false;
  return p.mode === 'logo' ? !!p.logoUrl : !!p.label.trim();
}

/* ------------------------------------------------------------ geometry -- */

export interface Box { x: number; y: number; w: number; h: number }

/**
 * Where to draw a mark of aspect `ratio` (w/h) on a W×H photo. Returns one box,
 * or a grid of boxes for "tile". Pure, so it is unit-tested.
 */
export function markBoxes(W: number, H: number, ratio: number, p: Pick<WatermarkSettings, 'position' | 'size'>): Box[] {
  const r = ratio > 0 && Number.isFinite(ratio) ? ratio : 4;
  const w = Math.max(16, Math.round((W * p.size) / 100));
  const h = Math.max(4, Math.round(w / r));
  const m = Math.round(Math.min(W, H) * 0.03);
  if (p.position === 'tile') {
    const gx = Math.round(w * 0.6); const gy = Math.round(h * 2.2);
    const out: Box[] = [];
    let row = 0;
    for (let y = m; y < H; y += h + gy, row++) {
      for (let x = (row % 2 ? -(w + gx) / 2 : 0) + m; x < W; x += w + gx) out.push({ x: Math.round(x), y: Math.round(y), w, h });
    }
    return out;
  }
  const x = p.position.endsWith('left') ? m : p.position === 'center' ? Math.round((W - w) / 2) : W - w - m;
  const y = p.position.startsWith('top') ? m : p.position === 'center' ? Math.round((H - h) / 2) : H - h - m;
  return [{ x, y, w, h }];
}

/** Scale (w, h) so the longest side is at most `max` (0 = unchanged). */
export function fitInside(w: number, h: number, max: number): { w: number; h: number } {
  if (!max || Math.max(w, h) <= max) return { w, h };
  const k = max / Math.max(w, h);
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

/* ------------------------------------------------------------- browser -- */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Η εικόνα δεν φορτώθηκε.'));
    img.src = src;
  });
}

/** Draw the mark on a canvas context sized W×H (used for upload and the settings preview). */
export async function drawWatermark(ctx: CanvasRenderingContext2D, W: number, H: number, p: WatermarkPlan): Promise<void> {
  if (!watermarkActive(p)) return;
  ctx.save();
  ctx.globalAlpha = p.opacity / 100;
  if (p.mode === 'logo' && p.logoUrl) {
    const logo = await loadImage(p.logoUrl);
    const ratio = (logo.naturalWidth || logo.width) / Math.max(1, logo.naturalHeight || logo.height);
    for (const b of markBoxes(W, H, ratio, p)) ctx.drawImage(logo, b.x, b.y, b.w, b.h);
  } else {
    const text = p.label.trim();
    // Measure at a reference size, then scale the font so the text fills the box width.
    ctx.font = `600 100px system-ui, -apple-system, "Segoe UI", sans-serif`;
    const tw = Math.max(1, ctx.measureText(text).width);
    const ratio = tw / 120;
    const boxes = markBoxes(W, H, ratio, p);
    const fs = Math.max(8, Math.round((100 * boxes[0].w) / tw));
    ctx.font = `600 ${fs}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = Math.max(2, fs / 10);
    for (const b of boxes) ctx.fillText(text, b.x, b.y + b.h / 2, b.w);
  }
  ctx.restore();
}

/**
 * Resize (maxSide) and stamp a photo before upload. Returns the original file
 * untouched when there is nothing to do or the format can't go through canvas
 * (GIF, HEIC). A logo that can't be loaded throws, so the caller can tell the
 * user instead of silently uploading an unmarked photo.
 */
export async function prepareUpload(file: File, p: WatermarkPlan | null): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) return file;
  const active = watermarkActive(p);
  const max = p?.maxSide ?? 0;
  if (!active && !max) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const W0 = img.naturalWidth; const H0 = img.naturalHeight;
    const { w: W, h: H } = fitInside(W0, H0, max);
    if (!active && W === W0 && H === H0) return file;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, W, H);
    if (active && p) await drawWatermark(ctx, W, H, p);
    const type = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, type, 0.9));
    if (!blob) return file;
    const name = type === 'image/jpeg' ? file.name.replace(/\.(png|webp)$/i, '.jpg') : file.name;
    return new File([blob], name, { type, lastModified: Date.now() });
  } finally {
    URL.revokeObjectURL(url);
  }
}
