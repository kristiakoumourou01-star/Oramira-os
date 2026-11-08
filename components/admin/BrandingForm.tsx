'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RotateCcw, Palette } from 'lucide-react';
import {
  DEFAULT_BRANDING,
  FONT_CATALOG,
  HEADING_FONTS,
  BODY_FONTS,
  type Branding,
  type FontKey,
} from '@/lib/branding-shared';
import { saveBranding } from '@/app/actions/branding';
import { onLiveBrand, patchLiveBrand } from '@/lib/brand-live';

const COLOR_FIELDS: { key: keyof Branding; label: string; hint: string }[] = [
  { key: 'colorPrimary', label: 'Κύριο χρώμα', hint: 'Sidebar, τίτλοι, primary κουμπιά' },
  { key: 'colorAccent', label: 'Accent', hint: 'Ενεργές ενδείξεις, key figures' },
  { key: 'colorSecondary', label: 'Δευτερεύον', hint: 'Δευτερεύουσες επιφάνειες' },
  { key: 'colorBackground', label: 'Φόντο', hint: 'Βασικό φόντο εφαρμογής' },
  { key: 'colorText', label: 'Κείμενο', hint: 'Κύριο χρώμα κειμένου' },
];

export function BrandingForm({ initial }: { initial: Branding }) {
  const [b, setB] = useState<Branding>(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const router = useRouter();
  // Ίδια χρώματα με το επάνω μέρος της Εμφάνισης (κύριο/δεύτερο).
  useEffect(() => onLiveBrand((d) => setB((p) => (p.colorPrimary === d.colorPrimary && p.colorSecondary === d.colorSecondary ? p : { ...p, colorPrimary: d.colorPrimary, colorSecondary: d.colorSecondary }))), []);

  const set = <K extends keyof Branding>(key: K, value: Branding[K]) => {
    setB((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
    if (typeof value !== 'string' || !key.startsWith('color') || /^#[0-9a-fA-F]{6}$/.test(value)) patchLiveBrand({ [key]: value } as Partial<Branding>);
  };

  function onSave() {
    startTransition(async () => {
      const res = await saveBranding({
        companyName: b.companyName,
        colorPrimary: b.colorPrimary,
        colorAccent: b.colorAccent,
        colorSecondary: b.colorSecondary,
        colorBackground: b.colorBackground,
        colorText: b.colorText,
        fontHeading: b.fontHeading,
        fontBody: b.fontBody,
        contentWidth: b.contentWidth,
        density: b.density,
      });
      if (res.ok) {
        setMsg({ ok: true, text: 'Αποθηκεύτηκε. Οι αλλαγές ισχύουν σε όλο το CRM.' });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    });
  }


  return (
    <div>
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <div className="panel space-y-4 p-5">
          <h4 className="flex items-center gap-2"><Palette size={15} className="text-olive" strokeWidth={1.75} /> Ταυτότητα</h4>
          <label className="block">
            <span className="eyebrow mb-1 block">Όνομα εταιρείας</span>
            <input className="input" value={b.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </label>
          <p className="text-xs text-charcoal-600/60">Το logo και το favicon ανεβαίνουν πιο κάτω, στο «Logo & favicon».</p>
        </div>

        <div className="panel space-y-3 p-5">
          <h4>Χρώματα</h4>
          {COLOR_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center gap-3">
              <input
                type="color"
                aria-label={f.label}
                value={b[f.key] as string}
                onChange={(e) => set(f.key, e.target.value.toUpperCase() as Branding[typeof f.key])}
                className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-stone-line bg-white p-0.5"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-charcoal">{f.label}</p>
                <p className="truncate text-xs text-charcoal-600/60">{f.hint}</p>
              </div>
              <input
                value={b[f.key] as string}
                onChange={(e) => set(f.key, e.target.value.toUpperCase() as Branding[typeof f.key])}
                className="input w-28 font-mono uppercase"
                maxLength={7}
              />
            </div>
          ))}
        </div>

        <div className="panel grid grid-cols-2 gap-4 p-5">
          <label className="block">
            <span className="eyebrow mb-1 block">Γραμματοσειρά τίτλων</span>
            <select className="input" value={b.fontHeading} onChange={(e) => set('fontHeading', e.target.value as FontKey)}>
              {HEADING_FONTS.map((k) => <option key={k} value={k}>{FONT_CATALOG[k].label}{FONT_CATALOG[k].greek ? ' · Αα' : ' · χωρίς ελληνικά'}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Γραμματοσειρά κειμένου</span>
            <select className="input" value={b.fontBody} onChange={(e) => set('fontBody', e.target.value as FontKey)}>
              {BODY_FONTS.map((k) => <option key={k} value={k}>{FONT_CATALOG[k].label}{FONT_CATALOG[k].greek ? ' · Αα' : ' · χωρίς ελληνικά'}</option>)}
            </select>
          </label>
        </div>

        <div className="panel space-y-4 p-5">
          <h4>Διάταξη</h4>
          <div>
            <span className="eyebrow mb-1.5 block">Πλάτος περιεχομένου</span>
            <div className="flex rounded-lg border border-stone-line p-0.5">
              {([['standard', 'Κανονικό'], ['wide', 'Πλατύ'], ['full', 'Πλήρες']] as const).map(([v, label]) => (
                <button key={v} onClick={() => set('contentWidth', v)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${b.contentWidth === v ? 'bg-forest text-stone-100' : 'text-charcoal-600 hover:text-forest'}`}>{label}</button>
              ))}
            </div>
          </div>
          <div>
            <span className="eyebrow mb-1.5 block">Πυκνότητα</span>
            <div className="flex rounded-lg border border-stone-line p-0.5">
              {([['comfortable', 'Άνετη'], ['compact', 'Συμπαγής']] as const).map(([v, label]) => (
                <button key={v} onClick={() => set('density', v)} className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium ${b.density === v ? 'bg-forest text-stone-100' : 'text-charcoal-600 hover:text-forest'}`}>{label}</button>
              ))}
            </div>
            <p className="mt-1.5 text-xs text-charcoal-600/60">Η συμπαγής μειώνει τα κενά σε κάρτες, πίνακες και κουμπιά σε όλο το CRM.</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onSave} disabled={isPending} className="btn-primary">
            <Check size={15} strokeWidth={1.75} /> {isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}
          </button>
          <button onClick={() => { setB({ ...DEFAULT_BRANDING }); setMsg(null); patchLiveBrand({ ...DEFAULT_BRANDING, companyName: b.companyName }); }} disabled={isPending} className="btn-ghost">
            <RotateCcw size={14} strokeWidth={1.75} /> Επαναφορά default
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>
          )}
        </div>
      </div>

    </div>
  );
}
