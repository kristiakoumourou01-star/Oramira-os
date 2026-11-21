'use client';

import { Users, ShieldCheck, Plane } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

/** Staff (όπως στο FitnessCRM): κάρτες Μέλη · Ρόλοι · Άδειες. */
export function StaffTabs({ active, counts = {} }: { active: 'employees' | 'external' | 'roles' | 'leave'; counts?: Partial<Record<string, number>> }) {
  return (
    <div className="space-y-5">
      <WorkspaceHeader eyebrow="Admin" title="Staff" description="Η ομάδα σας, οι ρόλοι με τα δικαιώματά τους και οι άδειες." />
      <HubCards cols={3} active={active === 'external' ? 'employees' : active} cards={[
        { key: 'employees', icon: Users, title: 'Μέλη', value: counts.employees, sub: 'Ενεργά μέλη της ομάδας', href: '/settings/users' },
        { key: 'roles', icon: ShieldCheck, title: 'Ρόλοι', value: counts.roles, sub: 'Ομάδες δικαιωμάτων', href: '/settings/roles' },
        { key: 'leave', icon: Plane, title: 'Άδειες', value: counts.leave, sub: 'Αιτήματα, εγκρίσεις και υπόλοιπα', href: '/settings/users?tab=leave' },
      ]} />
    </div>
  );
}
