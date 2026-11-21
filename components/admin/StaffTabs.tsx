'use client';

import { Users, Handshake, ShieldCheck, Plane } from 'lucide-react';
import { HubCards } from '@/components/ui/HubCards';
import { WorkspaceHeader } from '@/components/ui/WorkspaceHeader';

/** Staff (όπως στο FitnessCRM): κάρτες Υπάλληλοι · Ιδιοκτήτες & συνεργάτες · Ρόλοι · Άδειες. */
export function StaffTabs({ active, counts = {} }: { active: 'employees' | 'external' | 'roles' | 'leave'; counts?: Partial<Record<string, number>> }) {
  return (
    <div className="space-y-5">
    <WorkspaceHeader eyebrow="Admin" title="Staff" description="Υπάλληλοι, ιδιοκτήτες & συνεργάτες, ρόλοι και άδειες από ένα σημείο." />
    <HubCards active={active} cards={[
      { key: 'employees', icon: Users, title: 'Υπάλληλοι', value: counts.employees, sub: 'Ομάδα, ρόλοι και πρόσβαση', href: '/settings/users' },
      { key: 'external', icon: Handshake, title: 'Ιδιοκτήτες & συνεργάτες', value: counts.external, sub: 'Λογαριασμοί εκτός ομάδας', href: '/settings/users?tab=external' },
      { key: 'roles', icon: ShieldCheck, title: 'Ρόλοι', value: counts.roles, sub: 'Τι βλέπει και τι αλλάζει ο κάθε ρόλος', href: '/settings/roles' },
      { key: 'leave', icon: Plane, title: 'Άδειες', value: counts.leave, sub: 'Αιτήματα, εγκρίσεις και υπόλοιπα', href: '/settings/users?tab=leave' },
    ]} />
    </div>
  );
}
