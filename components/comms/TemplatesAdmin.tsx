'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Mail, Check, Languages, Plus } from 'lucide-react';
import { updateTemplate, addTemplateLanguage } from '@/app/actions/communications';

export interface Template {
  id: string;
  channel: string;
  key: string;
  name: string;
  subject: string | null;
  body: string;
  is_active: boolean;
  audience?: string | null;
}

const LANG: Record<string, string> = { en: 'English', el: 'Ελληνικά', ru: 'Русский', uk: 'Українська', he: 'עברית', ar: 'العربية', zh: '中文', de: 'Deutsch', fr: 'Français' };
const ADDABLE = Object.keys(LANG);

/** Edit WhatsApp + Email templates, one card per template with a tab per
 *  language. The client's language (contact card) picks the variant; without a
 *  translation the English one is sent. Placeholders: {{name}} {{project}}
 *  {{agent}} {{date}}. */
export function TemplatesAdmin({ templates }: { templates: Template[] }) {
  const [tab, setTab] = useState<'whatsapp' | 'email'>('whatsapp');
  const shown = templates.filter((t) => t.channel === tab);
  const groups = new globalThis.Map<string, Template[]>();
  for (const t of shown) groups.set(t.key, [...(groups.get(t.key) ?? []), t]);

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
        {Array.from(groups.entries()).map(([key, list]) => <TemplateGroup key={`${tab}-${key}`} list={list} />)}
        {shown.length === 0 && <p className="text-sm text-charcoal-600/70">Κανένα πρότυπο για αυτό το κανάλι.</p>}
      </div>
    </div>
  );
}

const aud = (t: Template) => (t.audience || 'en').toLowerCase();

function TemplateGroup({ list }: { list: Template[] }) {
  const router = useRouter();
  const sorted = [...list].sort((a, b) => (aud(a) === 'en' ? -1 : aud(b) === 'en' ? 1 : aud(a).localeCompare(aud(b))));
  const [cur, setCur] = useState(sorted[0].id);
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const t = sorted.find((x) => x.id === cur) ?? sorted[0];
  const have = new Set(sorted.map(aud));
  const add = (lang: string) => start(async () => {
    const r = await addTemplateLanguage(sorted[0].id, lang);
    if (r.ok) { setAdding(false); setErr(null); router.refresh(); } else setErr(r.error);
  });

  return (
    <div className="panel p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h4 className="mr-1">{t.name.replace(/\s*\([A-Z]{2}\)$/, '')}</h4>
        <span className="badge-neutral">{t.key}</span>
        <span className="ml-auto flex flex-wrap items-center gap-1">
          <Languages size={13} className="text-charcoal-600/60" />
          {sorted.map((x) => (
            <button key={x.id} type="button" onClick={() => setCur(x.id)} title={LANG[aud(x)] ?? aud(x)}
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase ${x.id === t.id ? 'bg-forest text-white' : 'bg-sand-100 text-charcoal-600 hover:bg-sand'} ${x.is_active ? '' : 'line-through opacity-60'}`}>
              {aud(x)}
            </button>
          ))}
          {!adding
            ? <button type="button" onClick={() => setAdding(true)} className="rounded px-1.5 py-0.5 text-[11px] text-forest hover:bg-forest/10" title="Νέα μετάφραση" aria-label="Νέα μετάφραση"><Plus size={12} /></button>
            : (
              <select autoFocus disabled={pending} className="input w-auto py-0.5 text-xs" defaultValue="" onChange={(e) => e.target.value && add(e.target.value)} onBlur={() => setAdding(false)}>
                <option value="" disabled>Γλώσσα…</option>
                {ADDABLE.filter((l) => !have.has(l)).map((l) => <option key={l} value={l}>{LANG[l]}</option>)}
              </select>
            )}
        </span>
      </div>
      {err && <p className="mb-2 text-xs text-signal-danger">{err}</p>}
      <TemplateCard key={t.id} template={t} />
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
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs text-charcoal-600/70">{LANG[aud(template)] ?? aud(template)}{aud(template) === 'en' ? ' · και για όσες γλώσσες δεν έχουν μετάφραση' : ''}</span>
        <label className="flex items-center gap-1.5 text-xs text-charcoal-600/70">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ενεργό
        </label>
      </div>
      {template.channel === 'email' && (
        <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Θέμα" className="input mb-2" />
      )}
      <textarea value={body} onChange={(e) => setBody(e.target.value)} dir={['he', 'ar'].includes(aud(template)) ? 'rtl' : undefined} className="input min-h-[90px] font-mono text-xs" />
      <div className="mt-2 flex items-center justify-between">
        <p className="text-[11px] text-charcoal-600/50">Placeholders: {'{{name}} {{project}} {{agent}} {{date}}'}</p>
        <button onClick={save} disabled={isPending} className="btn-secondary text-xs">
          {saved ? <Check size={13} strokeWidth={1.75} /> : null} {isPending ? 'Αποθήκευση…' : saved ? 'Αποθηκεύτηκε' : 'Αποθήκευση'}
        </button>
      </div>
    </div>
  );
}
