'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Mail, Check } from 'lucide-react';
import { updateTemplate } from '@/app/actions/communications';

export interface Template {
  id: string;
  channel: string;
  key: string;
  name: string;
  subject: string | null;
  body: string;
  is_active: boolean;
}

/** Edit WhatsApp + Email templates. Placeholders like {{name}}, {{project}},
 *  {{agent}}, {{date}} are filled when a message is sent. */
export function TemplatesAdmin({ templates }: { templates: Template[] }) {
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const shown = templates.filter((t) => t.channel === tab);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['whatsapp', 'email'] as const).map((c) => (
          <button key={c} onClick={() => setTab(c)} className={`badge capitalize ${tab === c ? 'badge-forest' : 'badge-neutral'}`}>
            {c === 'whatsapp' ? <MessageCircle size={12} className="mr-1" strokeWidth={1.75} /> : <Mail size={12} className="mr-1" strokeWidth={1.75} />}
            {c}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {shown.map((t) => <TemplateCard key={t.id} template={t} />)}
        {shown.length === 0 && <p className="text-sm text-charcoal-600/70">No templates for this channel.</p>}
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const [subject, setSubject] = useState(template.subject ?? '');
  const [body, setBody] = useState(template.body);
  const [active, setActive] = useState(template.is_active);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function save() {
    setSaved(false);
    startTransition(async () => {
      await updateTemplate(template.id, { subject: template.channel === 'email' ? subject : null, body, isActive: active });
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="panel p-5">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h4>{template.name}</h4>
          <span className="badge-neutral">{template.key}</span>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-charcoal-600/70">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Active
        </label>
      </div>
      {template.channel === 'email' && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" className="input mb-2" />
      )}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} className="input min-h-[90px] font-mono text-xs" />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-charcoal-600/50">Placeholders: {'{{name}} {{project}} {{agent}} {{date}}'}</p>
        <button onClick={save} disabled={isPending} className="btn-secondary text-xs">
          {saved ? <Check size={13} strokeWidth={1.75} /> : null} {isPending ? 'Saving…' : saved ? 'Saved' : 'Save'}
        </button>
      </div>
    </div>
  );
}
