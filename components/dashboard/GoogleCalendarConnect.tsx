'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Check, X } from 'lucide-react';
import { disconnectCalendar } from '@/app/actions/calendar';

/** Compact Google Calendar connect/disconnect control for the dashboard. */
export function GoogleCalendarConnect({ connected, configured }: { connected: boolean; configured: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!configured) {
    return <span className="flex items-center gap-1.5 text-xs text-charcoal-600/50"><Calendar size={13} /> Google Calendar not configured</span>;
  }
  if (connected) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="flex items-center gap-1.5 text-forest"><Check size={13} /> Google Calendar synced</span>
        <button onClick={() => startTransition(async () => { await disconnectCalendar(); router.refresh(); })} disabled={isPending} className="flex items-center gap-1 text-charcoal-600/60 hover:text-charcoal"><X size={12} /> Disconnect</button>
      </div>
    );
  }
  return (
    <a href="/api/google/connect" className="flex items-center gap-1.5 rounded-lg border border-forest/30 bg-white px-3 py-1.5 text-xs font-medium text-forest shadow-soft hover:bg-champagne-50">
      <Calendar size={13} /> Connect Google Calendar
    </a>
  );
}
