import Link from 'next/link';
import { Users, Handshake, ShieldCheck, Plane } from 'lucide-react';

/** Staff (όπως στο FitnessCRM): Υπάλληλοι · Ιδιοκτήτες & συνεργάτες · Ρόλοι · Άδειες. */
export function StaffTabs({ active, counts = {} }: { active: 'employees' | 'external' | 'roles' | 'leave'; counts?: Partial<Record<string, number>> }) {
  const tabs = [
    { k: 'employees', label: 'Υπάλληλοι', href: '/settings/users', icon: Users },
    { k: 'external', label: 'Ιδιοκτήτες & συνεργάτες', href: '/settings/users?tab=external', icon: Handshake },
    { k: 'roles', label: 'Ρόλοι', href: '/settings/roles', icon: ShieldCheck },
    { k: 'leave', label: 'Άδειες', href: '/settings/users?tab=leave', icon: Plane },
  ] as const;
  return (
    <nav className="flex flex-wrap gap-1.5 rounded-2xl bg-forest/[0.06] p-1.5">
      {tabs.map((t) => {
        const on = t.k === active;
        return (
          <Link key={t.k} href={t.href} aria-current={on ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition ${on ? 'bg-forest text-white shadow-sm' : 'text-forest hover:bg-forest/10'}`}>
            <t.icon size={15} /> {t.label}
            {counts[t.k] !== undefined && <span className={`rounded-full px-1.5 text-[11px] ${on ? 'bg-white/20' : 'bg-forest/10'}`}>{counts[t.k]}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
