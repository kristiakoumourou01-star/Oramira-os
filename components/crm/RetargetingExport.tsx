'use client';

import { useState, useTransition } from 'react';
import { Download, Users } from 'lucide-react';
import { exportRetargetingCsv, type RetargetLead } from '@/app/actions/communications';
import { RETARGET_LABELS, type RetargetCategory } from '@/lib/sales-doctrine';

const CATEGORY_ORDER: RetargetCategory[] = ['warm_no_response', 'viewed_inactive', 'negotiation_stalled'];
const CATEGORY_HINT: Record<RetargetCategory, string> = {
  warm_no_response: 'Engaged early but went quiet — re-engage with value.',
  viewed_inactive: 'Reached viewing/qualified then stalled — strong intent, worth a push.',
  negotiation_stalled: 'Offer/negotiation went cold — high-value recovery audience.',
};

/**
 * Retargeting audience board — the commercial intelligence layer. Groups
 * inactive leads into ad-platform audiences and exports each (or all) as CSV.
 */
export function RetargetingExport({ leads }: { leads: RetargetLead[] }) {
  const [isPending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  function download(category?: RetargetCategory) {
    setBusy(category ?? 'all');
    startTransition(async () => {
      const csv = await exportRetargetingCsv(category);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `retargeting-${category ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setBusy(null);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-charcoal-600/70">{leads.length} leads inactive for 7+ days, grouped into retargeting audiences.</p>
        <button onClick={() => download()} disabled={isPending || leads.length === 0} className="btn-primary">
          <Download size={14} strokeWidth={1.75} /> {busy === 'all' ? 'Exporting…' : 'Export all'}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {CATEGORY_ORDER.map((cat) => {
          const items = leads.filter((l) => l.category === cat);
          return (
            <div key={cat} className="panel p-6">
              <div className="mb-1 flex items-center justify-between">
                <h4 className="flex items-center gap-2"><Users size={15} className="text-olive" strokeWidth={1.75} /> {RETARGET_LABELS[cat]}</h4>
                <span className="figure text-lg text-forest">{items.length}</span>
              </div>
              <p className="mb-3 text-xs text-charcoal-600/60">{CATEGORY_HINT[cat]}</p>
              <button onClick={() => download(cat)} disabled={isPending || items.length === 0} className="btn-secondary mb-4 w-full text-xs">
                <Download size={13} strokeWidth={1.75} /> {busy === cat ? 'Exporting…' : 'Export audience'}
              </button>
              {items.length === 0 ? (
                <p className="text-sm text-charcoal-600/60">No leads in this audience.</p>
              ) : (
                <ul className="divide-y divide-stone-line">
                  {items.slice(0, 12).map((l) => (
                    <li key={l.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="truncate text-charcoal">{l.full_name ?? 'Unnamed'}</span>
                      <span className="ml-2 shrink-0 text-xs capitalize text-charcoal-600/50">{l.buyer_type?.replace('_', ' ') ?? '—'}</span>
                    </li>
                  ))}
                  {items.length > 12 && <li className="pt-2 text-xs text-charcoal-600/50">+{items.length - 12} more in export</li>}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
