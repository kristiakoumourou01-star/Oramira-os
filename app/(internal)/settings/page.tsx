import { requirePermission } from '@/lib/auth';
import Link from 'next/link';
import { Users, MessageSquare, Workflow, Palette, ScrollText, ArrowRight } from 'lucide-react';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

/** Admin settings hub. */
export default async function SettingsPage() {
  await requirePermission('users');

  const links = [
    { href: '/settings/users', icon: Users, label: 'Users & roles', hint: 'Invite staff, set roles & permissions' },
    { href: '/settings/branding', icon: Palette, label: 'Branding & appearance', hint: 'Logo, colors & fonts across the OS' },
    { href: '/settings/audit', icon: ScrollText, label: 'Audit log', hint: 'Who did what, when & from where' },
    { href: '/settings/templates', icon: MessageSquare, label: 'Message templates', hint: 'WhatsApp & email templates per audience' },
    { href: '/automation', icon: Workflow, label: 'Automations', hint: 'Cron jobs & automation runs' },
  ];

  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Admin" title="Settings" description="Users, templates, and automation configuration." />
      <div className="grid grid-cols-3 gap-4">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="panel flex items-start justify-between gap-3 p-5 transition-shadow hover:shadow-overlay">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-sand-100 text-olive"><l.icon size={16} strokeWidth={1.75} /></span>
              <div><p className="text-sm font-medium text-charcoal">{l.label}</p><p className="text-xs text-charcoal-600/60">{l.hint}</p></div>
            </div>
            <ArrowRight size={15} className="shrink-0 text-charcoal-600/40" strokeWidth={1.75} />
          </Link>
        ))}
      </div>
    </div>
  );
}
