'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { previewAudience } from '@/app/actions/campaigns';
import { parseAddresses, type CampaignAudience, type CampaignChannel } from '@/lib/campaigns-shared';
import { ROLE_EL, ALL_ROLES } from '@/lib/contacts-hub-shared';

export interface PickContact { id: string; name: string; email: string | null; phone: string | null; optIn: boolean }
export interface AudiencePrefill { group?: string; tag?: string; role?: string; ids?: string }
export type AudienceCount = { total: number; reachable: number; noConsent: number; noAddress: number };
type Kind = CampaignAudience['kind'];

const lbl = 'mb-1 block text-[12px] font-semibold uppercase tracking-wide text-charcoal-600';

/**
 * «Σε ποιους»: ομάδα πελατών, συγκεκριμένοι πελάτες, tag, ιδιότητα ή γραπτές
 * διευθύνσεις — με ζωντανό μέτρημα παραληπτών (συγκατάθεση marketing, GDPR).
 * Κοινό για τις καμπάνιες και τους προγραμματισμένους αυτοματισμούς.
 */
export function AudiencePicker({ channel, initial, prefill = {}, groups, contacts, tags, onChange, onCount, label = 'Κοινό *' }: {
  channel: CampaignChannel; initial?: CampaignAudience | null; prefill?: AudiencePrefill;
  groups: { name: string; n: number }[]; contacts: PickContact[]; tags: string[];
  onChange: (a: CampaignAudience | null) => void; onCount?: (c: AudienceCount | null) => void; label?: string;
}) {
  const a0 = initial ?? null;
  const preIds = prefill.ids ? prefill.ids.split(',').filter(Boolean) : [];
  const [kind, setKind] = useState<Kind>(a0?.kind ?? (preIds.length ? 'contacts' : prefill.tag ? 'tag' : prefill.role ? 'role' : 'groups'));
  const [selGroups, setSelGroups] = useState<string[]>(a0?.kind === 'groups' ? a0.groups : prefill.group ? [prefill.group] : []);
  const [ids, setIds] = useState<Set<string>>(new Set(a0?.kind === 'contacts' ? a0.ids : preIds));
  const [addrText, setAddrText] = useState(a0?.kind === 'addresses' ? a0.addresses.join('\n') : '');
  const [tag, setTag] = useState(a0?.kind === 'tag' ? a0.tag : prefill.tag ?? '');
  const [role, setRole] = useState(a0?.kind === 'role' ? a0.role : prefill.role ?? 'buyer');
  const [q, setQ] = useState('');
  const [count, setCount] = useState<AudienceCount | null>(null);

  useEffect(() => { if (channel === 'push' && kind === 'addresses') setKind('groups'); }, [channel, kind]);
  const audience: CampaignAudience | null = kind === 'groups' ? { kind, groups: selGroups } : kind === 'contacts' ? { kind, ids: [...ids] } : kind === 'addresses' ? { kind, addresses: parseAddresses(addrText) } : kind === 'tag' ? { kind, tag } : { kind: 'role', role };
  const key = JSON.stringify([audience, channel]);
  useEffect(() => {
    onChange(audience);
    setCount(null); onCount?.(null);
    const t = setTimeout(() => { void previewAudience(audience, channel).then((r) => { if (r.ok) { setCount(r); onCount?.(r); } }); }, 350);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const ql = q.trim().toLowerCase();
  const shown = contacts.filter((c) => !ql || [c.name, c.email ?? '', c.phone ?? ''].join(' ').toLowerCase().includes(ql)).slice(0, 150);
  const flip = (id: string) => setIds((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const KINDS: [Kind, string][] = [['groups', 'Ομάδα πελατών'], ['contacts', 'Συγκεκριμένοι πελάτες'], ['tag', 'Tag'], ['role', 'Ιδιότητα'], ...(channel === 'push' ? [] : [['addresses', channel === 'email' ? 'Γραπτές διευθύνσεις' : 'Γραπτά τηλέφωνα'] as [Kind, string]])];

  return (
    <div>
      <span className={lbl}>{label}</span>
      <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="input w-auto text-sm">{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <div className="mt-2">
        {kind === 'groups' && (groups.length ? (
          <div className="flex flex-wrap gap-1.5">{groups.map((g) => { const on = selGroups.includes(g.name); return <button key={g.name} type="button" onClick={() => setSelGroups((x) => (on ? x.filter((y) => y !== g.name) : [...x, g.name]))} className={`rounded-full border px-3 py-1 text-sm ${on ? 'border-forest bg-forest text-white' : 'border-stone-line text-charcoal'}`}><span data-no-tr>{g.name}</span> <span className={on ? 'text-white/80' : 'text-charcoal-600'}>· {g.n}</span></button>; })}</div>
        ) : <p className="text-sm text-charcoal-600">Δεν υπάρχουν ομάδες. Φτιάξτε μία στους Πελάτες → Ομάδες.</p>)}
        {kind === 'contacts' && (
          <div>
            <label className="relative block"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/60" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση πελάτη…" className="input pl-9" /></label>
            <div className="mt-2 max-h-56 divide-y divide-stone-line overflow-y-auto rounded-xl border border-stone-line">
              {shown.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-stone-50">
                  <input type="checkbox" checked={ids.has(c.id)} onChange={() => flip(c.id)} />
                  <span className="min-w-0 flex-1"><span className="block truncate font-medium text-charcoal" data-no-tr>{c.name}</span><span className="block truncate text-[12px] text-charcoal-600" data-no-tr>{channel === 'email' ? c.email ?? 'χωρίς email' : c.phone ?? 'χωρίς τηλέφωνο'}</span></span>
                  {!c.optIn && <span className="text-[12px] text-charcoal-600">χωρίς συγκατάθεση</span>}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[13px] text-charcoal-600">{ids.size} επιλεγμένοι</p>
          </div>
        )}
        {kind === 'tag' && <select value={tag} onChange={(e) => setTag(e.target.value)} className="input text-sm"><option value="">Διαλέξτε tag…</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</select>}
        {kind === 'role' && <select value={role} onChange={(e) => setRole(e.target.value)} className="input text-sm">{ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_EL[r]}</option>)}</select>}
        {kind === 'addresses' && <textarea value={addrText} onChange={(e) => setAddrText(e.target.value)} className="input min-h-[90px] text-sm" placeholder={channel === 'email' ? 'ένα email ανά γραμμή ή με κόμμα' : 'ένα τηλέφωνο ανά γραμμή, με κωδικό χώρας (+357…)'} />}
      </div>
      <p className="mt-2 rounded-lg bg-stone-50 px-3 py-2 text-[13px] text-charcoal-600">
        {count === null ? 'Υπολογισμός παραληπτών…' : kind === 'addresses' ? `${count.reachable} έγκυρες διευθύνσεις.` : <>Θα το λάβουν <b className="text-charcoal">{count.reachable}</b> από {count.total}{count.noConsent ? ` · ${count.noConsent} χωρίς συγκατάθεση marketing (GDPR)` : ''}{count.noAddress ? ` · ${count.noAddress} χωρίς ${channel === 'email' ? 'email' : channel === 'push' ? 'λογαριασμό στην εφαρμογή' : 'τηλέφωνο'}` : ''}.</>}
      </p>
    </div>
  );
}
