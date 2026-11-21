import Link from 'next/link';
import { Home } from 'lucide-react';
import { formatDate } from '@/lib/format';
import type { ContactProperty } from '@/lib/unit-history';

const ROLE: Record<ContactProperty['role'], string> = { owner: 'Ιδιοκτήτης', former_owner: 'Πρώην ιδιοκτήτης', buyer: 'Αγοραστής', tenant: 'Ενοικιαστής' };

/**
 * Ακίνητα ενός πελάτη (για την καρτέλα πελάτη): μονάδες που έχει ή είχε,
 * αγόρασε ή νοικιάζει, με σύνδεσμο στο ιστορικό της κάθε μονάδας.
 * Δεδομένα από `loadContactProperties(contactId)` στο lib/unit-history.
 */
export function ContactPropertyHistory({ items }: { items: ContactProperty[] }) {
  return (
    <div className="rounded-2xl border border-stone-line bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)] sm:p-5">
      <p className="mb-3 flex items-center gap-2 font-semibold text-charcoal"><Home size={16} className="text-forest" /> Ακίνητα</p>
      {items.length === 0 ? <p className="text-sm text-charcoal-600">Κανένα ακίνητο συνδεδεμένο με αυτόν τον πελάτη.</p> : (
        <ul className="divide-y divide-stone-line">
          {items.map((p, i) => (
            <li key={`${p.unitId}_${i}`} className="flex items-center justify-between gap-2 py-2 text-sm">
              <Link href={`/projects/${p.projectId}/units/${p.unitId}?tab=history`} className="min-w-0 truncate font-medium text-forest hover:underline" data-no-tr>{p.label}</Link>
              <span className="shrink-0 text-[13px] text-charcoal-600"><span>{ROLE[p.role]}</span>{(p.since || p.until) && <span className="tabular-nums"> · {p.since ? formatDate(p.since) : '…'} – {p.until ? formatDate(p.until) : '…'}</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
