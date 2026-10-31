'use client';

import { useEffect, useState, useTransition } from 'react';
import { History, TrendingUp, TrendingDown } from 'lucide-react';
import { getPriceHistory, type PriceHistoryRow } from '@/app/actions/pricing';
import { formatCurrency, formatDateTime } from '@/lib/format';
import { pctChange } from '@/lib/pricing-shared';

const SOURCE: Record<string, string> = { manual: 'αλλαγή', bulk: 'μαζική αλλαγή', import: 'εισαγωγή Excel', created: 'αρχική τιμή' };

/** «Ιστορικό τιμής» of one unit, loaded when opened. `inline` = always open (unit page). */
export function PriceHistory({ unitId, inline = false }: { unitId: string; inline?: boolean }) {
  const [rows, setRows] = useState<PriceHistoryRow[] | null>(null);
  const [open, setOpen] = useState(inline);
  const [pending, start] = useTransition();
  const load = () => start(async () => setRows(await getPriceHistory(unitId)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (inline) load(); }, [inline, unitId]);

  const list = rows === null || (pending && !rows.length) ? <p className="text-xs text-charcoal-600/60">Φόρτωση…</p>
    : rows.length === 0 ? <p className="text-xs text-charcoal-600/60">Καμία αλλαγή τιμής ακόμη.</p>
    : (
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const d = pctChange(r.oldPrice, r.newPrice);
          return (
            <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 text-xs">
              <span className="text-charcoal-600/70">{formatDateTime(r.at)} · {SOURCE[r.source] ?? r.source}{r.by ? ` · ${r.by}` : ''}{r.reason ? ` · «${r.reason}»` : ''}</span>
              <span className="figure">
                {r.oldPrice != null && <span className="text-charcoal-600/60 line-through">{formatCurrency(r.oldPrice)}</span>} {formatCurrency(r.newPrice)}
                {d !== null && d !== 0 && (
                  <span className={`ml-1 inline-flex items-center gap-0.5 ${d > 0 ? 'text-signal-success' : 'text-signal-danger'}`}>
                    {d > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{d > 0 ? '+' : ''}{d}%
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    );

  if (inline) return list;
  return (
    <span className="relative">
      <button type="button" title="Ιστορικό τιμής" onClick={() => { setOpen((o) => !o); if (rows === null) load(); }} className="text-charcoal-600/50 hover:text-forest"><History size={13} /></button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-80 rounded-md border border-stone-line bg-white p-3 text-left shadow-overlay">
          <p className="eyebrow mb-2">Ιστορικό τιμής</p>
          {list}
        </div>
      )}
    </span>
  );
}
