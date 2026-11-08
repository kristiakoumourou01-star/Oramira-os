'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Download, Megaphone, Tag } from 'lucide-react';
import { audienceCsv, tagContacts } from '@/app/actions/audience';

/** Export / retargeting για τους «Αγοραστές που ταιριάζουν». */
export function MatchAudienceActions({ contactIds, name }: { contactIds: string[]; name: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [tag, setTag] = useState(`Campaign: ${name}`);
  const save = (csv: string, file: string) => {
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; a.click(); URL.revokeObjectURL(a.href);
  };
  const slug = name.replace(/[^\w]+/g, '-').toLowerCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary text-sm" disabled={pending} onClick={() => start(async () => { const r = await audienceCsv(contactIds, 'list'); if (r.ok) { save(r.csv, `matching-${slug}.csv`); setMsg(`Export: ${r.included} επαφές.`); } else setMsg(r.error); })}><Download size={14} /> Export</button>
      <button type="button" className="btn-secondary text-sm" disabled={pending} title="Αρχείο για Meta / Google Ads (Custom Audience) — μόνο όσοι έχουν δώσει συγκατάθεση marketing"
        onClick={() => start(async () => { const r = await audienceCsv(contactIds, 'ads'); if (r.ok) { if (r.included) save(r.csv, `audience-${slug}.csv`); setMsg(`Κοινό για Meta / Google Ads: ${r.included} επαφές${r.excluded ? ` · ${r.excluded} χωρίς συγκατάθεση marketing δεν μπήκαν` : ''}.`); } else setMsg(r.error); })}><Megaphone size={14} /> Κοινό για διαφημίσεις</button>
      <button type="button" className="btn-secondary text-sm" disabled={pending} onClick={() => setTagOpen((v) => !v)}><Tag size={14} /> Tag για campaign</button>
      {tagOpen && (
        <span className="flex items-center gap-1.5">
          <input className="input h-9 w-56 py-1 text-sm" value={tag} onChange={(e) => setTag(e.target.value)} data-no-tr />
          <button type="button" className="btn-primary text-sm" disabled={pending} onClick={() => start(async () => { const r = await tagContacts(contactIds, tag); if (r.ok) { setTagOpen(false); setMsg(`Το tag «${tag}» μπήκε σε ${r.count} επαφές.`); } else setMsg(r.error); })}>Εφαρμογή</button>
        </span>
      )}
      {msg && <p className="w-full text-xs text-forest">{msg} {msg.startsWith('Το tag') && <Link href="/crm/customers" className="underline">Επαφές → φίλτρο Tag</Link>}</p>}
    </div>
  );
}
