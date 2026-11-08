'use client';

import { useEffect, useState } from 'react';

/** Χώρες με κωδικό κλήσης· πρώτες όσες χρησιμοποιούνται συχνότερα. */
export const COUNTRIES: { iso: string; name: string; code: string }[] = [
  { iso: 'CY', name: 'Κύπρος', code: '+357' }, { iso: 'GR', name: 'Ελλάδα', code: '+30' }, { iso: 'GB', name: 'Ην. Βασίλειο', code: '+44' },
  { iso: 'IL', name: 'Ισραήλ', code: '+972' }, { iso: 'LB', name: 'Λίβανος', code: '+961' }, { iso: 'RU', name: 'Ρωσία', code: '+7' },
  { iso: 'UA', name: 'Ουκρανία', code: '+380' }, { iso: 'DE', name: 'Γερμανία', code: '+49' }, { iso: 'FR', name: 'Γαλλία', code: '+33' },
  { iso: 'IT', name: 'Ιταλία', code: '+39' }, { iso: 'NL', name: 'Ολλανδία', code: '+31' }, { iso: 'BE', name: 'Βέλγιο', code: '+32' },
  { iso: 'ES', name: 'Ισπανία', code: '+34' }, { iso: 'PT', name: 'Πορτογαλία', code: '+351' }, { iso: 'IE', name: 'Ιρλανδία', code: '+353' },
  { iso: 'CH', name: 'Ελβετία', code: '+41' }, { iso: 'AT', name: 'Αυστρία', code: '+43' }, { iso: 'SE', name: 'Σουηδία', code: '+46' },
  { iso: 'NO', name: 'Νορβηγία', code: '+47' }, { iso: 'DK', name: 'Δανία', code: '+45' }, { iso: 'FI', name: 'Φινλανδία', code: '+358' },
  { iso: 'PL', name: 'Πολωνία', code: '+48' }, { iso: 'RO', name: 'Ρουμανία', code: '+40' }, { iso: 'BG', name: 'Βουλγαρία', code: '+359' },
  { iso: 'CZ', name: 'Τσεχία', code: '+420' }, { iso: 'HU', name: 'Ουγγαρία', code: '+36' }, { iso: 'RS', name: 'Σερβία', code: '+381' },
  { iso: 'TR', name: 'Τουρκία', code: '+90' }, { iso: 'AE', name: 'ΗΑΕ', code: '+971' }, { iso: 'SA', name: 'Σ. Αραβία', code: '+966' },
  { iso: 'QA', name: 'Κατάρ', code: '+974' }, { iso: 'KW', name: 'Κουβέιτ', code: '+965' }, { iso: 'EG', name: 'Αίγυπτος', code: '+20' },
  { iso: 'JO', name: 'Ιορδανία', code: '+962' }, { iso: 'IR', name: 'Ιράν', code: '+98' }, { iso: 'IN', name: 'Ινδία', code: '+91' },
  { iso: 'CN', name: 'Κίνα', code: '+86' }, { iso: 'ZA', name: 'Ν. Αφρική', code: '+27' }, { iso: 'NG', name: 'Νιγηρία', code: '+234' },
  { iso: 'US', name: 'ΗΠΑ / Καναδάς', code: '+1' }, { iso: 'AU', name: 'Αυστραλία', code: '+61' },
];
const flag = (iso: string) => iso.replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
const BY_LEN = [...COUNTRIES].sort((a, b) => b.code.length - a.code.length);

/** «+357 99123456» → { code: '+357', rest: '99123456' }. Χωρίς + μένει στην προεπιλεγμένη χώρα. */
export function splitPhone(v: string | null | undefined, fallback = '+357'): { code: string; rest: string } {
  const s = (v ?? '').trim();
  const norm = s.replace(/^00/, '+');
  if (norm.startsWith('+')) {
    const digits = '+' + norm.slice(1).replace(/[^\d]/g, '');
    const c = BY_LEN.find((x) => digits.startsWith(x.code));
    if (c) return { code: c.code, rest: norm.slice(1).replace(/^\s*/, '').slice(c.code.length - 1).replace(/^[\s\-()]+/, '') };
    return { code: fallback, rest: norm };
  }
  return { code: fallback, rest: s };
}

/**
 * Τηλέφωνο με επιλογή χώρας μπροστά (σημαία + κωδικός). Δίνει πάντα
 * «+κωδικός αριθμός», ή κενό αν δεν γράφτηκε αριθμός. Με `name` στέλνεται
 * και σε κανονική φόρμα (hidden input).
 */
export function PhoneInput({ value, onChange, name, defaultValue, placeholder = 'Αριθμός', required, disabled, className = '', defaultCountry = '+357', id }: {
  value?: string | null; onChange?: (v: string) => void; name?: string; defaultValue?: string; placeholder?: string;
  required?: boolean; disabled?: boolean; className?: string; defaultCountry?: string; id?: string;
}) {
  const controlled = value !== undefined;
  const [inner, setInner] = useState(defaultValue ?? '');
  const current = controlled ? value ?? '' : inner;
  const parsed = splitPhone(current, defaultCountry);
  const [code, setCode] = useState(parsed.code);
  const [rest, setRest] = useState(parsed.rest);
  // Όταν αλλάζει η τιμή απ' έξω (π.χ. φόρτωσε το lead), ενημερώνονται τα πεδία.
  useEffect(() => {
    const out = rest.trim() ? `${code} ${rest.trim()}` : '';
    if (current.trim() !== out) { const p = splitPhone(current, defaultCountry); setCode(p.code); setRest(p.rest); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);
  const emit = (c: string, r: string) => {
    const digits = r.replace(/[^\d\s\-()]/g, '');
    const out = digits.trim() ? `${c} ${digits.trim()}` : '';
    if (!controlled) setInner(out);
    onChange?.(out);
  };

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <select aria-label="Χώρα" disabled={disabled} value={code} className="input w-[6.5rem] shrink-0 px-2 text-sm"
        onChange={(e) => { setCode(e.target.value); emit(e.target.value, rest); }}>
        {COUNTRIES.map((c) => <option key={c.iso} value={c.code} title={c.name}>{flag(c.iso)} {c.code}</option>)}
      </select>
      <input id={id} type="tel" inputMode="tel" autoComplete="tel-national" disabled={disabled} required={required} placeholder={placeholder}
        className="input min-w-0 flex-1 text-sm" value={rest}
        onChange={(e) => {
          let r = e.target.value;
          // Επικόλληση με κωδικό (π.χ. +44 7700…) → αλλάζει και η χώρα.
          if (/^\s*(\+|00)/.test(r)) { const p = splitPhone(r, code); setCode(p.code); r = p.rest; setRest(r); emit(p.code, r); return; }
          r = r.replace(/[^\d\s\-()]/g, '');
          setRest(r); emit(code, r);
        }} />
      {name && <input type="hidden" name={name} value={rest.trim() ? `${code} ${rest.trim()}` : ''} />}
    </div>
  );
}
