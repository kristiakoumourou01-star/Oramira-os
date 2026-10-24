'use client';

import { useEffect, useState } from 'react';

export interface TabDef {
  id: string;
  label: string;
  content: React.ReactNode;
}

/** In-page tab switcher. Server-rendered panels are passed as `content` nodes,
 *  so a single sidebar page can hold many sections without extra routes.
 *  `initial` deep-links a tab (e.g. from a sidebar sub-item via ?tab=…); when it
 *  changes (navigation), the active tab follows without a remount. */
export function Tabs({ tabs, initial }: { tabs: TabDef[]; initial?: string }) {
  const [active, setActive] = useState(initial ?? tabs[0]?.id);
  useEffect(() => { if (initial && tabs.some((t) => t.id === initial)) setActive(initial); }, [initial, tabs]);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="space-y-5">
      <nav className="flex flex-wrap gap-1 border-b border-stone-line">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActive(t.id)}
            className={`-mb-px border-b-2 px-3.5 py-2 text-sm font-medium transition-colors ${active === t.id ? 'border-forest text-forest' : 'border-transparent text-charcoal-600/70 hover:text-forest'}`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div>{current?.content}</div>
    </div>
  );
}
