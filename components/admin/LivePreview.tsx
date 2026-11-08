'use client';

import { useEffect, useState } from 'react';
import { LayoutDashboard, TrendingUp, Contact, Building2, Wallet, Search, Bell, Plus } from 'lucide-react';
import { clearLiveBrand, getLiveBrand, initLiveBrand, onLiveBrand } from '@/lib/brand-live';
import type { Branding } from '@/lib/branding-shared';

/**
 * Μικρογραφία της εφαρμογής δίπλα στις ρυθμίσεις Εμφάνισης. Χρησιμοποιεί τα
 * ίδια χρώματα/γραμματοσειρές/γωνίες με την πραγματική οθόνη (τα ίδια CSS
 * variables), άρα δείχνει ακριβώς πώς θα φαίνεται — και κάθε αλλαγή
 * εφαρμόζεται αμέσως και στην υπόλοιπη οθόνη.
 */
export function LivePreview({ branding, logoUrl, sidebar }: { branding: Branding; logoUrl: string | null; sidebar: { style: string; custom: string } }) {
  const [b, setB] = useState<Branding>(branding);
  useEffect(() => {
    initLiveBrand(branding, sidebar);
    setB(getLiveBrand() ?? branding);
    const off = onLiveBrand(setB);
    return () => { off(); clearLiveBrand(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const nav = [
    { icon: LayoutDashboard, label: 'Αρχική', active: false },
    { icon: TrendingUp, label: 'Πωλήσεις', active: true },
    { icon: Contact, label: 'Πελάτες', active: false },
    { icon: Building2, label: 'Έργα & μονάδες', active: false },
    { icon: Wallet, label: 'Οικονομικά', active: false },
  ];

  return (
    <div className="space-y-2">
      <p className="eyebrow">Προεπισκόπηση — έτσι θα φαίνεται</p>
      <div className="overflow-hidden rounded-xl border border-stone-line bg-stone shadow-overlay">
        <div className="flex h-[360px] text-[11px]">
          {/* Μενού */}
          <div className="flex w-[118px] shrink-0 flex-col gap-1 p-2.5 [background:var(--sidebar-bg)]">
            <div className="mb-2 flex h-7 items-center px-1">
              {logoUrl
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoUrl} alt="" className="max-h-6 max-w-full object-contain" />
                : <span className="truncate font-display text-sm text-stone-100">{b.companyName}</span>}
            </div>
            {nav.map((n) => (
              <div key={n.label} className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${n.active ? 'bg-white/10 text-stone-100' : 'text-stone-100/65'}`}>
                <n.icon size={11} strokeWidth={1.75} /> <span className="truncate">{n.label}</span>
              </div>
            ))}
          </div>
          {/* Σελίδα */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center gap-2 border-b border-stone-line bg-white px-3 py-1.5">
              <span className="flex flex-1 items-center gap-1 rounded-md bg-sand-100 px-2 py-1 text-charcoal-600/70"><Search size={10} /> Αναζήτηση…</span>
              <Bell size={12} className="text-charcoal-600" />
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-forest text-[9px] text-white">K</span>
            </div>
            <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-eyebrow text-olive">Workspace</p>
                  <p className="font-display text-lg leading-tight text-charcoal">Πωλήσεις</p>
                </div>
                <span className="btn-primary !gap-1 !px-2 !py-1 !text-[10px]"><Plus size={10} /> Νέο lead</span>
              </div>
              <div className="flex gap-3 border-b border-stone-line text-charcoal-600">
                <span className="border-b-2 border-forest pb-1 font-medium text-charcoal">Leads</span><span className="pb-1">Pipeline</span><span className="pb-1">Follow-ups</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="panel p-2"><p className="text-[9px] uppercase text-charcoal-600/70">Έσοδα</p><p className="figure text-sm text-champagne-600">€1.240.000</p></div>
                <div className="panel p-2"><p className="text-[9px] uppercase text-charcoal-600/70">Ανοιχτά</p><p className="figure text-sm text-forest">38</p></div>
              </div>
              <div className="panel divide-y divide-stone-line">
                {[['Μιχάλης Γ.', 'Επικοινωνία', 'badge-neutral'], ['Μαρία Ι.', 'Προβολή', 'badge-champagne'], ['John S.', 'Won', 'badge-forest']].map(([n, s, c]) => (
                  <div key={n} className="flex items-center justify-between px-2 py-1.5">
                    <span className="text-charcoal">{n}</span><span className={`${c} !text-[9px]`}>{s}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-1.5">
                <span className="btn-secondary !px-2 !py-1 !text-[10px]">Δευτερεύον</span>
                <span className="rounded-md bg-sand px-2 py-1 text-[10px] text-charcoal">Επιφάνεια</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <p className="text-xs text-charcoal-600/60">Οι αλλαγές φαίνονται αμέσως εδώ και σε όλη την οθόνη. Μένουν μόνο αν πατήσετε Αποθήκευση· αλλιώς επανέρχονται όταν φύγετε από τη σελίδα.</p>
    </div>
  );
}
