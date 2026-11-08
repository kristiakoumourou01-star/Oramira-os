'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { saveBrandBasics, saveLogo } from '@/app/actions/branding';
import { saveOrgSlice } from '@/app/actions/org-settings';
import { setMyLocale } from '@/app/actions/locale';
import { LANGS, type Lang, type NumFmt } from '@/lib/locale-shared';
import type { LayoutSettings } from '@/lib/org-settings-shared';
import { Switch, SettingsBlock, FieldLabel, LogoDrop, ColorField } from '@/components/admin/settings-ui';

const PREFS_KEY = 'oramira:display';
const SWATCHES = ['#1E3A2F', '#159947', '#2F6F6A', '#2563EB', '#7C3AED', '#C0396B', '#D9612B'];

function readDisplay(): { scale: number; reduceMotion: boolean } {
  try { const p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); return { scale: Number(p.scale) || 100, reduceMotion: p.reduceMotion === true }; } catch { return { scale: 100, reduceMotion: false }; }
}
function writeDisplay(patch: { scale?: number; reduceMotion?: boolean }) {
  let cur: any = {};
  try { cur = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'); } catch { /* */ }
  const next = { ...cur, ...patch };
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); } catch { /* private mode */ }
  const d = document.documentElement;
  if (patch.scale !== undefined) d.style.setProperty('--ui-zoom', String(patch.scale / 100));
  if (patch.reduceMotion !== undefined) { if (patch.reduceMotion) d.dataset.motion = 'reduce'; else delete d.dataset.motion; }
}

/**
 * Settings → Εμφάνιση (επάνω μέρος), στη μορφή του demo: μέγεθος γραμματοσειράς,
 * μείωση κίνησης, γλώσσα, πρώτη μέρα εβδομάδας, χρώματα brand με έτοιμες
 * αποχρώσεις, logo. Μέγεθος/κίνηση/γλώσσα είναι προσωπικά· τα υπόλοιπα για όλους.
 */
export function AppearanceBasics({ primary, secondary, logoUrl, layout, lang, num, canEdit }: {
  primary: string; secondary: string; logoUrl: string | null; layout: LayoutSettings; lang: Lang; num: NumFmt; canEdit: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [scale, setScale] = useState(100);
  const [motion, setMotion] = useState(false);
  const [myLang, setMyLang] = useState<Lang>(lang);
  const [week, setWeek] = useState(layout.weekStart);
  const [c1, setC1] = useState(primary);
  const [c2, setC2] = useState(secondary);
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { const p = readDisplay(); setScale(p.scale); setMotion(p.reduceMotion); }, []);

  const saveColors = () => start(async () => {
    const r = await saveBrandBasics({ colorPrimary: c1, ...(c2 ? { colorSecondary: c2 } : {}) });
    setMsg(r.ok ? { ok: true, text: 'Τα χρώματα εφαρμόστηκαν για όλους.' } : { ok: false, text: r.error });
    if (r.ok) router.refresh();
  });

  return (
    <div className="space-y-6">
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
      </SettingsBlock>

      <SettingsBlock title="Προτιμήσεις">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Γλώσσα (η δική μου)</FieldLabel>
            <select className="input" value={myLang} onChange={(e) => { const l = e.target.value as Lang; setMyLang(l); start(async () => { await setMyLocale(l, num); router.refresh(); }); }}>
              {LANGS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          <label className="block">
            <FieldLabel>Η εβδομάδα ξεκινά (για όλους)</FieldLabel>
            <select className="input" disabled={!canEdit} value={week} onChange={(e) => {
              const w = e.target.value as LayoutSettings['weekStart']; setWeek(w);
              start(async () => { const r = await saveOrgSlice('layout', { ...layout, weekStart: w }); setMsg(r.ok ? { ok: true, text: 'Αποθηκεύτηκε.' } : { ok: false, text: r.error }); if (r.ok) router.refresh(); });
            }}>
              <option value="monday">Δευτέρα</option><option value="sunday">Κυριακή</option><option value="saturday">Σάββατο</option>
            </select>
          </label>
        </div>
      </SettingsBlock>

      <section className="space-y-2">
        <h3 className="flex flex-wrap items-baseline gap-3 font-display text-xl text-charcoal">Χρώμα brand · κύριο <span className="font-sans text-[11px] font-semibold uppercase tracking-wide text-charcoal-600/70">Για όλους</span></h3>
        <p className="text-sm text-charcoal-600/75">Το χρώμα ισχύει σε όλη την εταιρεία και φαίνεται στην οθόνη κάθε συνεργάτη. Οι προσωπικές επιλογές πιο κάτω μένουν μόνο σε αυτή τη συσκευή.</p>
        <div className="panel space-y-4 p-5">
          <div className="flex flex-wrap items-center gap-3">
            {SWATCHES.map((c) => (
              <button key={c} type="button" disabled={!canEdit} onClick={() => setC1(c)} aria-label={`Χρώμα ${c}`}
                className={`h-14 w-14 rounded-2xl transition-transform hover:scale-105 ${c1.toUpperCase() === c ? 'ring-4 ring-offset-2' : ''}`} style={{ background: c, ['--tw-ring-color' as any]: `${c}66` }} />
            ))}
            <input type="color" disabled={!canEdit} value={/^#[0-9a-fA-F]{6}$/.test(c1) ? c1 : '#1E3A2F'} onChange={(e) => setC1(e.target.value.toUpperCase())} className="h-10 w-14 cursor-pointer rounded border border-stone-line" aria-label="Δικό σας χρώμα" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><FieldLabel>Χρώμα brand · κύριο</FieldLabel><ColorField value={c1} disabled={!canEdit} onChange={setC1} /></label>
            <label className="block"><FieldLabel>Χρώμα brand · δεύτερο</FieldLabel><ColorField value={c2} disabled={!canEdit} placeholder="#2563EB" onChange={setC2} />
              <span className="mt-1 block text-xs text-charcoal-600/60">Προαιρετικό, για διχρωμία στα γραφήματα.</span></label>
          </div>
          {canEdit && <button type="button" disabled={pending || (c1 === primary && c2 === secondary)} onClick={saveColors} className="btn-primary"><Check size={15} /> {pending ? 'Αποθήκευση…' : 'Εφαρμογή χρωμάτων'}</button>}
          <div>
            <FieldLabel>Logo</FieldLabel>
            <LogoDrop value={logo} disabled={!canEdit} onChange={async (v) => { const r = await saveLogo(v); if (r.ok) { setLogo(v); router.refresh(); } else setMsg({ ok: false, text: r.error }); }} />
          </div>
          {msg && <p className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</p>}
        </div>
      </section>
    </div>
  );
}
