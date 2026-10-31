'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Upload, X, Droplets } from 'lucide-react';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { UndoButton } from '@/components/admin/UndoButton';
import {
  WATERMARK_POSITIONS, drawWatermark, watermarkActive, watermarkPlan,
  type WatermarkSettings,
} from '@/lib/watermark-shared';

const Lbl = ({ children }: { children: React.ReactNode }) => <span className="eyebrow mb-1 block">{children}</span>;

/** A stand-in "photo" (sky, sea, building) so the preview works with no upload. */
function paintSample(ctx: CanvasRenderingContext2D, W: number, H: number) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#9cc4dd'); sky.addColorStop(0.55, '#e8dcc4'); sky.addColorStop(0.56, '#3f7f96'); sky.addColorStop(1, '#2b5d70');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#f4efe6'; ctx.fillRect(W * 0.18, H * 0.22, W * 0.42, H * 0.5);
  ctx.fillStyle = '#d9cdb8'; ctx.fillRect(W * 0.6, H * 0.34, W * 0.2, H * 0.38);
  ctx.fillStyle = '#8fb3c4';
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) ctx.fillRect(W * (0.21 + c * 0.075), H * (0.27 + r * 0.105), W * 0.05, H * 0.06);
}

/** Settings → Φόρμες μονάδων → Υδατογράφημα: text or logo stamped on unit photos at upload. */
export function WatermarkSettings({ initial, canEdit, companyName, companyLogo }: {
  initial: WatermarkSettings; canEdit: boolean; companyName: string; companyLogo: string | null;
}) {
  const router = useRouter();
  const [v, setV] = useState<WatermarkSettings>(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [previewErr, setPreviewErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canvas = useRef<HTMLCanvasElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const patch = (p: Partial<WatermarkSettings>) => { setV((x) => ({ ...x, ...p })); setMsg(null); };
  const plan = watermarkPlan(v, companyName, companyLogo);

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    const ctx = c.getContext('2d'); if (!ctx) return;
    let alive = true;
    paintSample(ctx, c.width, c.height);
    setPreviewErr(null);
    drawWatermark(ctx, c.width, c.height, plan).catch(() => {
      if (alive) setPreviewErr('Το logo δεν μπορεί να χρησιμοποιηθεί (δεν φορτώνει ή δεν επιτρέπεται από τον server του). Ανεβάστε το εδώ.');
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.enabled, v.mode, v.text, v.logo, v.position, v.opacity, v.size, companyName, companyLogo]);

  const pickLogo = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 400 * 1024) { setMsg({ ok: false, text: 'Το logo πρέπει να είναι έως 400 KB (PNG με διαφανές φόντο είναι το καλύτερο).' }); return; }
    const r = new FileReader();
    r.onload = () => patch({ logo: String(r.result), mode: 'logo' });
    r.readAsDataURL(f);
  };

  const save = () => start(async () => {
    const r = await saveOrgSlice('watermark', v);
    if (r.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε. Ισχύει για τις φωτογραφίες που θα ανεβούν από εδώ και πέρα.' }); router.refresh(); }
    else setMsg({ ok: false, text: r.error });
  });

  const dis = !canEdit;
  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2"><Droplets size={16} /> Υδατογράφημα φωτογραφιών</h4>
          <p className="text-xs text-charcoal-600/60">Μπαίνει αυτόματα σε κάθε φωτογραφία μονάδας τη στιγμή που ανεβαίνει. Οι φωτογραφίες που ήδη υπάρχουν δεν αλλάζουν.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <input type="checkbox" disabled={dis} checked={v.enabled} onChange={(e) => patch({ enabled: e.target.checked })} /> Ενεργό
        </label>
      </div>

      <div className="grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div>
            <Lbl>Τι να γράφει</Lbl>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" disabled={dis} checked={v.mode === 'text'} onChange={() => patch({ mode: 'text' })} /> Κείμενο</label>
              <label className="flex items-center gap-1.5"><input type="radio" disabled={dis} checked={v.mode === 'logo'} onChange={() => patch({ mode: 'logo' })} /> Logo</label>
            </div>
          </div>

          {v.mode === 'text' ? (
            <div>
              <Lbl>Κείμενο</Lbl>
              <input className="input" disabled={dis} maxLength={60} value={v.text} placeholder={companyName || 'π.χ. www.example.com'} onChange={(e) => patch({ text: e.target.value })} />
              <p className="mt-1 text-[11px] text-charcoal-600/60">Κενό = η επωνυμία της εταιρείας.</p>
            </div>
          ) : (
            <div>
              <Lbl>Logo</Lbl>
              <div className="flex flex-wrap items-center gap-2">
                {v.logo ? (
                  <span className="inline-flex items-center gap-2 rounded-md border border-stone-line bg-sand-100 px-2 py-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={v.logo} alt="" className="h-6 max-w-[120px] object-contain" />
                    {!dis && <button type="button" onClick={() => patch({ logo: null })} className="text-charcoal-600/50 hover:text-signal-danger"><X size={13} /></button>}
                  </span>
                ) : (
                  <span className="text-xs text-charcoal-600/70">{companyLogo ? 'Χρησιμοποιείται το logo της εταιρείας (Εμφάνιση).' : 'Δεν υπάρχει logo εταιρείας — ανεβάστε ένα.'}</span>
                )}
                {!dis && (
                  <button type="button" onClick={() => file.current?.click()} className="btn-secondary px-3 py-1.5 text-xs"><Upload size={13} /> {v.logo ? 'Αλλαγή' : 'Άλλο logo'}</button>
                )}
                <input ref={file} type="file" accept="image/png,image/webp,image/svg+xml,image/jpeg" className="hidden" onChange={(e) => { pickLogo(e.target.files?.[0]); e.target.value = ''; }} />
              </div>
              <p className="mt-1 text-[11px] text-charcoal-600/60">Λευκό logo σε διαφανές PNG φαίνεται καλύτερα πάνω σε φωτογραφίες.</p>
            </div>
          )}

          <div>
            <Lbl>Θέση</Lbl>
            <select className="input" disabled={dis} value={v.position} onChange={(e) => patch({ position: e.target.value as WatermarkSettings['position'] })}>
              {WATERMARK_POSITIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <Lbl>Διαφάνεια · {v.opacity}%</Lbl>
              <input type="range" min={5} max={90} disabled={dis} value={v.opacity} onChange={(e) => patch({ opacity: Number(e.target.value) })} className="w-full" />
            </label>
            <label className="block">
              <Lbl>Μέγεθος · {v.size}% του πλάτους</Lbl>
              <input type="range" min={5} max={60} disabled={dis} value={v.size} onChange={(e) => patch({ size: Number(e.target.value) })} className="w-full" />
            </label>
          </div>
          <div>
            <Lbl>Μέγιστο μέγεθος φωτογραφίας</Lbl>
            <select className="input" disabled={dis} value={v.maxSide} onChange={(e) => patch({ maxSide: Number(e.target.value) })}>
              <option value={1920}>1920 px (γρήγορες σελίδες)</option>
              <option value={2560}>2560 px (προτείνεται)</option>
              <option value={4000}>4000 px (για εκτύπωση)</option>
              <option value={0}>Χωρίς σμίκρυνση</option>
            </select>
            <p className="mt-1 text-[11px] text-charcoal-600/60">Ισχύει για κάθε φωτογραφία που ανεβαίνει, ακόμη κι αν το υδατογράφημα είναι κλειστό.</p>
          </div>
        </div>

        <div>
          <Lbl>Προεπισκόπηση</Lbl>
          <canvas ref={canvas} width={640} height={420} className="w-full rounded-md border border-stone-line" />
          {!watermarkActive(plan) && <p className="mt-1 text-[11px] text-charcoal-600/60">{v.enabled ? 'Δεν υπάρχει κείμενο ή logo για να μπει.' : 'Κλειστό — οι φωτογραφίες ανεβαίνουν χωρίς υδατογράφημα.'}</p>}
          {previewErr && <p className="mt-1 text-[11px] text-signal-danger">{previewErr}</p>}
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={pending} onClick={save} className="btn-primary"><Check size={14} /> {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>}
          {msg?.ok && <UndoButton slice="watermark" />}
        </div>
      )}
    </div>
  );
}
