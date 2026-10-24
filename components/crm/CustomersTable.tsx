'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search, Users, Wallet, BadgeEuro } from 'lucide-react';
import { formatCurrency, formatCurrencyCompact } from '@/lib/format';
import type { CustomerRow, CustomerType } from '@/lib/customers';

const TYPE_LABEL: Record<CustomerType, string> = { buyer: 'Buyer', investor: 'Investor', homeowner: 'Homeowner' };
type SortKey = 'value_desc' | 'value_asc' | 'paid_desc' | 'name' | 'recent';

export function CustomersTable({ rows }: { rows: CustomerRow[] }) {
  const [q, setQ] = useState('');
  const [type, setType] = useState<'all' | CustomerType>('all');
  const [min, setMin] = useState('');
  const [max, setMax] = useState('');
  const [sort, setSort] = useState<SortKey>('value_desc');

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const minV = min ? Number(min) : null;
    const maxV = max ? Number(max) : null;
    let out = rows.filter((r) => {
      if (type !== 'all' && !r.types.includes(type)) return false;
      if (minV !== null && r.contractValue < minV) return false;
      if (maxV !== null && r.contractValue > maxV) return false;
      if (needle) {
        const hay = `${r.name} ${r.email ?? ''} ${r.phone ?? ''}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
    out = [...out].sort((a, b) => {
      switch (sort) {
        case 'value_asc': return a.contractValue - b.contractValue;
        case 'paid_desc': return b.paid - a.paid;
        case 'name': return a.name.localeCompare(b.name);
        case 'recent': return (b.createdAt ?? '').localeCompare(a.createdAt ?? '');
        default: return b.contractValue - a.contractValue;
      }
    });
    return out;
  }, [rows, q, type, min, max, sort]);

  const totals = useMemo(
    () => filtered.reduce((t, r) => ({ count: t.count + 1, value: t.value + r.contractValue, paid: t.paid + r.paid, balance: t.balance + r.balance }), { count: 0, value: 0, paid: 0, balance: 0 }),
    [filtered],
  );

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tile icon={<Users size={15} />} label="Πελάτες" value={String(totals.count)} />
        <Tile icon={<BadgeEuro size={15} />} label="Συνολική αξία" value={formatCurrencyCompact(totals.value)} />
        <Tile icon={<Wallet size={15} />} label="Εισπραγμένα" value={formatCurrencyCompact(totals.paid)} />
        <Tile icon={<Wallet size={15} />} label="Υπόλοιπο" value={formatCurrencyCompact(totals.balance)} />
      </div>

      {/* Filters */}
      <div className="panel flex flex-wrap items-end gap-3 p-4">
        <label className="min-w-[220px] flex-1">
          <span className="eyebrow mb-1 block">Αναζήτηση</span>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-charcoal-600/50" strokeWidth={1.75} />
            <input className="input pl-9" placeholder="Όνομα, email ή τηλέφωνο" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </label>
        <label>
          <span className="eyebrow mb-1 block">Τύπος</span>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as any)}>
            <option value="all">Όλοι</option>
            <option value="buyer">Buyers</option>
            <option value="investor">Investors</option>
            <option value="homeowner">Homeowners</option>
          </select>
        </label>
        <label className="w-32">
          <span className="eyebrow mb-1 block">Ποσό από</span>
          <input className="input figure" type="number" inputMode="numeric" placeholder="0" value={min} onChange={(e) => setMin(e.target.value)} />
        </label>
        <label className="w-32">
          <span className="eyebrow mb-1 block">Ποσό έως</span>
          <input className="input figure" type="number" inputMode="numeric" placeholder="∞" value={max} onChange={(e) => setMax(e.target.value)} />
        </label>
        <label>
          <span className="eyebrow mb-1 block">Ταξινόμηση</span>
          <select className="input" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="value_desc">Αξία ↓</option>
            <option value="value_asc">Αξία ↑</option>
            <option value="paid_desc">Εισπραγμένα ↓</option>
            <option value="name">Όνομα (Α–Ω)</option>
            <option value="recent">Πιο πρόσφατοι</option>
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th>Πελάτης</th>
              <th>Τύπος</th>
              <th className="text-right">Μονάδες</th>
              <th className="text-right">Αξία συμβολαίων</th>
              <th className="text-right">Εισπραγμένα</th>
              <th className="min-w-[120px]">Πρόοδος</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const pct = r.contractValue > 0 ? Math.min(100, Math.round((r.paid / r.contractValue) * 100)) : 0;
              return (
                <tr key={r.contactId} className="hover:bg-stone/60">
                  <td>
                    <Link href={`/crm/${r.contactId}`} className="font-medium text-forest hover:underline">{r.name}</Link>
                    <p className="text-xs text-charcoal-600/70">{r.email ?? r.phone ?? '—'}</p>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {r.types.length === 0 && <span className="badge-neutral">Lead/Reserved</span>}
                      {r.types.map((t) => <span key={t} className="badge-forest">{TYPE_LABEL[t]}</span>)}
                    </div>
                  </td>
                  <td className="figure text-right">{r.units || (r.reservations ? `${r.reservations}R` : '—')}</td>
                  <td className="figure text-right text-charcoal">{r.contractValue ? formatCurrency(r.contractValue) : '—'}</td>
                  <td className="figure text-right text-charcoal-600">{r.paid ? formatCurrency(r.paid) : '—'}</td>
                  <td>
                    {r.contractValue > 0 ? (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sand">
                          <div className="h-full rounded-full bg-forest" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="figure text-xs text-charcoal-600/70">{pct}%</span>
                      </div>
                    ) : <span className="text-xs text-charcoal-600/50">—</span>}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="py-12 text-center text-charcoal-600/70">Κανένας πελάτης με αυτά τα φίλτρα.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="ws-card-flat flex items-center gap-3">
      <span className="ws-ico">{icon}</span>
      <div>
        <p className="eyebrow">{label}</p>
        <p className="figure text-lg text-charcoal">{value}</p>
      </div>
    </div>
  );
}
