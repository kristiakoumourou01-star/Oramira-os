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
}: {
  sections: SidebarSection[];
  footer?: React.ReactNode;
}) {
  return (
    <aside className="sticky top-0 flex h-screen w-56 shrink-0 flex-col self-start bg-gradient-to-b from-[#0C271C] via-[#113124] to-[#153A2B] px-3 py-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
      <div className="px-2 pb-5">
        <BrandMark tone="light" />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && (
              <p className="mb-1 flex items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-eyebrow text-stone-100/30">
                {section.label}
                <span className="h-px flex-1 bg-white/[0.06]" />
              </p>
            )}
            <div className="space-y-px">
              {section.items.map((item) =>
                // Render the icon to an element here (server side) so only a
                // serializable ReactNode — not the component function — crosses
                // into the client NavItem / NavGroup.
                item.children && item.children.length > 0 ? (
                  <NavGroup key={item.href} href={item.href} label={item.label} icon={<item.icon size={15} strokeWidth={1.75} />} children={item.children} />
                ) : (
                  <NavItem key={item.href} href={item.href} label={item.label} icon={<item.icon size={15} strokeWidth={1.75} />} />
                )
              )}
            </div>
          </div>
        ))}
      </nav>
      {footer && <div className="border-t border-white/[0.07] pt-3">{footer}</div>}
    </aside>
  );
}
