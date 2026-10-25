'use client';

import { useState, useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { Check, RotateCcw, Palette } from 'lucide-react';
import {
  DEFAULT_BRANDING,
  FONT_CATALOG,
  HEADING_FONTS,
  BODY_FONTS,
  brandStyleObject,
  type Branding,
  type FontKey,
} from '@/lib/branding-shared';
import { saveBranding } from '@/app/actions/branding';

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

  const set = <K extends keyof Branding>(key: K, value: Branding[K]) => {
    setB((prev) => ({ ...prev, [key]: value }));
    setMsg(null);
  };

  function onSave() {
    startTransition(async () => {
      const res = await saveBranding({
        companyName: b.companyName,
        logoUrl: b.logoUrl ?? '',
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

  const previewStyle = brandStyleObject(b) as CSSProperties;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      {/* ---- Controls ---- */}
      <div className="space-y-5">
        <div className="panel space-y-4 p-5">
          <h4 className="flex items-center gap-2"><Palette size={15} className="text-olive" strokeWidth={1.75} /> Ταυτότητα</h4>
          <label className="block">
            <span className="eyebrow mb-1 block">Όνομα εταιρείας</span>
            <input className="input" value={b.companyName} onChange={(e) => set('companyName', e.target.value)} />
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Logo URL (προαιρετικό)</span>
            <input
              className="input"
              placeholder="https://…/logo.png"
              value={b.logoUrl ?? ''}
              onChange={(e) => set('logoUrl', e.target.value || null)}
            />
            <span className="mt-1 block text-xs text-charcoal-600/60">Αν κενό, εμφανίζεται το όνομα ως wordmark. Διαφανές PNG/SVG συνιστάται.</span>
          </label>
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
              {HEADING_FONTS.map((k) => <option key={k} value={k}>{FONT_CATALOG[k].label}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block">Γραμματοσειρά κειμένου</span>
            <select className="input" value={b.fontBody} onChange={(e) => set('fontBody', e.target.value as FontKey)}>
              {BODY_FONTS.map((k) => <option key={k} value={k}>{FONT_CATALOG[k].label}</option>)}
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
          <button onClick={() => { setB({ ...DEFAULT_BRANDING }); setMsg(null); }} disabled={isPending} className="btn-ghost">
            <RotateCcw size={14} strokeWidth={1.75} /> Επαναφορά default
          </button>
          {msg && (
            <span className={`text-sm ${msg.ok ? 'text-signal-success' : 'text-signal-danger'}`}>{msg.text}</span>
          )}
        </div>
      </div>

      {/* ---- Live preview ---- */}
      <div className="lg:sticky lg:top-5 lg:self-start">
        <p className="eyebrow mb-2">Προεπισκόπηση</p>
        <div style={previewStyle} className="overflow-hidden rounded-[18px] bg-stone shadow-overlay">
          <div className="flex h-[320px]">
            {/* mini sidebar */}
            <div className="flex w-20 flex-col gap-2 bg-gradient-to-b from-forest-deep to-forest p-3">
              <div className="mb-2 h-4 rounded bg-champagne/80" />
              <div className="h-2 rounded bg-white/25" />
              <div className="h-2 w-3/4 rounded bg-white/15" />
              <div className="h-2 w-2/3 rounded bg-white/15" />
              <div className="mt-auto h-2 w-1/2 rounded bg-champagne/60" />
            </div>
            {/* body */}
            <div className="flex-1 space-y-3 p-4">
              <h3 className="text-xl">{b.companyName} OS</h3>
              <p className="font-sans text-xs text-charcoal-600">Δείγμα κειμένου σώματος με την επιλεγμένη γραμματοσειρά.</p>
              <div className="panel space-y-2 p-3">
                <div className="flex items-center justify-between">
                  <span className="eyebrow">Έσοδα</span>
                  <span className="figure text-champagne-600">€1.240.000</span>
                </div>
                <div className="h-2 rounded bg-sand" />
                <div className="h-2 w-2/3 rounded bg-sand-300" />
              </div>
              <div className="flex gap-2">
                <span className="btn-primary !px-3 !py-1.5 !text-xs">Primary</span>
                <span className="badge-forest">Badge</span>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-charcoal-600/60">Οι σκιάσεις (shades) παράγονται αυτόματα από τα χρώματά σου.</p>
      </div>
    </div>
  );
}
