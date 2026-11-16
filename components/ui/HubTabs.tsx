'use client';

import { useEffect, useState } from 'react';
import { History, Sparkles, ScrollText as Scroll2, Users, Plane, Wallet, FileSignature, FolderOpen, Gift, BarChart3, ShieldAlert, UserPlus, Receipt, Settings, User, Lock, Bell, Palette, LayoutGrid, Building2, Mail, ListChecks, Globe, KeyRound, ScrollText, Smartphone, Inbox, TrendingUp, LineChart, Hammer, Map as MapIcon, Calculator, Home, Wrench, CalendarDays, FileText, ShieldCheck, type LucideIcon } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';

const ICONS: Record<string, LucideIcon> = { History, Sparkles, Scroll2, Users, Plane, Wallet, FileSignature, FolderOpen, Gift, BarChart3, ShieldAlert, UserPlus, Receipt, Settings, User, Lock, Bell, Palette, LayoutGrid, Building2, Mail, ListChecks, Globe, KeyRound, ScrollText, Smartphone, Inbox, TrendingUp, LineChart, Hammer, Map: MapIcon, Calculator, Home, Wrench, CalendarDays, FileText, ShieldCheck };

export interface HubTabDef { id: string; label: string; icon: string; value?: React.ReactNode; sub?: string; content: React.ReactNode }

/** Κάρτες στην κορυφή (όπως στο FitnessCRM) — το περιεχόμενο της επιλεγμένης από κάτω. Κρατά το ?tab= στη διεύθυνση. */
export function HubTabs({ tabs, initial, cols = 3 }: { tabs: HubTabDef[]; initial?: string; cols?: 2 | 3 | 4 }) {
  const [active, setActive] = useState(initial && tabs.some((t) => t.id === initial) ? initial : tabs[0]?.id);
  useEffect(() => { if (initial && tabs.some((t) => t.id === initial)) setActive(initial); }, [initial, tabs]);
  const pick = (id: string) => {
    setActive(id);
    try { const url = new URL(window.location.href); url.searchParams.set('tab', id); window.history.replaceState(null, '', url.toString()); } catch { /* */ }
  };
  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="space-y-5">
      <HubCards cols={cols} active={active} onSelect={pick} cards={tabs.map((t) => ({ key: t.id, icon: ICONS[t.icon] ?? LayoutGrid, title: t.label, value: t.value, sub: t.sub }))} />
      <div>{current?.content}</div>
    </div>
  );
}

/** Κάρτες-σύνδεσμοι (για σελίδες που αλλάζουν ενότητα με ?tab= από τον server). Τα εικονίδια δίνονται με όνομα. */
export function HubLinks({ cards, active, cols = 3 }: { cards: { key: string; icon: string; title: string; value?: React.ReactNode; sub?: string; href: string }[]; active?: string; cols?: 2 | 3 | 4 }) {
  return <HubCards cols={cols} active={active} cards={cards.map((c) => ({ ...c, icon: ICONS[c.icon] ?? LayoutGrid }))} />;
}
