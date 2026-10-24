import Link from 'next/link';

export interface KpiSegment {
  key: string;
  label: string;
  value: string;
  tone?: 'forest' | 'danger' | 'champagne' | 'neutral';
  icon: any;
  href?: string;
  hint?: string;
}

const VALUE_TONE: Record<string, string> = {
  forest: 'text-forest', danger: 'text-signal-danger', champagne: 'text-champagne-600', neutral: 'text-charcoal',
};
const SURFACE: Record<string, string> = {
  forest: 'bg-forest/[0.04]', danger: 'bg-signal-danger/[0.04]', champagne: 'bg-champagne-50/50', neutral: 'bg-white',
};

/** One connected horizontal analytics bar — the dashboard's KPI row. Segments
 *  share a single card so the numbers read as a unit, not isolated tiles. */
export function KpiStrip({ segments }: { segments: KpiSegment[] }) {
  return (
    <div className="ws-card ws-card-hover flex flex-col divide-y divide-[#EFE7D8] overflow-hidden !p-0 sm:flex-row sm:divide-x sm:divide-y-0">
      {segments.map((s) => {
        const tone = s.tone ?? 'neutral';
        const Inner = (
          <div className={`flex flex-1 items-center gap-3 px-4 py-3 transition-colors ${SURFACE[tone]} ${s.href ? 'group-hover/seg:brightness-[0.98]' : ''}`}>
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone === 'neutral' ? 'bg-forest/8 text-forest' : `${SURFACE[tone]} ${VALUE_TONE[tone]}`}`}>
              <s.icon size={16} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <p className={`figure text-[26px] font-semibold leading-none ${VALUE_TONE[tone]}`}>{s.value}</p>
              <p className="mt-1 truncate text-[11px] font-medium uppercase tracking-wide text-charcoal-600/55">{s.label}</p>
            </div>
          </div>
        );
        return s.href
          ? <Link key={s.key} href={s.href} className="group/seg flex flex-1">{Inner}</Link>
          : <div key={s.key} className="flex flex-1">{Inner}</div>;
      })}
    </div>
  );
}
