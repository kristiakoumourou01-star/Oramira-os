import { Logo } from './Logo';
import { NavItem } from './NavItem';
import type { LucideIcon } from 'lucide-react';

export interface SidebarSection {
  label?: string;
  items: { href: string; label: string; icon: LucideIcon }[];
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
}: {
  sections: SidebarSection[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="flex h-screen w-64 flex-col bg-forest px-4 py-6">
      <div className="px-2 pb-8">
        <Logo tone="light" />
      </div>
      <nav className="flex-1 space-y-6">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="px-3 pb-2 text-[11px] uppercase tracking-eyebrow text-stone-100/40">
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                // Render the icon to an element here (server side) so only a
                // serializable ReactNode — not the component function — crosses
                // into the client NavItem.
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={<item.icon size={16} strokeWidth={1.75} />}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-white/10 pt-4">{footer}</div>}
    </aside>
  );
}
