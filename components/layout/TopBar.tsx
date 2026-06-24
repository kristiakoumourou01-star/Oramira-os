import { Search } from 'lucide-react';
import { NotificationBell } from '@/components/ui/NotificationBell';
import type { CurrentProfile } from '@/lib/auth';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  sales: 'Sales',
  management: 'Management',
  buyer: 'Buyer',
  homeowner: 'Homeowner',
  investor: 'Investor',
  contractor: 'Contractor',
};

/**
 * Top bar: global search (staff only — search across leads/units/contacts)
 * and the notification bell, present for every role. Quiet by design —
 * no busy toolbar, just the two things every screen actually needs.
 */
export function TopBar({ profile, showSearch = false }: { profile: CurrentProfile; showSearch?: boolean }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-stone-line bg-white px-8">
      {showSearch ? (
        <div className="flex max-w-sm items-center gap-2 rounded border border-stone-line bg-stone px-3 py-1.5 text-sm text-charcoal-600">
          <Search size={15} strokeWidth={1.75} />
          <span className="text-charcoal-600/70">Search leads, units, contacts…</span>
        </div>
      ) : (
        <div />
      )}
      <div className="flex items-center gap-4">
        <NotificationBell userId={profile.id} />
        <div className="flex items-center gap-2.5 border-l border-stone-line pl-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sand text-sm font-medium text-forest">
            {(profile.fullName ?? '?').charAt(0)}
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-charcoal">{profile.fullName ?? 'Unnamed'}</p>
            <p className="text-xs text-charcoal-600/70">{ROLE_LABEL[profile.role]}</p>
          </div>
        </div>
      </div>
    </header>
  );
}
