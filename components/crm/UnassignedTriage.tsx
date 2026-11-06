'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Inbox, UserPlus } from 'lucide-react';
import { reassignLead } from '@/app/actions/leads';

export interface TriageLead { id: string; name: string; source: string; ageMinutes: number }

const SOURCE_LABEL: Record<string, string> = {
  website: 'Website', meta: 'Meta', google: 'Google', organic: 'Organic', referral: 'Referral',
  whatsapp: 'WhatsApp', instagram: 'Instagram', facebook: 'Facebook', walk_in: 'Walk-in', other: 'Other',
};

function age(m: number): string {
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
}

/**
 * "Needs an owner" rail — surfaces leads nobody owns so they can't slip. Each
 * one assigns in a single click (to me, or any agent), and drops off the rail
 * immediately (optimistic). Self-gates to nothing when every lead has an owner.
 */
export function UnassignedTriage({ leads, agents, currentUserId }: { leads: TriageLead[]; agents: { id: string; full_name: string | null }[]; currentUserId: string }) {
  const [items, setItems] = useState(leads);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  if (items.length === 0) return null;

  function assign(leadId: string, agentId: string) {
    if (!agentId) return;
    setPendingId(leadId);
    setItems((prev) => prev.filter((l) => l.id !== leadId));
    startTransition(async () => { await reassignLead(leadId, agentId); router.refresh(); });
  }

  return (
    <section className="rounded-md border border-champagne/50 bg-champagne-50/50 p-5">
      <div className="mb-1 flex items-center gap-2">
        <Inbox size={16} className="text-champagne-600" strokeWidth={1.85} />
        <h4 className="text-charcoal">Needs an owner</h4>
        <span className="badge-champagne">{items.length}</span>
      </div>
      <p className="mb-3 text-xs text-charcoal-600/65">New leads with no one assigned — give each an owner so someone picks up the first contact.</p>
      <ul className="space-y-2">
        {items.map((l) => {
          const overdue = l.ageMinutes >= 60; // past the speed-to-lead window
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded border border-stone-line bg-white px-4 py-2.5">
              <div className="min-w-0">
                <Link href={`/crm/leads/${l.id}`} className="font-medium text-forest hover:underline">{l.name}</Link>
                <p className="text-xs text-charcoal-600/60">
                  {SOURCE_LABEL[l.source] ?? l.source} · <span className={overdue ? 'text-signal-danger' : ''}>waiting {age(l.ageMinutes)}</span>
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  disabled={pendingId === l.id}
                  onClick={() => assign(l.id, currentUserId)}
                  className="inline-flex items-center gap-1.5 rounded-md bg-forest px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-forest-deep disabled:opacity-50"
                >
                  <UserPlus size={12} strokeWidth={2.1} /> Take it
                </button>
                <select
                  defaultValue=""
                  disabled={pendingId === l.id}
                  onChange={(e) => assign(l.id, e.target.value)}
                  className="rounded-md border border-stone-line bg-white px-2 py-1.5 text-xs text-charcoal-600 focus:border-forest focus:outline-none"
                  aria-label="Assign to agent"
                >
                  <option value="" disabled>Assign to…</option>
                  {agents.filter((a) => a.id !== currentUserId).map((a) => (
                    <option key={a.id} value={a.id}>{a.full_name ?? 'Agent'}</option>
                  ))}
                </select>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
