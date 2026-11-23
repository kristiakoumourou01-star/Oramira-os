'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings, User, Building2, Palette, LayoutGrid, LayoutDashboard, Bell, ShieldCheck, Tags, Network, ListChecks, Workflow, Zap, FileText, Globe,
  Users, KeyRound, Eye, Receipt, MessageSquare, Smartphone, Plug, Database, History, ScrollText, Sparkles, Lock, MonitorSmartphone, LifeBuoy, LogOut, Ticket, Percent, ReceiptText, CreditCard, type LucideIcon,
} from 'lucide-react';
import { PopSelect } from '@/components/ui/PopSelect';

const ICONS: Record<string, LucideIcon> = {
  settings: Settings, user: User, business: Building2, appearance: Palette, layout: LayoutGrid, dashboard: LayoutDashboard, notifications: Bell,
  security: ShieldCheck, tags: Tags, departments: Network, customerFields: ListChecks, pipelines: Workflow, leads: Zap, unitforms: FileText,
  portals: Globe, templates: FileText, automation: Workflow, users: Users, roles: KeyRound, viewas: Eye, invoices: Receipt, communication: MessageSquare,
  mobile: Smartphone, integrations: Plug, gdpr: Database, logs: History, audit: ScrollText, news: Sparkles, password: Lock, devices: MonitorSmartphone,
  help: LifeBuoy, logout: LogOut, tickets: Ticket, vat: Percent, receipts: ReceiptText, payments: CreditCard, atlas: Sparkles, otp: KeyRound, staff: Users, privacy: ShieldCheck,
};

export interface FrameItem { label: string; href: string; icon: string; sub?: string }
export interface FrameGroup { label: string; items: FrameItem[] }

/**
 * Σελίδες ρυθμίσεων όπως στο FitnessCRM: μπάνερ με εικονίδιο στην κορυφή,
 * αριστερά μενού με ομάδες και εικονίδια (το ανοιχτό γεμίζει με το χρώμα της
 * εταιρείας), δεξιά το περιεχόμενο με τίτλο ενότητας. Στο κινητό το μενού
 * γίνεται dropdown.
 */
export function SettingsFrame({ icon, title, subtitle, aside, groups, activeHref, children }: {
  icon: string; title: string; subtitle: string; aside?: React.ReactNode; groups: FrameGroup[]; activeHref: string; children: React.ReactNode;
}) {
  const router = useRouter();
  const Icon = ICONS[icon] ?? Settings;
  const all = groups.flatMap((g) => g.items.map((it) => ({ ...it, group: g.label })));
  const current = all.find((it) => it.href === activeHref);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-forest/15 bg-gradient-to-r from-forest/[0.08] via-forest/[0.03] to-white p-4 shadow-sm">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-forest text-white shadow-[0_6px_16px_-8px_rgb(var(--c-forest)/0.8)]"><Icon size={22} strokeWidth={1.8} /></span>
        <div className="min-w-[11rem] flex-1">
          <h1 className="font-display text-[22px] italic leading-tight text-charcoal sm:text-[26px]">{title}</h1>
          <p className="text-[13px] text-charcoal-600">{subtitle}</p>
        </div>
        {aside && <div className="w-full text-[13px] font-medium text-charcoal sm:w-auto">{aside}</div>}
      </div>

      <div className="lg:hidden">
        <PopSelect searchable width="w-full" ariaLabel="Ενότητα" value={activeHref} placeholder="Διαλέξτε ενότητα"
          onChange={(v) => router.push(v, { scroll: false })}
          options={all.map((it) => [it.href, `${it.group} · ${it.label}`] as [string, string])} />
      </div>

      <div className="lg:grid lg:grid-cols-[230px_minmax(0,1fr)] lg:items-start lg:gap-5">
        <nav aria-label={title} className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-[14px] border border-stone-line bg-white p-2.5 shadow-sm lg:block">
          {groups.map((g, i) => (
            <div key={g.label} className={i > 0 ? 'mt-3' : ''}>
              <p className="mb-1 px-2.5 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-charcoal-600/80">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((it) => {
                  const on = it.href === activeHref;
                  const I = ICONS[it.icon] ?? Settings;
                  return (
                    <Link key={it.href} href={it.href} scroll={false} aria-current={on ? 'page' : undefined}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[13px] transition-colors duration-150 ${on ? 'bg-forest font-medium text-white shadow-sm' : 'text-charcoal hover:bg-stone-100'}`}>
                      <I size={15} strokeWidth={1.8} className={on ? 'text-white' : 'text-charcoal-600'} />
                      <span className="truncate">{it.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div key={activeHref} className="anim-fade min-w-0 space-y-4">
          {current?.sub && <p className="text-[13px] text-charcoal-600">{current.sub}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
