'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Trash2 } from 'lucide-react';
import { saveLogo } from '@/app/actions/branding';
import { fileToDataUrl } from '@/lib/image-upload';
import { patchLiveMenu } from '@/lib/brand-live';
import { saveAppearance } from '@/app/actions/org-settings';
import { sidebarBackground } from '@/lib/branding-shared';
import type { AppearanceSettings, BoxColor, BoxStyle, Corners, LabelStyle, SidebarStyle } from '@/lib/org-settings-shared';

/* ─────────────────────────── image upload helper ────────────────────────── */


function ImagePicker({
  label, hint, value, background, onPick, onRemove, busy, square = false, maxPx,
}: {
  label: string; hint: string; value: string | null; background: string;
  onPick: (dataUrl: string) => void; onRemove: () => void; busy: boolean; square?: boolean; maxPx: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="flex h-16 w-40 items-center justify-center rounded-lg p-2" style={{ background }}>
        {value
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={value} alt={label} className={square ? 'h-10 w-10 object-contain' : 'max-h-12 max-w-full object-contain'} />
          : <span className="text-xs opacity-60" style={{ color: background.includes('gradient') ? '#fff' : '#555' }}>Χωρίς εικόνα</span>}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-charcoal">{label}</p>
        <p className="text-xs text-charcoal-600/60">{hint}</p>
        {err && <p className="text-xs text-signal-danger">{err}</p>}
      </div>
      <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          setErr(null);
          if (f.size > 5_000_000) { setErr('Το αρχείο είναι πάνω από 5 MB.'); return; }
          try { onPick(await fileToDataUrl(f, maxPx, square)); } catch (x) { setErr(x instanceof Error ? x.message : 'Σφάλμα εικόνας.'); }
        }} />
      <div className="flex gap-1">
        <button type="button" className="btn-ghost text-xs" disabled={busy} onClick={() => ref.current?.click()}><Upload size={13} /> Ανέβασμα</button>
        {value && <button type="button" className="btn-ghost text-xs text-signal-danger" disabled={busy} onClick={onRemove}><Trash2 size={13} /> Αφαίρεση</button>}
      </div>
    </div>
  );
}

/* ─────────────────────────── company appearance ─────────────────────────── */

const SIDEBAR_STYLES: { v: SidebarStyle; label: string }[] = [
  { v: 'brand', label: 'Από το κύριο χρώμα' },
  { v: 'charcoal', label: 'Σκούρο γκρι' },
  { v: 'custom', label: 'Δικό μου χρώμα' },
];
const CORNERS: { v: Corners; label: string }[] = [{ v: 'square', label: 'Τετράγωνες' }, { v: 'soft', label: 'Απαλές' }, { v: 'round', label: 'Στρογγυλές' }];
const BOXES: { v: BoxStyle; label: string }[] = [{ v: 'shadow', label: 'Σκιά' }, { v: 'outline', label: 'Περίγραμμα' }, { v: 'flat', label: 'Επίπεδα' }];
const BOX_COLORS: { v: BoxColor; label: string; sw: string }[] = [{ v: 'white', label: 'Λευκό', sw: '#FFFFFF' }, { v: 'sand', label: 'Μπεζ (άμμος)', sw: 'rgb(var(--c-box-sand))' }, { v: 'cream', label: 'Κρεμ', sw: 'rgb(var(--c-box-cream))' }];
const LABELS: { v: LabelStyle; label: string }[] = [{ v: 'soft', label: 'Απαλές' }, { v: 'solid', label: 'Γεμάτες' }, { v: 'outline', label: 'Περίγραμμα' }];

function Choice<T extends string>({ options, value, onChange, disabled }: { options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.v} type="button" disabled={disabled} onClick={() => onChange(o.v)}
          className={`rounded-lg border px-3 py-1.5 text-sm ${value === o.v ? 'border-forest bg-forest/[0.06] text-forest' : 'border-stone-line text-charcoal-600'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Settings → Εμφάνιση (top part): personal display for this device, then the
 * company-wide logo/favicon and the menu colour, corners and box style.
 * Colours and fonts follow below in BrandingForm.
 */
export function AppearanceExtras({
  logoUrl, primary, initial, canEdit,
}: { logoUrl: string | null; primary: string; initial: AppearanceSettings; canEdit: boolean }) {
  const [a, setA] = useState<AppearanceSettings>(initial);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const menuBg = sidebarBackground(a.sidebarStyle, primary, a.sidebarColor);

  const persist = (next: AppearanceSettings, okText = 'Αποθηκεύτηκε.') =>
    start(async () => {
      const res = await saveAppearance(next);
      setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
      if (res.ok) router.refresh();
    });
  const persistLogo = (v: string | null) =>
    start(async () => {
      const res = await saveLogo(v);
      if (res.ok) { setLogo(v); setMsg({ ok: true, text: v ? 'Το logo ανέβηκε.' : 'Το logo αφαιρέθηκε.' }); router.refresh(); }
      else setMsg({ ok: false, text: res.error });
    });
  // Live preview: the whole app changes as you click; «Αποθήκευση» keeps it for everyone.
  useEffect(() => {
    const d = document.documentElement;
    d.dataset.corners = a.corners;
    d.dataset.box = a.boxStyle;
    d.dataset.boxcolor = a.boxColor ?? 'white';
    d.dataset.labels = a.labelStyle ?? 'soft';
    patchLiveMenu(a.sidebarStyle, a.sidebarColor);
  }, [a.corners, a.boxStyle, a.boxColor, a.labelStyle, menuBg]);
  const patch = (p: Partial<AppearanceSettings>) => { setA((prev) => ({ ...prev, ...p })); setMsg({ ok: true, text: 'Προεπισκόπηση — πατήστε «Αποθήκευση» για να μείνει.' }); };

  return (
    <div className="space-y-5">

      <div className="panel space-y-5 p-5">
        <div>
          <h4>Logo & favicon</h4>
          <p className="text-xs text-charcoal-600/60">Για όλη την εταιρεία. PNG με διαφάνεια ή SVG δίνουν το καλύτερο αποτέλεσμα. Οι εικόνες μικραίνουν αυτόματα.</p>
        </div>
        <ImagePicker label="Logo για το μενού" hint="Εμφανίζεται πάνω στο σκούρο μενού: συνήθως η ανοιχτόχρωμη/λευκή εκδοχή."
          value={logo} background={menuBg} busy={pending || !canEdit} maxPx={600}
          onPick={(v) => persistLogo(v)} onRemove={() => persistLogo(null)} />
        <ImagePicker label="Logo για ανοιχτό φόντο" hint="Σελίδα σύνδεσης και αλλαγής κωδικού: συνήθως η σκουρόχρωμη εκδοχή. Αν λείπει, μπαίνει το logo του μενού."
          value={a.logoOnLight} background="#F7F3EC" busy={pending || !canEdit} maxPx={600}
          onPick={(v) => { const n = { ...a, logoOnLight: v }; setA(n); persist(n, 'Το logo ανέβηκε.'); }}
          onRemove={() => { const n = { ...a, logoOnLight: null }; setA(n); persist(n, 'Το logo αφαιρέθηκε.'); }} />
        <ImagePicker label="Favicon" hint="Το μικρό εικονίδιο στην καρτέλα του browser. Τετράγωνη εικόνα, γίνεται 64×64."
          value={a.favicon} background="#FFFFFF" busy={pending || !canEdit} maxPx={64} square
          onPick={(v) => { const n = { ...a, favicon: v }; setA(n); persist(n, 'Το favicon ανέβηκε.'); }}
          onRemove={() => { const n = { ...a, favicon: null }; setA(n); persist(n, 'Το favicon αφαιρέθηκε.'); }} />
      </div>

      <div className="panel space-y-5 p-5">
        <h4>Μενού, γωνίες & κουτιά</h4>
        <div className="space-y-2">
          <p className="eyebrow">Χρώμα μενού</p>
          <div className="flex flex-wrap items-center gap-3">
            <Choice options={SIDEBAR_STYLES} value={a.sidebarStyle} onChange={(v) => patch({ sidebarStyle: v })} disabled={!canEdit} />
            {a.sidebarStyle === 'custom' && (
              <input type="color" value={a.sidebarColor} disabled={!canEdit} onChange={(e) => patch({ sidebarColor: e.target.value.toUpperCase() })}
                className="h-9 w-12 cursor-pointer rounded-md border border-stone-line bg-white p-0.5" aria-label="Χρώμα μενού" />
            )}
            <span className="h-9 w-24 rounded-md" style={{ background: menuBg }} title="Προεπισκόπηση" />
          </div>
          <p className="text-xs text-charcoal-600/60">Αν διαλέξετε πολύ ανοιχτό χρώμα, σκουραίνει αυτόματα ώστε να διαβάζεται το κείμενο του μενού.</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Γωνίες</p>
          <Choice options={CORNERS} value={a.corners} onChange={(v) => patch({ corners: v })} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Κουτιά</p>
          <Choice options={BOXES} value={a.boxStyle} onChange={(v) => patch({ boxStyle: v })} disabled={!canEdit} />
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Χρώμα κουτιών</p>
          <div className="flex flex-wrap gap-2">
            {BOX_COLORS.map((o) => (
              <button key={o.v} type="button" disabled={!canEdit} onClick={() => patch({ boxColor: o.v })}
                className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm ${(a.boxColor ?? 'white') === o.v ? 'border-forest bg-forest/[0.06] text-forest' : 'border-stone-line text-charcoal-600'}`}>
                <span className="h-4 w-4 rounded border border-stone-line" style={{ background: o.sw }} />{o.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-charcoal-600/60">Οι αποχρώσεις βγαίνουν από τα χρώματα της εταιρείας (Χρώματα & γραμματοσειρές). Τα πεδία κειμένου μένουν λευκά για να διαβάζονται.</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Ετικέτες κατάστασης</p>
          <Choice options={LABELS} value={a.labelStyle ?? 'soft'} onChange={(v) => patch({ labelStyle: v })} disabled={!canEdit} />
          <p className="flex flex-wrap gap-2 pt-1"><span className="badge-forest">Διαθέσιμη</span><span className="badge-champagne">Κρατημένη</span><span className="badge-neutral">Πρόχειρο</span></p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={pending} onClick={() => persist(a, 'Αποθηκεύτηκε. Ισχύει για όλους.')}>
              {pending ? 'Αποθήκευση…' : 'Αποθήκευση'}
            </button>
          </div>
        )}
        {msg && <p className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</p>}
      </div>
    </div>
  );
}
