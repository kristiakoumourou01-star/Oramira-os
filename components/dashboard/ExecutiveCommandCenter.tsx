import Link from 'next/link';
import { Command, Flame, AlertTriangle, Banknote, Sparkles, ArrowRight } from 'lucide-react';
import type { CommandCenter } from '@/lib/command-center-shared';
import { formatCurrency } from '@/lib/format';


/**
 * Compact executive command bar — a single dark strip surfacing the four
 * signals a leader needs at a glance (highest priority, biggest risk, cashflow
 * alert, AI recommendation) with one button into the full board (/command-center).
 */
export function ExecutiveCommandCenter({ data }: { data: CommandCenter }) {
  const p = data.topPriorities[0];
  const risk = data.risks[0];
  const positive = data.cashflow.net30 >= 0;
  const rec = data.learning.items[0];

  const Signal = ({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) => (
    <div className="flex min-w-0 items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/10 ${tone}`}><Icon size={14} strokeWidth={1.95} /></span>
      <div className="min-w-0"><p className="text-[9.5px] font-semibold uppercase tracking-wide text-white/45">{label}</p><p className="truncate text-[12.5px] font-medium text-white/90" title={value}>{value}</p></div>
    </div>
  );

  return (
    <div className="relative mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 overflow-hidden rounded-2xl bg-gradient-to-r from-[#0C271C] via-[#173D2E] to-[#22523D] px-4 py-3 shadow-[0_8px_24px_rgba(31,77,58,0.16)]">
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-champagne/10 blur-3xl" />
      <div className="relative order-1 flex items-center gap-2 pr-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10 text-champagne ring-1 ring-white/15"><Command size={15} strokeWidth={1.95} /></span>
        <span className="text-[12px] font-semibold uppercase tracking-wide text-white/80">Command</span>
      </div>
      {/* Signals get their own full-width row (legible 2×2) until there's real
          room for 4-across (xl); the button reflows instead of colliding. */}
      <div className="relative order-3 grid w-full grid-cols-2 gap-x-5 gap-y-3 xl:order-2 xl:w-auto xl:flex-1 xl:grid-cols-4">
        <Signal icon={Flame} label="Highest priority" value={p ? p.title : 'All clear'} tone="text-champagne" />
        <Signal icon={AlertTriangle} label="Biggest risk" value={risk ? risk.label : 'No material risks'} tone={risk?.severity === 'high' ? 'text-[#F0A090]' : 'text-[#E3B778]'} />
        <Signal icon={Banknote} label="Cashflow · 30d" value={formatCurrency(data.cashflow.net30)} tone={positive ? 'text-[#8FCBA3]' : 'text-[#F0A090]'} />
        <Signal icon={Sparkles} label="AI recommendation" value={rec ?? 'Gathering signal…'} tone="text-champagne" />
      </div>
      <Link href="/command-center" className="relative order-2 ml-auto flex shrink-0 items-center gap-1.5 rounded-xl bg-white/12 px-3 py-2 text-[12.5px] font-medium text-white ring-1 ring-white/15 transition-colors hover:bg-white/20 xl:order-3 xl:ml-0">
        Open Command Center <ArrowRight size={14} />
      </Link>
    </div>
  );
}
