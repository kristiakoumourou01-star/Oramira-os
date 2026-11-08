'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Monitor } from 'lucide-react';
import { setMyLocale } from '@/app/actions/locale';
import { LANGS, type Lang, type NumFmt } from '@/lib/locale-shared';
import { reapplyLiveBrand } from '@/lib/brand-live';
import { Switch, SettingsBlock, FieldLabel } from '@/components/admin/settings-ui';

const PREFS_KEY = 'oramira:display';

type Theme = 'light' | 'dark' | 'system';
function readDisplay(): { scale: number; reduceMotion: boolean; theme: Theme; highContrast: boolean } {
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); return { scale: Number(p.scale) || 100, reduceMotion: p.reduceMotion === true, theme: ['dark', 'system'].includes(p.theme) ? p.theme : 'light', highContrast: p.highContrast === true }; } catch { return { scale: 100, reduceMotion: false, theme: 'light', highContrast: false }; }
}
function writeDisplay(patch: { scale?: number; reduceMotion?: boolean; theme?: Theme; highContrast?: boolean }) {
  let cur: any = {};
  try { cur = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { /* */ }
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  const d = document.documentElement;
  if (patch.scale !== undefined) d.style.setProperty('--ui-zoom', String(patch.scale / 100));
  if (patch.reduceMotion !== undefined) { if (patch.reduceMotion) d.dataset.motion = 'reduce'; else delete d.dataset.motion; }
  if (patch.highContrast !== undefined) { if (patch.highContrast) d.dataset.contrast = 'high'; else delete d.dataset.contrast; }
  if (patch.theme !== undefined) {
    const dark = patch.theme === 'dark' || (patch.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    d.dataset.theme = dark ? 'dark' : 'light';
    reapplyLiveBrand();
  }
}
const THEMES: { v: Theme; label: string; hint: string; icon: typeof Sun }[] = [
  { v: 'light', label: 'Ανοιχτό', hint: 'Προεπιλογή', icon: Sun },
  { v: 'dark', label: 'Σκούρο', hint: 'Για χαμηλό φως', icon: Moon },
  { v: 'system', label: 'Όπως η συσκευή', hint: 'Ακολουθεί το σύστημα', icon: Monitor },
];


/**
 * Ο λογαριασμός μου → Εμφάνιση: οι προσωπικές επιλογές (θέμα, μέγεθος
 * γραμματοσειράς, κίνηση, αντίθεση, γλώσσα). Ισχύουν μόνο για εμένα — οι
 * ρυθμίσεις της εταιρείας (χρώματα, logo) είναι στο Settings → Εμφάνιση.
 */
export function PersonalDisplay({ lang, num }: { lang: Lang; num: NumFmt }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [scale, setScale] = useState(100);
  const [motion, setMotion] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [contrast, setContrast] = useState(false);
  const [myLang, setMyLang] = useState<Lang>(lang);
  useEffect(() => { const p = readDisplay(); setScale(p.scale); setMotion(p.reduceMotion); setTheme(p.theme); setContrast(p.highContrast); }, []);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h3 className="font-display text-xl text-charcoal">Θέμα</h3>
        <p className="text-sm text-charcoal-600/75">Προσωπικό — ισχύει μόνο σε αυτή τη συσκευή.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button key={t.v} type="button" aria-pressed={theme === t.v} onClick={() => { setTheme(t.v); writeDisplay({ theme: t.v }); }}
              className={`flex items-center gap-3 rounded-xl border p-3 text-left ${theme === t.v ? 'border-forest bg-forest/[0.05] ring-1 ring-forest/40' : 'border-stone-line bg-white hover:border-forest/40'}`}>
              <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${t.v === 'dark' ? 'bg-[#15171A] text-white' : t.v === 'light' ? 'border border-stone-line bg-white text-charcoal' : 'bg-gradient-to-r from-white to-[#15171A] text-forest'}`}><t.icon size={16} /></span>
              <span><span className="block text-sm font-medium text-charcoal">{t.label}</span><span className="text-xs text-charcoal-600/60">{t.hint}</span></span>
            </button>
          ))}
        </div>
      </section>

      <SettingsBlock title="Μέγεθος γραμματοσειράς" note="Προσωπικό — ισχύει μόνο σε αυτή τη συσκευή.">
        <div className="flex items-center gap-4">
          <span className="text-sm text-charcoal">A</span>
          <input type="range" min={85} max={130} step={5} value={scale} aria-label="Μέγεθος γραμματοσειράς" className="flex-1 accent-[var(--color-primary,#1E3A2F)]"
            onChange={(e) => { const v = Number(e.target.value); setScale(v); writeDisplay({ scale: v }); }} />
          <span className="text-xl text-charcoal">A</span>
          <span className="w-14 text-right font-mono text-sm text-forest">{(scale / 100).toFixed(2)}×</span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><p className="font-medium text-charcoal">Μείωση κίνησης</p><p className="text-sm text-charcoal-600/70">Χωρίς μεταβάσεις και animations.</p></div>
          <Switch checked={motion} label="Μείωση κίνησης" onChange={(v) => { setMotion(v); writeDisplay({ reduceMotion: v }); }} />
        </div>
        <div className="flex items-center justify-between gap-4">
          <div><p className="font-medium text-charcoal">Έντονη αντίθεση</p><p className="text-sm text-charcoal-600/70">Πιο σκούρα γράμματα και γραμμές.</p></div>
          <Switch checked={contrast} label="Έντονη αντίθεση" onChange={(v) => { setContrast(v); writeDisplay({ highContrast: v }); }} />
        </div>
      </SettingsBlock>


      <SettingsBlock title="Γλώσσα">
        <label className="block max-w-xs">
          <FieldLabel>Γλώσσα εφαρμογής</FieldLabel>
          <select className="input" value={myLang} onChange={(e) => { const l = e.target.value as Lang; setMyLang(l); start(async () => { await setMyLocale(l, num); router.refresh(); }); }}>
            {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </label>
      </SettingsBlock>
    </div>
  );
}
