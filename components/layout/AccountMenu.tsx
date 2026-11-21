'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, useTransition } from 'react';
import { User, History, Ticket, LifeBuoy, Sparkles, Check, LogOut } from 'lucide-react';
import { logout } from '@/app/actions/auth';
import { setMyLocale } from '@/app/actions/locale';
import { currentLocale, LANGS, type LocalePrefs } from '@/lib/locale-shared';

const FLAG: Record<string, string> = { el: '🇬🇷', en: '🇬🇧', ru: '🇷🇺' };

/**
 * Το εικονίδιο του χρήστη πάνω δεξιά (όπως στο FitnessCRM): Πληροφορίες, Logs,
 * Tickets, FAQ, Τι νέο — γλώσσα — Αποσύνδεση. Από εδώ γίνεται η αποσύνδεση.
 */
export function AccountMenu({ name, role, internal }: { name: string; role: string; internal: boolean }) {
  const [open, setOpen] = useState(false);
  const [loc, setLoc] = useState<LocalePrefs | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { setLoc(currentLocale()); }, []);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc); };
  }, [open]);

  const links = internal
    ? [
        { href: '/account?tab=info', label: 'Πληροφορίες', icon: User },
        { href: '/account?tab=logs', label: 'Logs', icon: History },
        { href: '/account?tab=tickets', label: 'Τα tickets μου', icon: Ticket },
        { href: '/account?tab=faq', label: 'Συχνές ερωτήσεις', icon: LifeBuoy },
        { href: '/account?tab=news', label: 'Τι νέο', icon: Sparkles },
      ]
    : [{ href: '/account/password', label: 'Κωδικός', icon: User }];
  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] text-charcoal transition-colors hover:bg-forest/[0.06]';

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} title="Ο λογαριασμός μου"
        className="flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-1 transition sm:border-l sm:border-forest/10 sm:pl-3.5 sm:pr-2 hover:bg-forest/[0.04]">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-forest text-[13px] font-medium text-white shadow-[0_2px_8px_rgb(var(--c-forest)/0.25)]" data-no-tr>
          {(name || '?').charAt(0).toUpperCase()}
        </span>
        <span className="hidden text-left leading-tight lg:block">
          <span className="block text-[13px] font-medium text-charcoal" data-no-tr>{name}</span>
          <span className="block text-[11px] text-charcoal-600/60">{role}</span>
        </span>
      </button>
      {open && (
        <div role="menu" className="anim-fade absolute right-0 top-full z-50 mt-2 w-[220px] overflow-hidden rounded-xl border border-stone-line bg-white p-1 shadow-overlay">
          {links.map((l) => (
            <Link key={l.href} href={l.href} role="menuitem" onClick={() => setOpen(false)} className={item}>
              <l.icon size={14} className="text-charcoal-600" /> <span>{l.label}</span>
            </Link>
          ))}
          {loc && (
            <>
              <div className="my-1 h-px bg-stone-line" />
              {LANGS.map((l) => (
                <button key={l.value} type="button" role="menuitemradio" aria-checked={loc.lang === l.value} disabled={pending} data-no-tr
                  onClick={() => start(async () => { const r = await setMyLocale(l.value, loc.num); if (r.ok) window.location.reload(); })} className={item}>
                  <span className="w-3.5">{loc.lang === l.value && <Check size={14} className="text-forest" />}</span>
                  <span>{FLAG[l.value]}</span> <span>{l.label}</span>
                </button>
              ))}
            </>
          )}
          <div className="my-1 h-px bg-stone-line" />
          <form action={logout}>
            <button type="submit" role="menuitem" className={`${item} text-signal-danger hover:bg-rose-50`}>
              <LogOut size={14} /> <span>Αποσύνδεση</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
