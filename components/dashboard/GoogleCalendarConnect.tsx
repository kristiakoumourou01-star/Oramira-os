'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Check, X } from 'lucide-react';
import { disconnectCalendar } from '@/app/actions/calendar';

/**
 * Σύνδεση του ΔΙΚΟΥ ΜΟΥ Google Calendar (κάθε χρήστης συνδέει το δικό του).
 * `big` = εμφανής κάρτα (Ημερολόγιο / Ρυθμίσεις), αλλιώς μικρό κουμπί.
 */
export function GoogleCalendarConnect({ connected, configured, big = false }: { connected: boolean; configured: boolean; big?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!configured) {
    return <span className="flex items-center gap-1.5 text-xs text-charcoal-600/60"><Calendar size={13} /> Το Google Calendar δεν έχει ρυθμιστεί</span>;
  }
  if (connected) {
    return (
      <div className={`flex flex-wrap items-center gap-3 ${big ? 'rounded-2xl border border-forest/25 bg-forest/[0.05] px-4 py-3 text-sm' : 'text-xs'}`}>
        <span className="flex items-center gap-1.5 font-medium text-forest"><Check size={big ? 16 : 13} /> Το Google Calendar σας είναι συνδεδεμένο</span>
        <button type="button" onClick={() => startTransition(async () => { await disconnectCalendar(); router.refresh(); })} disabled={isPending}
          className="ml-auto flex items-center gap-1 text-charcoal-600/70 hover:text-charcoal"><X size={12} /> Αποσύνδεση</button>
      </div>
    );
  }
  if (big) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-stone-line bg-white px-4 py-3 shadow-[0_1px_2px_rgba(17,49,36,0.04)]">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-forest/10 text-forest"><Calendar size={18} /></span>
        <div className="min-w-[12rem] flex-1">
          <p className="text-sm font-semibold text-charcoal">Συνδέστε το Google Calendar σας</p>
          <p className="text-xs text-charcoal-600/75">Οι ξεναγήσεις και τα ραντεβού σας μπαίνουν αυτόματα στο ημερολόγιό σας. Συνδέεται μόνο το δικό σας.</p>
        </div>
        <a href="/api/google/connect" className="btn-primary inline-flex w-full items-center justify-center gap-1.5 sm:w-auto"><Calendar size={15} /> Σύνδεση με Google Calendar</a>
      </div>
    );
  }
  return (
    <a href="/api/google/connect" className="flex items-center gap-1.5 rounded-lg border border-forest/30 bg-white px-3 py-1.5 text-xs font-medium text-forest shadow-soft hover:bg-forest/[0.05]">
      <Calendar size={13} /> Σύνδεση με Google Calendar
    </a>
  );
}
