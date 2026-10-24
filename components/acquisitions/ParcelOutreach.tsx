'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, MessageCircle, Mail, Users, Loader2 } from 'lucide-react';
import { logParcelContact } from '@/app/actions/acquisitions';

const CHANNELS = [
  { v: 'phone', label: 'Call', icon: Phone },
  { v: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { v: 'email', label: 'Email', icon: Mail },
  { v: 'meeting', label: 'Meeting', icon: Users },
] as const;

/** Log an outreach touch to the landowner (stamps last_contacted_at). */
export function ParcelOutreach({ parcelId, contactId }: { parcelId: string; contactId: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [channel, setChannel] = useState<'phone' | 'whatsapp' | 'email' | 'meeting'>('phone');
  const [summary, setSummary] = useState('');

  const log = () => start(async () => {
    await logParcelContact({ parcelId, contactId, channel, direction: 'outbound', summary: summary.trim() || `${channel} outreach` });
    setSummary(''); router.refresh();
  });

  return (
    <div className="panel p-6">
      <h4 className="mb-3 text-charcoal">Log outreach</h4>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {CHANNELS.map((c) => (
          <button key={c.v} onClick={() => setChannel(c.v)} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${channel === c.v ? 'bg-forest text-white' : 'bg-sand-100 text-charcoal-600/70 hover:bg-sand-100/70'}`}><c.icon size={13} /> {c.label}</button>
        ))}
      </div>
      <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={2} placeholder="What was discussed? (optional)" className="w-full rounded-lg border border-stone-line bg-white px-3 py-2 text-sm focus-visible:border-forest focus-visible:outline-none" />
      <button onClick={log} disabled={pending} className="mt-2 flex items-center gap-1.5 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white disabled:opacity-60">{pending ? <Loader2 size={15} className="animate-spin" /> : 'Log contact'}</button>
    </div>
  );
}
