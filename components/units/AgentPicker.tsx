'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserRound } from 'lucide-react';
import { setUnitAgent } from '@/app/actions/unit-page';

/** Υπεύθυνος πωλητής της μονάδας. */
export function AgentPicker({ unitId, projectId, agents, value, canEdit }: { unitId: string; projectId: string; agents: { id: string; name: string }[]; value: string | null; canEdit: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(value ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const name = agents.find((a) => a.id === v)?.name;
  if (!canEdit) return <p className="flex items-center gap-1.5 text-sm text-charcoal-600"><UserRound size={14} /> {name ?? 'Χωρίς υπεύθυνο'}</p>;
  return (
    <div className="flex items-center gap-2">
      <UserRound size={14} className="text-charcoal-600" />
      <select value={v} disabled={pending} onChange={(e) => {
        const nv = e.target.value; setV(nv); setErr(null);
        start(async () => { const r = await setUnitAgent(unitId, projectId, nv || null); if (r.ok) router.refresh(); else setErr(r.error); });
      }} className="input w-auto py-1 text-sm">
        <option value="">Χωρίς υπεύθυνο</option>
        {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      {err && <span className="text-xs text-signal-danger">{err}</span>}
    </div>
  );
}
