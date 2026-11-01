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
}: {
  sections: SidebarSection[];
  footer?: React.ReactNode;
  compact?: boolean;
  accordion?: boolean;
}) {
  return (
    <aside className={`sticky top-0 flex h-screen shrink-0 flex-col self-start [background:var(--sidebar-bg)] py-4 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] ${compact ? 'w-[72px] px-2' : 'w-56 px-3'}`}>
      <div className={`pb-5 ${compact ? 'flex justify-center' : 'px-2'}`}>
        <BrandMark tone="light" compact={compact} />
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
        {sections.map((section, i) => (
          <div key={i}>
            {section.label && !compact && (
              <p className="mb-1 flex items-center gap-2 px-3 text-[10px] font-medium uppercase tracking-eyebrow text-stone-100/30">
                {section.label}
                <span className="h-px flex-1 bg-white/[0.06]" />
              </p>
            )}
            {section.label && compact && i > 0 && <div className="mx-auto mb-2 h-px w-6 bg-white/[0.08]" />}
            <div className="space-y-px">
              {section.items.map((item) =>
                // Render the icon to an element here (server side) so only a
                // serializable ReactNode — not the component function — crosses
                // into the client NavItem / NavGroup.
                item.children && item.children.length > 0 ? (
                  <NavGroup key={item.href} href={item.href} label={item.label} icon={<item.icon size={15} strokeWidth={1.75} />} items={item.children} compact={compact} accordion={accordion} />
                ) : (
                  <NavItem key={item.href} href={item.href} label={item.label} icon={<item.icon size={15} strokeWidth={1.75} />} compact={compact} />
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
