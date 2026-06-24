'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { createLead } from '@/app/actions/leads';

const SOURCES = ['website', 'meta', 'google', 'organic', 'referral', 'whatsapp', 'walk_in', 'other'];
const TIMELINES = ['Immediately', '0-3 months', '3-6 months', '6-12 months', '12+ months', 'Just exploring'];

export function NewLeadForm({ projects }: { projects: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await createLead({
        fullName: String(formData.get('fullName')),
        email: String(formData.get('email')),
        phone: String(formData.get('phone') || '') || undefined,
        source: String(formData.get('source')),
        budgetMin: Number(formData.get('budgetMin')) || undefined,
        budgetMax: Number(formData.get('budgetMax')) || undefined,
        preferredProjectId: String(formData.get('projectId') || '') || undefined,
        timelineToBuy: String(formData.get('timeline') || '') || undefined,
        message: String(formData.get('message') || '') || undefined,
      });
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary">
        <Plus size={15} strokeWidth={1.75} /> New lead
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-forest-deep/40 p-4">
      <div className="w-full max-w-lg rounded-md bg-white p-6 shadow-overlay">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl">New lead</h3>
          <button onClick={() => setOpen(false)} className="text-charcoal-600 hover:text-charcoal">
            <X size={18} strokeWidth={1.75} />
          </button>
        </div>
        <form action={handleSubmit} className="grid grid-cols-2 gap-3">
          <input name="fullName" required placeholder="Full name" className="input col-span-2" />
          <input name="email" type="email" required placeholder="Email" className="input col-span-2" />
          <input name="phone" placeholder="Phone" className="input" />
          <select name="source" required className="input">
            {SOURCES.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
          <input name="budgetMin" type="number" placeholder="Budget min (€)" className="input" />
          <input name="budgetMax" type="number" placeholder="Budget max (€)" className="input" />
          <select name="projectId" className="input col-span-2">
            <option value="">No specific project</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select name="timeline" defaultValue="" className="input col-span-2">
            <option value="">Timeline to buy…</option>
            {TIMELINES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <textarea name="message" placeholder="Notes / inquiry message" className="input col-span-2 min-h-[70px]" />
          <button type="submit" disabled={isPending} className="btn-primary col-span-2">
            {isPending ? 'Creating…' : 'Create lead'}
          </button>
        </form>
      </div>
    </div>
  );
}
