'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Plus, Trash2, Search, MapPin } from 'lucide-react';
import { saveBusinessSettings } from '@/app/actions/org-settings';
import { saveBrandBasics, saveLogo } from '@/app/actions/branding';
import type { BusinessSettings, Office } from '@/lib/org-settings-shared';
import { PhoneInput, COUNTRIES } from '@/components/ui/PhoneInput';
import { SettingsBlock, FieldLabel, LogoDrop, ColorField } from '@/components/admin/settings-ui';

const EMPTY_OFFICE: Office = { name: '', address: '', phone: '', manager: '', main: false };
interface Hit { display_name: string; lat: string; lon: string; address?: Record<string, string>; area?: boolean }

/** Χωρίζει «1st of April 28, 3117» σε οδό, αριθμό και ταχυδρομικό κώδικα. */
export function parseAddressQuery(raw: string): { street: string; number: string; postcode: string } {
  const t = raw.trim();
  const postcode = t.match(/(?:^|[\s,])(\d{4,5})(?=$|[\s,])/)?.[1] ?? '';
  const rest = (postcode ? t.replace(new RegExp(`(^|[\\s,])${postcode}(?=$|[\\s,])`), ' ') : t).replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').replace(/^[,\s]+|[,\s]+$/g, '');
  const nums = [...rest.matchAll(/(?:^|[\s,])(\d{1,4}[A-Za-zΑ-Ωα-ω]?)(?=$|[\s,])/g)].map((m) => m[1]);
  return { street: rest, number: nums[nums.length - 1] ?? '', postcode };
}

/**
 * Settings → Στοιχεία εταιρείας, στη μορφή του demo: «Ταυτότητα & branding»
 * (επωνυμία, εμπορική ονομασία, ΑΦΜ, logo, χρώματα) και «Διεύθυνση &
 * επικοινωνία» με αναζήτηση στον χάρτη (OpenStreetMap), συντεταγμένες και
 * προεπισκόπηση χάρτη. Από κάτω: άδεια, τιμολόγια, υποσέλιδο, γραφεία.
 */
export function BusinessSection({ initial, companyName, canEdit, logoUrl = null, colorPrimary = '#1E3A2F', colorSecondary = '' }: {
  initial: BusinessSettings; companyName: string; canEdit: boolean; logoUrl?: string | null; colorPrimary?: string; colorSecondary?: string;
}) {
  const [b, setB] = useState<BusinessSettings>({ ...initial, offices: initial.offices.length ? initial.offices : [] });
  const [brand, setBrand] = useState({ name: companyName, primary: colorPrimary, secondary: colorSecondary });
  const [logo, setLogo] = useState<string | null>(logoUrl);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const dis = !canEdit;

  const set = <K extends keyof BusinessSettings>(k: K, v: BusinessSettings[K]) => { setB((p) => ({ ...p, [k]: v })); setMsg(null); };
  const setOffice = (i: number, patch: Partial<Office>) => set('offices', b.offices.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  const addOffice = () => set('offices', [...b.offices, { ...EMPTY_OFFICE, main: b.offices.length === 0 }]);
  const removeOffice = (i: number) => set('offices', b.offices.filter((_, idx) => idx !== i));
  const makeMain = (i: number) => set('offices', b.offices.map((o, idx) => ({ ...o, main: idx === i })));

  // Συνάρτηση (όχι component): αλλιώς το input ξαναφτιάχνεται σε κάθε πλήκτρο και χάνει το focus.
  const field = (label: string, k: keyof BusinessSettings, placeholder?: string, type = 'text') => (
    <label className="block" key={k}>
      <FieldLabel>{label}</FieldLabel>
      <input className="input" type={type} disabled={dis} value={(b[k] as string) ?? ''} placeholder={placeholder} onChange={(e) => set(k, e.target.value as any)} />
    </label>
  );

  async function nom(params: Record<string, string>): Promise<Hit[]> {
    const u = new URLSearchParams({ format: 'json', addressdetails: '1', limit: '6', 'accept-language': 'el,en', ...params });
    if (b.country) u.set('countrycodes', b.country.toLowerCase());
    try { const r = await fetch(`https://nominatim.openstreetmap.org/search?${u}`); return r.ok ? await r.json() : []; } catch { return []; }
  }
  /**
   * Αναζήτηση: αν γράψατε ταχυδρομικό κώδικα, ψάχνει οδό + Τ.Κ. και βάζει πρώτα
   * τα αποτελέσματα με αυτόν τον κώδικα. Αν η οδός δεν υπάρχει στον χάρτη (συχνό
   * στην Κύπρο), δείχνει την περιοχή του Τ.Κ. και κρατά την οδό όπως τη γράψατε.
   */
  async function search() {
    const raw = q.trim();
    if (!raw) return;
    setSearching(true); setHits(null);
    const { street, postcode } = parseAddressQuery(raw);
    let out: Hit[] = [];
    if (postcode) {
      const [structured, free] = await Promise.all([street ? nom({ street, postalcode: postcode }) : Promise.resolve([]), nom({ q: `${street} ${postcode}`.trim() })]);
      const same = (h: Hit) => (h.address?.postcode ?? '').replace(/\s/g, '') === postcode;
      out = [...structured, ...free.filter(same)];
      if (out.length === 0) out = (await nom({ postalcode: postcode })).slice(0, 3).map((h) => ({ ...h, area: true }));
      if (out.length === 0) out = free;
    } else {
      out = await nom({ q: raw });
    }
    const seen = new Set<string>();
    setHits(out.filter((h) => { const k = `${h.lat},${h.lon}`; if (seen.has(k)) return false; seen.add(k); return true; }));
    setSearching(false);
  }
  function pick(h: Hit) {
    const a = h.address ?? {};
    const typed = parseAddressQuery(q);
    let road = [a.road ?? a.pedestrian ?? '', a.house_number ?? ''].filter(Boolean).join(' ');
    if (road && !a.house_number && typed.number) road = `${road} ${typed.number}`; // ο χάρτης συχνά δεν έχει αριθμούς σπιτιών
    if (h.area || !road) road = typed.street || h.display_name.split(',')[0];
    const cc = (a.country_code ?? '').toUpperCase();
    setB((p) => ({
      ...p,
      address1: road,
      address2: a.suburb ?? a.neighbourhood ?? a.village ?? '',
      city: a.city ?? a.town ?? a.village ?? a.municipality ?? '',
      region: a.state_district ?? a.state ?? a.county ?? '',
      postalCode: typed.postcode || a.postcode || '',
      country: COUNTRIES.some((c) => c.iso === cc) ? cc : p.country,
      lat: Number(h.lat).toFixed(6), lng: Number(h.lon).toFixed(6),
    }));
    setMsg(null); setHits(null); setQ(h.area ? `${road}, ${h.display_name}` : h.display_name);
  }
  const [locMsg, setLocMsg] = useState<string | null>(null);
  function useMyLocation() {
    if (!navigator.geolocation) { setLocMsg('Ο browser δεν δίνει τοποθεσία.'); return; }
    setLocMsg('Εντοπισμός…');
    navigator.geolocation.getCurrentPosition(
      (pos) => { set('lat', pos.coords.latitude.toFixed(6)); set('lng', pos.coords.longitude.toFixed(6)); setLocMsg('Ο χάρτης δείχνει την τρέχουσα θέση σας — αν είστε στο γραφείο, αυτή είναι η σωστή.'); },
      () => setLocMsg('Δεν δόθηκε άδεια τοποθεσίας.'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  const lat = Number(b.lat), lng = Number(b.lng);
  const hasMap = b.lat !== '' && b.lng !== '' && Number.isFinite(lat) && Number.isFinite(lng);
  const d = 0.004;
  const mapSrc = hasMap ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d}%2C${lat - d}%2C${lng + d}%2C${lat + d}&layer=mapnik&marker=${lat}%2C${lng}` : '';

  function onSave() {
    startTransition(async () => {
      const r1 = await saveBusinessSettings(b);
      const changedBrand = brand.name !== companyName || brand.primary !== colorPrimary || brand.secondary !== colorSecondary;
      const r2 = r1.ok && changedBrand
        ? await saveBrandBasics({ companyName: brand.name, colorPrimary: brand.primary, ...(brand.secondary ? { colorSecondary: brand.secondary } : {}) })
        : r1;
      if (r1.ok && r2.ok) { setMsg({ ok: true, text: 'Αποθηκεύτηκε.' }); router.refresh(); }
      else setMsg({ ok: false, text: (!r1.ok ? r1.error : !r2.ok ? r2.error : '') || 'Αποτυχία.' });
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-charcoal-600/75">Η ταυτότητα της εταιρείας, το brand, η διεύθυνση και τα στοιχεία επικοινωνίας.</p>

      <SettingsBlock title="Ταυτότητα & branding">
        {field('Επίσημη επωνυμία', 'officialName', 'π.χ. Oramira Ltd')}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <FieldLabel>Εμπορική ονομασία (brand)</FieldLabel>
            <input className="input" disabled={dis} value={brand.name} onChange={(e) => { setBrand({ ...brand, name: e.target.value }); setMsg(null); }} />
          </label>
          {field('ΑΦΜ / VAT ID', 'vatNo', 'CY00000000X')}
          {field('Αριθμός εγγραφής', 'registrationNo', 'HE 000000')}
          {field('Άδεια / μητρώο (προαιρετικό)', 'licence', 'π.χ. αρ. μητρώου εργολήπτη — κενό αν δεν ισχύει')}
        </div>
        <div>
          <FieldLabel>Logo</FieldLabel>
          <LogoDrop value={logo} disabled={dis} hint="Το logo της εταιρείας (εμφανίζεται στο μενού και στα έγγραφα)."
            onChange={async (v) => { const r = await saveLogo(v); if (r.ok) { setLogo(v); router.refresh(); } else setMsg({ ok: false, text: r.error }); }} />
        </div>
        <div className="space-y-2 border-t border-stone-line pt-4">
          <p className="font-display text-lg text-charcoal">Χρώματα brand — για όλους</p>
          <p className="text-sm text-charcoal-600/70">Τα χρώματα αυτά ισχύουν σε όλη την εταιρεία.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block"><FieldLabel>Κύριο</FieldLabel><ColorField value={brand.primary} disabled={dis} onChange={(v) => setBrand({ ...brand, primary: v })} /></label>
            <label className="block"><FieldLabel>Δεύτερο</FieldLabel><ColorField value={brand.secondary} disabled={dis} placeholder="#BFAB88" onChange={(v) => setBrand({ ...brand, secondary: v })} /><span className="mt-1 block text-xs text-charcoal-600/60">Δευτερεύουσες επιφάνειες: καρτέλες, αναζήτηση, μπάρες.</span></label>
          </div>
        </div>
      </SettingsBlock>

      <SettingsBlock title="Διεύθυνση & επικοινωνία">
        <div>
          <FieldLabel>Βρείτε τη διεύθυνση</FieldLabel>
          <div className="flex gap-2">
            <label className="relative flex-1">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
              <input className="input pl-9" disabled={dis} value={q} placeholder="Αρχίστε να γράφετε μια διεύθυνση…" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }} />
            </label>
            <button type="button" disabled={dis || searching} onClick={() => void search()} className="btn-secondary">{searching ? '…' : 'Αναζήτηση'}</button>
            <button type="button" disabled={dis} onClick={useMyLocation} className="btn-ghost" title="Η τρέχουσα θέση μου"><MapPin size={15} /> <span className="hidden sm:inline">Είμαι εδώ</span></button>
          </div>
          <p className="mt-1 text-xs text-charcoal-600/60">Γράψτε οδό, αριθμό και ταχυδρομικό κώδικα (π.χ. «1ης Απριλίου 28, 3117»). Αν η οδός δεν υπάρχει στον χάρτη, διαλέξτε την περιοχή — η διεύθυνση κρατιέται όπως τη γράψατε. Ή πατήστε «Είμαι εδώ» όταν είστε στο γραφείο.</p>
          {locMsg && <p className="mt-1 text-xs text-forest">{locMsg}</p>}
          {hits && (
            <ul className="mt-2 divide-y divide-stone-line overflow-hidden rounded-lg border border-stone-line bg-white text-sm">
              {hits.length === 0 && <li className="px-3 py-2 text-charcoal-600/70">Δεν βρέθηκε. Δοκιμάστε πιο απλά (οδός, πόλη).</li>}
              {hits.map((h) => <li key={`${h.lat},${h.lon}`}><button type="button" onClick={() => pick(h)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-stone"><MapPin size={14} className="mt-0.5 shrink-0 text-olive" /><span>{h.area && <span className="mr-1 font-medium text-charcoal">Περιοχή Τ.Κ. —</span>}{h.display_name}{h.area && <span className="block text-xs text-charcoal-600/70">Η οδός δεν βρέθηκε στον χάρτη· θα κρατηθεί όπως τη γράψατε.</span>}</span></button></li>)}
            </ul>
          )}
        </div>
        {field('Διεύθυνση (γραμμή 1)', 'address1')}
        {field('Διεύθυνση (γραμμή 2)', 'address2')}
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Πόλη', 'city')}
          {field('Επαρχία / περιοχή', 'region')}
          {field('Ταχυδρομικός κώδικας', 'postalCode')}
          <label className="block">
            <FieldLabel>Χώρα</FieldLabel>
            <select className="input" disabled={dis} value={b.country} onChange={(e) => set('country', e.target.value)}>
              {COUNTRIES.map((c) => <option key={c.iso} value={c.iso}>{c.name}</option>)}
            </select>
          </label>
          <label className="block"><FieldLabel>Σταθερό</FieldLabel><PhoneInput disabled={dis} value={b.landline} onChange={(v) => set('landline', v)} /></label>
          <label className="block"><FieldLabel>Κινητό</FieldLabel><PhoneInput disabled={dis} value={b.mobile} onChange={(v) => set('mobile', v)} /></label>
          {field('Γεωγρ. πλάτος (latitude)', 'lat', '34.684100')}
          {field('Γεωγρ. μήκος (longitude)', 'lng', '33.037900')}
        </div>
        <div className="overflow-hidden rounded-xl border border-dashed border-stone-line">
          {hasMap
            ? <iframe title="Χάρτης" src={mapSrc} className="h-64 w-full border-0" loading="lazy" />
            : <p className="flex h-40 items-center justify-center px-4 text-center text-sm text-charcoal-600/70">Αναζητήστε μια διεύθυνση ή γράψτε συντεταγμένες για να δείτε τον χάρτη.</p>}
        </div>
      </SettingsBlock>

      <SettingsBlock title="Τιμολόγια & έγγραφα">
        <div className="grid gap-3 sm:grid-cols-2">
          {field('Email τιμολογίων', 'invoiceEmail', 'accounts@company.cy', 'email')}
          {field('Ιστοσελίδα', 'website', 'company.cy')}
        </div>
        <label className="block">
          <FieldLabel>Υποσέλιδο εγγράφων</FieldLabel>
          <textarea className="input min-h-[64px]" disabled={dis} value={b.footer} placeholder="Εταιρεία · Αρ. εγγραφής · Τράπεζα / IBAN…" onChange={(e) => set('footer', e.target.value)} />
        </label>
      </SettingsBlock>

      <SettingsBlock title="Γραφεία">
        <div className="flex items-center justify-between">
          <p className="text-sm text-charcoal-600/70">{b.offices.length ? `${b.offices.length} γραφεία` : 'Δεν υπάρχουν γραφεία ακόμα.'}</p>
          {canEdit && <button type="button" onClick={addOffice} className="btn-ghost text-xs"><Plus size={13} /> Νέο γραφείο</button>}
        </div>
        <div className="space-y-3">
          {b.offices.map((o, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border border-stone-line p-2">
              <input className="input min-w-[8rem] flex-1" disabled={dis} placeholder="Πόλη / όνομα" value={o.name} onChange={(e) => setOffice(i, { name: e.target.value })} />
              <input className="input min-w-[10rem] flex-[1.4]" disabled={dis} placeholder="Διεύθυνση" value={o.address} onChange={(e) => setOffice(i, { address: e.target.value })} />
              <PhoneInput className="min-w-[14rem] flex-1" disabled={dis} placeholder="Τηλέφωνο" value={o.phone} onChange={(v) => setOffice(i, { phone: v })} />
              <button type="button" onClick={() => makeMain(i)} disabled={dis} className={`badge ${o.main ? 'badge-forest' : 'badge-neutral'}`}>{o.main ? 'Κεντρικό' : 'Ορισμός κεντρικού'}</button>
              {canEdit && <button type="button" onClick={() => removeOffice(i)} className="text-signal-danger/70 hover:text-signal-danger" aria-label="Διαγραφή γραφείου"><Trash2 size={15} /></button>}
            </div>
          ))}
        </div>
      </SettingsBlock>

      {canEdit && (
        <div className="sticky bottom-3 z-10 flex items-center gap-3 rounded-xl border border-stone-line bg-white/95 px-4 py-3 shadow-sm backdrop-blur">
          <button type="button" onClick={onSave} disabled={isPending} className="btn-primary"><Check size={15} /> {isPending ? 'Αποθήκευση…' : 'Αποθήκευση'}</button>
          {msg && <span className={`text-sm ${msg.ok ? 'text-forest' : 'text-signal-danger'}`}>{msg.text}</span>}
        </div>
      )}
    </div>
  );
}
