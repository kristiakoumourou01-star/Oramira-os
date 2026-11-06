import { Eye, LogOut } from 'lucide-react';
import { stopImpersonation } from '@/app/actions/impersonation';

/**
 * Persistent bar shown while an admin is viewing the OS as another user. Sits
 * at the top of the content column (not over the sidebar) and is the single
 * exit back to the admin's own workspace. Rendered only when
 * profile.impersonator is set.
 */
export function ImpersonationBanner({ name, role }: { name: string | null; role: string }) {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-center gap-3 bg-champagne px-4 py-2 text-xs font-medium text-forest-deep shadow-sm">
      <Eye size={14} strokeWidth={2} />
      <span>
        Προβολή ως <strong>{name || 'χρήστη'}</strong> <span className="opacity-70">({role})</span>
      </span>
      <form action={stopImpersonation}>
        <button
          type="submit"
          className="inline-flex items-center gap-1.5 rounded-full bg-forest-deep px-3 py-1 text-[11px] font-semibold text-stone-100 transition-opacity hover:opacity-90"
        >
          <LogOut size={12} strokeWidth={2} /> Έξοδος από προβολή
        </button>
      </form>
    </div>
  );
}
