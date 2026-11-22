import { BrandMark } from './BrandMark';
import { NavItem } from './NavItem';
import { NavGroup, type NavSubItem } from './NavGroup';
import type { LucideIcon } from 'lucide-react';

export interface SidebarSection {
  label?: string;
  items: { href: string; label: string; icon: LucideIcon; children?: NavSubItem[] }[];
}

/**
 * Single sidebar shell shared by the internal workbench and every portal
 * surface — only the nav sections and footer slot differ per role. Deep
 * forest background carries the brand's architectural weight; the
 * champagne rule on the active item is the only accent color in the rail.
 */
export function Sidebar({
  sections,
  footer,
  compact = false,
  accordion = true,
  className = '',
}: {
  sections: SidebarSection[];
  footer?: React.ReactNode;
  compact?: boolean;
  accordion?: boolean;
  className?: string;
}) {
  // Όλες οι διευθύνσεις του μενού: ενεργό είναι μόνο το πιο συγκεκριμένο (π.χ. «Τιμολόγια», όχι και «Οικονομικά»).
  const allHrefs = sections.flatMap((s) => s.items.flatMap((it) => [it.href, ...((it.children ?? []) as { href: string }[]).map((c) => c.href)])).map((h) => h.split('?')[0]);
  return (
    <aside className={`${className} sticky top-0 flex h-screen shrink-0 flex-col self-start [background:var(--sidebar-bg)] border-r border-[color:var(--sb-line)] py-4 ${compact ? 'w-[72px] px-2' : 'w-56 px-3'}`}>
      <div className={`pb-5 ${compact ? 'flex justify-center' : 'px-2'}`}>
        <span className="sb-logo-on-dark"><BrandMark tone="light" compact={compact} /></span>
        <span className="sb-logo-on-light"><BrandMark tone="dark" compact={compact} /></span>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && !compact && (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-[color:var(--sb-label)]">
                {section.label}
              </p>
            )}
            {section.label && compact && i > 0 && <div className="mx-auto mb-2 h-px w-6 bg-[color:var(--sb-line)]" />}
            <div className="space-y-px">
              {section.items.map((item) =>
                // Render the icon to an element here (server side) so only a
                // serializable ReactNode — not the component function — crosses
                // into the client NavItem / NavGroup.
                item.children && item.children.length > 0 ? (
                  <NavGroup key={item.href} href={item.href} label={item.label} icon={<item.icon size={16} strokeWidth={1.75} />} items={item.children} compact={compact} accordion={accordion} />
                ) : (
                  <NavItem key={item.href} href={item.href} label={item.label} icon={<item.icon size={16} strokeWidth={1.75} />} compact={compact} others={allHrefs} />
                )
              )}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-[color:var(--sb-line)] pt-3">{footer}</div>}
    </aside>
  );
}
