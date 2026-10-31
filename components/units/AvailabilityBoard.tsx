'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Printer, LayoutGrid } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact, formatNumber } from '@/lib/format';
import {
  BOARD_STATUSES, STATUS_STYLE, boardTotals, daysLeft, floorLabel, groupBoard, statusOf,
  type BoardStatus, type BoardUnit,
} from '@/lib/unit-board-shared';

/**
 * Πίνακας διαθεσιμότητας: κάθε κτίριο ως «πρόσοψη» — όροφοι από πάνω προς τα
 * κάτω, μονάδες με το χρώμα της κατάστασής τους. Κλικ → σελίδα μονάδας.
 */
export function AvailabilityBoard({ projectId, projectName, units }: { projectId: string; projectName: string; units: BoardUnit[] }) {
  const [on, setOn] = useState<Set<BoardStatus>>(new Set(BOARD_STATUSES));
  const [beds, setBeds] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [prices, setPrices] = useState(true);

  const groups = useMemo(() => groupBoard(units), [units]);
  const totals = useMemo(() => boardTotals(units), [units]);
  const types = useMemo(() => Array.from(new Set(units.map((u) => u.type).filter((t): t is string => !!t))).sort(), [units]);
  const bedOpts = useMemo(() => Array.from(new Set(units.map((u) => u.bedrooms).filter((b): b is number => b !== null && b !== undefined))).sort((a, b) => a - b), [units]);
  const filtered = on.size < BOARD_STATUSES.length || !!beds || !!type;
  const match = (u: BoardUnit) => on.has(statusOf(u.status)) && (!beds || String(u.bedrooms ?? '') === beds) && (!type || u.type === type);
  const matching = filtered ? units.filter(match).length : units.length;
  const toggle = (s: BoardStatus) => setOn((x) => { const n = new Set(x); if (n.has(s) && n.size === BOARD_STATUSES.length) return new Set([s]); if (n.has(s)) n.delete(s); else n.add(s); return n.size ? n : new Set(BOARD_STATUSES); });

  if (!units.length) return null;
  return (
    <div className="panel print-area space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="flex items-center gap-2"><LayoutGrid size={16} /> Πίνακας διαθεσιμότητας</h4>
          <p className="text-xs text-charcoal-600/70">
            {projectName} · {totals.total} μονάδες · πωλήθηκε το {totals.soldPct}%
            {totals.availableValue > 0 && <> · διαθέσιμα {formatCurrency(totals.availableValue)}</>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {types.length > 1 && (
            <select className="input w-auto py-1 text-sm" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Όλοι οι τύποι</option>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          )}
          {bedOpts.length > 1 && (
            <select className="input w-auto py-1 text-sm" value={beds} onChange={(e) => setBeds(e.target.value)}>
              <option value="">Όλα τα υπνοδωμάτια</option>
              {bedOpts.map((b) => <option key={b} value={String(b)}>{b === 0 ? 'Studio' : `${b} υπνοδ.`}</option>)}
            </select>
          )}
          <label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={prices} onChange={(e) => setPrices(e.target.checked)} /> Τιμές</label>
          <button type="button" onClick={() => window.print()} className="btn-secondary px-3 py-1.5 text-xs"><Printer size={13} /> Εκτύπωση</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {BOARD_STATUSES.filter((s) => totals.byStatus[s] > 0 || s === 'available').map((s) => {
          const st = STATUS_STYLE[s]; const active = on.has(s);
          return (
            <button key={s} type="button" onClick={() => toggle(s)} title="Κλικ: μόνο αυτή η κατάσταση · ξανά κλικ: προσθήκη/αφαίρεση"
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition"
              style={{ background: active ? st.bg : 'transparent', color: st.fg, borderColor: st.border, opacity: active ? 1 : 0.45 }}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: st.border }} /> {st.label} <b>{totals.byStatus[s]}</b>
            </button>
          );
        })}
        {filtered && <span className="self-center text-xs text-charcoal-600/70">Ταιριάζουν {matching} από {units.length}</span>}
      </div>

      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key} className="break-inside-avoid">
            {(groups.length > 1 || g.key !== '_none') && (
              <p className="mb-2 text-sm font-medium text-charcoal">{g.name} <span className="text-xs font-normal text-charcoal-600/60">· {g.count} μονάδες</span></p>
            )}
            <div className="overflow-x-auto rounded-md border border-stone-line">
              {g.floors.map((f) => (
                <div key={String(f.floor)} className="grid grid-cols-[76px_1fr] border-b border-stone-line last:border-b-0">
                  <div className="flex items-center bg-sand-100 px-2 py-2 text-xs text-charcoal-600">{floorLabel(f.floor)}</div>
                  <div className="flex flex-wrap gap-1.5 p-1.5">
                    {f.units.map((u) => {
                      const s = statusOf(u.status); const st = STATUS_STYLE[s];
                      const dim = filtered && !match(u);
                      const left = s === 'reserved' ? daysLeft(u.reserved_until) : null;
                      const tip = [
                        `${u.unit_number} · ${st.label}`, u.type, u.bedrooms != null ? `${u.bedrooms} υπνοδωμάτια` : null,
                        u.sqm ? `${formatNumber(u.sqm)} m²` : null, u.price ? formatCurrency(u.price) : null,
                        left !== null ? (left < 0 ? 'Η κράτηση έληξε' : `Η κράτηση λήγει σε ${left} μέρες`) : null,
                      ].filter(Boolean).join('\n');
                      return (
                        <Link key={u.id} href={`/projects/${projectId}/units/${u.id}`} title={tip}
                          className="relative flex w-[92px] flex-col rounded-md border px-2 py-1.5 leading-tight transition hover:shadow-md"
                          style={{ background: st.bg, color: st.fg, borderColor: st.border, opacity: dim ? 0.22 : 1 }}>
                          <span className="truncate text-sm font-semibold">{u.unit_number}</span>
                          <span className="truncate text-[10px] opacity-80">
                            {[u.bedrooms != null ? (u.bedrooms === 0 ? 'Studio' : `${u.bedrooms} υπν.`) : null, u.sqm ? `${formatNumber(u.sqm)} m²` : null].filter(Boolean).join(' · ') || (u.type ?? ' ')}
                          </span>
                          {prices && <span className="truncate text-[11px] font-medium">{u.price ? formatCurrencyCompact(u.price) : ' '}</span>}
                          {left !== null && (
                            <span className={`absolute -right-1 -top-1.5 rounded-full px-1 text-[9px] font-semibold text-white ${left <= 2 ? 'bg-signal-danger' : 'bg-champagne-600'}`}>
                              {left < 0 ? 'έληξε' : `${left}μ`}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
