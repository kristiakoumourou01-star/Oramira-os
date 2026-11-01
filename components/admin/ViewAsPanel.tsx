'use client';

import { useMemo, useState, useTransition } from 'react';
import { Eye, Search, ShieldAlert, UserRound, Building2 } from 'lucide-react';
import { startImpersonation } from '@/app/actions/impersonation';
import { ROLE_EL, STAFF, type ViewAsEvent, type ViewAsUser } from '@/lib/view-as-shared';
import { formatDateTime } from '@/lib/format';

/**
 * Ρυθμίσεις → Χρήστες → Προβολή ως χρήστης. Ο admin βλέπει την εφαρμογή
 * ακριβώς όπως ένας συνάδελφος ή πελάτης (μενού, δικαιώματα, portal). Οι
 * ενέργειες καταγράφονται στο ιστορικό· πάνω σε κάθε σελίδα φαίνεται μπάρα
 * «Βλέπετε ως …» με επιστροφή.
 */
export function ViewAsPanel({ users, history }: { users: ViewAsUser[]; history: ViewAsEvent[] }) {
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'staff' | 'clients'>('staff');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return users
      .filter((u) => (tab === 'staff' ? STAFF.includes(u.role) : !STAFF.includes(u.role)))
      .filter((u) => !term || [u.name, u.email, ROLE_EL[u.role], u.customRole, u.title].some((x) => x?.toLowerCase().includes(term)));
  }, [users, q, tab]);

  const go = (id: string) => {
    setErr(null); setBusy(id);
    start(async () => {
      const r = await startImpersonation(id);
      if (r && !r.ok) { setErr(r.error); setBusy(null); }
    });
  };

  const staffN = users.filter((u) => STAFF.includes(u.role)).length;
  return (
    <div className="space-y-4">
      <div className="panel flex items-start gap-3 p-4 text-sm text-charcoal-600">
        <ShieldAlert size={18} className="mt-0.5 shrink-0 text-champagne-600" />
        <p>Βλέπετε την εφαρμογή όπως τη βλέπει ο χρήστης: το μενού, τις σελίδες και τα δεδομένα που του επιτρέπονται. Ό,τι αλλάξετε σε αυτή τη λειτουργία γίνεται στο όνομά του και καταγράφεται ότι το κάνατε εσείς. Για επιστροφή πατήστε «Επιστροφή στον λογαριασμό μου» στη μπάρα που εμφανίζεται πάνω.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab('staff')} className={`badge ${tab === 'staff' ? 'badge-forest' : 'badge-neutral'}`}><UserRound size={12} className="mr-1" /> Ομάδα ({staffN})</button>
        <button type="button" onClick={() => setTab('clients')} className={`badge ${tab === 'clients' ? 'badge-forest' : 'badge-neutral'}`}><Building2 size={12} className="mr-1" /> Πελάτες & συνεργάτες ({users.length - staffN})</button>
        <label className="relative ml-auto w-full max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Αναζήτηση ονόματος, email, ρόλου…" className="input pl-8" />
        </label>
      </div>

      {err && <p className="text-sm text-signal-danger">{err}</p>}

      <div className="panel divide-y divide-stone-line">
        {shown.length === 0 && <p className="p-5 text-sm text-charcoal-600/70">Κανένας χρήστης.</p>}
        {shown.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest/10 text-[13px] font-medium text-forest">{u.name.charAt(0)}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-charcoal">{u.name}{!u.active && <span className="ml-2 text-[11px] font-normal text-signal-danger">ανενεργός</span>}</p>
              <p className="truncate text-xs text-charcoal-600/70">{[u.email, u.customRole ?? ROLE_EL[u.role] ?? u.role, u.title].filter(Boolean).join(' · ')}</p>
            </div>
            <button type="button" disabled={pending} onClick={() => go(u.id)} className="btn-secondary px-3 py-1.5 text-xs">
              <Eye size={13} /> {busy === u.id ? 'Άνοιγμα…' : 'Προβολή ως'}
            </button>
          </div>
        ))}
      </div>

      <div className="panel p-5">
        <h4 className="mb-2">Ιστορικό</h4>
        {history.length === 0 ? <p className="text-sm text-charcoal-600/60">Δεν έχει γίνει ακόμα προβολή ως άλλος χρήστης.</p> : (
          <ul className="space-y-1 text-sm">
            {history.map((h, i) => (
              <li key={i} className="flex flex-wrap gap-x-2 text-charcoal-600">
                <span className="figure text-xs text-charcoal-600/60">{formatDateTime(h.at)}</span>
                <span>{h.started ? <>Ο/Η <b>{h.by}</b> είδε την εφαρμογή ως <b>{h.target}</b></> : <>Ο/Η <b>{h.by}</b> επέστρεψε στον λογαριασμό του/της</>}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
