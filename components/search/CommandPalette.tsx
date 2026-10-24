'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, CornerDownLeft, LayoutDashboard, Users, Map, Megaphone, Home, TrendingUp, UserCog,
  ClipboardList, Calculator, FileBarChart, Command, Settings, Workflow, MessageSquare,
  UserPlus, MapPin, FolderKanban, CheckSquare, Plus,
} from 'lucide-react';

interface PaletteCmd { id: string; label: string; hint?: string; icon: any; href: string; keywords?: string }

// Navigation + quick actions — always available, filtered by the query text.
const COMMANDS: PaletteCmd[] = [
  { id: 'nav-dash', label: 'My Workspace', icon: LayoutDashboard, href: '/dashboard', keywords: 'home dashboard' },
  { id: 'nav-sales', label: 'Sales', icon: Users, href: '/crm/leads', keywords: 'crm leads pipeline' },
  { id: 'nav-acq', label: 'Acquisitions', icon: Map, href: '/acquisitions', keywords: 'land parcels map' },
  { id: 'nav-mkt', label: 'Marketing', icon: Megaphone, href: '/marketing', keywords: 'campaigns ads' },
  { id: 'nav-prop', label: 'Property', icon: Home, href: '/property', keywords: 'projects owners maintenance' },
  { id: 'nav-fin', label: 'Finance', icon: TrendingUp, href: '/financials', keywords: 'cashflow revenue' },
  { id: 'nav-hr', label: 'HR', icon: UserCog, href: '/hr', keywords: 'employees payroll leave' },
  { id: 'nav-ops', label: 'Operations', icon: ClipboardList, href: '/operations', keywords: 'tasks notifications' },
  { id: 'nav-deal', label: 'Deal Analyzer', icon: Calculator, href: '/deal-analyzer', keywords: 'roi scenario' },
  { id: 'nav-reports', label: 'Reports & Intelligence', icon: FileBarChart, href: '/reports', keywords: 'board investor knowledge memory' },
  { id: 'nav-cc', label: 'Command Center', icon: Command, href: '/command-center', keywords: 'priorities risks' },
  { id: 'nav-auto', label: 'Automations', icon: Workflow, href: '/automation', keywords: 'jobs cron' },
  { id: 'nav-templates', label: 'Templates', icon: MessageSquare, href: '/settings/templates', keywords: 'messages' },
  { id: 'nav-users', label: 'Users', icon: Users, href: '/settings/users', keywords: 'team roles' },
  { id: 'nav-settings', label: 'Settings', icon: Settings, href: '/settings' },
  { id: 'act-lead', label: 'New lead', hint: 'Create', icon: UserPlus, href: '/crm/leads?new=lead', keywords: 'create add' },
  { id: 'act-parcel', label: 'Add parcel', hint: 'Create', icon: MapPin, href: '/acquisitions?new=parcel', keywords: 'create land acquisition' },
  { id: 'act-project', label: 'New project', hint: 'Create', icon: FolderKanban, href: '/projects?new=project', keywords: 'create development' },
  { id: 'act-task', label: 'New task', hint: 'Create', icon: CheckSquare, href: '/dashboard', keywords: 'create todo' },
];

import { globalSearch, type SearchHit } from '@/app/actions/search';

const HIT_ICON: Record<SearchHit['type'], any> = { lead: Users, parcel: MapPin, project: FolderKanban, task: CheckSquare };

/** ⌘K command palette — navigate anywhere, run quick actions, and search leads,
 *  parcels, projects and tasks. Opened by ⌘/Ctrl-K or the topbar search field. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [, startSearch] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Global open shortcut + topbar trigger event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen((o) => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('open-command-palette', onOpen); };
  }, []);

  useEffect(() => { if (open) { setQ(''); setSel(0); setHits([]); setTimeout(() => inputRef.current?.focus(), 20); } }, [open]);

  // Debounced entity search.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => { const query = q; startSearch(async () => { setHits(await globalSearch(query)); }); }, 160);
    return () => clearTimeout(t);
  }, [q, open]);

  const cmds = COMMANDS.filter((c) => { const s = `${c.label} ${c.keywords ?? ''}`.toLowerCase(); return !q.trim() || s.includes(q.toLowerCase().trim()); }).slice(0, 8);
  const items = [...cmds.map((c) => ({ kind: 'cmd' as const, c })), ...hits.map((h) => ({ kind: 'hit' as const, h }))];
  const go = (href: string) => { setOpen(false); router.push(href); };

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const it = items[sel]; if (it) go(it.kind === 'cmd' ? it.c.href : it.h.href); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-charcoal/25 p-4 pt-[12vh] backdrop-blur-[2px]" onClick={() => setOpen(false)}>
      <div className="ws-pop w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_70px_rgba(31,77,58,0.28)] ring-1 ring-forest/10" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2.5 border-b border-stone-line px-4">
          <Search size={16} className="shrink-0 text-forest/70" />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onListKey} placeholder="Search or jump to…" className="w-full bg-transparent py-3.5 text-[15px] text-charcoal placeholder:text-charcoal-600/40 focus:outline-none" />
          <kbd className="shrink-0 rounded-md bg-sand-100 px-1.5 py-0.5 text-[10px] font-medium text-charcoal-600/55">ESC</kbd>
        </div>

        <div className="max-h-[52vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-charcoal-600/50">{q.trim().length >= 2 ? 'No matches.' : 'Type to search leads, parcels, projects, tasks — or jump to a workspace.'}</p>
          ) : (
            <>
              {cmds.length > 0 && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal-600/40">Jump to</p>}
              {items.map((it, i) => {
                const active = i === sel;
                const Icon = it.kind === 'cmd' ? it.c.icon : HIT_ICON[it.h.type];
                const label = it.kind === 'cmd' ? it.c.label : it.h.label;
                const hint = it.kind === 'cmd' ? it.c.hint : it.h.sublabel;
                const href = it.kind === 'cmd' ? it.c.href : it.h.href;
                const showResultsHeader = it.kind === 'hit' && (i === 0 || items[i - 1].kind === 'cmd');
                return (
                  <div key={`${it.kind}-${i}`}>
                    {showResultsHeader && <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-charcoal-600/40">Results</p>}
                    <button
                      onMouseEnter={() => setSel(i)} onClick={() => go(href)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${active ? 'bg-forest/[0.07]' : 'hover:bg-sand-100/60'}`}
                    >
                      <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${active ? 'bg-forest text-white' : 'bg-sand-100 text-forest'}`}>
                        {it.kind === 'cmd' && it.c.hint === 'Create' ? <Plus size={14} /> : <Icon size={14} />}
                      </span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-[14px] text-charcoal">{label}</span></span>
                      {hint && <span className="shrink-0 text-[11px] text-charcoal-600/45">{hint}</span>}
                      {active && <CornerDownLeft size={13} className="shrink-0 text-charcoal-600/40" />}
                    </button>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
