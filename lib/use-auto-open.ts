'use client';

import { useEffect, useState } from 'react';

/**
 * Lets a create/edit modal open itself when the page is reached with a
 * `?new=<key>` query param — the mechanism behind ⌘K quick-create ("New lead"
 * from anywhere opens the form on arrival, no second click). Drop-in for the
 * usual `const [open, setOpen] = useState(false)`.
 *
 * Reads `window.location.search` on mount (client-only, so no Suspense
 * requirement) and strips the param via history.replaceState so a refresh or
 * Back navigation doesn't re-open the modal.
 */
export function useAutoOpen(key: string): [boolean, (v: boolean) => void] {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === key) {
      setOpen(true);
      params.delete('new');
      const qs = params.toString();
      window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''));
    }
  }, [key]);
  return [open, setOpen];
}
