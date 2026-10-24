import Link from 'next/link';
import { Sunrise } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { buildMorningBrief } from '@/lib/morning-brief';
import { MorningBriefEmailButton } from './MorningBriefEmailButton';
import { formatWeekdayLongDate } from '@/lib/format';

const TONE: Record<string, string> = {
  urgent: 'text-signal-danger',
  info: 'text-forest',
  good: 'text-champagne-600',
};

/**
 * AI Morning Brief — the first card in My Workspace. A personal executive
 * digest of the day: meetings, overdue work, hot leads, approvals, deadlines.
 * Deterministic and RLS-scoped (each user sees only their own operational load).
 */
export async function MorningBrief({ supabase, profileId, name, action }: {
  supabase: SupabaseClient<Database>;
  profileId: string;
  name: string;
  action?: React.ReactNode;
}) {
  const brief = await buildMorningBrief(supabase, profileId);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const first = name.split(' ')[0] || 'there';

  return (
    <div className="relative mb-4 overflow-hidden rounded-[20px] bg-gradient-to-br from-[#F4F8F2] via-[#EDF3EA] to-[#E4EEDF] p-5 shadow-[0_2px_8px_rgba(31,77,58,0.06),0_24px_60px_rgba(31,77,58,0.12),inset_0_0_0_1px_rgba(31,77,58,0.06)]">
      {/* Green hero wash */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-forest/[0.05] to-transparent" />
      <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-forest/[0.10] blur-3xl" />
      <div className="pointer-events-none absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-champagne/[0.16] blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-forest to-[#0E2C20] text-champagne shadow-[0_8px_20px_rgba(31,77,58,0.28)] ring-1 ring-forest/25"><Sunrise size={26} strokeWidth={1.7} /></span>
          <div>
            <p className="figure text-[11px] font-semibold uppercase tracking-[0.16em] text-forest/70">{formatWeekdayLongDate(new Date())}</p>
            <h3 className="font-display text-[30px] leading-[1.1] tracking-tight text-forest">{greeting}, {first}</h3>
            <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-charcoal-600/90">{brief.summary}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">{action}<MorningBriefEmailButton /></div>
      </div>

      {brief.stats.length > 0 && (
        <div className="relative mt-4 flex flex-wrap gap-2.5">
          {brief.stats.map((s) => (
            <Link key={s.key} href={s.href} className={`group flex items-center gap-2.5 rounded-2xl bg-white/70 px-3.5 py-2.5 shadow-[0_1px_3px_rgba(31,77,58,0.05),inset_0_0_0_1px_rgba(31,77,58,0.05)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_10px_26px_rgba(31,77,58,0.14)] ${TONE[s.tone]}`}>
              <span className="figure text-[26px] font-semibold leading-none">{s.count}</span>
              <span className="text-[13px] font-medium leading-tight text-charcoal-600/85">{s.label}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
